from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem
from app.models.item_progress import ItemProgress
from app.models.library import UserLibraryItem
from app.models.social import (
    ListVote, ListReport, Comment, CommentVote, CommentReport, Follow,
    Notification, ActivityLike, ActivityComment, ActivityCommentVote, FollowRequest
)
from app.models.activity import UserActivityLog
from app.services.tvmaze import TVMazeService
from app.schemas.social import (
    CommentCreate,
    CommentResponse,
    ReportCreate,
    ActivityFeedItemResponse,
    ActivityLikeToggleResponse,
    ActivityCommentCreate,
    ActivityCommentResponse,
    NotificationResponse,
    FollowRequestResponse,
    ListRatingCreate,
    ListRatingResponse
)
from app.schemas.list import ReadingListResponse
from app.schemas.user import UserResponse

router = APIRouter()
tvmaze_service = TVMazeService()

# --- 1. List Ratings, Votes & Reports ---

@router.post("/lists/{list_id}/rating", response_model=ListRatingResponse)
def rate_list(
    list_id: int,
    rating_in: ListRatingCreate,
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

    from app.services.activity_service import ActivityService

    if rating_in.rating is None or rating_in.rating <= 0:
        if vote:
            db.delete(vote)
            db.commit()
            ActivityService.delete_activity(
                db=db,
                user_id=current_user.id,
                activity_type="guide_rated",
                list_id=list_id
            )
    else:
        if vote:
            vote.rating = rating_in.rating
        else:
            vote = ListVote(user_id=current_user.id, list_id=list_id, rating=rating_in.rating)
            db.add(vote)
        
        db.commit()
        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="guide_rated",
            item_title=reading_list.title,
            item_type="guide",
            list_id=reading_list.id,
            details=str(rating_in.rating)
        )

    all_votes = db.query(ListVote).filter(ListVote.list_id == list_id, ListVote.rating != None).all()
    total = len(all_votes)
    avg = sum(v.rating for v in all_votes) / total if total > 0 else None
    
    current_user_vote = db.query(ListVote).filter(
        ListVote.user_id == current_user.id,
        ListVote.list_id == list_id
    ).first()

    return ListRatingResponse(
        user_rating=current_user_vote.rating if current_user_vote else None,
        average_rating=round(avg, 1) if avg is not None else None,
        total_ratings=total
    )

@router.get("/lists/{list_id}/rating", response_model=ListRatingResponse)
def get_list_rating(
    list_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    all_votes = db.query(ListVote).filter(ListVote.list_id == list_id, ListVote.rating != None).all()
    total = len(all_votes)
    avg = sum(v.rating for v in all_votes) / total if total > 0 else None
    
    user_rating = None
    if current_user:
        vote = db.query(ListVote).filter(
            ListVote.user_id == current_user.id,
            ListVote.list_id == list_id
        ).first()
        if vote:
            user_rating = vote.rating

    return ListRatingResponse(
        user_rating=user_rating,
        average_rating=round(avg, 1) if avg is not None else None,
        total_ratings=total
    )

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
        new_vote = ListVote(user_id=current_user.id, list_id=list_id, rating=5)
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
        
    effective_parent_id = None
    if comment_in.parent_id:
        parent_comment = db.query(Comment).filter(Comment.id == comment_in.parent_id, Comment.list_id == list_id).first()
        if not parent_comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")
        # Ensure only 1 level of nesting: always attach reply to the top-level root comment
        curr = parent_comment
        while curr.parent_id is not None:
            root = db.query(Comment).filter(Comment.id == curr.parent_id).first()
            if not root:
                break
            curr = root
        effective_parent_id = curr.id

    new_comment = Comment(
        user_id=current_user.id,
        list_id=list_id,
        parent_id=effective_parent_id,
        content=comment_in.content
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Guide comments do not generate standalone social activity cards
    
    return CommentResponse(
        id=new_comment.id,
        user_id=new_comment.user_id,
        list_id=new_comment.list_id,
        parent_id=new_comment.parent_id,
        content=new_comment.content,
        created_at=new_comment.created_at,
        creator_username=current_user.username,
        photo_url=current_user.photo_url,
        vote_count=0,
        is_voted_by_me=False
    )

@router.get("/lists/{list_id}/comments", response_model=List[CommentResponse])
def get_list_comments(
    list_id: int,
    skip: int = 0,
    limit: int = 200,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    comments = db.query(Comment).filter(Comment.list_id == list_id).order_by(Comment.created_at.asc()).offset(skip).limit(limit).all()
    results = []
    
    for c in comments:
        vote_count = db.query(CommentVote).filter(CommentVote.comment_id == c.id).count()
        is_voted = False
        if current_user:
            is_voted = db.query(CommentVote).filter(
                CommentVote.comment_id == c.id,
                CommentVote.user_id == current_user.id
            ).first() is not None
            
        is_del = bool(getattr(c, 'is_deleted', False))
        results.append(
            CommentResponse(
                id=c.id,
                user_id=c.user_id,
                list_id=c.list_id,
                parent_id=c.parent_id,
                content=None if is_del else c.content,
                is_deleted=is_del,
                created_at=c.created_at,
                creator_username="Usuario" if is_del else (c.user.username if c.user else "Unknown"),
                photo_url=None if is_del else (c.user.photo_url if c.user else None),
                vote_count=0 if is_del else vote_count,
                is_voted_by_me=False if is_del else is_voted
            )
        )
    return results

@router.delete("/lists/{list_id}/comments/{comment_id}", status_code=status.HTTP_200_OK)
def delete_comment(
    list_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.list_id == list_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    # Only list creator, comment creator or admin can delete comments
    if comment.user_id != current_user.id and comment.reading_list.creator_id != current_user.id and not getattr(current_user, 'is_admin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this comment"
        )
        
    has_replies = db.query(Comment).filter(Comment.parent_id == comment.id).count() > 0

    if has_replies:
        comment.is_deleted = True
        comment.content = None
        db.commit()
    else:
        parent_id_val = comment.parent_id
        db.delete(comment)
        db.commit()

        if parent_id_val:
            parent = db.query(Comment).filter(Comment.id == parent_id_val).first()
            if parent and getattr(parent, 'is_deleted', False):
                other_replies = db.query(Comment).filter(Comment.parent_id == parent_id_val).count()
                if other_replies == 0:
                    db.delete(parent)
                    db.commit()

    from app.services.activity_service import ActivityService
    ActivityService.delete_activity(
        db=db,
        user_id=comment.user_id,
        activity_type="guide_commented",
        entity_id=str(comment_id)
    )
    return {"message": "Comment deleted successfully", "is_deleted": has_replies}

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

# --- 3. Follow System & Requests ---

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
    
    from app.services.activity_service import ActivityService

    if follow:
        db.delete(follow)
        db.commit()
        ActivityService.delete_activity(
            db=db,
            user_id=current_user.id,
            activity_type="user_followed",
            entity_id=str(user_id)
        )
        return {"following": False, "requested": False}

    # If target is private, manage follow request
    if getattr(target_user, 'is_private', False):
        existing_req = db.query(FollowRequest).filter(
            FollowRequest.requester_id == current_user.id,
            FollowRequest.target_id == user_id
        ).first()
        if existing_req:
            db.delete(existing_req)
            db.commit()
            return {"following": False, "requested": False}
        else:
            new_req = FollowRequest(requester_id=current_user.id, target_id=user_id)
            db.add(new_req)
            # Send notification to target_user
            notif = Notification(
                recipient_id=user_id,
                actor_id=current_user.id,
                notification_type="follow_request",
                entity_type="user",
                entity_id=str(current_user.id),
                extra_data_json=f'{{"username": "{current_user.username}"}}'
            )
            db.add(notif)
            db.commit()
            return {"following": False, "requested": True}

    # Public user: direct follow
    new_follow = Follow(follower_id=current_user.id, followed_id=user_id)
    db.add(new_follow)

    # Send notification for new follower
    notif = Notification(
        recipient_id=user_id,
        actor_id=current_user.id,
        notification_type="new_follower",
        entity_type="user",
        entity_id=str(current_user.id),
        extra_data_json=f'{{"username": "{current_user.username}"}}'
    )
    db.add(notif)
    db.commit()

    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="user_followed",
        item_title=target_user.username,
        item_type="user",
        entity_id=str(user_id),
        image_url=target_user.photo_url,
        details="followed"
    )
    return {"following": True, "requested": False}

@router.post("/follow-requests/{request_id}/accept", status_code=status.HTTP_200_OK)
def accept_follow_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    freq = db.query(FollowRequest).filter(
        FollowRequest.id == request_id,
        FollowRequest.target_id == current_user.id
    ).first()
    if not freq:
        raise HTTPException(status_code=404, detail="Follow request not found")

    requester_id = freq.requester_id
    # Create Follow
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == requester_id,
        Follow.followed_id == current_user.id
    ).first()
    if not existing_follow:
        new_follow = Follow(follower_id=requester_id, followed_id=current_user.id)
        db.add(new_follow)

    # Clean up request
    db.delete(freq)

    # Send notification to the accepted requester
    notif = Notification(
        recipient_id=requester_id,
        actor_id=current_user.id,
        notification_type="new_follower",
        entity_type="user",
        entity_id=str(current_user.id),
        extra_data_json=f'{{"accepted": true, "username": "{current_user.username}"}}'
    )
    db.add(notif)
    db.commit()
    return {"message": "Follow request accepted"}

@router.post("/follow-requests/{request_id}/reject", status_code=status.HTTP_200_OK)
def reject_follow_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    freq = db.query(FollowRequest).filter(
        FollowRequest.id == request_id,
        FollowRequest.target_id == current_user.id
    ).first()
    if not freq:
        raise HTTPException(status_code=404, detail="Follow request not found")
    db.delete(freq)
    db.commit()
    return {"message": "Follow request rejected"}

@router.delete("/follow-requests/{target_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_follow_request(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    freq = db.query(FollowRequest).filter(
        FollowRequest.requester_id == current_user.id,
        FollowRequest.target_id == target_id
    ).first()
    if freq:
        db.delete(freq)
        db.commit()
    return {"message": "Follow request cancelled"}

@router.get("/follow-requests", response_model=List[FollowRequestResponse])
def get_pending_follow_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reqs = db.query(FollowRequest).filter(FollowRequest.target_id == current_user.id).order_by(FollowRequest.created_at.desc()).all()
    results = []
    for r in reqs:
        u = db.query(User).filter(User.id == r.requester_id).first()
        if u:
            results.append(FollowRequestResponse(
                id=r.id,
                requester_id=u.id,
                requester_username=u.username,
                requester_photo_url=u.photo_url,
                created_at=r.created_at
            ))
    return results

@router.get("/users/{user_id}/followers", response_model=List[UserResponse])
def get_user_followers(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and not getattr(current_user, 'is_admin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own followers and following list."
        )
    followers = db.query(User).join(Follow, Follow.follower_id == User.id).filter(
        Follow.followed_id == user_id
    ).all()
    my_following_ids = set(
        r[0] for r in db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id).all()
    )
    res = []
    for u in followers:
        f_count = db.query(Follow).filter(Follow.followed_id == u.id).count()
        fg_count = db.query(Follow).filter(Follow.follower_id == u.id).count()
        u_dict = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "created_at": u.created_at,
            "photo_url": u.photo_url,
            "is_admin": u.is_admin,
            "show_nsfw": u.show_nsfw,
            "is_pro": u.is_pro,
            "is_private": bool(getattr(u, "is_private", False)),
            "profile_color": u.profile_color,
            "lastfm_username": u.lastfm_username,
            "followers_count": f_count,
            "following_count": fg_count,
            "is_following": u.id in my_following_ids
        }
        res.append(UserResponse(**u_dict))
    return res

@router.get("/users/{user_id}/following", response_model=List[UserResponse])
def get_user_following(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and not getattr(current_user, 'is_admin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own followers and following list."
        )
    following = db.query(User).join(Follow, Follow.followed_id == User.id).filter(
        Follow.follower_id == user_id
    ).all()
    my_following_ids = set(
        r[0] for r in db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id).all()
    )
    res = []
    for u in following:
        f_count = db.query(Follow).filter(Follow.followed_id == u.id).count()
        fg_count = db.query(Follow).filter(Follow.follower_id == u.id).count()
        u_dict = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "created_at": u.created_at,
            "photo_url": u.photo_url,
            "is_admin": u.is_admin,
            "show_nsfw": u.show_nsfw,
            "is_pro": u.is_pro,
            "is_private": bool(getattr(u, "is_private", False)),
            "profile_color": u.profile_color,
            "lastfm_username": u.lastfm_username,
            "followers_count": f_count,
            "following_count": fg_count,
            "is_following": u.id in my_following_ids
        }
        res.append(UserResponse(**u_dict))
    return res

# --- 4. Helper for Activity Serialisation ---

def _format_activity_item(r: UserActivityLog, db: Session, current_user_id: Optional[int], client_lang: str, client_country: str) -> Optional[ActivityFeedItemResponse]:
    user = db.query(User).filter(User.id == r.user_id).first()
    if not user:
        return None

    final_title = r.item_title
    final_image_url = r.image_url

    # Check if this is an episode or comic issue
    is_tvm_ep = (r.external_id and str(r.external_id).startswith('tvm-ep-')) or r.item_type == 'episode'
    is_cv_issue = (r.external_id and str(r.external_id).startswith('cv_issue_'))
    has_raw_title = bool(not final_title or (final_title.startswith('Episode (') and final_title.endswith(')')) or (final_title.startswith('Comic (') and final_title.endswith(')')))

    if is_tvm_ep or is_cv_issue:
        li = db.query(ListItem).filter(ListItem.external_id == r.external_id).first()
        if li:
            if has_raw_title and li.title:
                final_title = li.title
            if li.image_url:
                # Always prefer specific episode still image / issue cover
                final_image_url = li.image_url

    if r.item_type == 'series' and r.external_id and r.external_id.startswith('tvm_'):
        clean_show_id = r.external_id.replace('tvm_', '')
        if clean_show_id.isdigit():
            loc_name = TVMazeService.get_localized_title(int(clean_show_id), r.item_title or '', lang=client_lang, country_code=client_country)
            if loc_name:
                final_title = loc_name

    from app.models.review import MediaReviewVote

    review_id_int = None
    if r.activity_type in ("item_reviewed", "item_rated") and r.entity_id:
        try:
            review_id_int = int(r.entity_id)
        except (ValueError, TypeError):
            review_id_int = None

    if review_id_int:
        likes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review_id_int).count()
        is_liked = False
        if current_user_id:
            is_liked = db.query(MediaReviewVote).filter(
                MediaReviewVote.review_id == review_id_int,
                MediaReviewVote.user_id == current_user_id
            ).first() is not None
    else:
        likes_count = db.query(ActivityLike).filter(ActivityLike.activity_id == r.id).count()
        is_liked = False
        if current_user_id:
            is_liked = db.query(ActivityLike).filter(
                ActivityLike.activity_id == r.id,
                ActivityLike.user_id == current_user_id
            ).first() is not None

    comments_count = db.query(ActivityComment).filter(ActivityComment.activity_id == r.id).count()

    # Ensure any activity about a media item has its poster image
    if r.item_type in ('series', 'anime', 'episode') or is_tvm_ep:
        # Check user's library for the series poster if we need an image or fallback
        series_match = None
        if final_title and ' - S' in final_title:
            series_match = final_title.split(' - S')[0].strip()
        elif r.metadata_json:
            try:
                m = json.loads(r.metadata_json) if isinstance(r.metadata_json, str) else r.metadata_json
                series_match = m.get('show_name') or m.get('series_title')
            except Exception:
                pass

        if series_match:
            lib_match = db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == r.user_id,
                UserLibraryItem.title.ilike(series_match)
            ).first()
            if lib_match and lib_match.image_url:
                if not final_image_url:
                    final_image_url = lib_match.image_url
            else:
                any_lib = db.query(UserLibraryItem).filter(
                    UserLibraryItem.title.ilike(series_match),
                    UserLibraryItem.image_url.isnot(None)
                ).first()
                if any_lib and any_lib.image_url:
                    if not final_image_url:
                        final_image_url = any_lib.image_url
    elif r.item_type in ('comic', 'manga') or is_cv_issue:
        # For comic issues, always display the parent volume poster if issue image is missing
        meta_dict = {}
        if r.metadata_json:
            try:
                meta_dict = json.loads(r.metadata_json) if isinstance(r.metadata_json, str) else r.metadata_json
            except Exception:
                pass

        vol_ext_id = meta_dict.get('series_external_id') or meta_dict.get('volume_id')
        vol_title = meta_dict.get('series_title') or meta_dict.get('work_title')
        if not vol_title and final_title and '#' in final_title:
            vol_title = final_title.split('#')[0].strip()

        # Check library by tracking list, external id, or title
        vol_lib = None
        if r.list_id:
            vol_lib = db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == r.user_id,
                UserLibraryItem.tracking_list_id == r.list_id,
                UserLibraryItem.image_url.isnot(None)
            ).first()
        if not vol_lib and vol_ext_id:
            vol_lib = db.query(UserLibraryItem).filter(
                UserLibraryItem.external_id == vol_ext_id,
                UserLibraryItem.image_url.isnot(None)
            ).first()
        if not vol_lib and vol_title:
            vol_lib = db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == r.user_id,
                UserLibraryItem.title.ilike(vol_title),
                UserLibraryItem.image_url.isnot(None)
            ).first()
        if not vol_lib and vol_title:
            vol_lib = db.query(UserLibraryItem).filter(
                UserLibraryItem.title.ilike(vol_title),
                UserLibraryItem.image_url.isnot(None)
            ).first()

        if vol_lib and vol_lib.image_url:
            if not final_image_url:
                final_image_url = vol_lib.image_url
        elif r.list_id and not final_image_url:
            reading_list = db.query(ReadingList).filter(ReadingList.id == r.list_id).first()
            if reading_list and reading_list.cover_image:
                final_image_url = reading_list.cover_image
    elif not final_image_url and final_title:
        # If image_url is missing, look up by external_id or title in UserLibraryItem or ListItem
        if r.external_id:
            lib_by_ext = db.query(UserLibraryItem).filter(
                UserLibraryItem.external_id == r.external_id,
                UserLibraryItem.image_url.isnot(None)
            ).first()
            if lib_by_ext and lib_by_ext.image_url:
                final_image_url = lib_by_ext.image_url
            else:
                li_by_ext = db.query(ListItem).filter(
                    ListItem.external_id == r.external_id,
                    ListItem.image_url.isnot(None)
                ).first()
                if li_by_ext and li_by_ext.image_url:
                    final_image_url = li_by_ext.image_url

        if not final_image_url and final_title:
            lib_by_title = db.query(UserLibraryItem).filter(
                UserLibraryItem.title.ilike(final_title),
                UserLibraryItem.image_url.isnot(None)
            ).first()
            if lib_by_title and lib_by_title.image_url:
                final_image_url = lib_by_title.image_url

    return ActivityFeedItemResponse(
        id=r.id,
        user_id=r.user_id,
        username=user.username,
        user_photo_url=user.photo_url,
        activity_type=r.activity_type,
        item_title=final_title,
        item_type=r.item_type,
        external_id=r.external_id,
        list_id=r.list_id,
        image_url=final_image_url,
        details=r.details,
        metadata_json=r.metadata_json,
        is_hidden=bool(getattr(r, 'is_hidden', False)),
        likes_count=likes_count,
        is_liked_by_me=is_liked,
        comments_count=comments_count,
        created_at=r.created_at
    )

# --- 5. The 4 Social Feeds (/social/feed) ---

@router.get("/feed/following", response_model=List[ActivityFeedItemResponse])
def get_following_feed(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

    followed_ids_query = db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id)
    comment_types = ["guide_commented", "item_commented", "guide_review_commented"]
    
    activity_records = db.query(UserActivityLog).filter(
        UserActivityLog.user_id.in_(followed_ids_query),
        UserActivityLog.is_hidden == False,
        ~UserActivityLog.activity_type.in_(comment_types)
    ).order_by(UserActivityLog.created_at.desc()).offset(skip).limit(limit).all()

    feed = []
    for r in activity_records:
        item = _format_activity_item(r, db, current_user.id, client_lang, client_country)
        if item:
            feed.append(item)
    return feed

@router.get("/feed/discover", response_model=List[ActivityFeedItemResponse])
def get_discover_feed(
    request: Request,
    skip: int = 0,
    limit: int = 25,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

    # Discover feed: activities from public users, not hidden, no comment events
    public_users_query = db.query(User.id).filter(User.is_private == False)
    comment_types = ["guide_commented", "item_commented", "guide_review_commented"]

    activity_records = db.query(UserActivityLog).filter(
        UserActivityLog.user_id.in_(public_users_query),
        UserActivityLog.is_hidden == False,
        ~UserActivityLog.activity_type.in_(comment_types)
    ).order_by(UserActivityLog.created_at.desc()).offset(skip).limit(limit).all()

    uid = current_user.id if current_user else None
    feed = []
    for r in activity_records:
        item = _format_activity_item(r, db, uid, client_lang, client_country)
        if item:
            feed.append(item)
    return feed

@router.get("/feed/reviews", response_model=List[ActivityFeedItemResponse])
def get_reviews_feed(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

    # Review activities: item_reviewed, guide_rated, item_rated
    review_types = ["item_reviewed", "guide_rated", "item_rated"]
    public_users_query = db.query(User.id).filter(User.is_private == False)

    activity_records = db.query(UserActivityLog).filter(
        UserActivityLog.user_id.in_(public_users_query),
        UserActivityLog.is_hidden == False,
        UserActivityLog.activity_type.in_(review_types)
    ).order_by(UserActivityLog.created_at.desc()).offset(skip).limit(limit).all()

    uid = current_user.id if current_user else None
    feed = []
    for r in activity_records:
        item = _format_activity_item(r, db, uid, client_lang, client_country)
        if item:
            feed.append(item)
    return feed

@router.get("/feed/me", response_model=List[ActivityFeedItemResponse])
def get_my_activity_feed(
    request: Request,
    skip: int = 0,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

    comment_types = ["guide_commented", "item_commented", "guide_review_commented"]
    activity_records = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == current_user.id,
        ~UserActivityLog.activity_type.in_(comment_types)
    ).order_by(UserActivityLog.created_at.desc()).offset(skip).limit(limit).all()

    feed = []
    for r in activity_records:
        item = _format_activity_item(r, db, current_user.id, client_lang, client_country)
        if item:
            feed.append(item)
    return feed

@router.patch("/feed/activity/{activity_id}/visibility", status_code=status.HTTP_200_OK)
def toggle_activity_visibility(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    act = db.query(UserActivityLog).filter(
        UserActivityLog.id == activity_id,
        UserActivityLog.user_id == current_user.id
    ).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found or unauthorized")

    act.is_hidden = not bool(getattr(act, "is_hidden", False))
    db.commit()
    return {"id": act.id, "is_hidden": act.is_hidden}

# Legacy backwards compatibility endpoint for previous social view
@router.get("/users/feed/activity", response_model=List[ActivityFeedItemResponse])
def get_legacy_feed(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_following_feed(request=request, skip=skip, limit=limit, current_user=current_user, db=db)

# --- 6. Activity Likes & Comments (/social/activity) ---

@router.post("/activity/{activity_id}/like", response_model=ActivityLikeToggleResponse)
def toggle_activity_like(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    act = db.query(UserActivityLog).filter(UserActivityLog.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    existing_like = db.query(ActivityLike).filter(
        ActivityLike.activity_id == activity_id,
        ActivityLike.user_id == current_user.id
    ).first()

    from app.models.review import MediaReviewVote

    review_id_val = None
    if act.activity_type in ("item_reviewed", "item_rated") and act.entity_id:
        try:
            review_id_val = int(act.entity_id)
        except (ValueError, TypeError):
            review_id_val = None

    from sqlalchemy.exc import IntegrityError

    if existing_like:
        db.delete(existing_like)
        if review_id_val:
            db.query(MediaReviewVote).filter(
                MediaReviewVote.review_id == review_id_val,
                MediaReviewVote.user_id == current_user.id
            ).delete(synchronize_session=False)

        try:
            db.commit()
        except Exception:
            db.rollback()

        likes_count = db.query(ActivityLike).filter(ActivityLike.activity_id == activity_id).count()
        return ActivityLikeToggleResponse(liked=False, likes_count=likes_count)
    else:
        new_like = ActivityLike(activity_id=activity_id, user_id=current_user.id)
        db.add(new_like)

        if review_id_val:
            existing_rev_vote = db.query(MediaReviewVote).filter(
                MediaReviewVote.review_id == review_id_val,
                MediaReviewVote.user_id == current_user.id
            ).first()
            if not existing_rev_vote:
                db.add(MediaReviewVote(review_id=review_id_val, user_id=current_user.id))
        
        # Send notification to activity owner if not self
        if act.user_id != current_user.id:
            safe_title = (act.item_title or '').replace('"', '')
            notif = Notification(
                recipient_id=act.user_id,
                actor_id=current_user.id,
                notification_type="activity_like",
                entity_type="activity",
                entity_id=str(act.id),
                extra_data_json=f'{{"item_title": "{safe_title}"}}'
            )
            db.add(notif)
            
        try:
            db.commit()
            liked_status = True
        except IntegrityError:
            # Already liked concurrently from another tab/device
            db.rollback()
            liked_status = True
        except Exception:
            db.rollback()
            liked_status = False

        likes_count = db.query(ActivityLike).filter(ActivityLike.activity_id == activity_id).count()
        return ActivityLikeToggleResponse(liked=liked_status, likes_count=likes_count)

@router.get("/activity/{activity_id}/comments", response_model=List[ActivityCommentResponse])
def get_activity_comments(
    activity_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    comments = db.query(ActivityComment).filter(
        ActivityComment.activity_id == activity_id
    ).order_by(ActivityComment.created_at.asc()).all()

    # Build reply map
    comm_map = {}
    uid = current_user.id if current_user else None

    for c in comments:
        u = db.query(User).filter(User.id == c.user_id).first()
        votes_count = db.query(ActivityCommentVote).filter(ActivityCommentVote.comment_id == c.id).count()
        is_voted = False
        if uid:
            is_voted = db.query(ActivityCommentVote).filter(
                ActivityCommentVote.comment_id == c.id,
                ActivityCommentVote.user_id == uid
            ).first() is not None

        is_del = bool(getattr(c, 'is_deleted', False))
        c_resp = ActivityCommentResponse(
            id=c.id,
            activity_id=c.activity_id,
            user_id=c.user_id,
            username="Usuario" if is_del else (u.username if u else "Unknown"),
            photo_url=None if is_del else (u.photo_url if u else None),
            parent_id=c.parent_id,
            content=None if is_del else c.content,
            media_url=None if is_del else c.media_url,
            media_type=None if is_del else c.media_type,
            audio_url=None if is_del else c.audio_url,
            is_deleted=is_del,
            votes_count=0 if is_del else votes_count,
            is_voted_by_me=False if is_del else is_voted,
            created_at=c.created_at,
            replies=[]
        )
        comm_map[c.id] = c_resp

    root_comments = []
    for c in comments:
        node = comm_map[c.id]
        if c.parent_id and c.parent_id in comm_map:
            comm_map[c.parent_id].replies.append(node)
        else:
            root_comments.append(node)

    return root_comments

@router.post("/activity/{activity_id}/comments", response_model=ActivityCommentResponse, status_code=status.HTTP_201_CREATED)
def post_activity_comment(
    activity_id: int,
    comment_in: ActivityCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    act = db.query(UserActivityLog).filter(UserActivityLog.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    new_comment = ActivityComment(
        activity_id=activity_id,
        user_id=current_user.id,
        parent_id=comment_in.parent_id,
        content=comment_in.content,
        media_url=comment_in.media_url,
        media_type=comment_in.media_type,
        audio_url=comment_in.audio_url
    )
    db.add(new_comment)
    db.flush()

    # Determine recipient of notification
    recipient_id = act.user_id
    notif_type = "activity_comment"
    if comment_in.parent_id:
        parent_c = db.query(ActivityComment).filter(ActivityComment.id == comment_in.parent_id).first()
        if parent_c:
            recipient_id = parent_c.user_id
            notif_type = "comment_reply"

    if recipient_id != current_user.id:
        raw_snippet = str(comment_in.content or '')[:60].replace('"', '')
        notif = Notification(
            recipient_id=recipient_id,
            actor_id=current_user.id,
            notification_type=notif_type,
            entity_type="activity",
            entity_id=str(act.id),
            extra_data_json=f'{{"snippet": "{raw_snippet}"}}'
        )
        db.add(notif)

    db.commit()
    db.refresh(new_comment)

    return ActivityCommentResponse(
        id=new_comment.id,
        activity_id=new_comment.activity_id,
        user_id=new_comment.user_id,
        username=current_user.username,
        photo_url=current_user.photo_url,
        parent_id=new_comment.parent_id,
        content=new_comment.content,
        media_url=new_comment.media_url,
        media_type=new_comment.media_type,
        audio_url=new_comment.audio_url,
        votes_count=0,
        is_voted_by_me=False,
        created_at=new_comment.created_at,
        replies=[]
    )

@router.post("/comments/{comment_id}/vote", status_code=status.HTTP_200_OK)
def toggle_activity_comment_vote(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(ActivityComment).filter(ActivityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    vote = db.query(ActivityCommentVote).filter(
        ActivityCommentVote.comment_id == comment_id,
        ActivityCommentVote.user_id == current_user.id
    ).first()

    if vote:
        db.delete(vote)
        db.commit()
        cnt = db.query(ActivityCommentVote).filter(ActivityCommentVote.comment_id == comment_id).count()
        return {"voted": False, "votes_count": cnt}
    else:
        new_vote = ActivityCommentVote(comment_id=comment_id, user_id=current_user.id)
        db.add(new_vote)
        db.commit()
        cnt = db.query(ActivityCommentVote).filter(ActivityCommentVote.comment_id == comment_id).count()
        return {"voted": True, "votes_count": cnt}

@router.delete("/comments/{comment_id}", status_code=status.HTTP_200_OK)
def delete_activity_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(ActivityComment).filter(ActivityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id and not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    has_replies = db.query(ActivityComment).filter(ActivityComment.parent_id == comment.id).count() > 0

    if has_replies:
        comment.is_deleted = True
        comment.content = None
        comment.media_url = None
        comment.media_type = None
        comment.audio_url = None
        db.commit()
    else:
        parent_id_val = comment.parent_id
        db.delete(comment)
        db.commit()

        if parent_id_val:
            parent = db.query(ActivityComment).filter(ActivityComment.id == parent_id_val).first()
            if parent and getattr(parent, 'is_deleted', False):
                other_replies = db.query(ActivityComment).filter(ActivityComment.parent_id == parent_id_val).count()
                if other_replies == 0:
                    db.delete(parent)
                    db.commit()

    return {"message": "Comment deleted successfully", "is_deleted": has_replies}

@router.post("/activity/comments/{comment_id}/report", status_code=status.HTTP_201_CREATED)
def report_activity_comment(
    comment_id: int,
    report_in: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(ActivityComment).filter(ActivityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    from app.models.social import ActivityCommentReport
    existing_report = db.query(ActivityCommentReport).filter(
        ActivityCommentReport.comment_id == comment_id,
        ActivityCommentReport.user_id == current_user.id
    ).first()
    if existing_report:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya has reportado este comentario.")

    report = ActivityCommentReport(
        user_id=current_user.id,
        comment_id=comment_id,
        reason=report_in.reason.strip()
    )
    db.add(report)
    db.commit()
    return {"message": "Comment reported successfully"}
