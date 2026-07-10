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
from app.models.addition import ListAddition, UserAdoptedAddition
from app.services.tmdb import TMDBService
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.activity import UserActivityLog
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
    TVImportType,
    SectionBulkActionRequest,
    BulkToggleRequest,
    ToggleTMDBEpisodeRequest,
    BulkToggleSeasonRequest
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
    # Enforce draft state on initial creation, saving intended visibility inside section_descriptions
    intended = list_in.visibility.value if list_in.visibility else "public"
    new_list = ReadingList(
        creator_id=current_user.id,
        title=list_in.title,
        description=list_in.description,
        visibility=VisibilityEnum.DRAFT,
        importance_labels=list_in.importance_labels,
        section_importances=list_in.section_importances,
        section_descriptions={
            "flow": [],
            "draft_flow": [],
            "draft_title": list_in.title,
            "draft_description": list_in.description,
            "intended_visibility": intended
        }
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)

    # Automatically follow/save the newly created guide for the creator
    saved = SavedList(user_id=current_user.id, list_id=new_list.id)
    db.add(saved)

    # Record activity log
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_created",
        item_title=new_list.title,
        item_type="guide",
        details="created"
    )
    db.add(activity)
    db.commit()

    return new_list

# 3. Get list details (with progress calculated if logged in)
@router.get("/{list_id}", response_model=ReadingListDetailsResponse)
def get_list_details(
    list_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
    draft: bool = Query(False)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")

    # Access checks
    if reading_list.visibility in (VisibilityEnum.PRIVATE, VisibilityEnum.DRAFT):
        if not current_user or reading_list.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this list"
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
    external_progress_map = {}
    custom_progress_map = {}
    addition_progress_map = {}
    
    if current_user:
        progress_records = db.query(ItemProgress).filter(ItemProgress.user_id == current_user.id).all()
        external_progress_map = {
            (p.item_type.lower() if p.item_type else "", p.external_id): (p.is_completed, p.is_skipped)
            for p in progress_records if p.external_id
        }
        custom_progress_map = {
            p.list_item_id: (p.is_completed, p.is_skipped)
            for p in progress_records if p.list_item_id and not p.external_id
        }
        addition_progress_map = {
            p.addition_item_id: (p.is_completed, p.is_skipped)
            for p in progress_records if p.addition_item_id and not p.external_id
        }

    # Fetch active additions for the current user
    addition_items = []
    if current_user:
        # Additions created by user
        user_additions = db.query(ListAddition).filter(
            ListAddition.list_id == list_id,
            ListAddition.user_id == current_user.id
        ).all()
        # Additions adopted by user
        adopted_additions = db.query(ListAddition).join(
            UserAdoptedAddition, UserAdoptedAddition.addition_id == ListAddition.id
        ).filter(
            ListAddition.list_id == list_id,
            UserAdoptedAddition.user_id == current_user.id
        ).all()
        
        all_active_additions = list(set(user_additions + adopted_additions))
        
        for add in all_active_additions:
            addition_items.extend(add.items)

    # Sort addition items by order_index so they inject sequentially
    addition_items.sort(key=lambda x: x.order_index)

    # Map base items
    merged_items = []
    sec_importances = reading_list.section_importances or {}
    for item in items:
        if item.external_id:
            is_completed, is_skipped = external_progress_map.get((item.item_type.lower(), item.external_id), (False, False))
        else:
            is_completed, is_skipped = custom_progress_map.get(item.id, (False, False))
            
        inherited = item.importance_rank
        if inherited is None and item.section:
            inherited = sec_importances.get(item.section)
            
        merged_items.append(
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
                is_completed=is_completed,
                is_skipped=is_skipped,
                is_addition=False,
                importance_rank=item.importance_rank,
                inherited_importance_rank=inherited
            )
        )

    # Inject addition items after anchor items
    for ai in addition_items:
        if ai.external_id:
            is_completed, is_skipped = external_progress_map.get((ai.item_type.lower(), ai.external_id), (False, False))
        else:
            is_completed, is_skipped = addition_progress_map.get(ai.id, (False, False))
            
        inherited = ai.importance_rank
        if inherited is None and ai.section:
            inherited = sec_importances.get(ai.section)
            
        ai_resp = ListItemProgressResponse(
            id=ai.id,
            list_id=list_id,
            order_index=ai.order_index,
            item_type=ai.item_type,
            external_id=ai.external_id,
            title=ai.title,
            image_url=ai.image_url,
            custom_notes=ai.custom_notes,
            section=ai.section,
            is_completed=is_completed,
            is_skipped=is_skipped,
            is_addition=True,
            addition_id=ai.addition_id,
            addition_item_id=ai.id,
            importance_rank=ai.importance_rank,
            inherited_importance_rank=inherited
        )
        
        inserted = False
        if ai.after_item_id:
            for index, base_item in enumerate(merged_items):
                if not base_item.is_addition and base_item.id == ai.after_item_id:
                    # Find last addition item inserted after this base item to insert after it
                    insert_idx = index + 1
                    while insert_idx < len(merged_items) and merged_items[insert_idx].is_addition:
                        insert_idx += 1
                    merged_items.insert(insert_idx, ai_resp)
                    inserted = True
                    break
        if not inserted:
            merged_items.append(ai_resp)

    # Recalculate metrics dynamically based on merged items list
    merged_total = len(merged_items)
    completed_count = sum(1 for x in merged_items if x.is_completed)
    skipped_count = sum(1 for x in merged_items if x.is_skipped)

    progress_percentage = 0.0
    skipped_percentage = 0.0
    if merged_total > 0:
        progress_percentage = (completed_count / merged_total) * 100.0
        skipped_percentage = (skipped_count / merged_total) * 100.0

    list_title = reading_list.title
    list_desc = reading_list.description
    if draft and current_user and reading_list.creator_id == current_user.id:
        sd = reading_list.section_descriptions or {}
        list_title = sd.get("draft_title") or list_title
        list_desc = sd.get("draft_description") or list_desc

    return ReadingListDetailsResponse(
        id=reading_list.id,
        creator_id=reading_list.creator_id,
        title=list_title,
        description=list_desc,
        visibility=reading_list.visibility,
        created_at=reading_list.created_at,
        creator_username=creator_username,
        is_saved_by_me=is_saved_by_me,
        completed_count=completed_count,
        skipped_count=skipped_count,
        total_count=merged_total,
        progress_percentage=round(progress_percentage, 2),
        skipped_percentage=round(skipped_percentage, 2),
        section_descriptions=reading_list.section_descriptions,
        importance_labels=reading_list.importance_labels,
        section_importances=reading_list.section_importances,
        items=merged_items
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
        
    old_visibility = reading_list.visibility
    update_data = list_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reading_list, field, value)
        
    db.commit()
    db.refresh(reading_list)

    # Log activity only on explicit publish (when metadata/visibility are updated)
    if "title" in update_data or "visibility" in update_data:
        act_type = "guide_updated"
        if old_visibility == VisibilityEnum.DRAFT and reading_list.visibility in (VisibilityEnum.PUBLIC, VisibilityEnum.PRIVATE):
            act_type = "guide_published"

        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type=act_type,
            item_title=reading_list.title,
            item_type="guide",
            details="published" if act_type == "guide_published" else "updated"
        )
        db.add(activity)
        db.commit()

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
        
    # Record activity log before deletion
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_deleted",
        item_title=reading_list.title,
        item_type="guide",
        details="deleted"
    )
    db.add(activity)
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
        section=item_in.section,
        importance_rank=item_in.importance_rank
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

    # Record activity log
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_followed",
        item_title=reading_list.title,
        item_type="guide",
        details="followed"
    )
    db.add(activity)
    db.commit()
    return {"message": "List saved to library successfully"}

# 9. Unsave list
@router.delete("/{list_id}/save", status_code=status.HTTP_200_OK)
def unsave_list_from_library(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    list_title = reading_list.title if reading_list else f"Guide {list_id}"

    saved_record = db.query(SavedList).filter(
        SavedList.user_id == current_user.id,
        SavedList.list_id == list_id
    ).first()
    if not saved_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved list not found")
        
    db.delete(saved_record)

    # Record activity log
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_unfollowed",
        item_title=list_title,
        item_type="guide",
        details="unfollowed"
    )
    db.add(activity)
    db.commit()
    return {"message": "List removed from library successfully"}

# 10. Toggle item progress completion status
def auto_add_to_library(db: Session, user_id: int, item: ListItem):
    if not item.external_id:
        return
    existing = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == user_id,
        UserLibraryItem.item_type == item.item_type,
        UserLibraryItem.external_id == item.external_id
    ).first()
    
    status_val = UserLibraryStatusEnum.COMPLETED
    if item.item_type in ("book", "comic", "manga"):
        status_val = UserLibraryStatusEnum.READ
        
    from datetime import datetime, timezone
    
    if existing:
        existing.status = status_val
        existing.completed_at = datetime.now(timezone.utc)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        lib_item = UserLibraryItem(
            user_id=user_id,
            item_type=item.item_type,
            external_id=item.external_id,
            title=item.title,
            image_url=item.image_url,
            status=status_val,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(lib_item)

@router.post("/items/{item_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_item_progress(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify the item exists
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
        
    if item.external_id:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.item_type == item.item_type,
            ItemProgress.external_id == item.external_id
        ).first()
    else:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.list_item_id == item_id
        ).first()
    
    if progress:
        progress.is_completed = not progress.is_completed
        if progress.is_completed:
            progress.is_skipped = False
        progress.completed_at = datetime.now(timezone.utc) if progress.is_completed else None
    else:
        if item.external_id:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=item.item_type,
                external_id=item.external_id,
                list_item_id=item_id, # Link for reference
                is_completed=True,
                is_skipped=False,
                completed_at=datetime.now(timezone.utc)
            )
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                list_item_id=item_id,
                is_completed=True,
                is_skipped=False,
                completed_at=datetime.now(timezone.utc)
            )
        db.add(progress)
        
    if progress.is_completed:
        auto_add_to_library(db, current_user.id, item)
        
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_completed",
            item_title=item.title,
            item_type=item.item_type,
            details="completed"
        )
        db.add(activity)
        
    db.commit()
    return {
        "item_id": item_id,
        "is_completed": progress.is_completed
    }

# Bulk toggle progress for items in a list
@router.post("/{list_id}/items/bulk-toggle", status_code=status.HTTP_200_OK)
def bulk_toggle_items_progress(
    list_id: int,
    req_body: BulkToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for item_id in req_body.item_ids:
        item = db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()
        if not item:
            continue
        
        if item.external_id:
            progress = db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.item_type == item.item_type,
                ItemProgress.external_id == item.external_id
            ).first()
        else:
            progress = db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.list_item_id == item_id
            ).first()
            
        if progress:
            progress.is_completed = req_body.completed
            if req_body.completed:
                progress.is_skipped = False
            progress.completed_at = datetime.now(timezone.utc) if req_body.completed else None
        else:
            if item.external_id:
                progress = ItemProgress(
                    user_id=current_user.id,
                    item_type=item.item_type,
                    external_id=item.external_id,
                    list_item_id=item_id,
                    is_completed=req_body.completed,
                    is_skipped=False,
                    completed_at=datetime.now(timezone.utc) if req_body.completed else None
                )
            else:
                progress = ItemProgress(
                    user_id=current_user.id,
                    list_item_id=item_id,
                    is_completed=req_body.completed,
                    is_skipped=False,
                    completed_at=datetime.now(timezone.utc) if req_body.completed else None
                )
            db.add(progress)
            
        if req_body.completed:
            auto_add_to_library(db, current_user.id, item)
            
            # Record activity log
            activity = UserActivityLog(
                user_id=current_user.id,
                activity_type="item_completed",
                item_title=item.title,
                item_type=item.item_type,
                details="completed"
            )
            db.add(activity)
            
    db.commit()
    return {"status": "success"}

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

# 15. Toggle Skip: Mark/unmark an item as skipped
@router.post("/items/{item_id}/toggle-skip")
def toggle_item_skip(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(ListItem).filter(ListItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")
        
    reading_list = db.query(ReadingList).filter(ReadingList.id == item.list_id).first()
    if reading_list.visibility == VisibilityEnum.PRIVATE and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Item belongs to a private list you don't access"
        )
        
    if item.external_id:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.item_type == item.item_type,
            ItemProgress.external_id == item.external_id
        ).first()
    else:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.list_item_id == item_id
        ).first()
    
    if progress:
        progress.is_skipped = not progress.is_skipped
        if progress.is_skipped:
            progress.is_completed = False
        progress.completed_at = datetime.now(timezone.utc) if progress.is_skipped else None
    else:
        if item.external_id:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=item.item_type,
                external_id=item.external_id,
                list_item_id=item_id,
                is_completed=False,
                is_skipped=True,
                completed_at=datetime.now(timezone.utc)
            )
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                list_item_id=item_id,
                is_completed=False,
                is_skipped=True,
                completed_at=datetime.now(timezone.utc)
            )
        db.add(progress)
        
    db.commit()
    return {
        "item_id": item_id,
        "is_skipped": progress.is_skipped,
        "is_completed": progress.is_completed
    }

# 16. Bulk Section Action (Skip, Unskip, Complete, Reset)
@router.post("/{list_id}/sections/bulk-action")
def bulk_section_action(
    list_id: int,
    action_req: SectionBulkActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    if reading_list.visibility == VisibilityEnum.PRIVATE and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This is a private list you don't access"
        )
        
    # Get all items in this list belonging to the specified section
    items = db.query(ListItem).filter(
        ListItem.list_id == list_id,
        ListItem.section == action_req.section_name
    ).all()
    
    if not items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No items found in section '{action_req.section_name}' for this list"
        )
        
    item_ids = [i.id for i in items]
    
    # Load all user progress records first to avoid N+1 queries
    all_user_progress = db.query(ItemProgress).filter(ItemProgress.user_id == current_user.id).all()
    
    # Maps
    external_progress = {(p.item_type.lower() if p.item_type else "", p.external_id): p for p in all_user_progress if p.external_id}
    custom_progress = {p.list_item_id: p for p in all_user_progress if p.list_item_id and not p.external_id}
    
    action = action_req.action.lower()
    
    for item in items:
        # Find record
        if item.external_id:
            rec = external_progress.get((item.item_type.lower(), item.external_id))
        else:
            rec = custom_progress.get(item.id)
            
        if action == "skip":
            if rec:
                rec.is_skipped = True
                rec.is_completed = False
                rec.completed_at = datetime.now(timezone.utc)
            else:
                if item.external_id:
                    new_rec = ItemProgress(
                        user_id=current_user.id,
                        item_type=item.item_type,
                        external_id=item.external_id,
                        list_item_id=item.id,
                        is_completed=False,
                        is_skipped=True,
                        completed_at=datetime.now(timezone.utc)
                    )
                else:
                    new_rec = ItemProgress(
                        user_id=current_user.id,
                        list_item_id=item.id,
                        is_completed=False,
                        is_skipped=True,
                        completed_at=datetime.now(timezone.utc)
                    )
                db.add(new_rec)
        elif action == "unskip":
            if rec:
                rec.is_skipped = False
                rec.completed_at = None
        elif action == "complete":
            if rec:
                rec.is_completed = True
                rec.is_skipped = False
                rec.completed_at = datetime.now(timezone.utc)
            else:
                if item.external_id:
                    new_rec = ItemProgress(
                        user_id=current_user.id,
                        item_type=item.item_type,
                        external_id=item.external_id,
                        list_item_id=item.id,
                        is_completed=True,
                        is_skipped=False,
                        completed_at=datetime.now(timezone.utc)
                    )
                else:
                    new_rec = ItemProgress(
                        user_id=current_user.id,
                        list_item_id=item.id,
                        is_completed=True,
                        is_skipped=False,
                        completed_at=datetime.now(timezone.utc)
                    )
                db.add(new_rec)
        elif action == "uncomplete":
            if rec:
                rec.is_completed = False
                rec.completed_at = None
                
    db.commit()
    return {"message": f"Section '{action_req.section_name}' items updated successfully with action '{action}'"}

@router.post("/{list_id}/toggle-tmdb-episode", status_code=status.HTTP_200_OK)
def toggle_tmdb_episode(
    list_id: int,
    ep_req: ToggleTMDBEpisodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify the private list exists and belongs to this user
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    if reading_list.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this list")
        
    ext_id = f"tmdb-ep-{ep_req.tmdb_episode_id}"
    
    # Check if ListItem already exists
    item = db.query(ListItem).filter(
        ListItem.list_id == list_id,
        ListItem.external_id == ext_id
    ).first()
    
    if not item:
        # Create dynamically
        # Let's count current items to calculate order_index
        item_count = db.query(ListItem).filter(ListItem.list_id == list_id).count()
        item = ListItem(
            list_id=list_id,
            order_index=item_count + 1,
            item_type=ItemTypeEnum.SERIES,
            external_id=ext_id,
            title=ep_req.title,
            image_url=ep_req.image_url,
            custom_notes=ep_req.overview,
            section=f"Season {ep_req.season_number}"
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        
    # Toggle progress
    progress = db.query(ItemProgress).filter(
        ItemProgress.user_id == current_user.id,
        ItemProgress.external_id == ext_id
    ).first()
    
    if progress:
        progress.is_completed = not progress.is_completed
        progress.completed_at = datetime.now(timezone.utc) if progress.is_completed else None
    else:
        progress = ItemProgress(
            user_id=current_user.id,
            item_type=ItemTypeEnum.SERIES,
            external_id=ext_id,
            list_item_id=item.id,
            is_completed=True,
            is_skipped=False,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress)
        
    if progress.is_completed:
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_completed",
            item_title=item.title,
            item_type="series",
            details="completed"
        )
        db.add(activity)
        
    db.commit()
    
    # Run TV Series general UserLibraryItem automatic transitions
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    
    if lib_item:
        # 1. Count completed episodes in this tracking list
        completed_episodes = db.query(ItemProgress).join(ListItem).filter(
            ItemProgress.user_id == current_user.id,
            ListItem.list_id == list_id,
            ItemProgress.is_completed == True
        ).all()
        
        completed_count = len(completed_episodes)
        
        if completed_count > 0:
            # Check if all episodes across all seasons are completed
            total_episodes = 99999
            try:
                series_id = int(lib_item.external_id)
                series_detail = TMDBService.get_series_detail(series_id)
                total_episodes = series_detail.get("number_of_episodes") or 99999
            except Exception:
                pass
                
            if completed_count >= total_episodes:
                lib_item.status = UserLibraryStatusEnum.COMPLETED
                lib_item.completed_at = datetime.now(timezone.utc)
            else:
                lib_item.status = UserLibraryStatusEnum.WATCHING
                lib_item.completed_at = None
                
            # Find last completed episode
            last_completed = db.query(ListItem).join(ItemProgress).filter(
                ListItem.list_id == list_id,
                ItemProgress.user_id == current_user.id,
                ItemProgress.is_completed == True
            ).order_by(ListItem.id.desc()).first() # newest entry first
            
            if last_completed:
                lib_item.last_seen_episode = last_completed.title
        else:
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            lib_item.completed_at = None
            lib_item.last_seen_episode = None
            
        lib_item.updated_at = datetime.now(timezone.utc)
        db.commit()
        
    return {
        "item_id": item.id,
        "is_completed": progress.is_completed,
        "completed_at": progress.completed_at.isoformat() if (progress.completed_at and progress.is_completed) else None
    }

@router.post("/{list_id}/bulk-toggle-season", status_code=status.HTTP_200_OK)
def bulk_toggle_season(
    list_id: int,
    req: BulkToggleSeasonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    if reading_list.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    
    series_title = lib_item.title if lib_item else "Series"
    
    # Resolve episodes list (fetch from TMDB directly if not supplied)
    episodes_list = req.episodes
    if not episodes_list:
        if lib_item and lib_item.external_id:
            try:
                series_id = int(lib_item.external_id)
                episodes_list = TMDBService.get_season_episodes(series_id, req.season_number) or []
            except Exception as e:
                print(f"Failed to fetch episodes for bulk toggle in backend: {e}")
                episodes_list = []
        else:
            episodes_list = []

    # Get initial item count to increment index in memory
    item_count = db.query(ListItem).filter(ListItem.list_id == list_id).count()

    for ep in episodes_list:
        ext_id = f"tmdb-ep-{ep.get('id')}"
        item = db.query(ListItem).filter(
            ListItem.list_id == list_id,
            ListItem.external_id == ext_id
        ).first()
        
        if not item:
            item_count += 1
            item = ListItem(
                list_id=list_id,
                order_index=item_count,
                item_type=ItemTypeEnum.SERIES,
                external_id=ext_id,
                title=f"{series_title} - S{req.season_number:02d}E{ep.get('episode_number', 1):02d} - {ep.get('name', 'Untitled')}",
                image_url=f"https://image.tmdb.org/t/p/w185{ep.get('still_path')}" if ep.get('still_path') else None,
                custom_notes=ep.get('overview'),
                section=f"Season {req.season_number}"
            )
            db.add(item)
            # Flush so item.id is populated for ItemProgress mapping without full transaction commit
            db.flush()
            
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.external_id == ext_id
        ).first()
        
        if progress:
            progress.is_completed = req.completed
            progress.completed_at = datetime.now(timezone.utc) if req.completed else None
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=ItemTypeEnum.SERIES,
                external_id=ext_id,
                list_item_id=item.id,
                is_completed=req.completed,
                is_skipped=False,
                completed_at=datetime.now(timezone.utc) if req.completed else None
            )
            db.add(progress)
            
    db.commit()
    
    if lib_item:
        completed_episodes = db.query(ItemProgress).join(ListItem).filter(
            ItemProgress.user_id == current_user.id,
            ListItem.list_id == list_id,
            ItemProgress.is_completed == True
        ).all()
        
        completed_count = len(completed_episodes)
        
        if completed_count > 0:
            total_episodes = 99999
            try:
                series_id = int(lib_item.external_id)
                series_detail = TMDBService.get_series_detail(series_id)
                total_episodes = series_detail.get("number_of_episodes") or 99999
            except Exception:
                pass
                
            if completed_count >= total_episodes:
                lib_item.status = UserLibraryStatusEnum.COMPLETED
                lib_item.completed_at = datetime.now(timezone.utc)
            else:
                lib_item.status = UserLibraryStatusEnum.WATCHING
                lib_item.completed_at = None
                
            last_completed = db.query(ListItem).join(ItemProgress).filter(
                ListItem.list_id == list_id,
                ItemProgress.user_id == current_user.id,
                ItemProgress.is_completed == True
            ).order_by(ListItem.id.desc()).first()
            
            if last_completed:
                lib_item.last_seen_episode = last_completed.title
        else:
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            lib_item.completed_at = None
            lib_item.last_seen_episode = None
            
        lib_item.updated_at = datetime.now(timezone.utc)
        db.commit()
        
    return {"message": "Season progress toggled successfully"}




