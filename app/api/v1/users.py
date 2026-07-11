from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.library import UserLibraryItem
from app.models.addition import ListAddition, UserAdoptedAddition
from app.core.security import verify_password, get_password_hash
from app.models.activity import UserActivityLog
from app.schemas.user import UserResponse, UserDashboardResponse
from app.schemas.social import UpNextResponse, UpNextItemResponse
from app.schemas.auth import PasswordChangeRequest, UsernameUpdateRequest

router = APIRouter()

@router.get("/me", response_model=UserDashboardResponse)
def get_user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch lists created by the user (exclude personal trackers from the dashboard guides)
    tracker_list_ids_query = db.query(UserLibraryItem.tracking_list_id).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id.isnot(None)
    )
    
    created_lists = db.query(ReadingList).filter(
        ReadingList.creator_id == current_user.id,
        ~ReadingList.id.in_(tracker_list_ids_query)
    ).all()
    
    # Fetch lists saved/followed by the user
    saved_lists = db.query(ReadingList).join(
        SavedList, SavedList.list_id == ReadingList.id
    ).filter(
        SavedList.user_id == current_user.id
    ).all()
    
    return UserDashboardResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        photo_url=current_user.photo_url,
        is_admin=current_user.is_admin,
        created_lists=created_lists,
        saved_lists=saved_lists
    )

@router.get("/me/up-next", response_model=UpNextResponse)
def get_user_up_next(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch all reading lists associated with the user (both created and saved)
    all_user_lists = db.query(ReadingList).filter(
        (ReadingList.creator_id == current_user.id) | 
        ReadingList.id.in_(db.query(SavedList.list_id).filter(SavedList.user_id == current_user.id))
    ).all()
    
    # Get IDs of lists linked to user library items (personal trackers)
    personal_tracker_ids = {
        item.tracking_list_id for item in 
        db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.tracking_list_id.isnot(None)
        ).all()
    }
    
    # Fetch active additions for the current user for all lists
    user_additions = db.query(ListAddition).filter(
        ListAddition.user_id == current_user.id
    ).all()
    adopted_additions = db.query(ListAddition).join(
        UserAdoptedAddition, UserAdoptedAddition.addition_id == ListAddition.id
    ).filter(
        UserAdoptedAddition.user_id == current_user.id
    ).all()
    all_active_additions = list(set(user_additions + adopted_additions))
    
    additions_by_list = {}
    for add in all_active_additions:
        additions_by_list.setdefault(add.list_id, []).append(add)
    
    guides_up_next = []
    personal_up_next = []
    
    # Pre-fetch completed or skipped item ids for the user
    completed_or_skipped_item_ids = {
        p.list_item_id for p in 
        db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.list_item_id.isnot(None),
            (ItemProgress.is_completed == True) | (ItemProgress.is_skipped == True)
        ).all()
    }
    completed_or_skipped_addition_ids = {
        p.addition_item_id for p in 
        db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.addition_item_id.isnot(None),
            (ItemProgress.is_completed == True) | (ItemProgress.is_skipped == True)
        ).all()
    }
    
    for rlist in all_user_lists:
        addition_items = []
        for add in additions_by_list.get(rlist.id, []):
            addition_items.extend(add.items)
        addition_items.sort(key=lambda x: x.order_index)
        
        merged_items = []
        for item in rlist.items:
            merged_items.append((item.id, item, False, None, None))
            
        for ai in addition_items:
            inserted = False
            if ai.after_item_id:
                for index, (base_id, base_item, is_addition, _, _) in enumerate(merged_items):
                    if not is_addition and base_id == ai.after_item_id:
                        insert_idx = index + 1
                        while insert_idx < len(merged_items) and merged_items[insert_idx][2]:
                            insert_idx += 1
                        merged_items.insert(insert_idx, (ai.id, ai, True, ai.addition_id, ai.id))
                        inserted = True
                        break
            if not inserted:
                merged_items.append((ai.id, ai, True, ai.addition_id, ai.id))
                
        # Find the first item in the merged list that is NOT completed or skipped
        first_uncompleted = None
        for item_id, item, is_addition, add_id, add_item_id in merged_items:
            if is_addition:
                if item_id not in completed_or_skipped_addition_ids:
                    first_uncompleted = (item, is_addition, add_id, add_item_id)
                    break
            else:
                if item_id not in completed_or_skipped_item_ids:
                    first_uncompleted = (item, is_addition, None, None)
                    break
                    
        if first_uncompleted:
            item, is_addition, add_id, add_item_id = first_uncompleted
            up_next_item = UpNextItemResponse(
                item_id=item.id,
                list_id=rlist.id,
                list_title=rlist.title,
                order_index=item.order_index,
                item_type=item.item_type,
                title=item.title,
                image_url=item.image_url,
                section=item.section,
                is_addition=is_addition,
                addition_id=add_id,
                addition_item_id=add_item_id
            )
            
            if rlist.id in personal_tracker_ids:
                personal_up_next.append(up_next_item)
            else:
                guides_up_next.append(up_next_item)
                
    return UpNextResponse(
        guides=guides_up_next,
        personal=personal_up_next
    )

@router.get("/search", response_model=List[UserResponse])
def search_users(
    q: str = Query(..., min_length=1, description="Username search query"),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    search_pattern = f"%{q.lower()}%"
    users = db.query(User).filter(
        User.username.like(search_pattern)
    ).offset(skip).limit(limit).all()
    return users

@router.put("/me/username", response_model=UserResponse)
def update_username(
    req: UsernameUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if username is already taken
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        if existing.id == current_user.id:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
        
    current_user.username = req.username
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me/password")
def change_password(
    req: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
        
    current_user.hashed_password = get_password_hash(req.new_password)
    # Revoke any refresh tokens on password change for security
    current_user.refresh_token = None
    db.commit()
    return {"message": "Password updated successfully"}

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return None

@router.get("/me/activity")
def get_my_activity(
    limit: int = 15,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    activities = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == current_user.id
    ).order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": act.id,
            "activity_type": act.activity_type,
            "item_title": act.item_title,
            "item_type": act.item_type,
            "details": act.details,
            "created_at": act.created_at
        }
        for act in activities
    ]

@router.get("/profile/{user_id}", response_model=UserDashboardResponse)
def get_any_user_profile(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Exclude tracking lists (personal series/episode trackers)
    tracker_list_ids_query = db.query(UserLibraryItem.tracking_list_id).filter(
        UserLibraryItem.user_id == user.id,
        UserLibraryItem.tracking_list_id.isnot(None)
    )
    
    created_lists = db.query(ReadingList).filter(
        ReadingList.creator_id == user.id,
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        ~ReadingList.id.in_(tracker_list_ids_query)
    ).all()
    
    saved_lists = db.query(ReadingList).join(
        SavedList, SavedList.list_id == ReadingList.id
    ).filter(
        SavedList.user_id == user.id,
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).all()
    
    return UserDashboardResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
        created_lists=created_lists,
        saved_lists=saved_lists
    )

@router.get("/{user_id}/activity")
def get_user_activity(
    user_id: int,
    limit: int = 15,
    db: Session = Depends(get_db)
):
    activities = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == user_id
    ).order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": act.id,
            "activity_type": act.activity_type,
            "item_title": act.item_title,
            "item_type": act.item_type,
            "details": act.details,
            "created_at": act.created_at
        }
        for act in activities
    ]
