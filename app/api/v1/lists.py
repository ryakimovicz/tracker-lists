from datetime import datetime, timezone
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.addition import ListAddition, UserAdoptedAddition
from app.models.social import ListVote
from app.services.tvmaze import TVMazeService
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.activity import UserActivityLog
from app.api.v1.users import check_user_is_pro
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
    ToggleSeriesEpisodeRequest,
    BulkToggleSeasonRequest,
    BulkToggleAllSeasonsRequest
)

router = APIRouter()

# 1. Feed: Get public lists
@router.get("/", response_model=List[ReadingListResponse])
def get_public_lists(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
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
    # Enforce limit of 2 created guides for free users
    is_pro = check_user_is_pro(current_user)
    if not is_pro:
        existing_created = db.query(ReadingList).filter(ReadingList.creator_id == current_user.id).count()
        if existing_created >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los usuarios gratuitos pueden crear un máximo de 2 guías. Pásate a Pathd Premium para crear guías ilimitadas."
            )
        # Free users can only create public guides
        intended = "public"
    else:
        # Enforce draft state on initial creation, saving intended visibility inside section_descriptions
        intended = list_in.visibility.value if list_in.visibility else "public"

    new_list = ReadingList(
        creator_id=current_user.id,
        title=list_in.title,
        description=list_in.description,
        visibility=VisibilityEnum.DRAFT,
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
            list_id=new_list.id,
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
        has_access = False
        if current_user:
            if reading_list.creator_id == current_user.id or getattr(current_user, 'is_admin', False):
                has_access = True
            else:
                # Check if this list belongs to a library item tracking card of the user
                tracking_lib_item = db.query(UserLibraryItem).filter(
                    UserLibraryItem.user_id == current_user.id,
                    UserLibraryItem.tracking_list_id == list_id
                ).first()
                if tracking_lib_item:
                    has_access = True
                    if reading_list.creator_id != current_user.id:
                        reading_list.creator_id = current_user.id
                        db.commit()
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this list"
            )

    # Auto-heal creator_id if orphaned tracking list
    if current_user and reading_list.creator_id is None:
        tracking_lib_item = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.tracking_list_id == list_id
        ).first()
        if tracking_lib_item:
            reading_list.creator_id = current_user.id
            db.commit()

    # Check if saved by current user
    is_saved_by_me = False
    if current_user:
        saved_record = db.query(SavedList).filter(
            SavedList.user_id == current_user.id,
            SavedList.list_id == list_id
        ).first()
        is_saved_by_me = saved_record is not None

    
    creator = db.query(User).filter(User.id == reading_list.creator_id).first() if reading_list.creator_id else None
    creator_username = creator.username if creator else "Comunidad de Pathd"

    # Calculate edit permissions
    can_edit = False
    if current_user:
        if bool(getattr(current_user, 'is_admin', False)):
            can_edit = True
        elif reading_list.creator_id == current_user.id:
            if check_user_is_pro(current_user):
                can_edit = True
            else:
                user_lists_ids = [l.id for l in db.query(ReadingList.id).filter(ReadingList.creator_id == current_user.id).order_by(ReadingList.created_at.asc()).limit(2).all()]
                can_edit = reading_list.id in user_lists_ids

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
        
        seen_addition_ids = set()
        for add in (user_additions + adopted_additions):
            if add.id in seen_addition_ids:
                continue
            seen_addition_ids.add(add.id)
            for item in add.items:
                is_comp, is_skip = addition_progress_map.get(item.id, (False, False))
                # For additions, inherited_importance_rank is the target item rank or 1
                inherited_rank = None
                if add.target_list_item:
                    inherited_rank = add.target_list_item.importance_rank
                
                addition_items.append(
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
                        importance_rank=item.importance_rank,
                        is_nsfw=getattr(item, 'is_nsfw', False),
                        is_completed=is_comp,
                        is_skipped=is_skip,
                        is_addition=True,
                        addition_id=add.id,
                        addition_item_id=item.id,
                        inherited_importance_rank=inherited_rank
                    )
                )

    # Process base items
    formatted_base_items = []
    for item in items:
        # Check progress
        if item.external_id:
            key = (item.item_type.value.lower() if hasattr(item.item_type, 'value') else str(item.item_type).lower(), item.external_id)
            is_comp, is_skip = external_progress_map.get(key, (False, False))
        else:
            is_comp, is_skip = custom_progress_map.get(item.id, (False, False))

        formatted_base_items.append(
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
                importance_rank=item.importance_rank,
                is_nsfw=getattr(item, 'is_nsfw', False),
                is_completed=is_comp,
                is_skipped=is_skip,
                is_addition=False
            )
        )


    # If draft mode requested and user is creator, return draft metadata
    list_title = reading_list.title
    list_desc = reading_list.description
    
    if draft and current_user and reading_list.creator_id == current_user.id:
        sd = reading_list.section_descriptions or {}
        if "draft_title" in sd:
            list_title = sd.get("draft_title")
        if "draft_description" in sd:
            list_desc = sd.get("draft_description")
        
        # When drafting, return items mapped by draft_flow
        draft_flow = sd.get("draft_flow", None)
        if draft_flow is not None:
            # Reconstruct list from draft_flow metadata
            items_by_id = {item.id: item for item in formatted_base_items}
            reconstructed = []
            order = 0
            for entry in draft_flow:
                if entry.get("type") == "item":
                    base_id = entry.get("id")
                    if base_id in items_by_id:
                        itm = items_by_id[base_id]
                        itm.order_index = order
                        itm.section = entry.get("section")
                        reconstructed.append(itm)
                        order += 1
            formatted_base_items = reconstructed

    # Merge base items with addition items
    merged_items = formatted_base_items + addition_items
    merged_total = len(merged_items)

    completed_count = sum(1 for i in merged_items if i.is_completed)
    skipped_count = sum(1 for i in merged_items if i.is_skipped)
    progress_percentage = (completed_count / merged_total * 100) if merged_total > 0 else 0
    skipped_percentage = (skipped_count / merged_total * 100) if merged_total > 0 else 0

    all_votes = db.query(ListVote).filter(ListVote.list_id == list_id).all()
    total_ratings = len(all_votes)
    avg_rating = sum(v.rating for v in all_votes) / total_ratings if total_ratings > 0 else None
    user_rating = None
    if current_user:
        user_vote = db.query(ListVote).filter(
            ListVote.user_id == current_user.id,
            ListVote.list_id == list_id
        ).first()
        if user_vote:
            user_rating = user_vote.rating

    return ReadingListDetailsResponse(
        id=reading_list.id,
        creator_id=reading_list.creator_id,
        title=list_title,
        description=list_desc,
        visibility=reading_list.visibility,
        created_at=reading_list.created_at,
        creator_username=creator_username,
        creator_photo_url=creator.photo_url if creator else None,
        is_saved_by_me=is_saved_by_me,
        can_edit=can_edit,
        completed_count=completed_count,
        skipped_count=skipped_count,
        total_count=merged_total,
        progress_percentage=round(progress_percentage, 2),
        skipped_percentage=round(skipped_percentage, 2),
        user_rating=user_rating,
        average_rating=round(avg_rating, 1) if avg_rating is not None else None,
        total_ratings=total_ratings,
        section_descriptions=reading_list.section_descriptions,
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
        
    is_admin = bool(getattr(current_user, 'is_admin', False))
    if not is_admin:
        if reading_list.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el creador puede modificar esta guía"
            )
        if not check_user_is_pro(current_user):
            # Check if this list is among the first 2 created
            user_lists_ids = [l.id for l in db.query(ReadingList.id).filter(ReadingList.creator_id == current_user.id).order_by(ReadingList.created_at.asc()).limit(2).all()]
            if reading_list.id not in user_lists_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta guía está en modo solo lectura. Pasa a Premium para editarla."
                )
            # Free users cannot switch to private or unlisted
            if list_in.visibility in (VisibilityEnum.PRIVATE, VisibilityEnum.UNLISTED):
                list_in.visibility = VisibilityEnum.PUBLIC
                
    old_title = reading_list.title
    old_visibility = reading_list.visibility
    old_flow = reading_list.section_descriptions.get("flow", []) if reading_list.section_descriptions else []
    update_data = list_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reading_list, field, value)
        
    db.commit()
    db.refresh(reading_list)

    # Log activity only on explicit publish or title change
    title_changed = "title" in update_data and old_title != update_data["title"]
    visibility_changed = "visibility" in update_data and old_visibility != update_data["visibility"]
    
    if title_changed or visibility_changed:
        act_type = "guide_updated"
        if old_visibility == VisibilityEnum.DRAFT and reading_list.visibility in (VisibilityEnum.PUBLIC, VisibilityEnum.PRIVATE):
            act_type = "guide_published"

        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type=act_type,
            item_title=reading_list.title,
            item_type="guide",
            list_id=reading_list.id,
            details="published" if act_type == "guide_published" else "updated"
        )
        db.add(activity)
        
    if "section_descriptions" in update_data:
        new_flow = update_data["section_descriptions"].get("flow", [])
        edited_title = reading_list.title
        edited_type = "block"
        edited_id = ""
        block_changed = False
        
        def extract_elements(flow):
            els = {}
            for el in flow:
                if "id" in el:
                    els[el["id"]] = el
                if "subblocks" in el:
                    for sub in el["subblocks"]:
                        if "id" in sub:
                            els[sub["id"]] = sub
            return els
            
        old_els = extract_elements(old_flow)
        new_els = extract_elements(new_flow)
        
        for el_id, new_el in reversed(list(new_els.items())):
            if el_id not in old_els:
                edited_title = new_el.get("title") or ""
                edited_type = new_el.get("type", "block")
                edited_id = el_id
                block_changed = True
                break
            else:
                old_el_no_items = {k: v for k, v in old_els[el_id].items() if k != 'items'}
                new_el_no_items = {k: v for k, v in new_el.items() if k != 'items'}
                if old_el_no_items != new_el_no_items:
                    edited_title = new_el.get("title") or ""
                    edited_type = new_el.get("type", "block")
                    edited_id = el_id
                    block_changed = True
                    break
                
        if not block_changed and len(old_els) != len(new_els):
            # A block was removed
            edited_title = ""
            edited_type = "block"
            block_changed = True
            
        if block_changed:
            activity_title = f"type:{edited_type}|id:{edited_id}|title:{edited_title}" if edited_title != reading_list.title else reading_list.title

            activity_block = UserActivityLog(
                user_id=current_user.id,
                activity_type="block_edited",
                item_title=activity_title,
                item_type="guide",
                list_id=reading_list.id,
                details=f"list_id:{reading_list.id}"
            )
            db.add(activity_block)
        
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
        
    is_admin = bool(getattr(current_user, 'is_admin', False))
    if not is_admin and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el creador puede eliminar esta guía"
        )
        
    # Record activity log before deletion
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_deleted",
        item_title=reading_list.title,
        item_type="guide",
        list_id=reading_list.id,
        details="deleted"
    )
    db.add(activity)

    # Check if other users are following this guide
    other_followers = db.query(SavedList).filter(
        SavedList.list_id == list_id,
        SavedList.user_id != current_user.id
    ).count()

    if other_followers > 0:
        # Soft Orphan: Disassociate from author so it becomes a community guide and frees author's creation slot
        reading_list.creator_id = None
        # Remove author's own saved entry
        db.query(SavedList).filter(
            SavedList.list_id == list_id,
            SavedList.user_id == current_user.id
        ).delete()
        db.commit()
    else:
        # Hard delete if no one else follows it
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
        
    is_admin = bool(getattr(current_user, 'is_admin', False))
    if not is_admin:
        if reading_list.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can modify this list"
            )
        if not check_user_is_pro(current_user):
            user_lists_ids = [l.id for l in db.query(ReadingList.id).filter(ReadingList.creator_id == current_user.id).order_by(ReadingList.created_at.asc()).limit(2).all()]
            if reading_list.id not in user_lists_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta guía está en modo solo lectura. Pasa a Premium para editarla."
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

    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="item_added",
        item_title=new_item.title,
        item_type=new_item.item_type,
        external_id=new_item.external_id,
        image_url=new_item.image_url,
        details=f"list_id:{list_id}"
    )
    db.add(activity)
    db.commit()

    return new_item

# 7. Remove item from list
@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item_from_list(
    list_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        
    is_admin = bool(getattr(current_user, 'is_admin', False))
    if not is_admin:
        if reading_list.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can modify this list"
            )
        if not check_user_is_pro(current_user):
            user_lists_ids = [l.id for l in db.query(ReadingList.id).filter(ReadingList.creator_id == current_user.id).order_by(ReadingList.created_at.asc()).limit(2).all()]
            if reading_list.id not in user_lists_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta guía está en modo solo lectura. Pasa a Premium para editarla."
                )
        
    item = db.query(ListItem).filter(
        ListItem.id == item_id,
        ListItem.list_id == list_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in list")
        
    db.delete(item)
    
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="item_removed",
        item_title=item.title,
        item_type=item.item_type,
        external_id=item.external_id,
        image_url=item.image_url,
        details=f"list_id:{list_id}"
    )
    db.add(activity)
    
    db.commit()
    return None

# 8. Save/subscribe to a list in library
@router.post("/{list_id}/save", status_code=status.HTTP_200_OK)
def save_list_to_library(
    list_id: int,
    replace_last: bool = Query(False, description="Replace the 3rd followed guide if Free limit of 3 is reached"),
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
        
    # Free users limit: max 3 followed guides of other users (own created guides don't count)
    is_pro = check_user_is_pro(current_user)
    if not is_pro and reading_list.creator_id != current_user.id:
        saved_others = db.query(SavedList).join(ReadingList, SavedList.list_id == ReadingList.id)\
            .filter(SavedList.user_id == current_user.id, ReadingList.creator_id != current_user.id)\
            .order_by(SavedList.saved_at.asc()).all()

        if len(saved_others) >= 3:
            third_saved = saved_others[2]
            third_guide = third_saved.reading_list
            third_title = third_guide.title if third_guide else f"Guía #{third_saved.list_id}"

            if replace_last:
                # Automatically swap the 3rd followed guide
                db.delete(third_saved)
                db.flush()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "FOLLOW_LIMIT_REACHED",
                        "message": f"Has alcanzado el límite de 3 guías seguidas de otros usuarios. Si continúas, se intercambiará por '{third_title}'.",
                        "replace_guide_id": third_saved.list_id,
                        "replace_guide_title": third_title
                    }
                )

    saved = SavedList(user_id=current_user.id, list_id=list_id)
    db.add(saved)

    # Record activity log
    activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="guide_followed",
            item_title=reading_list.title,
            item_type="guide",
            list_id=reading_list.id,
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
    db.commit()

    # If the list is a community soft-orphan (creator_id is None) and has no remaining followers, purge it
    if reading_list and reading_list.creator_id is None:
        remaining = db.query(SavedList).filter(SavedList.list_id == list_id).count()
        if remaining == 0:
            db.delete(reading_list)
            db.commit()

    # Record activity log
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="guide_unfollowed",
        item_title=list_title,
        item_type="guide",
        list_id=list_id,
        details="unfollowed"
    )
    db.add(activity)
    db.commit()
    return {"message": "List removed from library successfully"}

# 10. Toggle item progress completion status
def auto_add_to_library(db: Session, user_id: int, item: ListItem):
    if not item.external_id:
        return
        
    target_item_type = item.item_type.value if hasattr(item.item_type, 'value') else item.item_type
    target_external_id = item.external_id
    target_title = item.title
    target_image_url = item.image_url
    show_name = None
    
    show_ext_id = None
    if item.external_id.startswith("tvm-ep-"):
        ep_id = item.external_id.replace("tvm-ep-", "")
        import urllib.request, json
        url = f"https://api.tvmaze.com/episodes/{ep_id}?embed=show"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    show = data.get("_embedded", {}).get("show", {})
                    if show:
                        show_name = show.get("name")
                        show_ext_id = f"tvm_{show.get('id')}"
        except Exception:
            pass

    # Check if user is following the parent series
    existing_series = None
    if show_name:
        existing_series = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.item_type.in_(["series", "anime"]),
            UserLibraryItem.title == show_name
        ).first()

    if item.external_id.startswith("tvm-ep-") and not existing_series:
        # Add loose episode card to library
        existing_ep = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.external_id == item.external_id
        ).first()
        
        if not existing_ep:
            lib_item = UserLibraryItem(
                user_id=user_id,
                item_type="episode",
                external_id=item.external_id,
                title=item.title,
                image_url=item.image_url,
                last_seen_episode=show_name or "Serie",
                status=UserLibraryStatusEnum.COMPLETED,
                completed_at=datetime.now(timezone.utc),
                imdb_id=show_ext_id
            )
            db.add(lib_item)
            db.commit()
        return

    if existing_series and item.external_id.startswith("tvm-ep-"):
        existing_series.last_seen_episode = item.title
        existing_series.updated_at = datetime.now(timezone.utc)
        if existing_series.status in (UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.COMPLETED):
            existing_series.status = UserLibraryStatusEnum.WATCHING
            existing_series.completed_at = None
        if existing_series.tracking_list_id:
            ep_in_tracker = db.query(ListItem).filter(
                ListItem.list_id == existing_series.tracking_list_id,
                ListItem.external_id == item.external_id
            ).first()
            if not ep_in_tracker:
                item_count = db.query(ListItem).filter(ListItem.list_id == existing_series.tracking_list_id).count()
                ep_item = ListItem(
                    list_id=existing_series.tracking_list_id,
                    order_index=item_count + 1,
                    item_type=ItemTypeEnum.SERIES,
                    external_id=item.external_id,
                    title=item.title,
                    image_url=item.image_url,
                    custom_notes=""
                )
                db.add(ep_item)
        db.commit()
        return

    # Regular media items (movies, books, games, comics, mangas, or full series)
    existing = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == user_id,
        UserLibraryItem.item_type == target_item_type,
        UserLibraryItem.external_id == target_external_id
    ).first()
    
    status_val = UserLibraryStatusEnum.COMPLETED
    if target_item_type in ("book", "comic", "manga"):
        status_val = UserLibraryStatusEnum.READ
        
    if not existing:
        lib_item = UserLibraryItem(
            user_id=user_id,
            item_type=target_item_type,
            external_id=target_external_id,
            title=target_title,
            image_url=target_image_url,
            status=status_val,
            completed_at=datetime.now(timezone.utc)
        )
        if target_item_type in ("series", "anime"):
            private_list = ReadingList(
                creator_id=user_id,
                title=f"Tracker: {target_title}",
                description=f"Auto-generated episode tracking for '{target_title}'",
                visibility=VisibilityEnum.PRIVATE
            )
            db.add(private_list)
            db.commit()
            db.refresh(private_list)
            lib_item.tracking_list_id = private_list.id
            
        db.add(lib_item)
        db.commit()
    else:
        existing.status = status_val
        existing.completed_at = datetime.now(timezone.utc)
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()

from typing import Optional

@router.post("/items/{item_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_item_progress(
    item_id: int,
    action: Optional[str] = None, # None=toggle, 'mark_again', 'remove'
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
            ItemProgress.item_type == (item.item_type.value if hasattr(item.item_type, 'value') else item.item_type),
            ItemProgress.external_id == item.external_id
        ).first()
        if not progress:
            progress = db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.list_item_id == item_id
            ).first()
    else:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.list_item_id == item_id
        ).first()
    
    # Needs to be imported inside or at the top
    from app.models.consumption import ConsumptionHistory
    
    now_dt = datetime.now(timezone.utc)
    just_marked_completed = False
    
    if progress:
        if action == "mark_again":
            progress.is_completed = True
            progress.completed_at = now_dt
            just_marked_completed = True
        elif action == "remove":
            progress.is_completed = False
            progress.completed_at = None
            
            # Also try to remove from user library if it's an episode that was added automatically
            if item.external_id and item.external_id.startswith("tvm-ep-"):
                db.query(UserLibraryItem).filter(
                    UserLibraryItem.user_id == current_user.id,
                    UserLibraryItem.external_id == item.external_id
                ).delete()
        else:
            # Default toggle
            progress.is_completed = not progress.is_completed
            if progress.is_completed:
                progress.is_skipped = False
            progress.completed_at = now_dt if progress.is_completed else None
            just_marked_completed = progress.is_completed
    else:
        # Prevent "remove" or "mark_again" if no progress exists (though shouldn't happen from UI)
        if action == "remove":
            return {"item_id": item_id, "is_completed": False}
            
        if item.external_id:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
                external_id=item.external_id,
                list_item_id=item_id, # Link for reference
                is_completed=True,
                is_skipped=False,
                completed_at=now_dt
            )
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                list_item_id=item_id,
                is_completed=True,
                is_skipped=False,
                completed_at=now_dt
            )
        db.add(progress)
        just_marked_completed = True
        
    if just_marked_completed:
        auto_add_to_library(db, current_user.id, item)
        
        # Add to ConsumptionHistory
        ch = ConsumptionHistory(
            user_id=current_user.id,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            list_item_id=item_id,
            consumed_at=now_dt
        )
        db.add(ch)
        
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_completed",
            item_title=item.title,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            image_url=item.image_url,
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
            external_id=item.external_id,
            image_url=item.image_url,
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
        series = TVMazeService.get_series_detail(import_req.series_id)
        if not series:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Series not found in TVMaze")
            
        poster = series.get("poster_path")
        image_url = poster if poster else None
        
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

        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_added",
            item_title=series.get("name") or "Untitled Series",
            item_type="series",
            details=f"list_id:{list_id}"
        )
        db.add(activity)
        
    elif import_req.import_type == TVImportType.SEASON:
        if import_req.season_number is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="season_number is required for season imports")
            
        series = TVMazeService.get_series_detail(import_req.series_id)
        series_name = series.get("name") if series else "Series"
        
        episodes = TVMazeService.get_season_episodes(import_req.series_id, import_req.season_number)
        if not episodes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No episodes found for this season in TVMaze")
            
        for ep in episodes:
            ep_num = ep.get("episode_number")
            ep_name = ep.get("name") or "Untitled Episode"
            title = f"{series_name} - S{import_req.season_number:02d}E{ep_num:02d} - {ep_name}"
            
            still = ep.get("still_path")
            image_url = still if still else None
            
            item = ListItem(
                list_id=list_id,
                order_index=order_idx,
                item_type=ItemTypeEnum.SERIES,
                external_id=f"tvm-ep-{ep.get('id')}",
                title=title,
                image_url=image_url,
                custom_notes=ep.get("overview"),
                section=f"Season {import_req.season_number}"
            )
            db.add(item)
            created_items.append(item)
            
            activity = UserActivityLog(
                user_id=current_user.id,
                activity_type="item_added",
                item_title=title,
                item_type="series",
                details=f"list_id:{list_id}"
            )
            db.add(activity)

            order_idx += 1
            
    elif import_req.import_type == TVImportType.EPISODE:
        if import_req.season_number is None or import_req.episode_number is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="season_number and episode_number are required for episode imports")
            
        series = TVMazeService.get_series_detail(import_req.series_id)
        series_name = series.get("name") if series else "Series"
        
        ep = TVMazeService.get_episode_detail(import_req.series_id, import_req.season_number, import_req.episode_number)
        if not ep:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Episode not found in TVMaze")
            
        ep_name = ep.get("name") or "Untitled Episode"
        title = f"{series_name} - S{import_req.season_number:02d}E{import_req.episode_number:02d} - {ep_name}"
        
        still = ep.get("still_path")
        image_url = still if still else None
        
        item = ListItem(
            list_id=list_id,
            order_index=order_idx,
            item_type=ItemTypeEnum.SERIES,
            external_id=f"tvm-ep-{ep.get('id')}",
            title=title,
            image_url=image_url,
            custom_notes=ep.get("overview"),
            section=f"Season {import_req.season_number}"
        )
        db.add(item)
        created_items.append(item)
        
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_added",
            item_title=title,
            item_type="series",
            details=f"list_id:{list_id}"
        )
        db.add(activity)
        
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
    search_pattern = f"%{q.strip()}%"
    lists = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        (ReadingList.title.ilike(search_pattern) | ReadingList.description.ilike(search_pattern))
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
        
    if "order_index" in update_data:
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_moved",
            item_title=item.title,
            item_type=item.item_type,
            external_id=item.external_id,
            image_url=item.image_url,
            details=f"list_id:{list_id}"
        )
        db.add(activity)
        
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

def check_series_completion(user_id: int, ep_external_id: str):
    # This runs in background to check if the full series is watched
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        if not ep_external_id.startswith("tvm-ep-"):
            return
        ep_id = ep_external_id.replace("tvm-ep-", "")
        import urllib.request, json
        # 1. Get show id from episode
        url = f"https://api.tvmaze.com/episodes/{ep_id}?embed=show"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        show_id = None
        show_name = None
        show_image = None
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                show = data.get("_embedded", {}).get("show", {})
                if show:
                    show_id = show.get("id")
                    show_name = show.get("name")
                    show_image = show.get("image", {}).get("original") if show.get("image") else None
        
        if not show_id:
            return
            
        # 2. Get all episodes for the show
        episodes_url = f"https://api.tvmaze.com/shows/{show_id}/episodes"
        req2 = urllib.request.Request(episodes_url, headers={"User-Agent": "TrackerLists/1.0"})
        with urllib.request.urlopen(req2, timeout=5) as response2:
            if response2.status == 200:
                episodes = json.loads(response2.read().decode())
                # Filter out episodes that haven't aired yet
                import datetime
                today = datetime.datetime.now().strftime("%Y-%m-%d")
                aired_episodes = [ep for ep in episodes if ep.get("airdate") and ep.get("airdate") <= today]
                total_aired = len(aired_episodes)
                
                if total_aired == 0:
                    return
                
                # 3. Check user's progress
                from app.models.consumption import ItemProgress
                from app.models.library import UserLibraryItem, UserLibraryStatusEnum
                
                aired_ep_ids = [f"tvm-ep-{ep['id']}" for ep in aired_episodes]
                
                completed_count = db.query(ItemProgress).filter(
                    ItemProgress.user_id == user_id,
                    ItemProgress.external_id.in_(aired_ep_ids),
                    ItemProgress.is_completed == True
                ).count()
                
                if completed_count >= total_aired:
                    # Mark series as completed
                    show_ext_id = f"tvm_{show_id}"
                    existing_series = db.query(UserLibraryItem).filter(
                        UserLibraryItem.user_id == user_id,
                        UserLibraryItem.external_id == show_ext_id
                    ).first()
                    
                    if existing_series:
                        existing_series.status = UserLibraryStatusEnum.COMPLETED
                        from datetime import timezone
                        existing_series.completed_at = datetime.datetime.now(timezone.utc)
                    else:
                        from datetime import timezone
                        new_series = UserLibraryItem(
                            user_id=user_id,
                            item_type="series",
                            external_id=show_ext_id,
                            title=show_name,
                            image_url=show_image,
                            status=UserLibraryStatusEnum.COMPLETED,
                            completed_at=datetime.datetime.now(timezone.utc),
                            imdb_id=show_ext_id
                        )
                        db.add(new_series)
                    
                    # Remove loose episodes
                    db.query(UserLibraryItem).filter(
                        UserLibraryItem.user_id == user_id,
                        UserLibraryItem.item_type == "episode",
                        UserLibraryItem.external_id.in_(aired_ep_ids)
                    ).delete(synchronize_session=False)
                    
                    db.commit()
    except Exception as e:
        print(f"Error checking series completion: {e}")
    finally:
        db.close()

@router.post("/{list_id}/toggle-series-episode", status_code=status.HTTP_200_OK)
def toggle_series_episode(
    list_id: int,
    ep_req: ToggleSeriesEpisodeRequest,
    background_tasks: BackgroundTasks,
    action: Optional[str] = None, # None=toggle, 'mark_again', 'remove'
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify the private list exists and belongs to this user
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    
    has_access = (reading_list.creator_id == current_user.id or getattr(current_user, 'is_admin', False))
    if not has_access:
        tracking_lib_item = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.tracking_list_id == list_id
        ).first()
        if tracking_lib_item:
            has_access = True
            if reading_list.creator_id != current_user.id:
                reading_list.creator_id = current_user.id
                db.commit()
                
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this list")

        
    ext_id = f"tvm-ep-{ep_req.episode_id}"
    
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
            custom_notes=json.dumps({"description": ep_req.overview or "", "release_date": None}),
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
    
    from app.models.consumption import ConsumptionHistory
    now_dt = datetime.now(timezone.utc)
    just_marked = False
    
    if progress:
        if action == "mark_again":
            progress.is_completed = True
            progress.list_item_id = item.id
            progress.completed_at = now_dt
            just_marked = True
        elif action == "remove":
            progress.is_completed = False
            progress.list_item_id = item.id
            progress.completed_at = None
            
            # Remove from user library
            db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.external_id == ext_id
            ).delete()
        else:
            progress.is_completed = not progress.is_completed
            progress.list_item_id = item.id
            progress.completed_at = now_dt if progress.is_completed else None
            just_marked = progress.is_completed
    else:
        if action == "remove":
            return {"is_completed": False, "completed_at": None}
            
        progress = ItemProgress(
            user_id=current_user.id,
            item_type=ItemTypeEnum.SERIES,
            external_id=ext_id,
            list_item_id=item.id,
            is_completed=True,
            is_skipped=False,
            completed_at=now_dt
        )
        db.add(progress)
        just_marked = True
        
    if just_marked:
        auto_add_to_library(db, current_user.id, item)
        background_tasks.add_task(check_series_completion, current_user.id, ext_id)
        
        ch = ConsumptionHistory(
            user_id=current_user.id,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            list_item_id=item.id,
            consumed_at=now_dt
        )
        db.add(ch)
        
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="item_completed",
            item_title=item.title,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            image_url=item.image_url,
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
        completed_progs = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.is_completed == True
        ).all()
        
        completed_ep_titles = []
        for p in completed_progs:
            li = None
            if p.list_item_id:
                li = db.query(ListItem).filter(ListItem.id == p.list_item_id, ListItem.list_id == list_id).first()
            if not li and p.external_id:
                li = db.query(ListItem).filter(ListItem.external_id == p.external_id, ListItem.list_id == list_id).first()
            if li:
                completed_ep_titles.append(li.title)
                
        if completed_ep_titles:
            import re
            ep_tuples = []
            for t in completed_ep_titles:
                m = re.search(r'S(\d+)E(\d+)', t, re.IGNORECASE)
                if m:
                    ep_tuples.append((int(m.group(1)), int(m.group(2)), t))
            if ep_tuples:
                ep_tuples.sort(key=lambda x: (x[0], x[1]))
                lib_item.last_seen_episode = ep_tuples[-1][2]
            else:
                lib_item.last_seen_episode = completed_ep_titles[-1]
            lib_item.status = UserLibraryStatusEnum.WATCHING
        else:
            lib_item.last_seen_episode = None
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            
        lib_item.updated_at = datetime.now(timezone.utc)
        db.commit()
    else:
        if progress.is_completed:
            auto_add_to_library(db, current_user.id, item)
        
    return {
        "item_id": item.id,
        "is_completed": progress.is_completed,
        "completed_at": progress.completed_at.isoformat() if (progress.completed_at and progress.is_completed) else None
    }

from fastapi import BackgroundTasks

@router.post("/{list_id}/bulk-toggle-season", status_code=status.HTTP_200_OK)
def bulk_toggle_season(
    list_id: int,
    req: BulkToggleSeasonRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    
    has_access = (reading_list.creator_id == current_user.id or getattr(current_user, 'is_admin', False))
    if not has_access:
        tracking_lib_item = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.tracking_list_id == list_id
        ).first()
        if tracking_lib_item:
            has_access = True
            if reading_list.creator_id != current_user.id:
                reading_list.creator_id = current_user.id
                db.commit()
                
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    
    series_title = lib_item.title if lib_item else "Series"
    
    # Resolve episodes list (fetch directly if not supplied)
    episodes_list = req.episodes
    if not episodes_list:
        if lib_item and lib_item.external_id:
            try:
                clean_id = lib_item.external_id
                if clean_id.startswith('tvm_'):
                    clean_id = clean_id.replace('tvm_', '')
                series_id = int(clean_id)
                episodes_list = TVMazeService.get_season_episodes(series_id, req.season_number) or []
            except Exception as e:
                print(f"Failed to fetch episodes for bulk toggle in backend: {e}")
                episodes_list = []
        else:
            episodes_list = []

    # Get initial item count to increment index in memory
    item_count = db.query(ListItem).filter(ListItem.list_id == list_id).count()

    for ep in episodes_list:
        ext_id = f"tvm-ep-{ep.get('id')}"
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
                image_url=ep.get('still_path') if ep.get('still_path') else None,
                custom_notes=json.dumps({"description": ep.get('overview') or "", "release_date": ep.get('air_date') or None}),
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
        completed_episodes_count = db.query(ItemProgress).join(ListItem).filter(
            ItemProgress.user_id == current_user.id,
            ListItem.list_id == list_id,
            ItemProgress.is_completed == True
        ).count()
        
        if completed_episodes_count > 0:
            last_completed = db.query(ListItem).join(ItemProgress).filter(
                ListItem.list_id == list_id,
                ItemProgress.user_id == current_user.id,
                ItemProgress.is_completed == True
            ).order_by(ListItem.id.desc()).first()
            if last_completed:
                lib_item.last_seen_episode = last_completed.title
            lib_item.updated_at = datetime.now(timezone.utc)
            db.commit()
        else:
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            lib_item.completed_at = None
            lib_item.last_seen_episode = None
            lib_item.updated_at = datetime.now(timezone.utc)
            db.commit()

        def check_series_completion(user_id, list_id, lib_item_id, ext_id):
            import app.core.database
            with app.core.database.SessionLocal() as session:
                completed_eps = session.query(ItemProgress).join(ListItem).filter(
                    ItemProgress.user_id == user_id,
                    ListItem.list_id == list_id,
                    ItemProgress.is_completed == True
                ).count()
                
                if completed_eps > 0:
                    try:
                        series_id = int(ext_id)
                        series_detail = TVMazeService.get_series_detail(series_id)
                        total_episodes = series_detail.get("number_of_episodes") or 99999
                        lib_it = session.query(UserLibraryItem).filter(UserLibraryItem.id == lib_item_id).first()
                        if lib_it:
                            if completed_eps >= total_episodes:
                                lib_it.status = UserLibraryStatusEnum.COMPLETED
                                lib_it.completed_at = datetime.now(timezone.utc)
                            else:
                                lib_it.status = UserLibraryStatusEnum.WATCHING
                                lib_it.completed_at = None
                            session.commit()
                    except Exception as e:
                        print(f"Background check completion error: {e}")
        
        background_tasks.add_task(check_series_completion, current_user.id, list_id, lib_item.id, lib_item.external_id)

    return {"message": "Season progress toggled successfully"}


@router.post("/{list_id}/bulk-toggle-all-seasons", status_code=status.HTTP_200_OK)
def bulk_toggle_all_seasons(
    list_id: int,
    req: BulkToggleAllSeasonsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    
    has_access = (reading_list.creator_id == current_user.id or getattr(current_user, 'is_admin', False))
    if not has_access:
        tracking_lib_item = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.tracking_list_id == list_id
        ).first()
        if tracking_lib_item:
            has_access = True
            if reading_list.creator_id != current_user.id:
                reading_list.creator_id = current_user.id
                db.commit()
                
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    
    series_title = lib_item.title if lib_item else "Series"
    
    # Resolve all episodes list (fetch directly if not supplied)
    episodes_list = req.episodes
    if not episodes_list:
        if lib_item and lib_item.external_id:
            try:
                clean_id = lib_item.external_id
                if clean_id.startswith('tvm_'):
                    clean_id = clean_id.replace('tvm_', '')
                series_id = int(clean_id)
                episodes_list = TVMazeService.get_all_series_episodes(series_id) or []
            except Exception as e:
                print(f"Failed to fetch all episodes for bulk toggle in backend: {e}")
                episodes_list = []
        else:
            episodes_list = []

    # Get initial item count to increment index in memory
    item_count = db.query(ListItem).filter(ListItem.list_id == list_id).count()

    for ep in episodes_list:
        ext_id = f"tvm-ep-{ep.get('id')}"
        item = db.query(ListItem).filter(
            ListItem.list_id == list_id,
            ListItem.external_id == ext_id
        ).first()
        
        season_num = ep.get('season_number', 1)
        ep_num = ep.get('episode_number', 1)
        
        if not item:
            item_count += 1
            item = ListItem(
                list_id=list_id,
                order_index=item_count,
                item_type=ItemTypeEnum.SERIES,
                external_id=ext_id,
                title=f"{series_title} - S{season_num:02d}E{ep_num:02d} - {ep.get('name', 'Untitled')}",
                image_url=ep.get('still_path') if ep.get('still_path') else None,
                custom_notes=json.dumps({"description": ep.get('overview') or "", "release_date": ep.get('air_date') or None}),
                section=f"Season {season_num}"
            )
            db.add(item)
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
            
    if lib_item:
        if req.completed:
            lib_item.status = UserLibraryStatusEnum.COMPLETED
            lib_item.completed_at = datetime.now(timezone.utc)
            # Set last seen episode to the last episode in list
            last_ep = db.query(ListItem).filter(
                ListItem.list_id == list_id
            ).order_by(ListItem.id.desc()).first()
            if last_ep:
                lib_item.last_seen_episode = last_ep.title
        else:
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            lib_item.completed_at = None
            lib_item.last_seen_episode = None
        lib_item.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {"message": "All seasons progress toggled successfully", "status": lib_item.status if lib_item else "completed"}





