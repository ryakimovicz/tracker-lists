from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.list import ReadingList
from app.models.social import ListReport, Comment, CommentReport
from app.models.review import MediaReview, MediaReviewReport
from app.models.nsfw import MediaCoverReport, ReportStatusEnum
from pydantic import BaseModel

router = APIRouter()

@router.get("/reports", response_model=Dict[str, List[Any]])
def get_all_reports(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns lists of active reports grouped by type (lists, comments, reviews).
    """
    list_reports = db.query(ListReport).all()
    comment_reports = db.query(CommentReport).all()
    review_reports = db.query(MediaReviewReport).all()
    cover_reports = db.query(MediaCoverReport).all()
    
    # Format responses cleanly
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
        
    formatted_covers = []
    for r in cover_reports:
        formatted_covers.append({
            "report_id": r.id,
            "item_type": r.item_type.value if hasattr(r.item_type, 'value') else r.item_type,
            "external_id": r.external_id,
            "reporter_username": r.reporter.username if r.reporter else "Unknown",
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "created_at": r.created_at
        })
        
    return {
        "lists": formatted_lists,
        "comments": formatted_comments,
        "reviews": formatted_reviews,
        "covers": formatted_covers
    }

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete an admin account")
        
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

class CoverReportStatusUpdate(BaseModel):
    status: str

@router.put("/reports/covers/{report_id}", status_code=status.HTTP_200_OK)
def update_cover_report(
    report_id: int,
    status_update: CoverReportStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    report = db.query(MediaCoverReport).filter(MediaCoverReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Cover report not found")
        
    try:
        new_status = ReportStatusEnum(status_update.status)
        report.status = new_status
        db.commit()
        return {"message": "Report status updated"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
