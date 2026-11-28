import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.activity import UserActivityLog


class ActivityService:
    @staticmethod
    def record_activity(
        db: Session,
        user_id: int,
        activity_type: str,
        item_title: Optional[str] = None,
        item_type: Optional[str] = None,
        external_id: Optional[str] = None,
        list_id: Optional[int] = None,
        image_url: Optional[str] = None,
        details: Optional[str] = None,
        entity_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UserActivityLog:
        """
        Records an activity log. If it's a repetitive consecutive progress event for the same work
        within 24 hours, aggregates it into the existing record instead of creating a new one.
        """
        now = datetime.now(timezone.utc)
        meta_dict = metadata or {}

        # Prevent duplicate item_favorited / shelf_favorite activity logs for the same work
        if activity_type in ["item_favorited", "shelf_favorite"] and external_id is not None:
            existing_fav = (
                db.query(UserActivityLog)
                .filter(
                    UserActivityLog.user_id == user_id,
                    UserActivityLog.activity_type.in_(["item_favorited", "shelf_favorite"]),
                    UserActivityLog.external_id == str(external_id)
                )
                .order_by(desc(UserActivityLog.id))
                .first()
            )
            if existing_fav:
                existing_fav.updated_at = now
                if image_url:
                    existing_fav.image_url = image_url
                if item_title:
                    existing_fav.item_title = item_title
                db.commit()
                db.refresh(existing_fav)
                return existing_fav

        # Reactivate a previously hidden completion activity for the same work (preserves original created_at, likes & comments)
        is_completion_event = (
            activity_type in ["item_completed", "item_status_changed"]
            and external_id is not None
            and (activity_type == "item_completed" or (details or "").lower() in ["completed", "read", "watched"])
        )
        if is_completion_event:
            hidden_existing = (
                db.query(UserActivityLog)
                .filter(
                    UserActivityLog.user_id == user_id,
                    UserActivityLog.external_id == str(external_id),
                    UserActivityLog.activity_type.in_(["item_completed", "item_status_changed"]),
                    UserActivityLog.is_hidden == True
                )
                .order_by(desc(UserActivityLog.id))
                .first()
            )
            if hidden_existing:
                hidden_existing.is_hidden = False
                hidden_existing.details = details or hidden_existing.details
                hidden_existing.image_url = image_url or hidden_existing.image_url
                hidden_existing.item_title = item_title or hidden_existing.item_title
                hidden_existing.item_type = item_type or hidden_existing.item_type
                if meta_dict:
                    hidden_existing.metadata_json = json.dumps(meta_dict, ensure_ascii=False)
                hidden_existing.updated_at = now
                db.commit()
                db.refresh(hidden_existing)
                return hidden_existing

        # Check for 24h consecutive progress aggregation
        # Relevant progress activity types: item_progress, item_status_changed with progress
        is_progress_event = activity_type in ["item_progress", "item_status_changed"] and external_id is not None

        if is_progress_event:
            # Query the very last activity log for this user
            latest_log = (
                db.query(UserActivityLog)
                .filter(UserActivityLog.user_id == user_id)
                .order_by(desc(UserActivityLog.id))
                .first()
            )

            # Check if latest activity is the same item and within 24 hours
            if (
                latest_log
                and latest_log.activity_type == activity_type
                and latest_log.external_id == external_id
                and latest_log.created_at
            ):
                created_at_dt = latest_log.created_at
                if created_at_dt.tzinfo is None:
                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)

                if now - created_at_dt < timedelta(hours=24):
                    # Aggregate
                    existing_meta = {}
                    if latest_log.metadata_json:
                        try:
                            existing_meta = json.loads(latest_log.metadata_json)
                        except Exception:
                            existing_meta = {}

                    count = existing_meta.get("count", 1) + 1
                    meta_dict["count"] = count

                    # Preserve first unit / range info if helpful
                    if "initial_progress" not in existing_meta and "current_progress" in existing_meta:
                        existing_meta["initial_progress"] = existing_meta["current_progress"]

                    existing_meta.update(meta_dict)
                    existing_meta["count"] = count

                    latest_log.details = details or latest_log.details
                    latest_log.image_url = image_url or latest_log.image_url
                    latest_log.item_title = item_title or latest_log.item_title
                    latest_log.item_type = item_type or latest_log.item_type
                    latest_log.metadata_json = json.dumps(existing_meta, ensure_ascii=False)
                    latest_log.updated_at = now
                    if entity_id:
                        latest_log.entity_id = entity_id

                    db.commit()
                    db.refresh(latest_log)
                    return latest_log

        # Otherwise create new record
        meta_json_str = json.dumps(meta_dict, ensure_ascii=False) if meta_dict else None

        log_entry = UserActivityLog(
            user_id=user_id,
            activity_type=activity_type,
            item_title=item_title,
            item_type=item_type,
            external_id=external_id,
            list_id=list_id,
            image_url=image_url,
            details=details,
            entity_id=entity_id,
            metadata_json=meta_json_str,
            created_at=now,
            updated_at=now
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @staticmethod
    def delete_activity(
        db: Session,
        user_id: Optional[int] = None,
        activity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        external_id: Optional[str] = None,
        list_id: Optional[int] = None,
    ) -> int:
        """
        Deletes activity logs matching criteria to support reversible / clean states.
        """
        query = db.query(UserActivityLog)

        if user_id is not None:
            query = query.filter(UserActivityLog.user_id == user_id)
        if activity_type is not None:
            query = query.filter(UserActivityLog.activity_type == activity_type)
        if entity_id is not None:
            query = query.filter(UserActivityLog.entity_id == str(entity_id))
        if external_id is not None:
            query = query.filter(UserActivityLog.external_id == str(external_id))
        if list_id is not None:
            query = query.filter(UserActivityLog.list_id == list_id)

        count = query.delete(synchronize_session=False)
        db.commit()
        return count

    @staticmethod
    def hide_activity(
        db: Session,
        user_id: Optional[int] = None,
        activity_type: Optional[str] = None,
        activity_types: Optional[list] = None,
        external_id: Optional[str] = None,
        external_ids: Optional[list] = None,
        list_id: Optional[int] = None,
    ) -> int:
        """
        Soft-hides matching activity logs (is_hidden=True) so likes and comments are preserved
        and the same record can be reactivated with its original date if re-completed later.
        """
        query = db.query(UserActivityLog).filter(UserActivityLog.is_hidden == False)

        if user_id is not None:
            query = query.filter(UserActivityLog.user_id == user_id)
        if activity_type is not None:
            query = query.filter(UserActivityLog.activity_type == activity_type)
        if activity_types:
            query = query.filter(UserActivityLog.activity_type.in_(activity_types))
        if external_id is not None:
            query = query.filter(UserActivityLog.external_id == str(external_id))
        if external_ids:
            query = query.filter(UserActivityLog.external_id.in_([str(x) for x in external_ids]))
        if list_id is not None:
            query = query.filter(UserActivityLog.list_id == list_id)

        count = query.update({"is_hidden": True}, synchronize_session=False)
        db.commit()
        return count
