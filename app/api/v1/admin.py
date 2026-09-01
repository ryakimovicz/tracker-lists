from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.list import ReadingList
from app.models.library import UserLibraryItem
from app.models.social import ListReport, Comment, CommentReport

from app.models.review import MediaReview, MediaReviewReport
from pydantic import BaseModel

router = APIRouter()

@router.get("/reports", response_model=Dict[str, List[Any]])
def get_all_reports(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns lists of active reports grouped by type (media, lists, comments, reviews).
    """
    from app.models.social import MediaItemReport, BlockedMediaItem, BlockedFranchise
    media_reports = db.query(MediaItemReport).order_by(MediaItemReport.created_at.desc()).all()
    list_reports = db.query(ListReport).order_by(ListReport.created_at.desc()).all()
    comment_reports = db.query(CommentReport).order_by(CommentReport.created_at.desc()).all()
    review_reports = db.query(MediaReviewReport).order_by(MediaReviewReport.created_at.desc()).all()
    blocked_items = db.query(BlockedMediaItem).order_by(BlockedMediaItem.created_at.desc()).all()
    blocked_franchises = db.query(BlockedFranchise).order_by(BlockedFranchise.created_at.desc()).all()
    
    formatted_media = []
    for r in media_reports:
        formatted_media.append({
            "report_id": r.id,
            "item_type": r.item_type,
            "external_id": r.external_id,
            "title": r.title or "Sin título",
            "image_url": r.image_url,
            "reporter_username": r.user.username if r.user else "Unknown",
            "reason": r.reason,
            "created_at": r.created_at
        })

    formatted_blocked = []
    for b in blocked_items:
        formatted_blocked.append({
            "id": b.id,
            "item_type": b.item_type,
            "external_id": b.external_id,
            "title": b.title or "Sin título",
            "reason": b.reason,
            "created_at": b.created_at
        })

    formatted_blocked_franchises = []
    for bf in blocked_franchises:
        formatted_blocked_franchises.append({
            "id": bf.id,
            "target_type": bf.target_type,
            "target_id": bf.target_id,
            "name": bf.name,
            "item_type": bf.item_type,
            "reason": bf.reason,
            "created_at": bf.created_at
        })
        
    formatted_lists = []
    for r in list_reports:
        formatted_lists.append({
            "report_id": r.id,
            "list_id": r.list_id,
            "reporter_username": r.user.username if r.user else "Unknown",
            "reason": r.reason,
            "created_at": r.created_at
        })
        
    formatted_comments = []
    for r in comment_reports:
        formatted_comments.append({
            "report_id": r.id,
            "comment_id": r.comment_id,
            "comment_content": r.comment.content if r.comment else "[Deleted]",
            "reporter_username": r.user.username if r.user else "Unknown",
            "reason": r.reason,
            "created_at": r.created_at
        })
        
    formatted_reviews = []
    for r in review_reports:
        formatted_reviews.append({
            "report_id": r.id,
            "review_id": r.review_id,
            "review_content": r.review.content if r.review else "[Deleted]",
            "reporter_username": r.user.username if r.user else "Unknown",
            "reason": r.reason,
            "created_at": r.created_at
        })
        
    return {
        "media": formatted_media,
        "blocked_media": formatted_blocked,
        "blocked_franchises": formatted_blocked_franchises,
        "lists": formatted_lists,
        "comments": formatted_comments,
        "reviews": formatted_reviews
    }

class BanMediaRequest(BaseModel):
    item_type: str
    external_id: str
    title: str = None
    reason: str = None

@router.post("/media/ban")
def admin_ban_media(
    body: BanMediaRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.social import BlockedMediaItem, MediaItemReport
    from app.models.library import UserLibraryItem
    from app.models.list_item import ListItem
    from app.models.review import MediaReview

    try:
        # Check if already blocked
        existing = db.query(BlockedMediaItem).filter(BlockedMediaItem.external_id == body.external_id).first()
        if not existing:
            blocked = BlockedMediaItem(
                item_type=body.item_type,
                external_id=body.external_id,
                title=body.title,
                reason=body.reason or "Contenido inapropiado / explícito"
            )
            db.add(blocked)

        # Purge from all user libraries
        try:
            db.query(UserLibraryItem).filter(
                UserLibraryItem.external_id == body.external_id
            ).delete(synchronize_session=False)
        except Exception as e:
            print(f"Notice purging user_library_items: {e}")

        # Purge from all lists
        try:
            db.query(ListItem).filter(
                ListItem.external_id == body.external_id
            ).delete(synchronize_session=False)
        except Exception as e:
            print(f"Notice purging list_items: {e}")

        # Purge reviews
        try:
            db.query(MediaReview).filter(
                MediaReview.external_id == body.external_id
            ).delete(synchronize_session=False)
        except Exception as e:
            print(f"Notice purging media_reviews: {e}")

        # Delete all reports for this media
        try:
            db.query(MediaItemReport).filter(MediaItemReport.external_id == body.external_id).delete(synchronize_session=False)
        except Exception as e:
            print(f"Notice purging media_item_reports: {e}")

        db.commit()
        return {"success": True, "message": f"La obra '{body.title or body.external_id}' fue bloqueada y eliminada de todo el sistema."}
    except Exception as err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al banear obra: {str(err)}"
        )

@router.delete("/media/unban/{blocked_id}")
def admin_unban_media(
    blocked_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.social import BlockedMediaItem
    blocked = db.query(BlockedMediaItem).filter(BlockedMediaItem.id == blocked_id).first()
    if not blocked:
        raise HTTPException(status_code=404, detail="Obra bloqueada no encontrada.")
    db.delete(blocked)
    db.commit()
    return {"success": True, "message": "La obra fue desbloqueada del sistema."}

@router.get("/franchises/search")
def admin_search_franchises(
    query: str,
    item_type: str = "comic",
    current_admin: User = Depends(get_current_admin)
):
    """
    Searches sagas/volumes and publishers by name in external APIs (ComicVine)
    to allow the admin to select and ban by ID.
    """
    import urllib.request, urllib.parse, json
    from app.core.config import settings
    
    if not query or len(query.strip()) < 2:
        return []

    results = []
    if item_type in ("comic", "manga"):
        api_key = settings.COMIC_VINE_API_KEY
        if api_key:
            try:
                encoded_q = urllib.parse.quote(query.strip())
                url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume,publisher&query={encoded_q}&limit=12"
                req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
                with urllib.request.urlopen(req, timeout=7) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        for it in data.get("results", []):
                            res_type = it.get("resource_type")  # 'volume' or 'publisher'
                            img_obj = it.get("image", {})
                            img_url = img_obj.get("thumb_url") or img_obj.get("small_url") or img_obj.get("medium_url")
                            pub_name = it.get("publisher", {}).get("name") if res_type == "volume" and it.get("publisher") else None
                            
                            results.append({
                                "target_type": res_type,  # 'volume' or 'publisher'
                                "target_id": f"cv_{res_type}_{it.get('id')}",
                                "raw_id": it.get("id"),
                                "name": it.get("name") or "Sin nombre",
                                "publisher": pub_name,
                                "count_of_issues": it.get("count_of_issues") if res_type == "volume" else None,
                                "start_year": it.get("start_year"),
                                "image_url": img_url,
                                "item_type": item_type
                            })
            except Exception as e:
                print(f"Admin search franchises error: {e}")

    return results

@router.get("/franchises/resolve-from-media")
def admin_resolve_franchise_from_media(
    external_id: str,
    item_type: str = "comic",
    title: str = None,
    current_admin: User = Depends(get_current_admin)
):
    """
    Given a reported media item's external_id and title, resolves its parent Saga / Volume / Publisher
    so the admin can ban the entire franchise with one click.
    """
    import urllib.request, urllib.parse, re, json
    from app.core.config import settings

    def clean_saga_name(t: str) -> str:
        if not t:
            return ""
        clean = re.sub(r'\s*#\s*\d+.*$', '', t)
        clean = re.sub(r'\s*No\.\s*\d+.*$', '', clean, flags=re.IGNORECASE)
        clean = re.sub(r'\s*\(.*?\)', '', clean)
        clean = re.sub(r'\s*Vol(ume|\.|\s*)\s*\d+.*$', '', clean, flags=re.IGNORECASE)
        return clean.strip()

    resolved_candidates = []

    if item_type in ("comic", "manga"):
        api_key = settings.COMIC_VINE_API_KEY
        raw_issue_id = external_id.replace("cv_issue_", "").replace("cv_", "")
        
        # 1. If we have a comic issue ID, fetch the volume directly from Comic Vine API
        if api_key and raw_issue_id.isdigit():
            try:
                url = f"https://comicvine.gamespot.com/api/issue/4000-{raw_issue_id}/?api_key={api_key}&format=json"
                req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
                with urllib.request.urlopen(req, timeout=6) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        res = data.get("results", {})
                        vol = res.get("volume")
                        if vol and vol.get("id"):
                            vol_img = vol.get("image", {})
                            resolved_candidates.append({
                                "target_type": "volume",
                                "target_id": f"cv_volume_{vol.get('id')}",
                                "name": vol.get("name") or title,
                                "publisher": None,
                                "image_url": vol_img.get("thumb_url") or vol_img.get("small_url"),
                                "item_type": item_type
                            })
            except Exception as e:
                print(f"Error fetching issue volume directly: {e}")

        # 2. Fallback / supplementary: search by extracted saga name if needed
        if not resolved_candidates and title:
            extracted_name = clean_saga_name(title)
            if extracted_name and len(extracted_name) >= 2 and api_key:
                try:
                    encoded_q = urllib.parse.quote(extracted_name)
                    url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume,publisher&query={encoded_q}&limit=5"
                    req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
                    with urllib.request.urlopen(req, timeout=6) as response:
                        if response.status == 200:
                            data = json.loads(response.read().decode())
                            for it in data.get("results", []):
                                res_type = it.get("resource_type")
                                img_obj = it.get("image", {})
                                resolved_candidates.append({
                                    "target_type": res_type,
                                    "target_id": f"cv_{res_type}_{it.get('id')}",
                                    "name": it.get("name") or extracted_name,
                                    "publisher": it.get("publisher", {}).get("name") if res_type == "volume" and it.get("publisher") else None,
                                    "image_url": img_obj.get("thumb_url") or img_obj.get("small_url"),
                                    "item_type": item_type
                                })
                except Exception as e:
                    print(f"Error resolving saga name: {e}")

    # Fallback default candidate if external API returned nothing
    if not resolved_candidates and title:
        extracted_name = clean_saga_name(title)
        if extracted_name:
            resolved_candidates.append({
                "target_type": "volume",
                "target_id": f"franchise_{external_id}",
                "name": extracted_name,
                "publisher": None,
                "image_url": None,
                "item_type": item_type
            })

    return resolved_candidates

class BanFranchiseRequest(BaseModel):
    target_type: str  # 'volume', 'publisher', etc.
    target_id: str    # e.g., 'cv_volume_88907'
    name: str
    item_type: str = "comic"
    reason: str = None

@router.post("/franchises/ban")
def admin_ban_franchise(
    body: BanFranchiseRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.social import BlockedFranchise, MediaItemReport
    from app.models.library import UserLibraryItem
    from app.models.list_item import ListItem
    from app.models.review import MediaReview

    try:
        existing = db.query(BlockedFranchise).filter(
            BlockedFranchise.target_id == body.target_id
        ).first()

        if not existing:
            blocked = BlockedFranchise(
                target_type=body.target_type,
                target_id=body.target_id,
                name=body.name,
                item_type=body.item_type,
                reason=body.reason or f"Bloqueo de {body.target_type} explícito/no deseado"
            )
            db.add(blocked)

        # Purge items matching this name from library, lists, reviews and active reports
        if body.name and len(body.name.strip()) >= 3:
            name_pattern = f"%{body.name.strip()}%"
            try:
                db.query(UserLibraryItem).filter(UserLibraryItem.title.ilike(name_pattern)).delete(synchronize_session=False)
                db.query(ListItem).filter(ListItem.title.ilike(name_pattern)).delete(synchronize_session=False)
                db.query(MediaReview).filter(MediaReview.title.ilike(name_pattern)).delete(synchronize_session=False)
                # Purge all matching active media reports in one go
                db.query(MediaItemReport).filter(MediaItemReport.title.ilike(name_pattern)).delete(synchronize_session=False)
            except Exception as e:
                print(f"Notice purging matching franchise titles: {e}")

        db.commit()
        return {
            "success": True,
            "message": f"La {body.target_type} '{body.name}' ({body.target_id}) fue bloqueada. Todos sus números, entregas y reportes fueron eliminados."
        }
    except Exception as err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al banear saga/editorial: {str(err)}"
        )

@router.delete("/franchises/unban/{blocked_id}")
def admin_unban_franchise(
    blocked_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.social import BlockedFranchise
    blocked = db.query(BlockedFranchise).filter(BlockedFranchise.id == blocked_id).first()
    if not blocked:
        raise HTTPException(status_code=404, detail="Saga/editorial bloqueada no encontrada.")
    db.delete(blocked)
    db.commit()
    return {"success": True, "message": f"'{blocked.name}' fue desbloqueada exitosamente."}

@router.delete("/reports/media/{report_id}")
def admin_dismiss_media_report(
    report_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.social import MediaItemReport
    report = db.query(MediaItemReport).filter(MediaItemReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    db.delete(report)
    db.commit()
    return {"success": True, "message": "Reporte desestimado."}

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.models.library import UserLibraryItem
    from app.models.consumption import ConsumptionHistory
    from app.models.activity import UserActivityLog
    from app.models.social import Follow, Comment, CommentVote, ListVote, ListReport, CommentReport
    from app.models.review import MediaReview, MediaReviewVote, MediaReviewReport
    from app.models.addition import ListAddition, UserAdoptedAddition, AdditionVote, AdditionComment
    from app.models.saved_list import SavedList
    from app.models.item_progress import ItemProgress

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete an admin account")
        
    # 0. Cancel Dodo Payments subscription if active
    if user.dodo_subscription_id:
        try:
            import asyncio
            from app.api.v1.payments import cancel_dodo_subscription_direct
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(cancel_dodo_subscription_direct(user.dodo_subscription_id))
                else:
                    loop.run_until_complete(cancel_dodo_subscription_direct(user.dodo_subscription_id))
            except Exception:
                pass
        except Exception:
            pass

    # 1. Delete comments and review votes/reports
    db.query(CommentVote).filter(CommentVote.user_id == user_id).delete()
    db.query(CommentReport).filter(CommentReport.user_id == user_id).delete()
    db.query(Comment).filter(Comment.user_id == user_id).delete()

    db.query(ListVote).filter(ListVote.user_id == user_id).delete()
    db.query(ListReport).filter(ListReport.user_id == user_id).delete()

    db.query(MediaReviewVote).filter(MediaReviewVote.user_id == user_id).delete()
    db.query(MediaReviewReport).filter(MediaReviewReport.user_id == user_id).delete()
    db.query(MediaReview).filter(MediaReview.user_id == user_id).delete()

    # 2. Additions and votes
    db.query(AdditionVote).filter(AdditionVote.user_id == user_id).delete()
    db.query(AdditionComment).filter(AdditionComment.user_id == user_id).delete()
    db.query(UserAdoptedAddition).filter(UserAdoptedAddition.user_id == user_id).delete()
    db.query(ListAddition).filter(ListAddition.user_id == user_id).delete()

    # 3. Follows, activities, progress, library and consumptions
    db.query(Follow).filter((Follow.follower_id == user_id) | (Follow.followed_id == user_id)).delete()
    db.query(UserActivityLog).filter(UserActivityLog.user_id == user_id).delete()
    db.query(ItemProgress).filter(ItemProgress.user_id == user_id).delete()
    db.query(UserLibraryItem).filter(UserLibraryItem.user_id == user_id).delete()
    db.query(ConsumptionHistory).filter(ConsumptionHistory.user_id == user_id).delete()
    db.query(SavedList).filter(SavedList.user_id == user_id).delete()

    # 4. Delete user (cascades to owned lists)
    db.delete(user)
    db.commit()
    return None

@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_list(
    list_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reading list not found")
        
    db.delete(reading_list)
    db.commit()
    return None

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_comment(
    comment_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    db.delete(comment)
    db.commit()
    return None

@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    review = db.query(MediaReview).filter(MediaReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    db.delete(review)
    db.commit()
    return None


# -------------------------------------------------------------
# User Management Endpoints
# -------------------------------------------------------------

from datetime import datetime, timezone, timedelta
from app.api.v1.users import check_user_is_pro, trim_downgraded_user_favorites

@router.get("/users")
def admin_get_users(
    q: str = "",
    page: int = 1,
    limit: int = 50,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Search and paginate all registered users with admin and moderation metadata.
    """
    query = db.query(User)
    if q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            (User.username.ilike(search_term)) | (User.email.ilike(search_term))
        )
    
    total = query.count()
    users = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    user_ids = [u.id for u in users]
    tracker_list_ids = set()
    if user_ids:
        tracker_list_rows = db.query(UserLibraryItem.tracking_list_id).filter(
            UserLibraryItem.user_id.in_(user_ids),
            UserLibraryItem.tracking_list_id.isnot(None)
        ).all()
        tracker_list_ids = {r[0] for r in tracker_list_rows if r[0]}

    real_lists_count_by_user = {}
    if user_ids:
        all_user_lists = db.query(ReadingList.creator_id, ReadingList.id).filter(
            ReadingList.creator_id.in_(user_ids)
        ).all()
        for creator_id, list_id in all_user_lists:
            if list_id not in tracker_list_ids:
                real_lists_count_by_user[creator_id] = real_lists_count_by_user.get(creator_id, 0) + 1

    formatted_users = []
    for u in users:
        formatted_users.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "photo_url": u.photo_url,
            "banner_url": u.banner_url,
            "created_at": u.created_at,
            "is_admin": u.is_admin,
            "is_vip": bool(u.is_vip),
            "is_pro": check_user_is_pro(u),
            "is_pro_paid": bool(u.is_pro),
            "is_pro_cancelled": bool(u.is_pro_cancelled),
            "pro_expires_at": u.pro_expires_at,
            "is_suspended": bool(u.is_suspended),
            "suspended_until": u.suspended_until,
            "suspension_reason": u.suspension_reason,
            "admin_warning": u.admin_warning,
            "admin_warning_at": u.admin_warning_at,
            "lists_count": real_lists_count_by_user.get(u.id, 0),
            "profile_color": u.profile_color
        })


    return {
        "total": total,
        "page": page,
        "limit": limit,
        "users": formatted_users
    }


class ToggleVipRequest(BaseModel):
    is_vip: bool

@router.post("/users/{user_id}/vip")
def admin_toggle_vip(
    user_id: int,
    req: ToggleVipRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Los administradores ya poseen todos los beneficios y no requieren VIP.")
        
    user.is_vip = req.is_vip
    if not req.is_vip and not user.is_pro and not user.is_admin:
        trim_downgraded_user_favorites(db, user.id)
    db.commit()
    return {"message": f"User VIP status set to {req.is_vip}", "is_vip": user.is_vip, "is_pro": check_user_is_pro(user)}


class GrantProRequest(BaseModel):
    months: int = 1

@router.post("/users/{user_id}/grant-pro")
def admin_grant_pro(
    user_id: int,
    req: GrantProRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin or user.is_vip:
        raise HTTPException(
            status_code=400,
            detail="Los administradores y usuarios VIP ya poseen todos los beneficios de Premium de forma permanente."
        )
    
    if req.months <= 0:
        raise HTTPException(status_code=400, detail="Months must be greater than 0")


    now = datetime.now(timezone.utc)
    base_time = now
    if user.pro_expires_at:
        exp = user.pro_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now:
            base_time = exp
            
    user.pro_expires_at = base_time + timedelta(days=req.months * 30)
    user.is_pro = True
    db.commit()
    return {
        "message": f"Granted {req.months} month(s) of Premium",
        "pro_expires_at": user.pro_expires_at,
        "is_pro": check_user_is_pro(user)
    }


class WarnUserRequest(BaseModel):
    message: str

@router.post("/users/{user_id}/warn")
def admin_warn_user(
    user_id: int,
    req: WarnUserRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot warn an admin account")

    user.admin_warning = req.message.strip()
    user.admin_warning_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Warning sent to user", "admin_warning": user.admin_warning}


class SuspendUserRequest(BaseModel):
    duration_value: int | None = None
    duration_unit: str = "days"  # "hours", "days", "weeks", "months", "years", "permanent"
    reason: str = ""

@router.post("/users/{user_id}/suspend")
def admin_suspend_user(
    user_id: int,
    req: SuspendUserRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot suspend an admin account")

    user.is_suspended = True
    user.suspension_reason = req.reason.strip() or "Violación de las Normas de la Comunidad"
    
    now = datetime.now(timezone.utc)
    if req.duration_unit == "permanent" or req.duration_value is None or req.duration_value <= 0:
        user.suspended_until = None
    elif req.duration_unit == "hours":
        user.suspended_until = now + timedelta(hours=req.duration_value)
    elif req.duration_unit == "weeks":
        user.suspended_until = now + timedelta(weeks=req.duration_value)
    elif req.duration_unit == "months":
        user.suspended_until = now + timedelta(days=req.duration_value * 30)
    elif req.duration_unit == "years":
        user.suspended_until = now + timedelta(days=req.duration_value * 365)
    else:  # default "days"
        user.suspended_until = now + timedelta(days=req.duration_value)

    db.commit()
    return {
        "message": "User suspended successfully",
        "is_suspended": True,
        "suspended_until": user.suspended_until,
        "suspension_reason": user.suspension_reason
    }



@router.post("/users/{user_id}/unsuspend")
def admin_unsuspend_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_suspended = False
    user.suspended_until = None
    user.suspension_reason = None
    db.commit()
    return {"message": "User suspension removed", "is_suspended": False}


@router.post("/users/{user_id}/cancel-subscription")
async def admin_cancel_user_subscription(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Cancels an active subscription for a specific user (only if not admin and not VIP).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_admin:
        raise HTTPException(status_code=400, detail="No aplica para cuentas de Administradores.")
    if user.is_vip:
        raise HTTPException(status_code=400, detail="No aplica para usuarios con estatus VIP.")

    sub_id = user.dodo_subscription_id
    if sub_id:
        from app.api.v1.payments import cancel_dodo_subscription_direct
        await cancel_dodo_subscription_direct(sub_id)
        user.dodo_subscription_id = None
        user.is_pro_cancelled = True
        db.commit()
        return {
            "message": f"Suscripción de Dodo Payments cancelada con éxito para @{user.username}.",
            "is_pro": check_user_is_pro(user),
            "is_pro_cancelled": True
        }
    else:
        user.is_pro = False
        user.is_pro_cancelled = True
        user.pro_expires_at = None
        db.commit()
        return {
            "message": f"Beneficio Premium cancelado para @{user.username}.",
            "is_pro": check_user_is_pro(user),
            "is_pro_cancelled": True
        }


from sqlalchemy import text
from app.core.security import create_access_token

class ChangeUserIdRequest(BaseModel):
    new_id: int

@router.post("/users/{user_id}/change-id")
def admin_change_user_id(
    user_id: int,
    req: ChangeUserIdRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Safely migrates a user to a specific new ID in cascade across all PostgreSQL/SQLite relations.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    new_id = req.new_id
    if new_id <= 0:
        raise HTTPException(status_code=400, detail="El nuevo ID debe ser un número entero positivo mayor a 0.")

    if new_id == target_user.id:
        return {"success": True, "message": f"El usuario ya posee el ID {new_id}.", "new_id": new_id, "access_token": None}
    
    # Verify new_id is not already in use
    existing_user = db.query(User).filter(User.id == new_id).first()
    if existing_user:
        raise HTTPException(
            status_code=400, 
            detail=f"El ID {new_id} ya está en uso por el usuario @{existing_user.username} ({existing_user.email})."
        )
    
    old_id = target_user.id
    target_username = str(target_user.username)
    is_self = (current_admin.id == old_id)
    
    from sqlalchemy import inspect
    inspector = inspect(db.bind)
    existing_tables = set(inspector.get_table_names()) if db.bind else set()
    
    all_child_refs = [
        ("user_library_items", "user_id"),
        ("item_progress", "user_id"),
        ("reading_lists", "creator_id"),
        ("saved_lists", "user_id"),
        ("consumptions", "user_id"),
        ("user_activity_logs", "user_id"),
        ("list_additions", "user_id"),
        ("addition_votes", "user_id"),
        ("addition_comments", "user_id"),
        ("list_addition_votes", "user_id"),
        ("user_adopted_additions", "user_id"),
        ("list_addition_reports", "user_id"),
        ("list_reports", "user_id"),
        ("comments", "user_id"),
        ("comment_votes", "user_id"),
        ("comment_reports", "user_id"),
        ("list_votes", "user_id"),
        ("list_ratings", "user_id"),
        ("media_reviews", "user_id"),
        ("media_review_votes", "user_id"),
        ("media_review_reports", "user_id"),
        ("follows", "follower_id"),
        ("follows", "followed_id"),
    ]
    
    child_refs = [(tbl, col) for tbl, col in all_child_refs if tbl in existing_tables]
    
    is_postgres = (db.bind.dialect.name == "postgresql") if db.bind else False
    
    try:
        # Step 1: Read existing user record
        user_row = db.execute(text("SELECT * FROM users WHERE id = :old_id"), {"old_id": old_id}).mappings().first()
        if not user_row:
            raise Exception("Usuario no encontrado.")
            
        user_dict = dict(user_row)
        user_dict["id"] = new_id
        user_dict["refresh_token"] = None
        
        # Temporarily rename old user's unique fields to avoid unique constraint collisions
        temp_username = f"__tmp_{old_id}_{user_dict['username']}"
        temp_email = f"__tmp_{old_id}_{user_dict['email']}"
        db.execute(text("UPDATE users SET username = :tu, email = :te WHERE id = :old_id"), {
            "tu": temp_username,
            "te": temp_email,
            "old_id": old_id
        })
        
        # Insert cloned user with new_id and original username/email
        cols = [k for k in user_dict.keys()]
        placeholders = [f":{k}" for k in cols]
        insert_sql = f"INSERT INTO users ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
        db.execute(text(insert_sql), user_dict)
        
        # Step 2: Relink all child relations to new_id (foreign keys remain 100% valid)
        for table, col in child_refs:
            try:
                db.execute(
                    text(f"UPDATE {table} SET {col} = :new_id WHERE {col} = :old_id"),
                    {"new_id": new_id, "old_id": old_id}
                )
            except Exception as table_err:
                print(f"Notice updating {table}.{col}: {table_err}")
                
        # Step 3: Delete old temporary user row
        db.execute(text("DELETE FROM users WHERE id = :old_id"), {"old_id": old_id})
        
        # Step 4: Adjust PostgreSQL sequence if applicable
        if is_postgres:
            try:
                db.execute(text("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));"))
            except Exception:
                pass
            
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cambiar el ID: {str(e)}")


    return {
        "success": True,
        "message": f"¡El usuario @{target_username} fue cambiado al ID {new_id} exitosamente!",
        "new_id": new_id,
        "is_self": is_self
    }









