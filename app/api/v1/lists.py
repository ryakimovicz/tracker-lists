from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.services.tmdb import TMDBService
from app.schemas.list import (
    ReadingListCreate,
    ReadingListUpdate,
    ReadingListResponse,
    ReadingListDetailsResponse,
    ListItemCreate,
    ListItemUpdate,
    ListItemResponse,
    ListItemProgressResponse,
    TVImportRequest,
    TVImportType
)

router = APIRouter()

# 1. Feed: Get public lists
@router.get("/", response_model=List[ReadingListResponse])
def get_public_lists(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    lists = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).order_by(ReadingList.created_at.desc()).offset(skip).limit(limit).all()
    return lists

# 2. Create a reading list
@router.post("/", response_model=ReadingListResponse, status_code=status.HTTP_201_CREATED)
def create_list(
    list_in: ReadingListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_list = ReadingList(
        creator_id=current_user.id,
        title=list_in.title,
        description=list_in.description,
        visibility=list_in.visibility
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list

# 3. Get list details (with progress calculated if logged in)
@router.get("/{list_id}", response_model=ReadingListDetailsResponse)
def get_list_details(
    list_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")

    # Access checks
    if reading_list.visibility == VisibilityEnum.PRIVATE:
        if not current_user or reading_list.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this private list"
            )

    # Check if saved by current user
    is_saved_by_me = False
    if current_user:
        saved_record = db.query(SavedList).filter(
            SavedList.user_id == current_user.id,
            SavedList.list_id == list_id
        ).first()
        is_saved_by_me = saved_record is not None

    # Fetch creator username
    creator = db.query(User).filter(User.id == reading_list.creator_id).first()
    creator_username = creator.username if creator else "Unknown"

    # Fetch list items and their progress
    items = reading_list.items
    total_count = len(items)
    completed_count = 0
    items_response = []

    # Map item progress
    progress_map = {}
    if current_user and total_count > 0:
        item_ids = [item.id for item in items]
        progress_records = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.list_item_id.in_(item_ids)
        ).all()
        progress_map = {p.list_item_id: p.is_completed for p in progress_records}

    for item in items:
        is_completed = progress_map.get(item.id, False)
        if is_completed:
            completed_count += 1
            
        items_response.append(
            ListItemProgressResponse(
                id=item.id,
                list_id=item.list_id,
                order_index=item.order_index,
                item_type=item.item_type,
                external_id=item.external_id,
                title=item.title,
                image_url=item.image_url,
                custom_notes=item.custom_notes,
                section=item.section,
                is_completed=is_completed
            )
        )

    progress_percentage = 0.0
    if total_count > 0:
        progress_percentage = (completed_count / total_count) * 100.0

    return ReadingListDetailsResponse(
        id=reading_list.id,
        creator_id=reading_list.creator_id,
        title=reading_list.title,
        description=reading_list.description,
        visibility=reading_list.visibility,
        created_at=reading_list.created_at,
        creator_username=creator_username,
        is_saved_by_me=is_saved_by_me,
        completed_count=completed_count,
        total_count=total_count,
        progress_percentage=round(progress_percentage, 2),
        items=items_response
    )

# 4. Update reading list
@router.put("/{list_id}", response_model=ReadingListResponse)
def update_list(
    list_id: int,
    list_in: ReadingListUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can modify this list"
        )
        
    update_data = list_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reading_list, field, value)
        
    db.commit()
    db.refresh(reading_list)
    return reading_list

# 5. Delete reading list
@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can delete this list"
        )
        
    db.delete(reading_list)
    db.commit()
    return None

# 6. Add item to reading list
@router.post("/{list_id}/items", response_model=ListItemResponse, status_code=status.HTTP_201_CREATED)
def add_item_to_list(
    list_id: int,
    item_in: ListItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can add items to this list"
        )
        
    new_item = ListItem(
        list_id=list_id,
        order_index=item_in.order_index,
        item_type=item_in.item_type,
        external_id=item_in.external_id,
        title=item_in.title,
        image_url=item_in.image_url,
        custom_notes=item_in.custom_notes,
        section=item_in.section
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

# 7. Delete item from list
@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item_from_list(
    list_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can edit this list"
        )
        
    item = db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in this list")
        
    db.delete(item)
    db.commit()
    return None

# 8. Save/subscribe to a list in library
@router.post("/{list_id}/save", status_code=status.HTTP_200_OK)
def save_list_to_library(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.visibility == VisibilityEnum.PRIVATE and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot save a private list"
        )
        
    existing_save = db.query(SavedList).filter(
        SavedList.user_id == current_user.id,
        SavedList.list_id == list_id
    ).first()
    if existing_save:
        return {"message": "List already saved to library"}
        
    saved = SavedList(user_id=current_user.id, list_id=list_id)
    db.add(saved)
    db.commit()
    return {"message": "List saved to library successfully"}

# 9. Unsave list
@router.delete("/{list_id}/save", status_code=status.HTTP_200_OK)
def unsave_list_from_library(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saved_record = db.query(SavedList).filter(
        SavedList.user_id == current_user.id,
        SavedList.list_id == list_id
    ).first()
    if not saved_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved list not found")
        
    db.delete(saved_record)
    db.commit()
    return {"message": "List removed from library successfully"}

# 10. Toggle item progress completion status
@router.post("/items/{item_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_item_progress(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify the item exists
    item = db.query(ListItem).first() # Query by id
    item = db.query(ListItem).filter(ListItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")
        
    # Verify list is accessible (not private to someone else)
    reading_list = db.query(ReadingList).filter(ReadingList.id == item.list_id).first()
    if reading_list.visibility == VisibilityEnum.PRIVATE and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Item belongs to a private list you don't access"
        )
        
    progress = db.query(ItemProgress).filter(
        ItemProgress.user_id == current_user.id,
        ItemProgress.list_item_id == item_id
    ).first()
    
    if progress:
        progress.is_completed = not progress.is_completed
        progress.completed_at = datetime.now(timezone.utc) if progress.is_completed else None
    else:
        progress = ItemProgress(
            user_id=current_user.id,
            list_item_id=item_id,
            is_completed=True,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress)
        
    db.commit()
    return {
        "item_id": item_id,
        "is_completed": progress.is_completed
    }

# 11. Reverse Lookup: See which lists contain this item
@router.get("/items/lookup", response_model=List[ReadingListResponse])
def lookup_item_lists(
    external_id: str,
    db: Session = Depends(get_db)
):
    # We select all public lists containing an item with this external_id
    lists = db.query(ReadingList).join(ListItem).filter(
        ListItem.external_id == external_id,
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).all()
    return lists

# 12. Bulk TV Import (Series, Season, Episode)
@router.post("/{list_id}/items/tv-import", response_model=List[ListItemResponse], status_code=status.HTTP_201_CREATED)
def import_tv_items(
    list_id: int,
    import_req: TVImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can edit this list"
        )
        
    created_items = []
    order_idx = import_req.starting_order_index
    
    if import_req.import_type == TVImportType.SERIES:
        series = TMDBService.get_series_detail(import_req.series_id)
        if not series:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Series not found in TMDB")
            
        poster = series.get("poster_path")
        image_url = f"https://image.tmdb.org/t/p/w185{poster}" if poster else None
        
        item = ListItem(
            list_id=list_id,
            order_index=order_idx,
            item_type=ItemTypeEnum.SERIES,
            external_id=str(import_req.series_id),
            title=series.get("name") or "Untitled Series",
            image_url=image_url,
            custom_notes=f"Serie Completa: {series.get('name')}",
            section="Series"
        )
        db.add(item)
        created_items.append(item)
        
    elif import_req.import_type == TVImportType.SEASON:
        if import_req.season_number is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="season_number is required for season imports")
            
        series = TMDBService.get_series_detail(import_req.series_id)
        series_name = series.get("name") if series else "Series"
        
        episodes = TMDBService.get_season_episodes(import_req.series_id, import_req.season_number)
        if not episodes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No episodes found for this season in TMDB")
            
        for ep in episodes:
            ep_num = ep.get("episode_number")
            ep_name = ep.get("name") or "Untitled Episode"
            title = f"{series_name} - S{import_req.season_number:02d}E{ep_num:02d} - {ep_name}"
            
            still = ep.get("still_path")
            image_url = f"https://image.tmdb.org/t/p/w185{still}" if still else None
            
            item = ListItem(
                list_id=list_id,
                order_index=order_idx,
                item_type=ItemTypeEnum.SERIES,
                external_id=f"tmdb-ep-{ep.get('id')}",
                title=title,
                image_url=image_url,
                custom_notes=ep.get("overview"),
                section=f"Season {import_req.season_number}"
            )
            db.add(item)
            created_items.append(item)
            order_idx += 1
            
    elif import_req.import_type == TVImportType.EPISODE:
        if import_req.season_number is None or import_req.episode_number is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="season_number and episode_number are required for episode imports")
            
        series = TMDBService.get_series_detail(import_req.series_id)
        series_name = series.get("name") if series else "Series"
        
        ep = TMDBService.get_episode_detail(import_req.series_id, import_req.season_number, import_req.episode_number)
        if not ep:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Episode not found in TMDB")
            
        ep_name = ep.get("name") or "Untitled Episode"
        title = f"{series_name} - S{import_req.season_number:02d}E{import_req.episode_number:02d} - {ep_name}"
        
        still = ep.get("still_path")
        image_url = f"https://image.tmdb.org/t/p/w185{still}" if still else None
        
        item = ListItem(
            list_id=list_id,
            order_index=order_idx,
            item_type=ItemTypeEnum.SERIES,
            external_id=f"tmdb-ep-{ep.get('id')}",
            title=title,
            image_url=image_url,
            custom_notes=ep.get("overview"),
            section=f"Season {import_req.season_number}"
        )
        db.add(item)
        created_items.append(item)
        
    db.commit()
    for item in created_items:
        db.refresh(item)
    return created_items

# 13. Search Lists in Database
@router.get("/db/search", response_model=List[ReadingListResponse])
def search_lists_in_db(
    q: str = Query(..., min_length=1, description="List title or description search query"),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    search_pattern = f"%{q.lower()}%"
    lists = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        (ReadingList.title.like(search_pattern) | ReadingList.description.like(search_pattern))
    ).offset(skip).limit(limit).all()
    return lists

# 14. Update item inside list (customization / reordering)
@router.put("/{list_id}/items/{item_id}", response_model=ListItemResponse)
def update_list_item(
    list_id: int,
    item_id: int,
    item_in: ListItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can modify items in this list"
        )
        
    item = db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in this list")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    db.commit()
    db.refresh(item)
    return item



