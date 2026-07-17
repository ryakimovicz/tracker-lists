from typing import List, Any
from sqlalchemy.orm import Session
from app.models.nsfw import MediaCoverReport, ReportStatusEnum
from app.services.base import SearchResultItem

def enrich_with_nsfw_status(db: Session, items: List[Any], user_id: int = None) -> List[Any]:
    if not items:
        return items

    # Collect tuples of (item_type, external_id)
    # The items could be SearchResultItem (which is a Pydantic model) or Library items.
    item_keys = set()
    for item in items:
        if isinstance(item, SearchResultItem):
            item_keys.add((item.item_type, item.external_id))
        elif hasattr(item, 'item_type') and hasattr(item, 'external_id'):
            item_keys.add((item.item_type, item.external_id))
        elif isinstance(item, dict) and 'item_type' in item and 'external_id' in item:
            item_keys.add((item.item_type, item.external_id))

    if not item_keys:
        return items
        
    # Query all reports for these items that are either globally approved OR reported by the user
    query = db.query(MediaCoverReport).filter(MediaCoverReport.status == ReportStatusEnum.APPROVED)
    
    if user_id:
        query = db.query(MediaCoverReport).filter(
            (MediaCoverReport.status == ReportStatusEnum.APPROVED) |
            ((MediaCoverReport.status == ReportStatusEnum.PENDING) & (MediaCoverReport.reporter_id == user_id)) |
            ((MediaCoverReport.status == ReportStatusEnum.REJECTED) & (MediaCoverReport.reporter_id == user_id))
        )
    
    reports = query.all()
    nsfw_set = set()
    for r in reports:
        # Check if the report matches one of our keys
        r_type = r.item_type.value if hasattr(r.item_type, 'value') else r.item_type
        if (r_type, r.external_id) in item_keys:
            nsfw_set.add((r_type, r.external_id))

    if not nsfw_set:
        return items

    # Apply the is_nsfw flag
    for item in items:
        if isinstance(item, SearchResultItem):
            if (item.item_type, item.external_id) in nsfw_set:
                item.is_nsfw = True
        elif hasattr(item, 'item_type') and hasattr(item, 'external_id'):
            if (item.item_type, item.external_id) in nsfw_set:
                setattr(item, 'is_nsfw', True)
        elif isinstance(item, dict) and 'item_type' in item and 'external_id' in item:
            if (item['item_type'], item['external_id']) in nsfw_set:
                item['is_nsfw'] = True

    return items
