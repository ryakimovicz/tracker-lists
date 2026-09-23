from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.social import Notification
from app.schemas.social import NotificationResponse

router = APIRouter()

@router.get("/unread-count")
def get_unread_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    unread_count = db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read.is_(None)
    ).count()
    return {"unread": unread_count}

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(None))

    notifs = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for n in notifs:
        actor = db.query(User).filter(User.id == n.actor_id).first()
        results.append(
            NotificationResponse(
                id=n.id,
                recipient_id=n.recipient_id,
                actor_id=n.actor_id,
                actor_username=actor.username if actor else "Usuario",
                actor_photo_url=actor.photo_url if actor else None,
                notification_type=n.notification_type,
                entity_type=n.entity_type,
                entity_id=n.entity_id,
                extra_data_json=n.extra_data_json,
                is_read=n.is_read,
                created_at=n.created_at
            )
        )
    return results

@router.put("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notif.is_read:
        notif.is_read = datetime.now(timezone.utc)
        db.commit()

    return {"message": "Notification marked as read"}

@router.put("/read-all", status_code=status.HTTP_200_OK)
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read.is_(None)
    ).update({"is_read": now}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}", status_code=status.HTTP_200_OK)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted"}
