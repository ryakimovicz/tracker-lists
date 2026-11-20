import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from dodopayments import AsyncDodoPayments
from standardwebhooks import Webhook

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_allow_suspended

from datetime import datetime, timezone
from app.models.user import User

from app.api.v1.users import trim_downgraded_user_favorites

logger = logging.getLogger(__name__)
router = APIRouter()

DODO_PRODUCT_IDS = {
    ("streaming", "monthly"): os.environ.get("DODO_PRODUCT_STREAMING", "pdt_0NqE4c0UAsxsdIbYnD6sp"),
    ("reading", "monthly"): os.environ.get("DODO_PRODUCT_READING", "pdt_0NqE4q3p8OhLRrxSfs4Wf"),
    ("premium", "monthly"): os.environ.get("DODO_PRODUCT_PREMIUM_MONTHLY", "pdt_0NsJVLl0Ryscu40GvFXXa"),
    ("premium", "annual"): os.environ.get("DODO_PRODUCT_PREMIUM_ANNUAL", "pdt_0NqE5BtFYSASvu9BDo3W9"),
}

def resolve_plan_from_product_id(product_id: str | None) -> tuple[str, str]:
    if not product_id:
        return ("premium", "monthly")
    for (tier, cycle), pid in DODO_PRODUCT_IDS.items():
        if pid == product_id:
            return (tier, cycle)
    return ("premium", "monthly")

class CreateCheckoutRequest(BaseModel):
    plan: str = "premium"  # 'streaming', 'reading', 'premium'
    billing_cycle: str = "monthly"  # 'monthly', 'annual'

def get_dodo_client() -> AsyncDodoPayments:
    api_key = settings.DODO_PAYMENTS_API_KEY or os.environ.get("DODO_PAYMENTS_API_KEY", "")
    env = settings.DODO_PAYMENTS_ENVIRONMENT or os.environ.get("DODO_PAYMENTS_ENVIRONMENT", "test_mode")
    return AsyncDodoPayments(
        bearer_token=api_key,
        environment=env
    )

@router.post("/create-checkout")
async def create_checkout_session(
    request: Request,
    payload: CreateCheckoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a Dodo Payments checkout session for the current user,
    or changes the plan on an existing active subscription.
    """
    api_key = settings.DODO_PAYMENTS_API_KEY
    plan = (payload.plan if payload else "premium").lower().strip()
    billing_cycle = (payload.billing_cycle if payload else "monthly").lower().strip()
    if plan not in ("streaming", "reading", "premium"):
        plan = "premium"
    if plan != "premium" or billing_cycle not in ("monthly", "annual"):
        billing_cycle = "monthly"

    product_id = DODO_PRODUCT_IDS.get((plan, billing_cycle)) or settings.DODO_PAYMENTS_PRODUCT_ID

    if not api_key or not product_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments service is not configured"
        )

    client = get_dodo_client()

    # If user already has an active subscription, change plan instead of creating a duplicate
    if current_user.dodo_subscription_id and current_user.is_pro and not current_user.is_pro_cancelled:
        try:
            await client.subscriptions.change_plan(
                subscription_id=current_user.dodo_subscription_id,
                product_id=product_id,
                proration_billing_mode="prorated_immediately",
                quantity=1
            )
            prev_tier = current_user.plan_tier
            current_user.plan_tier = plan
            current_user.billing_cycle = billing_cycle
            if plan != "premium":
                current_user.profile_color = None
            if plan == "reading":
                current_user.blur_unwatched_episodes = False
            if prev_tier in ("streaming", "reading") and plan in ("streaming", "reading") and prev_tier != plan:
                current_user.category_order = None
            db.commit()
            db.refresh(current_user)
            return {
                "changed_plan": True,
                "plan_tier": plan,
                "billing_cycle": billing_cycle
            }
        except Exception as e:
            logger.error(f"Error changing Dodo subscription plan: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not change subscription plan: {str(e)}"
            )

    # Determine return URL based on request origin or default to settings
    origin = request.headers.get("origin") or "https://pathd.net"
    return_url = f"{origin}/profile?payment=success"

    # Calculate trial period days if user has remaining gifted pro time
    subscription_data = {}
    if current_user.pro_expires_at and not current_user.dodo_subscription_id:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        exp = current_user.pro_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now:
            remaining_seconds = (exp - now).total_seconds()
            trial_days = max(1, int(remaining_seconds // 86400))
            subscription_data["trial_period_days"] = trial_days

    checkout_payload: dict = {
        "product_cart": [{
            "product_id": product_id,
            "quantity": 1
        }],
        "customer": {
            "email": current_user.email
        },
        "metadata": {
            "user_id": str(current_user.id),
            "username": current_user.username,
            "plan_tier": plan,
            "billing_cycle": billing_cycle
        },
        "return_url": return_url
    }

    if subscription_data:
        checkout_payload["subscription_data"] = subscription_data

    try:
        session = await client.checkout_sessions.create(**checkout_payload)
        return {
            "checkout_url": session.checkout_url,
            "session_id": session.session_id
        }
    except Exception as e:
        logger.error(f"Error creating Dodo checkout session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create checkout session: {str(e)}"
        )


class VerifyPaymentRequest(BaseModel):
    subscription_id: str | None = None
    status: str | None = None

@router.post("/verify-success")
async def verify_payment_success(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies subscription status directly with Dodo Payments API before activating Pro
    """
    sub_id = payload.subscription_id or current_user.dodo_subscription_id
    if not sub_id or not settings.DODO_PAYMENTS_API_KEY:
        # Fallback to existing state if no API key or no sub_id
        return {"status": "pending", "is_pro": current_user.is_pro, "is_pro_cancelled": current_user.is_pro_cancelled}

    client = get_dodo_client()
    try:
        sub = await client.subscriptions.retrieve(subscription_id=sub_id)
        # Check that the subscription belongs to this user's email or metadata
        sub_email = getattr(getattr(sub, 'customer', None), 'email', None)
        sub_metadata = getattr(sub, 'metadata', {}) or {}
        user_id_meta = str(sub_metadata.get('user_id', ''))
        
        matches_user = (user_id_meta == str(current_user.id)) or (sub_email and sub_email.lower() == current_user.email.lower())
        sub_status = getattr(sub, 'status', '').lower()
        
        if matches_user and sub_status in ['active', 'succeeded', 'trialing', 'on_trial']:
            tier, cycle = resolve_plan_from_product_id(getattr(sub, 'product_id', None))
            current_user.is_pro = True
            current_user.is_pro_cancelled = False
            current_user.plan_tier = tier
            current_user.billing_cycle = cycle
            current_user.dodo_subscription_id = sub_id
            next_billing = getattr(sub, 'next_billing_date', None) or getattr(sub, 'expires_at', None)
            if next_billing:
                try:
                    if isinstance(next_billing, str):
                        current_user.pro_expires_at = datetime.fromisoformat(next_billing.replace("Z", "+00:00"))
                    elif isinstance(next_billing, datetime):
                        current_user.pro_expires_at = next_billing
                except Exception:
                    pass
            db.commit()
            db.refresh(current_user)
            logger.info(f"User {current_user.username} verified and activated Pro via Dodo API (sub={sub_id})")
            return {
                "status": "success",
                "is_pro": True,
                "is_pro_cancelled": False,
                "plan_tier": current_user.plan_tier,
                "billing_cycle": current_user.billing_cycle,
                "pro_expires_at": current_user.pro_expires_at
            }
        else:
            logger.warning(f"Subscription check failed for user {current_user.username}: status={sub_status}, matches={matches_user}")
    except Exception as e:
        logger.error(f"Error validating Dodo subscription {sub_id} with API: {e}")

    return {"status": "pending", "is_pro": current_user.is_pro, "is_pro_cancelled": current_user.is_pro_cancelled, "pro_expires_at": current_user.pro_expires_at}


async def cancel_dodo_subscription_direct(subscription_id: str) -> dict | None:
    """
    Directly requests Dodo Payments to cancel a subscription at next billing date (stops renewals)
    """
    if not subscription_id or not settings.DODO_PAYMENTS_API_KEY:
        return None
    client = get_dodo_client()
    try:
        sub = await client.subscriptions.update(
            subscription_id=subscription_id,
            cancel_at_next_billing_date=True,
            cancel_reason="cancelled_by_customer"
        )
        logger.info(f"Dodo subscription {subscription_id} scheduled for cancellation at next billing date.")
        next_billing = getattr(sub, 'next_billing_date', None) or getattr(sub, 'expires_at', None)
        return {
            "subscription_id": subscription_id,
            "next_billing_date": next_billing,
            "status": getattr(sub, 'status', None)
        }
    except Exception as e:
        logger.error(f"Error cancelling Dodo subscription {subscription_id}: {e}")
        return None


@router.post("/cancel-subscription")
async def cancel_my_subscription(
    current_user: User = Depends(get_current_user_allow_suspended),
    db: Session = Depends(get_db)
):
    """
    Cancels auto-renewal of Premium subscription. Access remains active until the end of the paid period.
    """
    sub_id = current_user.dodo_subscription_id
    if sub_id:
        sub_info = await cancel_dodo_subscription_direct(sub_id)
        current_user.is_pro_cancelled = True
        if sub_info and sub_info.get("next_billing_date"):
            nb = sub_info["next_billing_date"]
            try:
                if isinstance(nb, str):
                    current_user.pro_expires_at = datetime.fromisoformat(nb.replace("Z", "+00:00"))
                elif isinstance(nb, datetime):
                    current_user.pro_expires_at = nb
            except Exception:
                pass
        db.commit()
        db.refresh(current_user)
        return {
            "message": "Tu suscripción ha sido cancelada. Mantendrás todos los beneficios Premium hasta que finalice tu período ya abonado y no se te volverá a cobrar.",
            "status": "cancelled_at_period_end",
            "is_pro_cancelled": True,
            "pro_expires_at": current_user.pro_expires_at
        }
    else:
        # If user had a manual grant or mock pro
        current_user.is_pro = False
        current_user.is_pro_cancelled = False
        current_user.pro_expires_at = None
        trim_downgraded_user_favorites(db, current_user.id)
        current_user.banner_url = None
        current_user.background_url = None
        current_user.profile_color = None
        current_user.blur_unwatched_episodes = False
        db.commit()
        return {
            "message": "Suscripción Premium cancelada con éxito.",
            "status": "cancelled",
            "is_pro_cancelled": False,
            "pro_expires_at": None
        }


@router.post("/update-payment-method")
async def update_payment_method(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Generates a Dodo Payments link to update the payment method for an active subscription."""
    if not current_user.dodo_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active Dodo Payments subscription found."
        )

    origin = request.headers.get("origin") or "https://pathd.net"
    return_url = f"{origin}/profile"

    try:
        client = get_dodo_client()
        resp = await client.subscriptions.update_payment_method(
            subscription_id=current_user.dodo_subscription_id,
            payment_method={"type": "new", "return_url": return_url}
        )
        return {"payment_link": getattr(resp, "payment_link", None)}
    except Exception as e:
        logger.error(f"Error generating payment method update link: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not generate payment method update link: {str(e)}"
        )


@router.post("/webhook")
async def dodo_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handles incoming webhook notifications from Dodo Payments
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")
    
    headers = request.headers
    webhook_secret = settings.DODO_PAYMENTS_WEBHOOK_KEY

    if webhook_secret:
        webhook_headers = {
            "webhook-id": headers.get("webhook-id", ""),
            "webhook-signature": headers.get("webhook-signature", ""),
            "webhook-timestamp": headers.get("webhook-timestamp", "")
        }
        try:
            wh = Webhook(webhook_secret)
            wh.verify(body_str, webhook_headers)
        except WebhookVerificationError as e:
            logger.error(f"Dodo webhook signature verification failed: {e}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    else:
        logger.warning("Dodo Payments webhook secret not configured. Skipping verification (dev mode only).")

    try:
        payload = json.loads(body_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event_type = payload.get("type", "")
    data = payload.get("data", {})
    
    logger.info(f"Received Dodo Payments webhook event: {event_type}")

    # Extract user identifiers from metadata, customer info, or subscription/customer IDs
    metadata = data.get("metadata", {}) or {}
    user_id = metadata.get("user_id")
    customer = data.get("customer", {}) or {}
    customer_email = customer.get("email")
    subscription_id = data.get("subscription_id") or data.get("id")
    customer_id = data.get("customer_id") or customer.get("customer_id")

    user = None
    if user_id:
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
        except (ValueError, TypeError):
            pass

    # Reliable fallback: match by stored dodo_subscription_id
    if not user and subscription_id:
        user = db.query(User).filter(User.dodo_subscription_id == str(subscription_id)).first()

    # Reliable fallback: match by stored dodo_customer_id
    if not user and customer_id:
        user = db.query(User).filter(User.dodo_customer_id == str(customer_id)).first()

    # Fallback: match by email case-insensitively
    if not user and customer_email:
        user = db.query(User).filter(User.email.ilike(customer_email.strip())).first()

    if not user:
        logger.warning(f"Webhook received for unknown user (user_id={user_id}, subscription_id={subscription_id}, customer_id={customer_id}, email={customer_email})")
        return {"status": "ignored", "reason": "User not found"}

    if subscription_id and not user.dodo_subscription_id:
        user.dodo_subscription_id = str(subscription_id)
    if customer_id and not user.dodo_customer_id:
        user.dodo_customer_id = str(customer_id)

    # Events that grant or maintain Pro / Premium
    pro_active_events = [
        "payment.succeeded",
        "subscription.active",
        "subscription.renewed",
        "subscription.unpaused",
        "subscription.plan_changed",
        "entitlement_grant.created"
    ]

    # Events that revoke Pro / Premium
    pro_revoked_events = [
        "subscription.cancelled",
        "subscription.expired",
        "subscription.failed",
        "subscription.paused",
        "subscription.on_hold",
        "entitlement_grant.revoked",
        "refund.succeeded",
        "dispute.lost",
        "dispute.accepted",
        "payment.cancelled"
    ]

    if event_type in pro_active_events:
        user.is_pro = True
        user.is_pro_cancelled = False
        product_id_hook = data.get("product_id") or ((data.get("product_cart") or [{}])[0].get("product_id") if isinstance(data.get("product_cart"), list) and len(data.get("product_cart")) > 0 else None)
        if product_id_hook:
            tier, cycle = resolve_plan_from_product_id(product_id_hook)
            user.plan_tier = tier
            user.billing_cycle = cycle
        elif metadata.get("plan_tier") in ("streaming", "reading", "premium"):
            user.plan_tier = metadata.get("plan_tier")
            user.billing_cycle = metadata.get("billing_cycle") or "monthly"
        if subscription_id:
            user.dodo_subscription_id = str(subscription_id)
        if customer_id:
            user.dodo_customer_id = str(customer_id)
        next_billing = data.get("next_billing_date")
        if next_billing:
            try:
                if isinstance(next_billing, str):
                    user.pro_expires_at = datetime.fromisoformat(next_billing.replace("Z", "+00:00"))
                elif isinstance(next_billing, datetime):
                    user.pro_expires_at = next_billing
            except Exception:
                pass
        db.commit()
        logger.info(f"User {user.username} (ID: {user.id}) upgraded/maintained Pro via webhook event: {event_type}")

    elif event_type in pro_revoked_events:
        if subscription_id and user.dodo_subscription_id and str(subscription_id) != str(user.dodo_subscription_id):
            logger.info(
                f"Ignoring {event_type} for old/different subscription {subscription_id} "
                f"(user {user.username} has active subscription {user.dodo_subscription_id})"
            )
            return {"status": "ignored", "reason": "Different subscription_id"}
        user.is_pro = False
        user.is_pro_cancelled = False
        user.plan_tier = "free"
        user.billing_cycle = None
        user.dodo_subscription_id = None
        user.pro_expires_at = None
        user.banner_url = None
        user.background_url = None
        user.profile_color = None
        user.category_order = None
        user.blur_unwatched_episodes = False
        trim_downgraded_user_favorites(db, user.id)
        db.commit()
        logger.info(f"User {user.username} (ID: {user.id}) downgraded from Pro via webhook event: {event_type}")

    elif event_type in ["subscription.updated"]:
        cancel_at_period_end = data.get("cancel_at_next_billing_date")
        if cancel_at_period_end is True:
            user.is_pro_cancelled = True
            next_billing = data.get("next_billing_date") or data.get("expires_at")
            if next_billing:
                try:
                    if isinstance(next_billing, str):
                        user.pro_expires_at = datetime.fromisoformat(next_billing.replace("Z", "+00:00"))
                    elif isinstance(next_billing, datetime):
                        user.pro_expires_at = next_billing
                except Exception:
                    pass
            db.commit()
            logger.info(f"User {user.username} marked as pro_cancelled (expires at {user.pro_expires_at}).")
        elif cancel_at_period_end is False:
            user.is_pro_cancelled = False
            db.commit()
            logger.info(f"User {user.username} renewed auto-renewal (is_pro_cancelled=False).")

    return {"status": "success", "event": event_type}
