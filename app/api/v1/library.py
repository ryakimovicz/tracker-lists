from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.schemas.library import LibraryItemCreate, LibraryItemUpdate, LibraryItemResponse
from app.services.tmdb import TMDBService

router = APIRouter()

@router.post("/", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_library(
    item_in: LibraryItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if already exists in library
    existing = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == item_in.item_type,
        UserLibraryItem.external_id == item_in.external_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This item is already in your library"
        )
        
    tracking_list_id = None
    
    # If it is a TV series, automatically create a private reading list for episode tracking
    if item_in.item_type == "series":
        # Create private reading list representing this show
        private_list = ReadingList(
            creator_id=current_user.id,
            title=f"Tracker: {item_in.title}",
            description=f"Auto-generated episode tracking for '{item_in.title}'",
            visibility=VisibilityEnum.PRIVATE
        )
        db.add(private_list)
        db.commit()
        db.refresh(private_list)
        tracking_list_id = private_list.id
        
        # Try to retrieve season 1 episodes to auto-populate the tracker list
        try:
            series_id = int(item_in.external_id)
            episodes = TMDBService.get_season_episodes(series_id, 1)
            
            for idx, ep in enumerate(episodes, start=1):
                ep_num = ep.get("episode_number")
                ep_name = ep.get("name") or "Untitled Episode"
                title = f"{item_in.title} - S01E{ep_num:02d} - {ep_name}"
                
                still = ep.get("still_path")
                image_url = f"https://image.tmdb.org/t/p/w185{still}" if still else None
                
                db_item = ListItem(
                    list_id=private_list.id,
                    order_index=idx,
                    item_type=ItemTypeEnum.SERIES,
                    external_id=f"tmdb-ep-{ep.get('id')}",
                    title=title,
                    image_url=image_url,
                    custom_notes=ep.get("overview"),
                    section="Season 1"
                )
                db.add(db_item)
            db.commit()
        except Exception as e:
            # Log error but do not fail adding the show to the library
            print(f"Failed to auto-populate series episodes: {e}")
            
    new_lib_item = UserLibraryItem(
        user_id=current_user.id,
        item_type=item_in.item_type,
        external_id=item_in.external_id,
        title=item_in.title,
        image_url=item_in.image_url,
        status=item_in.status,
        tracking_list_id=tracking_list_id
    )
    db.add(new_lib_item)
    db.commit()
    db.refresh(new_lib_item)
    return new_lib_item

@router.get("/", response_model=List[LibraryItemResponse])
def get_library(
    status: Optional[UserLibraryStatusEnum] = Query(None, description="Filter library by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(UserLibraryItem).filter(UserLibraryItem.user_id == current_user.id)
    if status:
        query = query.filter(UserLibraryItem.status == status)
    return query.all()

@router.put("/{library_item_id}", response_model=LibraryItemResponse)
def update_library_item(
    library_item_id: int,
    item_in: LibraryItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.id == library_item_id,
        UserLibraryItem.user_id == current_user.id
    ).first()
    
    if not lib_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Library item not found"
        )
        
    lib_item.status = item_in.status
    db.commit()
    db.refresh(lib_item)
    return lib_item

@router.delete("/{library_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_from_library(
    library_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.id == library_item_id,
        UserLibraryItem.user_id == current_user.id
    ).first()
    
    if not lib_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Library item not found"
        )
        
    # If there is an associated private tracking list, delete it too
    if lib_item.tracking_list_id:
        private_list = db.query(ReadingList).filter(ReadingList.id == lib_item.tracking_list_id).first()
        if private_list:
            db.delete(private_list)
            
    db.delete(lib_item)
    db.commit()
    return None
