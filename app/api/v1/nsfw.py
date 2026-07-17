from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.nsfw import MediaCoverReport, ReportStatusEnum
from app.models.list_item import ItemTypeEnum
from app.api.deps import get_current_user
from pydantic import BaseModel
from typing import List

router = APIRouter()

class NSFWReportRequest(BaseModel):
    item_type: str
    external_id: str

@router.post("/report", status_code=status.HTTP_201_CREATED)
def report_nsfw_cover(
    report_in: NSFWReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        item_type_enum = ItemTypeEnum(report_in.item_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid item type")

    # Check if already reported
    existing = db.query(MediaCoverReport).filter(
        MediaCoverReport.item_type == item_type_enum,
        MediaCoverReport.external_id == report_in.external_id,
        MediaCoverReport.reporter_id == current_user.id
    ).first()

    if existing:
        return {"message": "Already reported"}

    new_report = MediaCoverReport(
        item_type=item_type_enum,
        external_id=report_in.external_id,
        reporter_id=current_user.id,
        status=ReportStatusEnum.PENDING
    )
    db.add(new_report)
    db.commit()
    return {"message": "Reported successfully"}

@router.post("/cancel", status_code=status.HTTP_200_OK)
def cancel_nsfw_report(
    report_in: NSFWReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        item_type_enum = ItemTypeEnum(report_in.item_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid item type")

    existing = db.query(MediaCoverReport).filter(
        MediaCoverReport.item_type == item_type_enum,
        MediaCoverReport.external_id == report_in.external_id,
        MediaCoverReport.reporter_id == current_user.id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")

    db.delete(existing)
    db.commit()
    return {"message": "Report cancelled"}
