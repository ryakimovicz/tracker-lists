from datetime import datetime, timezone
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, BackgroundTasks
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
from app.models.consumption import ConsumptionHistory
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
    BulkToggleAllSeasonsRequest,
    ExploreGuideItem,
    ExploreGuidesResponse
)

router = APIRouter()

# 0. Explore Guides: Populares, Mejor Valoradas, Más Guardadas, Nuevas
@router.get("/explore", response_model=ExploreGuidesResponse)
def get_explore_guides(db: Session = Depends(get_db)):
    # Query all public reading lists
    lists = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).all()

    guide_items = []
    for l in lists:
        if len(l.items) < 2:
            continue

        covers = []
        media_types = set()
        for it in l.items:
            if it.image_url and it.image_url not in covers and len(covers) < 4:
                covers.append(it.image_url)
            if it.item_type:
                m_type = it.item_type.value if hasattr(it.item_type, 'value') else str(it.item_type)
                media_types.add(m_type)

        votes = l.votes or []
        saves = l.saved_by_users or []
        comments = l.comments or []

        votes_count = len(votes)
        saves_count = len(saves)
        comments_count = len(comments)

        avg_rating = None
        if votes_count > 0:
            avg_rating = round(sum(v.rating for v in votes if v.rating is not None) / votes_count, 1)

        pop_score = (saves_count * 3) + (votes_count * 2) + (comments_count * 2)

        creator_name = l.creator.username if l.creator else "Comunidad de Pathd"
        creator_photo = getattr(l.creator, 'profile_image_url', None) if l.creator else None

        guide_item = ExploreGuideItem(
            id=l.id,
            title=l.title,
            description=l.description,
            created_at=l.created_at,
            creator_id=l.creator_id,
            creator_username=creator_name,
            creator_photo_url=creator_photo,
            items_count=len(l.items),
            saves_count=saves_count,
            votes_count=votes_count,
            average_rating=avg_rating,
            covers=covers,
            media_types=sorted(list(media_types))
        )
        guide_items.append((guide_item, pop_score, avg_rating or 0, saves_count, l.created_at))

    # 1. Más Populares
    populares = [
        item[0] for item in sorted(
            guide_items,
            key=lambda x: (x[1], x[3], x[4]),
            reverse=True
        )[:20]
    ]

    # 2. Mejor Valoradas
    mejor_valoradas = [
        item[0] for item in sorted(
            guide_items,
            key=lambda x: (x[2], x[1], x[3]),
            reverse=True
        )[:20]
    ]

    # 3. Más Guardadas
    mas_guardadas = [
        item[0] for item in sorted(
            guide_items,
            key=lambda x: (x[3], x[1], x[4]),
            reverse=True
        )[:20]
    ]

    # 4. Nuevas
    nuevas = [
        item[0] for item in sorted(
            guide_items,
            key=lambda x: x[4],
            reverse=True
        )[:20]
    ]

    return ExploreGuidesResponse(
        populares=populares,
        mejor_valoradas=mejor_valoradas,
        mas_guardadas=mas_guardadas,
        nuevas=nuevas
    )

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
    db.commit()

    # Record activity log
    from app.services.activity_service import ActivityService
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="guide_created",
        item_title=new_list.title,
        item_type="guide",
        list_id=new_list.id,
        details="created"
    )

    return new_list

# 3. Get list details (with progress calculated if logged in)
@router.get("/{list_id}", response_model=ReadingListDetailsResponse)
def get_list_details(
    list_id: int,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
    draft: bool = Query(False)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

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
        external_progress_map = {}
        for p in progress_records:
            if p.external_id:
                p_type = str(p.item_type.value if hasattr(p.item_type, 'value') else p.item_type).lower() if p.item_type else ""
                if "comic" in p_type:
                    p_type = "comic"
                elif "series" in p_type:
                    p_type = "series"
                elif "anime" in p_type:
                    p_type = "anime"
                external_progress_map[(p_type, p.external_id)] = (p.is_completed, p.is_skipped)
                external_progress_map[("", p.external_id)] = (p.is_completed, p.is_skipped)
        custom_progress_map = {
            p.list_item_id: (p.is_completed, p.is_skipped)
            for p in progress_records if p.list_item_id and not p.external_id
        }
        addition_progress_map = {
            p.addition_item_id: (p.is_completed, p.is_skipped)
            for p in progress_records if p.addition_item_id and not p.external_id
        }

        # Query consumption history counts for this user and items in this list
        from app.models.consumption import ConsumptionHistory
        from sqlalchemy import func
        all_ext_ids = [it.external_id for it in items if it.external_id]
        consumption_counts_map = {}
        if all_ext_ids:
            c_counts = db.query(
                ConsumptionHistory.external_id,
                func.count(ConsumptionHistory.id)
            ).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id.in_(all_ext_ids)
            ).group_by(ConsumptionHistory.external_id).all()
            for eid, cnt in c_counts:
                consumption_counts_map[eid] = cnt

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
                        is_completed=is_comp,
                        is_skipped=is_skip,
                        is_addition=True,
                        addition_id=add.id,
                        addition_item_id=item.id,
                        inherited_importance_rank=inherited_rank,
                        consumption_count=consumption_counts_map.get(item.external_id, 1 if is_comp else 0)
                    )
                )

    # Process base items
    formatted_base_items = []
    # If list is a series tracker, check parent series localized name
    parent_series_loc = None
    if reading_list.title and reading_list.title.startswith("Tracker: "):
        try:
            parent_lib_item = db.query(UserLibraryItem).filter(UserLibraryItem.tracking_list_id == list_id).first()
            if parent_lib_item and parent_lib_item.item_type == "series" and parent_lib_item.external_id:
                sid_str = parent_lib_item.external_id.replace("tvm_", "").replace("tvm-", "")
                if sid_str.isdigit():
                    parent_series_loc = (parent_lib_item.title, TVMazeService.get_localized_title(int(sid_str), parent_lib_item.title, lang=client_lang, country_code=client_country))
        except Exception:
            pass

    for item in items:
        # Check progress
        if item.external_id:
            i_type = str(item.item_type.value if hasattr(item.item_type, 'value') else item.item_type).lower() if item.item_type else ""
            if "comic" in i_type:
                i_type = "comic"
            elif "series" in i_type:
                i_type = "series"
            elif "anime" in i_type:
                i_type = "anime"
            key = (i_type, item.external_id)
            is_comp, is_skip = external_progress_map.get(key, external_progress_map.get(("", item.external_id), (False, False)))
        else:
            is_comp, is_skip = custom_progress_map.get(item.id, (False, False))

        c_cnt = consumption_counts_map.get(item.external_id, 0) if item.external_id else 0
        if is_comp and c_cnt == 0:
            c_cnt = 1

        display_item_title = item.title
        if parent_series_loc and display_item_title:
            orig_name, loc_name = parent_series_loc
            if loc_name and orig_name and loc_name != orig_name and display_item_title.startswith(orig_name):
                display_item_title = loc_name + display_item_title[len(orig_name):]

        formatted_base_items.append(
            ListItemProgressResponse(
                id=item.id,
                list_id=item.list_id,
                order_index=item.order_index,
                item_type=item.item_type,
                external_id=item.external_id,
                title=display_item_title,
                image_url=item.image_url,
                custom_notes=item.custom_notes,
                section=item.section,
                importance_rank=item.importance_rank,
                is_completed=is_comp,
                is_skipped=is_skip,
                is_addition=False,
                consumption_count=c_cnt
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

    from app.services.activity_service import ActivityService

    # Record guide_edited activity
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="guide_edited",
        item_title=reading_list.title,
        item_type="guide",
        list_id=reading_list.id,
        details="edited"
    )

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
        
    # Clean up all activities related to this guide
    from app.services.activity_service import ActivityService
    ActivityService.delete_activity(
        db=db,
        list_id=list_id
    )

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
        list_id=list_id,
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
        list_id=list_id,
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
    db.commit()

    # Record activity log
    from app.services.activity_service import ActivityService
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="guide_followed",
        item_title=reading_list.title,
        item_type="guide",
        list_id=reading_list.id,
        details="followed"
    )

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

    # Remove the guide_followed activity log
    from app.services.activity_service import ActivityService
    ActivityService.delete_activity(
        db=db,
        user_id=current_user.id,
        activity_type="guide_followed",
        list_id=list_id
    )

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

    # Check if user is following the parent series / comic volume
    existing_series = None
    if show_name:
        existing_series = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.item_type.in_(["series", "anime"]),
            UserLibraryItem.title == show_name
        ).first()

    is_cv_issue = item.external_id.startswith("cv_issue_") or item.external_id.startswith("cv_") or item.item_type == ItemTypeEnum.COMIC

    # Check if this comic issue belongs to a tracked comic volume
    existing_comic_vol = None
    if is_cv_issue and item.list_id:
        existing_comic_vol = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.item_type == "comic",
            UserLibraryItem.tracking_list_id == item.list_id
        ).first()

    if is_cv_issue:
        if existing_comic_vol:
            existing_comic_vol.last_seen_episode = item.title
            existing_comic_vol.updated_at = datetime.now(timezone.utc)
            if existing_comic_vol.status in (UserLibraryStatusEnum.PLAN_TO_READ, UserLibraryStatusEnum.READ):
                existing_comic_vol.status = UserLibraryStatusEnum.READING
                existing_comic_vol.completed_at = None
            db.commit()
        # Never add a loose comic issue as a library item if it belongs to a tracked volume
        return

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
        
        # Record activity log with progress metadata
        from app.services.activity_service import ActivityService
        t_str = item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type)
        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="item_status_changed",
            item_title=item.title,
            item_type=t_str,
            external_id=item.external_id,
            image_url=item.image_url,
            details="completed",
            metadata={
                "status": "completed",
                "item_type": t_str,
                "current_progress": item.title,
                "last_seen_episode": item.title,
                "show_name": show_name,
                "is_single_episode": bool(item.external_id and item.external_id.startswith("tvm-ep-"))
            }
        )
        
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
    from app.services.activity_service import ActivityService
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
                    item_type=item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type),
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
            
            # Record activity log with progress metadata
            t_str = item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type)
            ActivityService.record_activity(
                db=db,
                user_id=current_user.id,
                activity_type="item_status_changed",
                item_title=item.title,
                item_type=t_str,
                external_id=item.external_id,
                image_url=item.image_url,
                details="completed",
                metadata={
                    "status": "completed",
                    "item_type": t_str,
                    "current_progress": item.title,
                    "last_seen_episode": item.title,
                    "is_single_episode": bool(item.external_id and item.external_id.startswith("tvm-ep-"))
                }
            )
            
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
            list_id=list_id,
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
                list_id=list_id,
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
            list_id=list_id,
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
            list_id=list_id,
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
                item_type=item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type),
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
                        item_type=item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type),
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
                        item_type=item.item_type.value if hasattr(item.item_type, 'value') else str(item.item_type),
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
                from datetime import datetime, timezone
                now_dt = datetime.now(timezone.utc)
                now_iso = now_dt.isoformat()
                now_date = now_dt.strftime("%Y-%m-%d")

                def is_ep_aired(ep_dict):
                    astamp = ep_dict.get("airstamp")
                    if astamp:
                        try:
                            # Python 3.11+ fromisoformat handles +00:00 or Z
                            ep_dt = datetime.fromisoformat(astamp.replace("Z", "+00:00"))
                            return ep_dt <= now_dt
                        except Exception:
                            pass
                    adate = ep_dict.get("airdate")
                    return bool(adate and adate <= now_date)

                aired_episodes = [ep for ep in episodes if is_ep_aired(ep)]
                total_aired = len(aired_episodes)
                
                if total_aired == 0:
                    return
                
                # 3. Check user's progress
                from app.models.item_progress import ItemProgress
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
                        (UserLibraryItem.external_id == show_ext_id) | (UserLibraryItem.external_id == f"tvm-{show_id}")
                    ).first()
                    
                    if existing_series:
                        existing_series.status = UserLibraryStatusEnum.COMPLETED
                        existing_series.completed_at = now_dt
                    else:
                        new_series = UserLibraryItem(
                            user_id=user_id,
                            item_type="series",
                            external_id=show_ext_id,
                            title=show_name,
                            image_url=show_image,
                            status=UserLibraryStatusEnum.COMPLETED,
                            completed_at=now_dt,
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
    tracking_lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    if not has_access:
        if tracking_lib_item:
            has_access = True
            if reading_list.creator_id != current_user.id:
                reading_list.creator_id = current_user.id
                db.commit()
                
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this list")

    raw_ep_str = str(ep_req.episode_id)
    is_comic = (
        (tracking_lib_item and tracking_lib_item.item_type == "comic") or
        raw_ep_str.startswith("cv_") or
        raw_ep_str.startswith("cv-") or
        raw_ep_str.startswith("4000-") or
        raw_ep_str.startswith("4050-")
    )

    if is_comic:
        ext_id = raw_ep_str if raw_ep_str.startswith("cv_issue_") else f"cv_issue_{raw_ep_str.replace('cv_vol_', '').replace('cv_', '')}"
        media_item_type = ItemTypeEnum.COMIC
        sec_name = "Volumen"
    else:
        ext_id = f"tvm-ep-{raw_ep_str}"
        media_item_type = ItemTypeEnum.SERIES
        sec_name = f"Season {ep_req.season_number}"
    
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
            item_type=media_item_type,
            external_id=ext_id,
            title=ep_req.title,
            image_url=ep_req.image_url,
            custom_notes=json.dumps({"description": ep_req.overview or "", "release_date": None}),
            section=sec_name
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
            # Check if there is consumption history to remove latest
            history = db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id == ext_id
            ).order_by(ConsumptionHistory.consumed_at.desc()).all()
            
            if history:
                db.delete(history[0])
                remaining = history[1:]
                if remaining:
                    # Still has prior viewings! Keep is_completed True and point to previous date
                    progress.is_completed = True
                    progress.completed_at = remaining[0].consumed_at
                else:
                    progress.is_completed = False
                    progress.completed_at = None
                    # Remove loose item from user library
                    db.query(UserLibraryItem).filter(
                        UserLibraryItem.user_id == current_user.id,
                        UserLibraryItem.external_id == ext_id
                    ).delete()
            else:
                progress.is_completed = False
                progress.completed_at = None
                # Remove loose item from user library
                db.query(UserLibraryItem).filter(
                    UserLibraryItem.user_id == current_user.id,
                    UserLibraryItem.external_id == ext_id
                ).delete()
        else:
            progress.is_completed = not progress.is_completed
            progress.list_item_id = item.id
            progress.completed_at = now_dt if progress.is_completed else None
            just_marked = progress.is_completed
            if not progress.is_completed:
                # Remove latest consumption history entry on unchecking
                latest_ch = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == ext_id
                ).order_by(ConsumptionHistory.consumed_at.desc()).first()
                if latest_ch:
                    db.delete(latest_ch)
    else:
        if action == "remove":
            return {"is_completed": False, "completed_at": None}
            
        progress = ItemProgress(
            user_id=current_user.id,
            item_type=media_item_type.value if hasattr(media_item_type, 'value') else str(media_item_type),
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
        if media_item_type != ItemTypeEnum.COMIC:
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
    
    # Run TV Series & Comic Volume general UserLibraryItem automatic transitions
    lib_item = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id == list_id
    ).first()
    
    if lib_item:
        is_comic_vol = lib_item.item_type == "comic" or media_item_type == ItemTypeEnum.COMIC
        
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
                
        # Update last_seen_episode based on the most recently consumed episode for this series / comic
        latest_consumed = db.query(ConsumptionHistory, ListItem.title).join(
            ListItem, ListItem.external_id == ConsumptionHistory.external_id
        ).filter(
            ConsumptionHistory.user_id == current_user.id,
            ListItem.list_id == list_id
        ).order_by(ConsumptionHistory.consumed_at.desc()).first()

        if latest_consumed and latest_consumed[1]:
            lib_item.last_seen_episode = latest_consumed[1]
        elif just_marked:
            lib_item.last_seen_episode = item.title
        elif completed_ep_titles:
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

        if is_comic_vol:
            # Comic volume status logic
            if completed_ep_titles:
                lib_item.status = UserLibraryStatusEnum.READING
                lib_item.completed_at = None
            else:
                lib_item.last_seen_episode = None
                lib_item.status = UserLibraryStatusEnum.PLAN_TO_READ
                lib_item.completed_at = None
        else:
            # Series / TV logic
            all_aired_completed = False
            if completed_ep_titles:
                if lib_item.external_id:
                    try:
                        all_episodes = TVMazeService.get_all_episodes(lib_item.external_id)
                        now_dt = datetime.now(timezone.utc)
                        now_date = now_dt.strftime("%Y-%m-%d")

                        def is_ep_aired_check(ep_dict):
                            astamp = ep_dict.get("airstamp")
                            if astamp:
                                try:
                                    ep_dt = datetime.fromisoformat(astamp.replace("Z", "+00:00"))
                                    return ep_dt <= now_dt
                                except Exception:
                                    pass
                            adate = ep_dict.get("airdate")
                            return bool(adate and adate <= now_date)

                        aired_eps = [ep for ep in all_episodes if is_ep_aired_check(ep)]
                        if aired_eps:
                            aired_ext_ids = {f"tvm-ep-{ep['id']}" for ep in aired_eps}
                            watched_ext_ids = {
                                p.external_id for p in completed_progs if p.external_id
                            }
                            if aired_ext_ids.issubset(watched_ext_ids):
                                all_aired_completed = True
                    except Exception as e:
                        print(f"Error checking all_aired_completed: {e}")

                if all_aired_completed:
                    lib_item.status = UserLibraryStatusEnum.COMPLETED
                    lib_item.completed_at = datetime.now(timezone.utc)
                else:
                    lib_item.status = UserLibraryStatusEnum.WATCHING
                    lib_item.completed_at = None
            else:
                lib_item.last_seen_episode = None
                lib_item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
                lib_item.completed_at = None
            
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
    is_comic = (lib_item and lib_item.item_type == "comic")
    
    # Resolve episodes list (fetch directly if not supplied)
    episodes_list = req.episodes
    if not episodes_list:
        if lib_item and lib_item.external_id:
            try:
                if is_comic:
                    from app.services.comicvine import ComicVineService
                    episodes_list = ComicVineService.get_comic_volume_issues(lib_item.external_id) or []
                else:
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

    try:
        # 1. Preload existing list items for this list
        existing_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
        list_items_by_ext = {it.external_id: it for it in existing_list_items if it.external_id}
        item_count = len(existing_list_items)

        processed_eps = []
        seen_ext_ids = set()

        for ep in episodes_list:
            raw_id = str(ep.get('id'))
            if raw_id.startswith('cv_') or raw_id.startswith('cv-') or is_comic:
                ext_id = raw_id if raw_id.startswith("cv_issue_") else f"cv_issue_{raw_id.replace('cv_vol_', '').replace('cv_', '')}"
                media_item_type = ItemTypeEnum.COMIC
            else:
                ext_id = f"tvm-ep-{raw_id}"
                media_item_type = ItemTypeEnum.SERIES

            if ext_id in seen_ext_ids:
                continue
            seen_ext_ids.add(ext_id)

            ep_num = ep.get('episode_number')
            ep_name = ep.get('name') or 'Untitled'
            is_extra_ep = ep.get('is_extra') or ep.get('ep_type') == 'insignificant_special' or req.season_number == 0
            is_special_ep = ep.get('is_significant_special') or ep.get('ep_type') == 'significant_special'
            
            if media_item_type == ItemTypeEnum.COMIC:
                ep_title = f"{series_title} {ep_name}" if not ep_name.startswith(series_title) else ep_name
                section_name = "Volumen"
            elif is_extra_ep:
                ep_title = f"{series_title} - Extra {ep_num or 1} - {ep_name}"
                section_name = "Extras"
            elif is_special_ep or ep_num is None:
                ep_title = f"{series_title} - [Especial] - {ep_name}"
                section_name = f"Season {req.season_number}" if req.season_number > 0 else "Specials"
            else:
                ep_title = f"{series_title} - S{req.season_number:02d}E{ep_num:02d} - {ep_name}"
                section_name = f"Season {req.season_number}"

            item = list_items_by_ext.get(ext_id)
            if not item:
                item_count += 1
                img_url_val = ep.get('still_path') or ep.get('image_url')
                item = ListItem(
                    list_id=list_id,
                    order_index=item_count,
                    item_type=media_item_type,
                    external_id=ext_id[:95] if ext_id else None,
                    title=ep_title[:245],
                    image_url=img_url_val[:495] if img_url_val else None,
                    custom_notes=json.dumps({"description": ep.get('overview') or "", "release_date": ep.get('air_date') or None}),
                    section=section_name[:95] if section_name else None
                )
                db.add(item)
                db.flush()
                list_items_by_ext[ext_id] = item

            processed_eps.append((ext_id, item, media_item_type))

        # Query all existing ItemProgress for the user across all relevant identifiers
        all_ext_variations = set(seen_ext_ids)
        for eid in seen_ext_ids:
            clean = eid.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            all_ext_variations.add(clean)
            all_ext_variations.add(f"cv_issue_{clean}")
            all_ext_variations.add(f"cv_{clean}")
            all_ext_variations.add(f"tvm-ep-{clean}")
        
        target_ext_ids = list(all_ext_variations)
        target_item_ids = [it.id for it in list_items_by_ext.values() if it.id]
        
        user_progs = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            (ItemProgress.external_id.in_(target_ext_ids) | ItemProgress.list_item_id.in_(target_item_ids))
        ).all() if (target_ext_ids or target_item_ids) else []

        progs_by_ext = {}
        progs_by_item_id = {}
        for p in user_progs:
            if p.external_id:
                progs_by_ext[p.external_id] = p
                clean_p_ext = p.external_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
                progs_by_ext[clean_p_ext] = p
                progs_by_ext[f"cv_issue_{clean_p_ext}"] = p
                progs_by_ext[f"cv_{clean_p_ext}"] = p
                progs_by_ext[f"tvm-ep-{clean_p_ext}"] = p
            if p.list_item_id:
                progs_by_item_id[p.list_item_id] = p

        now_dt = datetime.now(timezone.utc)

        for ext_id, item, media_item_type in processed_eps:
            clean_ext = ext_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            progress = progs_by_ext.get(ext_id) or progs_by_ext.get(clean_ext) or progs_by_item_id.get(item.id)
            media_type_str = (media_item_type.value if hasattr(media_item_type, 'value') else str(media_item_type)).lower()

            if not progress:
                progress = db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    (
                        (ItemProgress.list_item_id == item.id) |
                        (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                    )
                ).first()

            if req.completed:
                was_already_completed = progress.is_completed if progress else False
                if progress:
                    progress.is_completed = True
                    progress.external_id = ext_id
                    progress.list_item_id = item.id
                    progress.item_type = media_type_str
                    if not was_already_completed or req.mark_again:
                        progress.completed_at = now_dt
                else:
                    try:
                        with db.begin_nested():
                            progress = ItemProgress(
                                user_id=current_user.id,
                                item_type=media_type_str,
                                external_id=ext_id,
                                list_item_id=item.id,
                                is_completed=True,
                                is_skipped=False,
                                completed_at=now_dt
                            )
                            db.add(progress)
                            db.flush()
                    except Exception:
                        progress = db.query(ItemProgress).filter(
                            ItemProgress.user_id == current_user.id,
                            (
                                (ItemProgress.list_item_id == item.id) |
                                (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                            )
                        ).first()
                        if progress:
                            progress.is_completed = True
                            progress.external_id = ext_id
                            progress.list_item_id = item.id
                            progress.item_type = media_type_str
                            progress.completed_at = now_dt
                
                if progress:
                    progs_by_ext[ext_id] = progress
                    progs_by_ext[clean_ext] = progress
                    progs_by_item_id[item.id] = progress
                
                # Record ConsumptionHistory only if not previously completed or if explicitly doing mark_again
                if not was_already_completed or req.mark_again:
                    ch = ConsumptionHistory(
                        user_id=current_user.id,
                        item_type=media_type_str,
                        external_id=ext_id,
                        list_item_id=item.id,
                        consumed_at=now_dt
                    )
                    db.add(ch)
            else:
                # Unwatch: remove latest consumption history entry
                history = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == ext_id
                ).order_by(ConsumptionHistory.consumed_at.desc()).all()
                
                if history:
                    db.delete(history[0])
                    remaining = history[1:]
                    if remaining:
                        if progress:
                            progress.is_completed = True
                            progress.completed_at = remaining[0].consumed_at
                    else:
                        if progress:
                            progress.is_completed = False
                            progress.completed_at = None
                else:
                    if progress:
                        progress.is_completed = False
                        progress.completed_at = None
                
        db.commit()
        
        if lib_item:
            all_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
            regular_list_items = [it for it in all_list_items if it.section != "Extras" and not (it.title and "[Extra]" in it.title)]
            all_item_ids = [it.id for it in regular_list_items if it.id] if regular_list_items else [it.id for it in all_list_items if it.id]
            all_ext_ids = [it.external_id for it in regular_list_items if it.external_id] if regular_list_items else [it.external_id for it in all_list_items if it.external_id]
            
            completed_progs = db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.is_completed == True,
                (ItemProgress.list_item_id.in_(all_item_ids) | ItemProgress.external_id.in_(all_ext_ids))
            ).all() if (all_item_ids or all_ext_ids) else []
            
            completed_episodes_count = len(completed_progs)
            if completed_episodes_count > 0:
                completed_prog_item_ids = {p.list_item_id for p in completed_progs if p.list_item_id}
                completed_prog_ext_ids = {p.external_id for p in completed_progs if p.external_id}
                completed_titles = [
                    it.title for it in all_list_items
                    if (it.id in completed_prog_item_ids or it.external_id in completed_prog_ext_ids) and it.title
                ]
                if completed_titles:
                    import re
                    if is_comic:
                        def parse_issue_num(t):
                            m = re.search(r'#(\d+(\.\d+)?)', t)
                            return float(m.group(1)) if m else -1.0
                        sorted_titles = sorted(completed_titles, key=parse_issue_num)
                        lib_item.last_seen_episode = sorted_titles[-1]
                    else:
                        ep_tuples = []
                        for t in completed_titles:
                            m = re.search(r'S(\d+)E(\d+)', t, re.IGNORECASE)
                            if m:
                                ep_tuples.append((int(m.group(1)), int(m.group(2)), t))
                        if ep_tuples:
                            ep_tuples.sort(key=lambda x: (x[0], x[1]))
                            lib_item.last_seen_episode = ep_tuples[-1][2]
                        else:
                            lib_item.last_seen_episode = completed_titles[-1]

                lib_item.updated_at = datetime.now(timezone.utc)
                db.commit()
            else:
                lib_item.status = UserLibraryStatusEnum.PLAN_TO_READ if is_comic else UserLibraryStatusEnum.PLAN_TO_WATCH
                lib_item.completed_at = None
                lib_item.last_seen_episode = None
                lib_item.updated_at = datetime.now(timezone.utc)
                db.commit()

            def check_series_completion(user_id, list_id, lib_item_id, ext_id, item_ids, ext_ids):
                import app.core.database
                with app.core.database.SessionLocal() as session:
                    completed_eps = session.query(ItemProgress).filter(
                        ItemProgress.user_id == user_id,
                        ItemProgress.is_completed == True,
                        (ItemProgress.list_item_id.in_(item_ids) | ItemProgress.external_id.in_(ext_ids))
                    ).count() if (item_ids or ext_ids) else 0
                    
                    if completed_eps > 0:
                        try:
                            lib_it = session.query(UserLibraryItem).filter(UserLibraryItem.id == lib_item_id).first()
                            if not lib_it:
                                return
                            if lib_it.item_type == "comic":
                                from app.services.comicvine import ComicVineService
                                cv_issues = ComicVineService.get_comic_volume_issues(ext_id)
                                total_episodes = len(cv_issues) if cv_issues else 99999
                                if completed_eps >= total_episodes:
                                    lib_it.status = UserLibraryStatusEnum.READ
                                    lib_it.completed_at = datetime.now(timezone.utc)
                                else:
                                    lib_it.status = UserLibraryStatusEnum.READING
                                    lib_it.completed_at = None
                            else:
                                series_id = int(str(ext_id).replace('tvm_', ''))
                                series_detail = TVMazeService.get_series_detail(series_id)
                                total_episodes = series_detail.get("number_of_episodes") or 99999
                                if completed_eps >= total_episodes:
                                    lib_it.status = UserLibraryStatusEnum.COMPLETED
                                    lib_it.completed_at = datetime.now(timezone.utc)
                                else:
                                    lib_it.status = UserLibraryStatusEnum.WATCHING
                                    lib_it.completed_at = None
                            session.commit()
                        except Exception as e:
                            logger.warning(f"Background check completion error: {e}")
            
            background_tasks.add_task(check_series_completion, current_user.id, list_id, lib_item.id, lib_item.external_id, all_item_ids, all_ext_ids)

        return {"message": "Season progress toggled successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        root_err = getattr(e, 'orig', e)
        error_msg = str(root_err) if root_err else str(e)
        if "[SQL:" in error_msg:
            error_msg = error_msg.split("[SQL:")[0].strip()
        logger.exception(f"Error in bulk_toggle_season for list {list_id}: {error_msg} | {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk toggle season failed: {type(root_err).__name__}: {error_msg}"
        )


@router.post("/{list_id}/bulk-toggle-all-seasons", status_code=status.HTTP_200_OK)
def bulk_toggle_all_seasons(
    list_id: int,
    req: BulkToggleAllSeasonsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
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
        is_comic = (lib_item and lib_item.item_type == "comic")
        
        # Resolve all episodes list (fetch directly if not supplied)
        episodes_list = req.episodes
        if not episodes_list:
            if lib_item and lib_item.external_id:
                try:
                    if is_comic:
                        from app.services.comicvine import ComicVineService
                        episodes_list = ComicVineService.get_comic_volume_issues(lib_item.external_id) or []
                    else:
                        clean_id = lib_item.external_id
                        if clean_id.startswith('tvm_'):
                            clean_id = clean_id.replace('tvm_', '')
                        series_id = int(clean_id)
                        episodes_list = TVMazeService.get_all_episodes(str(series_id)) or []
                except Exception as e:
                    logger.warning(f"Failed to fetch all episodes for bulk toggle in backend: {e}")
                    episodes_list = []
            else:
                episodes_list = []

        # 1. Fetch existing list items for this list to map by external_id
        existing_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
        list_items_by_ext = {it.external_id: it for it in existing_list_items if it.external_id}
        item_count = len(existing_list_items)

        # 2. Process all episodes, normalize ext_ids, and ensure ListItems exist
        processed_eps = []
        seen_ext_ids = set()
        
        for ep in episodes_list:
            ep_id = ep.get('id')
            if not ep_id:
                continue
            raw_ep_str = str(ep_id)
            if is_comic or raw_ep_str.startswith('cv_') or raw_ep_str.startswith('cv-'):
                ext_id = raw_ep_str if raw_ep_str.startswith('cv_issue_') else f"cv_issue_{raw_ep_str.replace('cv_vol_', '').replace('cv_', '')}"
                media_item_type = ItemTypeEnum.COMIC
                sec_name = "Volumen"
            else:
                ext_id = f"tvm-ep-{ep_id}"
                media_item_type = ItemTypeEnum.SERIES
                sec_name = f"Season {ep.get('season_number', 1)}"

            if ext_id in seen_ext_ids:
                continue
            seen_ext_ids.add(ext_id)

            season_num = ep.get('season_number', 1)
            ep_num = ep.get('episode_number')
            ep_name = ep.get('name') or 'Untitled'
            is_extra_ep = ep.get('is_extra') or ep.get('ep_type') == 'insignificant_special' or season_num == 0
            is_special_ep = ep.get('is_significant_special') or ep.get('ep_type') == 'significant_special'
            
            if media_item_type == ItemTypeEnum.COMIC:
                ep_title = f"{series_title} {ep_name}" if not ep_name.startswith(series_title) else ep_name
                section_name = "Volumen"
            elif is_extra_ep:
                ep_title = f"{series_title} - Extra {ep_num or 1} - {ep_name}"
                section_name = "Extras"
            elif is_special_ep or ep_num is None:
                ep_title = f"{series_title} - [Especial] - {ep_name}"
                section_name = f"Season {season_num}" if season_num > 0 else "Specials"
            else:
                ep_title = f"{series_title} - S{season_num:02d}E{ep_num:02d} - {ep_name}"
                section_name = f"Season {season_num}"

            item = list_items_by_ext.get(ext_id)
            if not item:
                item_count += 1
                img_url_val = ep.get('still_path') or ep.get('image_url')
                item = ListItem(
                    list_id=list_id,
                    order_index=item_count,
                    item_type=media_item_type,
                    external_id=ext_id[:95] if ext_id else None,
                    title=ep_title[:245],
                    image_url=img_url_val[:495] if img_url_val else None,
                    custom_notes=json.dumps({"description": ep.get('overview') or "", "release_date": ep.get('air_date') or None}),
                    section=section_name[:95] if section_name else None
                )
                db.add(item)
                db.flush()
                list_items_by_ext[ext_id] = item

            processed_eps.append((ext_id, item, media_item_type))

        # Query all existing ItemProgress for the user across all relevant identifiers
        all_ext_variations = set(seen_ext_ids)
        for eid in seen_ext_ids:
            clean = eid.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            all_ext_variations.add(clean)
            all_ext_variations.add(f"cv_issue_{clean}")
            all_ext_variations.add(f"cv_{clean}")
            all_ext_variations.add(f"tvm-ep-{clean}")

        target_ext_ids = list(all_ext_variations)
        target_item_ids = [it.id for it in list_items_by_ext.values() if it.id]
        
        user_progs = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            (ItemProgress.external_id.in_(target_ext_ids) | ItemProgress.list_item_id.in_(target_item_ids))
        ).all() if (target_ext_ids or target_item_ids) else []

        progs_by_ext = {}
        progs_by_item_id = {}
        for p in user_progs:
            if p.external_id:
                progs_by_ext[p.external_id] = p
                clean_p_ext = p.external_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
                progs_by_ext[clean_p_ext] = p
                progs_by_ext[f"cv_issue_{clean_p_ext}"] = p
                progs_by_ext[f"cv_{clean_p_ext}"] = p
                progs_by_ext[f"tvm-ep-{clean_p_ext}"] = p
            if p.list_item_id:
                progs_by_item_id[p.list_item_id] = p

        now_dt = datetime.now(timezone.utc)

        for ext_id, item, media_item_type in processed_eps:
            clean_ext = ext_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            progress = progs_by_ext.get(ext_id) or progs_by_ext.get(clean_ext) or progs_by_item_id.get(item.id)
            media_type_str = (media_item_type.value if hasattr(media_item_type, 'value') else str(media_item_type)).lower()

            if not progress:
                # Double-check database directly before attempting insert to prevent race or missed variation
                progress = db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    (
                        (ItemProgress.list_item_id == item.id) |
                        (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                    )
                ).first()

            if req.completed:
                was_already_completed = progress.is_completed if progress else False
                if progress:
                    progress.is_completed = True
                    progress.external_id = ext_id
                    progress.list_item_id = item.id
                    progress.item_type = media_type_str
                    if not was_already_completed or req.mark_again:
                        progress.completed_at = now_dt
                else:
                    try:
                        with db.begin_nested():
                            progress = ItemProgress(
                                user_id=current_user.id,
                                item_type=media_type_str,
                                external_id=ext_id,
                                list_item_id=item.id,
                                is_completed=True,
                                is_skipped=False,
                                completed_at=now_dt
                            )
                            db.add(progress)
                            db.flush()
                    except Exception:
                        progress = db.query(ItemProgress).filter(
                            ItemProgress.user_id == current_user.id,
                            (
                                (ItemProgress.list_item_id == item.id) |
                                (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                            )
                        ).first()
                        if progress:
                            progress.is_completed = True
                            progress.external_id = ext_id
                            progress.list_item_id = item.id
                            progress.item_type = media_type_str
                            progress.completed_at = now_dt
                
                if progress:
                    progs_by_ext[ext_id] = progress
                    progs_by_ext[clean_ext] = progress
                    progs_by_item_id[item.id] = progress

                # Record ConsumptionHistory only if not previously completed or if explicitly doing mark_again
                if not was_already_completed or req.mark_again:
                    ch = ConsumptionHistory(
                        user_id=current_user.id,
                        item_type=media_type_str,
                        external_id=ext_id,
                        list_item_id=item.id,
                        consumed_at=now_dt
                    )
                    db.add(ch)
            else:
                # Unwatch: remove latest consumption history entry
                history = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == ext_id
                ).order_by(ConsumptionHistory.consumed_at.desc()).all()
                
                if history:
                    db.delete(history[0])
                if progress:
                    progress.is_completed = False
                    progress.completed_at = None

        if not req.completed:
            # Guarantee all ItemProgress for this tracking list are set to completed = False
            all_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
            list_ext_ids = [it.external_id for it in all_list_items if it.external_id]
            if list_ext_ids:
                db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    ItemProgress.external_id.in_(list_ext_ids)
                ).update({"is_completed": False, "completed_at": None}, synchronize_session=False)
                
        if lib_item:
            completed_val = UserLibraryStatusEnum.READ if is_comic else UserLibraryStatusEnum.COMPLETED
            in_prog_val = UserLibraryStatusEnum.READING if is_comic else UserLibraryStatusEnum.WATCHING
            plan_val = UserLibraryStatusEnum.PLAN_TO_READ if is_comic else UserLibraryStatusEnum.PLAN_TO_WATCH

            if req.completed:
                lib_item.status = completed_val
                lib_item.completed_at = now_dt
                if is_comic and lib_item.total_pages:
                    lib_item.pages_read = lib_item.total_pages
                
                # Resolve last seen episode directly from in-memory items
                completed_titles = [it.title for _, it, _ in processed_eps if it and it.title]
                if not completed_titles:
                    completed_titles = [it.title for it in list_items_by_ext.values() if it and it.title]
                if completed_titles:
                    import re
                    if is_comic:
                        def parse_issue_num(t):
                            m = re.search(r'#(\d+(\.\d+)?)', t)
                            return float(m.group(1)) if m else -1.0
                        sorted_titles = sorted(completed_titles, key=parse_issue_num)
                        lib_item.last_seen_episode = sorted_titles[-1]
                    else:
                        ep_tuples = []
                        for t in completed_titles:
                            m = re.search(r'S(\d+)E(\d+)', t, re.IGNORECASE)
                            if m:
                                ep_tuples.append((int(m.group(1)), int(m.group(2)), t))
                        if ep_tuples:
                            ep_tuples.sort(key=lambda x: (x[0], x[1]))
                            lib_item.last_seen_episode = ep_tuples[-1][2]
                        else:
                            lib_item.last_seen_episode = completed_titles[-1]
            else:
                all_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
                regular_items = [it for it in all_list_items if it.section != "Extras" and not (it.title and "[Extra]" in it.title)]
                eval_items = regular_items if regular_items else all_list_items
                total_eps_count = len(eval_items)
                target_item_ids = [it.id for it in eval_items if it.id]
                target_exts = [it.external_id for it in eval_items if it.external_id]
                
                completed_progs = []
                if target_item_ids or target_exts:
                    completed_progs = db.query(ItemProgress).filter(
                        ItemProgress.user_id == current_user.id,
                        ItemProgress.is_completed == True,
                        (ItemProgress.list_item_id.in_(target_item_ids) | ItemProgress.external_id.in_(target_exts))
                    ).order_by(ItemProgress.completed_at.desc()).all()
                
                completed_eps_count = len(completed_progs)
                if completed_eps_count >= total_eps_count and total_eps_count > 0:
                    lib_item.status = completed_val
                    lib_item.completed_at = completed_progs[0].completed_at if (completed_progs and completed_progs[0].completed_at) else now_dt
                elif completed_eps_count > 0:
                    lib_item.status = in_prog_val
                    lib_item.completed_at = None
                    last_prog = completed_progs[0]
                    matching_item = None
                    for it in all_list_items:
                        if (last_prog.list_item_id and it.id == last_prog.list_item_id) or (last_prog.external_id and it.external_id == last_prog.external_id):
                            matching_item = it
                            break
                    if matching_item:
                        lib_item.last_seen_episode = matching_item.title
                else:
                    lib_item.status = plan_val
                    lib_item.completed_at = None
                    lib_item.last_seen_episode = None
                    if is_comic:
                        lib_item.pages_read = 0
                    vol_hist = db.query(ConsumptionHistory).filter(
                        ConsumptionHistory.user_id == current_user.id,
                        ConsumptionHistory.external_id == lib_item.external_id
                    ).order_by(ConsumptionHistory.consumed_at.desc()).first()
                    if vol_hist:
                        db.delete(vol_hist)
            lib_item.updated_at = datetime.now(timezone.utc)

        db.commit()
        return {"message": "All seasons progress toggled successfully", "status": lib_item.status.value if (lib_item and hasattr(lib_item.status, 'value')) else (lib_item.status if lib_item else ("read" if is_comic else "completed"))}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        root_err = getattr(e, 'orig', e)
        error_msg = str(root_err) if root_err else str(e)
        if "[SQL:" in error_msg:
            error_msg = error_msg.split("[SQL:")[0].strip()
        logger.exception(f"Error in bulk_toggle_all_seasons for list {list_id}: {error_msg} | {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk toggle all seasons failed: {type(root_err).__name__}: {error_msg}"
        )


class BulkToggleEpisodesRequest(BaseModel):
    episodes: List[Dict[str, Any]]
    completed: bool = True

@router.post("/{list_id}/bulk-toggle-episodes", status_code=status.HTTP_200_OK)
def bulk_toggle_episodes(
    list_id: int,
    req: BulkToggleEpisodesRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
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

        if not lib_item and reading_list:
            # Fallback lookup in case tracking_list_id was not yet saved on UserLibraryItem
            candidate_items = db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.item_type.in_(["series", "anime", "comic"])
            ).all()
            for cand in candidate_items:
                if cand.tracking_list_id == list_id or (cand.title and (cand.title in reading_list.title or reading_list.title.endswith(cand.title))):
                    lib_item = cand
                    if not lib_item.tracking_list_id:
                        lib_item.tracking_list_id = list_id
                    break
        
        series_title = lib_item.title if lib_item else "Series"
        is_comic = (lib_item and lib_item.item_type == "comic")
        episodes_list = req.episodes or []
        
        existing_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
        list_items_by_ext = {it.external_id: it for it in existing_list_items if it.external_id}
        item_count = len(existing_list_items)
        now_dt = datetime.now(timezone.utc)

        processed_eps = []
        seen_ext_ids = set()

        for ep in episodes_list:
            ep_id = ep.get('id')
            if not ep_id:
                continue
            raw_ep_str = str(ep_id)
            if is_comic or raw_ep_str.startswith('cv_') or raw_ep_str.startswith('cv-'):
                ext_id = raw_ep_str if raw_ep_str.startswith('cv_issue_') else f"cv_issue_{raw_ep_str.replace('cv_vol_', '').replace('cv_', '')}"
                media_item_type = ItemTypeEnum.COMIC
                sec_name = "Volumen"
            else:
                ext_id = f"tvm-ep-{ep_id}"
                media_item_type = ItemTypeEnum.SERIES
                sec_name = f"Season {ep.get('season_number', 1)}"

            if ext_id in seen_ext_ids:
                continue
            seen_ext_ids.add(ext_id)

            season_num = ep.get('season_number', 1)
            ep_num = ep.get('episode_number', 1)

            item = list_items_by_ext.get(ext_id)
            if not item:
                item_count += 1
                img_url_val = ep.get('still_path') or ep.get('image_url')
                item_title_val = ep.get('title') or (f"{series_title} {ep.get('name', 'Untitled')}" if media_item_type == ItemTypeEnum.COMIC else f"{series_title} - S{season_num:02d}E{ep_num:02d} - {ep.get('name', 'Untitled')}")
                item = ListItem(
                    list_id=list_id,
                    order_index=item_count,
                    item_type=media_item_type,
                    external_id=ext_id[:95] if ext_id else None,
                    title=item_title_val[:245],
                    image_url=img_url_val[:495] if img_url_val else None,
                    custom_notes=json.dumps({"description": ep.get('overview') or ep.get('custom_notes') or "", "release_date": ep.get('air_date') or None}),
                    section=sec_name[:95] if sec_name else None
                )
                db.add(item)
                db.flush()
                list_items_by_ext[ext_id] = item

            processed_eps.append((ext_id, item, media_item_type))

        all_ext_variations = set(seen_ext_ids)
        for eid in seen_ext_ids:
            clean = eid.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            all_ext_variations.add(clean)
            all_ext_variations.add(f"cv_issue_{clean}")
            all_ext_variations.add(f"cv_{clean}")
            all_ext_variations.add(f"tvm-ep-{clean}")

        target_ext_ids = list(all_ext_variations)
        target_item_ids = [it.id for it in list_items_by_ext.values() if it.id]
        
        user_progs = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            (ItemProgress.external_id.in_(target_ext_ids) | ItemProgress.list_item_id.in_(target_item_ids))
        ).all() if (target_ext_ids or target_item_ids) else []

        progs_by_ext = {}
        progs_by_item_id = {}
        for p in user_progs:
            if p.external_id:
                progs_by_ext[p.external_id] = p
                clean_p_ext = p.external_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
                progs_by_ext[clean_p_ext] = p
                progs_by_ext[f"cv_issue_{clean_p_ext}"] = p
                progs_by_ext[f"cv_{clean_p_ext}"] = p
                progs_by_ext[f"tvm-ep-{clean_p_ext}"] = p
            if p.list_item_id:
                progs_by_item_id[p.list_item_id] = p

        newly_completed_units = []
        for ext_id, item, media_item_type in processed_eps:
            clean_ext = ext_id.replace("cv_issue_", "").replace("tvm-ep-", "").replace("cv_", "").replace("cv-", "")
            progress = progs_by_ext.get(ext_id) or progs_by_ext.get(clean_ext) or progs_by_item_id.get(item.id)
            media_type_str = (media_item_type.value if hasattr(media_item_type, 'value') else str(media_item_type)).lower()
            
            if not progress:
                progress = db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    (
                        (ItemProgress.list_item_id == item.id) |
                        (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                    )
                ).first()

            if req.completed:
                was_already_completed = progress.is_completed if progress else False
                if progress:
                    progress.is_completed = True
                    progress.external_id = ext_id
                    progress.list_item_id = item.id
                    progress.item_type = media_type_str
                    progress.completed_at = now_dt
                else:
                    try:
                        with db.begin_nested():
                            progress = ItemProgress(
                                user_id=current_user.id,
                                item_type=media_type_str,
                                external_id=ext_id,
                                list_item_id=item.id,
                                is_completed=True,
                                is_skipped=False,
                                completed_at=now_dt
                            )
                            db.add(progress)
                            db.flush()
                    except Exception:
                        progress = db.query(ItemProgress).filter(
                            ItemProgress.user_id == current_user.id,
                            (
                                (ItemProgress.list_item_id == item.id) |
                                (ItemProgress.external_id.in_([ext_id, clean_ext, f"cv_issue_{clean_ext}", f"cv_{clean_ext}", f"tvm-ep-{clean_ext}"]))
                            )
                        ).first()
                        if progress:
                            progress.is_completed = True
                            progress.external_id = ext_id
                            progress.list_item_id = item.id
                            progress.item_type = media_type_str
                            progress.completed_at = now_dt
                
                if progress:
                    progs_by_ext[ext_id] = progress
                    progs_by_ext[clean_ext] = progress
                    progs_by_item_id[item.id] = progress

                if not was_already_completed:
                    newly_completed_units.append(item)
                    ch = ConsumptionHistory(
                        user_id=current_user.id,
                        item_type=media_type_str,
                        external_id=ext_id,
                        list_item_id=item.id,
                        consumed_at=now_dt
                    )
                    db.add(ch)
            else:
                history = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == ext_id
                ).order_by(ConsumptionHistory.consumed_at.desc()).all()
                if history:
                    db.delete(history[0])
                if progress:
                    progress.is_completed = False
                    progress.completed_at = None

        if lib_item:
            if req.completed:
                if is_comic:
                    from app.services.comicvine import ComicVineService
                    total_vol_issues = 0
                    if lib_item.external_id:
                        try:
                            cv_issues = ComicVineService.get_comic_volume_issues(lib_item.external_id)
                            total_vol_issues = len(cv_issues) if cv_issues else 0
                        except Exception:
                            pass

                    all_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
                    all_item_ids = [it.id for it in all_list_items if it.id]
                    all_ext_ids = [it.external_id for it in all_list_items if it.external_id]

                    completed_progs = db.query(ItemProgress).filter(
                        ItemProgress.user_id == current_user.id,
                        ItemProgress.is_completed == True,
                        (ItemProgress.list_item_id.in_(all_item_ids) | ItemProgress.external_id.in_(all_ext_ids))
                    ).all() if (all_item_ids or all_ext_ids) else []

                    completed_count = len(completed_progs)

                    if total_vol_issues > 0 and completed_count >= total_vol_issues:
                        lib_item.status = UserLibraryStatusEnum.READ
                        lib_item.completed_at = now_dt
                        if lib_item.total_pages:
                            lib_item.pages_read = lib_item.total_pages
                    else:
                        lib_item.status = UserLibraryStatusEnum.READING
                        lib_item.completed_at = None

                    completed_prog_item_ids = {p.list_item_id for p in completed_progs if p.list_item_id}
                    completed_prog_ext_ids = {p.external_id for p in completed_progs if p.external_id}
                    completed_titles = [
                        it.title for it in all_list_items
                        if (it.id in completed_prog_item_ids or it.external_id in completed_prog_ext_ids) and it.title
                    ]
                    if completed_titles:
                        import re
                        def parse_issue_num(t):
                            m = re.search(r'#(\d+(\.\d+)?)', t)
                            return float(m.group(1)) if m else -1.0
                        sorted_titles = sorted(completed_titles, key=parse_issue_num)
                        lib_item.last_seen_episode = sorted_titles[-1]
                else:
                    # Check if all aired episodes are completed
                    all_aired_completed = False
                    if lib_item.external_id:
                        try:
                            all_episodes = TVMazeService.get_all_episodes(lib_item.external_id)
                            now_date = now_dt.strftime("%Y-%m-%d")

                            def is_ep_aired_check(ep_dict):
                                astamp = ep_dict.get("airstamp")
                                if astamp:
                                    try:
                                        ep_dt = datetime.fromisoformat(astamp.replace("Z", "+00:00"))
                                        return ep_dt <= now_dt
                                    except Exception:
                                        pass
                                adate = ep_dict.get("airdate")
                                return bool(adate and adate <= now_date)

                            aired_eps = [
                                e for e in all_episodes 
                                if is_ep_aired_check(e) and not e.get("is_extra") and e.get("season_number", 1) != 0 and e.get("ep_type") != "insignificant_special"
                            ]
                            if aired_eps:
                                aired_ext_ids = {f"tvm-ep-{e['id']}" for e in aired_eps}
                                completed_progs = db.query(ItemProgress.external_id).filter(
                                    ItemProgress.user_id == current_user.id,
                                    ItemProgress.is_completed == True
                                ).all()
                                watched_ext_ids = {p[0] for p in completed_progs if p[0]}
                                if aired_ext_ids.issubset(watched_ext_ids):
                                    all_aired_completed = True
                        except Exception as e:
                            logger.warning(f"Error checking all_aired_completed: {e}")

                    if all_aired_completed:
                        lib_item.status = UserLibraryStatusEnum.COMPLETED
                        lib_item.completed_at = now_dt
                    else:
                        lib_item.status = UserLibraryStatusEnum.WATCHING
                        lib_item.completed_at = None

                    # Update last seen episode based on completed episodes
                    all_list_items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
                    all_item_ids = [it.id for it in all_list_items if it.id]
                    all_ext_ids = [it.external_id for it in all_list_items if it.external_id]
                    completed_progs = db.query(ItemProgress).filter(
                        ItemProgress.user_id == current_user.id,
                        ItemProgress.is_completed == True,
                        (ItemProgress.list_item_id.in_(all_item_ids) | ItemProgress.external_id.in_(all_ext_ids))
                    ).all() if (all_item_ids or all_ext_ids) else []
                    completed_prog_item_ids = {p.list_item_id for p in completed_progs if p.list_item_id}
                    completed_prog_ext_ids = {p.external_id for p in completed_progs if p.external_id}
                    completed_titles = [
                        it.title for it in all_list_items
                        if (it.id in completed_prog_item_ids or it.external_id in completed_prog_ext_ids) and it.title
                    ]
                    if completed_titles:
                        import re
                        ep_tuples = []
                        for t in completed_titles:
                            m = re.search(r'S(\d+)E(\d+)', t, re.IGNORECASE)
                            if m:
                                ep_tuples.append((int(m.group(1)), int(m.group(2)), t))
                        if ep_tuples:
                            ep_tuples.sort(key=lambda x: (x[0], x[1]))
                            lib_item.last_seen_episode = ep_tuples[-1][2]
                        else:
                            lib_item.last_seen_episode = completed_titles[-1]

            lib_item.updated_at = now_dt

        # Record activity log with range/batch metadata if any units were completed
        if req.completed and newly_completed_units:
            import re
            from app.services.activity_service import ActivityService
            from app.models.activity import UserActivityLog

            target_type = lib_item.item_type.value if (lib_item and hasattr(lib_item.item_type, 'value')) else (lib_item.item_type if lib_item else ("comic" if is_comic else "series"))
            work_title = lib_item.title if lib_item else series_title
            work_ext_id = lib_item.external_id if lib_item else None
            work_image_url = lib_item.image_url if lib_item else None

            # Sort newly completed units chronologically
            if is_comic:
                def extract_issue_n(it):
                    m = re.search(r'#(\d+(\.\d+)?)', it.title or '')
                    return float(m.group(1)) if m else (float(it.order_index or 0))
                sorted_units = sorted(newly_completed_units, key=extract_issue_n)
            else:
                def extract_s_e(it):
                    m = re.search(r'S(\d+)E(\d+)', it.title or '', re.IGNORECASE)
                    if m:
                        return (int(m.group(1)), int(m.group(2)))
                    return (1, it.order_index or 0)
                sorted_units = sorted(newly_completed_units, key=extract_s_e)

            def get_unit_label(it):
                if is_comic:
                    m = re.search(r'#\d+(\.\d+)?', it.title or '')
                    return m.group(0) if m else (f"#{it.order_index}" if it.order_index else it.title)
                else:
                    m = re.search(r'S(\d+)E(\d+)', it.title or '', re.IGNORECASE)
                    if m:
                        s_pad = f"{int(m.group(1)):02d}"
                        e_pad = f"{int(m.group(2)):02d}"
                        return f"T{s_pad} | E{e_pad}"
                    return it.title

            count = len(sorted_units)
            start_unit = get_unit_label(sorted_units[0])
            end_unit = get_unit_label(sorted_units[-1])

            # Check if this work was added to library in the last 15 minutes to unify into a single event
            recent_add = db.query(UserActivityLog).filter(
                UserActivityLog.user_id == current_user.id,
                UserActivityLog.activity_type == "item_added_to_library",
                UserActivityLog.external_id == work_ext_id
            ).order_by(UserActivityLog.id.desc()).first()

            is_unified = False
            if recent_add and recent_add.created_at:
                try:
                    c_at = recent_add.created_at.replace(tzinfo=timezone.utc) if recent_add.created_at.tzinfo is None else recent_add.created_at
                    if (now_dt - c_at).total_seconds() < 900:
                        is_unified = True
                        db.delete(recent_add)
                        db.flush()
                except Exception:
                    pass

            act_meta = {
                "count": count,
                "start_unit": start_unit,
                "end_unit": end_unit,
                "item_type": target_type,
                "work_title": work_title,
                "also_added": is_unified,
                "is_range": count > 1
            }

            if count == 1:
                item_title_val = sorted_units[0].title
            else:
                item_title_val = f"{work_title} ({start_unit} - {end_unit})"

            ActivityService.record_activity(
                db=db,
                user_id=current_user.id,
                activity_type="item_status_changed",
                item_title=item_title_val,
                item_type=target_type,
                external_id=work_ext_id,
                list_id=list_id,
                image_url=work_image_url,
                details="completed",
                metadata=act_meta
            )

        db.commit()
        if lib_item:
            db.refresh(lib_item)
        return {
            "message": f"{len(episodes_list)} episodes progress toggled successfully",
            "status": lib_item.status.value if (lib_item and hasattr(lib_item.status, 'value')) else (lib_item.status if lib_item else ("reading" if is_comic else "watching")),
            "last_seen_episode": lib_item.last_seen_episode if lib_item else None
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        root_err = getattr(e, 'orig', e)
        error_msg = str(root_err) if root_err else str(e)
        if "[SQL:" in error_msg:
            error_msg = error_msg.split("[SQL:")[0].strip()
        logger.exception(f"Error in bulk_toggle_episodes for list {list_id}: {error_msg} | {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk toggle episodes failed: {type(root_err).__name__}: {error_msg}"
        )






