from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList
from app.models.list_item import ListItem
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.library import UserLibraryItem
from app.schemas.user import UserResponse, UserDashboardResponse
from app.schemas.social import UpNextResponse, UpNextItemResponse

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
    
    guides_up_next = []
    personal_up_next = []
    
    # Pre-fetch completed or skipped item ids for the user
    completed_or_skipped_item_ids = {
        p.list_item_id for p in 
        db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            (ItemProgress.is_completed == True) | (ItemProgress.is_skipped == True)
        ).all()
    }
    
    for rlist in all_user_lists:
        # Find the first item in the list that is NOT completed or skipped
        first_uncompleted = None
        for item in rlist.items:
            if item.id not in completed_or_skipped_item_ids:
                first_uncompleted = item
                break
                
        if first_uncompleted:
            up_next_item = UpNextItemResponse(
                item_id=first_uncompleted.id,
                list_id=rlist.id,
                list_title=rlist.title,
                order_index=first_uncompleted.order_index,
                item_type=first_uncompleted.item_type,
                title=first_uncompleted.title,
                image_url=first_uncompleted.image_url,
                section=first_uncompleted.section
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
