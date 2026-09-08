from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.library import UserLibraryItem
from app.models.activity import UserActivityLog
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
    valid_types = {"comic", "manga", "book", "movie", "series", "game", "anime", "music", "episode"}
    if item_type_lower not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type. Must be one of {valid_types}"
        )

    # Find the title if it exists in the library, otherwise use a placeholder
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == item_type_lower,
        UserLibraryItem.external_id == external_id
    ).first()
    resolved_title = lib_item.title if lib_item else f"{item_type_lower.capitalize()} ({external_id})"

    # Handle Threaded Replies (when parent_id is provided)
    if review_in.parent_id:
        parent_rev = db.query(MediaReview).filter(
            MediaReview.id == review_in.parent_id,
            MediaReview.external_id == external_id
        ).first()
        if not parent_rev:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")

        # Ensure only 1 level of nesting: always attach reply to the top-level root comment
        curr = parent_rev
        while curr.parent_id is not None:
            root = db.query(MediaReview).filter(MediaReview.id == curr.parent_id).first()
            if not root:
                break
            curr = root
        effective_parent_id = curr.id

        reply_review = MediaReview(
            user_id=current_user.id,
            parent_id=effective_parent_id,
            item_type=item_type_lower,
            external_id=external_id,
            rating=None,
            content=review_in.content,
            created_at=datetime.now(timezone.utc)
        )
        db.add(reply_review)

        if review_in.content and review_in.content.strip():
            activity_comment = UserActivityLog(
                user_id=current_user.id,
                activity_type="item_commented",
                item_title=resolved_title,
                item_type=item_type_lower,
                details=review_in.content[:100]
            )
            db.add(activity_comment)

        db.commit()
        db.refresh(reply_review)

        return MediaReviewResponse(
            id=reply_review.id,
            user_id=reply_review.user_id,
            username=current_user.username,
            photo_url=current_user.photo_url,
            item_type=reply_review.item_type,
            external_id=reply_review.external_id,
            rating=None,
            content=reply_review.content,
            parent_id=reply_review.parent_id,
            created_at=reply_review.created_at,
            vote_count=0,
            is_voted_by_me=False
        )

    # Handle Top-Level Reviews (parent_id is None) - 1 per user per media item
    review = db.query(MediaReview).filter(
        MediaReview.user_id == current_user.id,
        MediaReview.item_type == item_type_lower,
        MediaReview.external_id == external_id,
        MediaReview.parent_id.is_(None)
    ).first()

    fields_set = review_in.model_fields_set if hasattr(review_in, 'model_fields_set') else set(getattr(review_in, '__fields_set__', []))

    if review:
        if "content" in fields_set and review.content and review_in.content and review_in.content.strip() != review.content.strip():
            # Check 30-minute editing window
            created_time = review.created_at
            if created_time.tzinfo is None:
                created_time = created_time.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - created_time).total_seconds() > 1800:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Los comentarios solo pueden editarse dentro de los primeros 30 minutos de haber sido publicados."
                )
            review.is_edited = datetime.now(timezone.utc)

        if "rating" in fields_set:
            review.rating = review_in.rating
        if "content" in fields_set:
            review.content = review_in.content
    else:
        review = MediaReview(
            user_id=current_user.id,
            parent_id=None,
            item_type=item_type_lower,
            external_id=external_id,
            rating=review_in.rating,
            content=review_in.content,
            created_at=datetime.now(timezone.utc)
        )
        db.add(review)

    if review_in.rating is not None and review_in.rating > 0:
        activity_rating = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_rated",
            item_title=resolved_title,
            item_type=item_type_lower,
            details=str(review_in.rating)
        )
        db.add(activity_rating)

    if review_in.content and review_in.content.strip():
        activity_comment = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_commented",
            item_title=resolved_title,
            item_type=item_type_lower,
            details=review_in.content[:100]
        )
        db.add(activity_comment)

    db.commit()
    db.refresh(review)

    # Return with mapped fields
    votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review.id).count()
    is_voted = db.query(MediaReviewVote).filter(
        MediaReviewVote.review_id == review.id,
        MediaReviewVote.user_id == current_user.id
    ).first() is not None

    return MediaReviewResponse(
        id=review.id,
        user_id=review.user_id,
        username=current_user.username,
        photo_url=current_user.photo_url,
        item_type=review.item_type,
        external_id=review.external_id,
        rating=review.rating,
        content=review.content,
        parent_id=review.parent_id,
        is_edited=review.is_edited,
        created_at=review.created_at,
        vote_count=votes_count,
        is_voted_by_me=is_voted
    )

@router.put("/{review_id}", response_model=MediaReviewResponse)
def edit_review_or_reply(
    review_id: int,
    review_in: MediaReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    review = db.query(MediaReview).filter(MediaReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")

    created_time = review.created_at
    if created_time.tzinfo is None:
        created_time = created_time.replace(tzinfo=timezone.utc)

    if (datetime.now(timezone.utc) - created_time).total_seconds() > 1800:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los comentarios y respuestas solo pueden editarse dentro de los primeros 30 minutos de haber sido publicados."
        )

    fields_set = review_in.model_fields_set if hasattr(review_in, 'model_fields_set') else set(getattr(review_in, '__fields_set__', []))
    if "content" in fields_set:
        review.content = review_in.content
        review.is_edited = datetime.now(timezone.utc)
    if "rating" in fields_set and review.parent_id is None:
        review.rating = review_in.rating

    db.commit()
    db.refresh(review)

    votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review.id).count()
    is_voted = db.query(MediaReviewVote).filter(
        MediaReviewVote.review_id == review.id,
        MediaReviewVote.user_id == current_user.id
    ).first() is not None

    return MediaReviewResponse(
        id=review.id,
        user_id=review.user_id,
        username=current_user.username,
        photo_url=current_user.photo_url,
        item_type=review.item_type,
        external_id=review.external_id,
        rating=review.rating,
        content=review.content,
        parent_id=review.parent_id,
        is_edited=review.is_edited,
        created_at=review.created_at,
        vote_count=votes_count,
        is_voted_by_me=is_voted
    )

@router.get("/{item_type}/{external_id}", response_model=List[MediaReviewResponse])
def get_item_reviews(
    item_type: str,
    external_id: str,
    skip: int = 0,
    limit: int = 200,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    item_type_lower = item_type.lower()
    reviews = db.query(MediaReview).filter(
        MediaReview.item_type == item_type_lower,
        MediaReview.external_id == external_id
    ).order_by(MediaReview.created_at.asc()).offset(skip).limit(limit).all()

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
                photo_url=r.user.photo_url if r.user else None,
                item_type=r.item_type,
                external_id=r.external_id,
                rating=r.rating,
                content=r.content,
                parent_id=r.parent_id,
                is_edited=r.is_edited,
                created_at=r.created_at,
                vote_count=votes_count,
                is_voted_by_me=is_voted
            )
        )
    return response_list

@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_or_comment(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    review = db.query(MediaReview).filter(MediaReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    if review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")

    # If it is a top-level review that still has a star rating, keep the rating but clear the comment text
    if review.parent_id is None and review.rating is not None and review.rating > 0:
        review.content = None
        db.commit()
    else:
        db.delete(review)
        db.commit()
    return None

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
        votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review_id).count()
        return {"message": "Upvote removed", "is_voted": False, "vote_count": votes_count}
    else:
        vote = MediaReviewVote(user_id=current_user.id, review_id=review_id)
        db.add(vote)
        db.commit()
        votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review_id).count()
        return {"message": "Review upvoted", "is_voted": True, "vote_count": votes_count}

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
