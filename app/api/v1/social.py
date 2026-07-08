from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem
from app.models.item_progress import ItemProgress
from app.models.social import ListVote, ListReport, Comment, CommentVote, CommentReport, Follow
from app.schemas.social import (
    CommentCreate,
    CommentResponse,
    ReportCreate,
    ActivityFeedItemResponse
)
from app.schemas.list import ReadingListResponse
from app.schemas.user import UserResponse

router = APIRouter()

# --- 1. List Votes & Reports ---

@router.post("/lists/{list_id}/vote", status_code=status.HTTP_200_OK)
def toggle_list_vote(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    vote = db.query(ListVote).filter(
        ListVote.user_id == current_user.id,
        ListVote.list_id == list_id
    ).first()
    
    if vote:
        db.delete(vote)
        db.commit()
        return {"voted": False}
    else:
        new_vote = ListVote(user_id=current_user.id, list_id=list_id)
        db.add(new_vote)
        db.commit()
        return {"voted": True}

@router.post("/lists/{list_id}/report", status_code=status.HTTP_201_CREATED)
def report_list(
    list_id: int,
    report_in: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    report = ListReport(
        user_id=current_user.id,
        list_id=list_id,
        reason=report_in.reason
    )
    db.add(report)
    db.commit()
    return {"message": "List reported successfully"}

# --- 2. List Comments & Comment Votes/Reports ---

@router.post("/lists/{list_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
    list_id: int,
    comment_in: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    new_comment = Comment(
        user_id=current_user.id,
        list_id=list_id,
        content=comment_in.content
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return CommentResponse(
        id=new_comment.id,
        user_id=new_comment.user_id,
        list_id=new_comment.list_id,
        content=new_comment.content,
        created_at=new_comment.created_at,
        creator_username=current_user.username,
        vote_count=0,
        is_voted_by_me=False
    )

@router.get("/lists/{list_id}/comments", response_model=List[CommentResponse])
def get_list_comments(
    list_id: int,
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    comments = db.query(Comment).filter(Comment.list_id == list_id).order_by(Comment.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    
    for c in comments:
        vote_count = db.query(CommentVote).filter(CommentVote.comment_id == c.id).count()
        is_voted = False
        if current_user:
            is_voted = db.query(CommentVote).filter(
                CommentVote.comment_id == c.id,
                CommentVote.user_id == current_user.id
            ).first() is not None
            
        results.append(
            CommentResponse(
                id=c.id,
                user_id=c.user_id,
                list_id=c.list_id,
                content=c.content,
                created_at=c.created_at,
                creator_username=c.user.username,
                vote_count=vote_count,
                is_voted_by_me=is_voted
            )
        )
    return results

@router.delete("/lists/{list_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    list_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.list_id == list_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    # Only list creator or comment creator can delete comments
    if comment.user_id != current_user.id and comment.reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this comment"
        )
        
    db.delete(comment)
    db.commit()
    return None

@router.post("/lists/{list_id}/comments/{comment_id}/vote", status_code=status.HTTP_200_OK)
def toggle_comment_vote(
    list_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.list_id == list_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    vote = db.query(CommentVote).filter(
        CommentVote.user_id == current_user.id,
        CommentVote.comment_id == comment_id
    ).first()
    
    if vote:
        db.delete(vote)
        db.commit()
        return {"voted": False}
    else:
        new_vote = CommentVote(user_id=current_user.id, comment_id=comment_id)
        db.add(new_vote)
        db.commit()
        return {"voted": True}

@router.post("/lists/{list_id}/comments/{comment_id}/report", status_code=status.HTTP_201_CREATED)
def report_comment(
    list_id: int,
    comment_id: int,
    report_in: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.list_id == list_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    report = CommentReport(
        user_id=current_user.id,
        comment_id=comment_id,
        reason=report_in.reason
    )
    db.add(report)
    db.commit()
    return {"message": "Comment reported successfully"}

# --- 3. Follow System ---

@router.post("/users/{user_id}/follow", status_code=status.HTTP_200_OK)
def toggle_follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot follow yourself")
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == user_id
    ).first()
    
    if follow:
        db.delete(follow)
        db.commit()
        return {"following": False}
    else:
        new_follow = Follow(follower_id=current_user.id, followed_id=user_id)
        db.add(new_follow)
        db.commit()
        return {"following": True}

@router.get("/users/{user_id}/followers", response_model=List[UserResponse])
def get_user_followers(
    user_id: int,
    db: Session = Depends(get_db)
):
    followers = db.query(User).join(Follow, Follow.follower_id == User.id).filter(
        Follow.followed_id == user_id
    ).all()
    return followers

@router.get("/users/{user_id}/following", response_model=List[UserResponse])
def get_user_following(
    user_id: int,
    db: Session = Depends(get_db)
):
    following = db.query(User).join(Follow, Follow.followed_id == User.id).filter(
        Follow.follower_id == user_id
    ).all()
    return following

# --- 4. Feeds ---

@router.get("/lists/feed/social", response_model=List[ReadingListResponse])
def get_followed_users_lists(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Retrieve public lists created by users that the current user follows
    followed_ids_query = db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id)
    lists = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        ReadingList.creator_id.in_(followed_ids_query)
    ).order_by(ReadingList.created_at.desc()).offset(skip).limit(limit).all()
    return lists

@router.get("/users/feed/activity", response_model=List[ActivityFeedItemResponse])
def get_followed_activity_feed(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch all progress completions from followed users
    followed_ids_query = db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id)
    
    # Query progress records for followed users, ordering by completion timestamp
    progress_records = db.query(ItemProgress).filter(
        ItemProgress.user_id.in_(followed_ids_query),
        ItemProgress.is_completed == True
    ).order_by(ItemProgress.completed_at.desc()).offset(skip).limit(limit).all()
    
    feed = []
    for r in progress_records:
        user = db.query(User).filter(User.id == r.user_id).first()
        item = db.query(ListItem).filter(ListItem.id == r.list_item_id).first()
        if not (user and item):
            continue
            
        reading_list = db.query(ReadingList).filter(ReadingList.id == item.list_id).first()
        list_title = reading_list.title if reading_list else "Unknown List"
        
        feed.append(
            ActivityFeedItemResponse(
                user_id=r.user_id,
                username=user.username,
                item_id=item.id,
                item_title=item.title,
                item_type=item.item_type,
                list_id=item.list_id,
                list_title=list_title,
                completed_at=r.completed_at
            )
        )
    return feed
