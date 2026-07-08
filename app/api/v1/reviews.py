from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.review import MediaReview, MediaReviewVote, MediaReviewReport
from app.schemas.review import MediaReviewCreate, MediaReviewResponse, ReviewReportCreate

router = APIRouter()

@router.post("/{item_type}/{external_id}", response_model=MediaReviewResponse)
def create_or_update_review(
    item_type: str,
    external_id: str,
    review_in: MediaReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item_type_lower = item_type.lower()
    valid_types = {"comic", "manga", "book", "movie", "series", "game"}
    if item_type_lower not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type. Must be one of {valid_types}"
        )

    # Check if a review already exists
    review = db.query(MediaReview).filter(
        MediaReview.user_id == current_user.id,
        MediaReview.item_type == item_type_lower,
        MediaReview.external_id == external_id
    ).first()

    if review:
        review.rating = review_in.rating
        review.content = review_in.content
        review.created_at = datetime.now(timezone.utc)
    else:
        review = MediaReview(
            user_id=current_user.id,
            item_type=item_type_lower,
            external_id=external_id,
            rating=review_in.rating,
            content=review_in.content,
            created_at=datetime.now(timezone.utc)
        )
        db.add(review)

    db.commit()
    db.refresh(review)

    # Return with mapped fields
    return MediaReviewResponse(
        id=review.id,
        user_id=review.user_id,
        username=current_user.username,
        item_type=review.item_type,
        external_id=review.external_id,
        rating=review.rating,
        content=review.content,
        created_at=review.created_at,
        vote_count=0,
        is_voted_by_me=False
    )

@router.get("/{item_type}/{external_id}", response_model=List[MediaReviewResponse])
def get_item_reviews(
    item_type: str,
    external_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    item_type_lower = item_type.lower()
    reviews = db.query(MediaReview).filter(
        MediaReview.item_type == item_type_lower,
        MediaReview.external_id == external_id
    ).offset(skip).limit(limit).all()

    response_list = []
    for r in reviews:
        votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == r.id).count()
        is_voted = False
        if current_user:
            is_voted = db.query(MediaReviewVote).filter(
                MediaReviewVote.review_id == r.id,
                MediaReviewVote.user_id == current_user.id
            ).first() is not None

        response_list.append(
            MediaReviewResponse(
                id=r.id,
                user_id=r.user_id,
                username=r.user.username if r.user else "Deleted User",
                item_type=r.item_type,
                external_id=r.external_id,
                rating=r.rating,
                content=r.content,
                created_at=r.created_at,
                vote_count=votes_count,
                is_voted_by_me=is_voted
            )
        )
    return response_list

@router.post("/{review_id}/vote")
def toggle_review_vote(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    review = db.query(MediaReview).filter(MediaReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    vote = db.query(MediaReviewVote).filter(
        MediaReviewVote.user_id == current_user.id,
        MediaReviewVote.review_id == review_id
    ).first()

    if vote:
        db.delete(vote)
        db.commit()
        return {"message": "Upvote removed", "is_voted": False}
    else:
        vote = MediaReviewVote(user_id=current_user.id, review_id=review_id)
        db.add(vote)
        db.commit()
        return {"message": "Review upvoted", "is_voted": True}

@router.post("/{review_id}/report")
def report_review(
    review_id: int,
    report_in: ReviewReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    review = db.query(MediaReview).filter(MediaReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    existing_report = db.query(MediaReviewReport).filter(
        MediaReviewReport.user_id == current_user.id,
        MediaReviewReport.review_id == review_id
    ).first()

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reported this review"
        )

    report = MediaReviewReport(
        user_id=current_user.id,
        review_id=review_id,
        reason=report_in.reason
    )
    db.add(report)
    db.commit()
    return {"message": "Review reported successfully"}
