from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.item_progress import ItemProgress
from app.schemas.library import LibraryItemCreate, LibraryItemUpdate, LibraryItemResponse
from app.services.tvmaze import TVMazeService
from app.models.activity import UserActivityLog

router = APIRouter()

def validate_media_status(item_type: str, status_val: UserLibraryStatusEnum):
    t_lower = item_type.lower()
    if status_val == UserLibraryStatusEnum.DROPPED or t_lower in ("episode", "season"):
        return
        
    if t_lower == "game":
        allowed = {UserLibraryStatusEnum.PLAN_TO_PLAY, UserLibraryStatusEnum.PLAYING, UserLibraryStatusEnum.COMPLETED}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for game. Must be 'plan_to_play', 'playing', 'completed', or 'dropped'."
            )
    elif t_lower == "movie":
        allowed = {UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.COMPLETED}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for movie. Must be 'plan_to_watch', 'completed', or 'dropped'."
            )
    elif t_lower in ("series", "anime"):
        allowed = {UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.WATCHING, UserLibraryStatusEnum.COMPLETED}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for series. Must be 'plan_to_watch', 'watching', 'completed', or 'dropped'."
            )
    elif t_lower == "book":
        allowed = {UserLibraryStatusEnum.PLAN_TO_READ, UserLibraryStatusEnum.READING, UserLibraryStatusEnum.READ}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for book. Must be 'plan_to_read', 'reading', 'read', or 'dropped'."
            )

def bulk_complete_series_episodes(db: Session, user_id: int, tracking_list_id: int, external_id: str, title: str):
    try:
        from app.models.list_item import ListItem, ItemTypeEnum
        from app.models.item_progress import ItemProgress
        from datetime import datetime, timezone
        
        # get series detail to know seasons
        series_detail = TVMazeService.get_series_detail(external_id)
        # Note: tvmaze doesnt easily return number_of_seasons in the main show endpoint
        # For simplicity, we just fetch a few seasons.
        s_count = series_detail.get('number_of_seasons', 1) if series_detail else 1
        
        last_completed_title = None
        for s_num in range(1, s_count + 1):
            episodes = TVMazeService.get_season_episodes(external_id, s_num)
            for ep in episodes:
                ext_id = f"tvm-ep-{ep.get('id')}"
                li = db.query(ListItem).filter(
                    ListItem.list_id == tracking_list_id,
                    ListItem.external_id == ext_id
                ).first()
                
                if not li:
                    item_count = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).count()
                    li = ListItem(
                        list_id=tracking_list_id,
                        order_index=item_count + 1,
                        item_type=ItemTypeEnum.SERIES,
                        external_id=ext_id,
                        title=f"{title} - S{s_num:02d}E{ep.get('episode_number', 1):02d} - {ep.get('name', 'Untitled')}",
                        image_url=ep.get('still_path'),
                        custom_notes=ep.get('overview'),
                        section=f"Season {s_num}"
                    )
                    db.add(li)
                    db.commit()
                    db.refresh(li)
                    
                progress = db.query(ItemProgress).filter(
                    ItemProgress.user_id == user_id,
                    ItemProgress.external_id == ext_id
                ).first()
                
                if progress:
                    progress.is_completed = True
                    progress.completed_at = datetime.now(timezone.utc)
                else:
                    progress = ItemProgress(
                        user_id=user_id,
                        item_type=ItemTypeEnum.SERIES,
                        external_id=ext_id,
                        list_item_id=li.id,
                        is_completed=True,
                        is_skipped=False,
                        completed_at=datetime.now(timezone.utc)
                    )
                    db.add(progress)
                last_completed_title = li.title
        db.commit()
        return last_completed_title
    except Exception as e:
        print(f"Failed to bulk complete series episodes: {e}")
        return None

def sync_show_episodes_and_get_last_seen(db: Session, user_id: int, tracking_list_id: Optional[int], show_title: str) -> Optional[str]:
    import re
    user_progs = db.query(ItemProgress).filter(
        ItemProgress.user_id == user_id,
        ItemProgress.is_completed == True
    ).all()

    completed_eps = []
    for prog in user_progs:
        ep_title = None
        ext_id = prog.external_id
        
        if prog.list_item_id:
            li = db.query(ListItem).filter(ListItem.id == prog.list_item_id).first()
            if li:
                ep_title = li.title
                ext_id = li.external_id or ext_id

        if not ep_title and ext_id:
            li = db.query(ListItem).filter(ListItem.external_id == ext_id).first()
            if li:
                ep_title = li.title

        if ep_title and (show_title.lower() in ep_title.lower()):
            match = re.search(r'S(\d+)E(\d+)', ep_title, re.IGNORECASE)
            if match:
                s_num = int(match.group(1))
                e_num = int(match.group(2))
                ep_code = f"S{s_num:02d}E{e_num:02d}"
                completed_eps.append((s_num, e_num, ep_code, ext_id, ep_title))

                if tracking_list_id:
                    track_li = db.query(ListItem).filter(
                        ListItem.list_id == tracking_list_id,
                        ListItem.external_id == ext_id
                    ).first()
                    if not track_li:
                        count = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).count()
                        track_li = ListItem(
                            list_id=tracking_list_id,
                            order_index=count + 1,
                            item_type=ItemTypeEnum.SERIES,
                            external_id=ext_id,
                            title=ep_title,
                            section=f"Season {s_num}"
                        )
                        db.add(track_li)
                        db.commit()
                        db.refresh(track_li)

                    tp = db.query(ItemProgress).filter(
                        ItemProgress.user_id == user_id,
                        (ItemProgress.list_item_id == track_li.id) | (ItemProgress.external_id == ext_id)
                    ).first()
                    if tp:
                        tp.list_item_id = track_li.id
                        tp.is_completed = True
                    else:
                        tp = ItemProgress(
                            user_id=user_id,
                            list_item_id=track_li.id,
                            external_id=ext_id,
                            item_type=ItemTypeEnum.SERIES,
                            is_completed=True,
                            completed_at=prog.completed_at or datetime.now(timezone.utc)
                        )
                        db.add(tp)
                    db.commit()

    if not completed_eps:
        return None

    completed_eps.sort(key=lambda x: (x[0], x[1]))
    return completed_eps[-1][2]

@router.post("/", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_library(
    item_in: LibraryItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    validate_media_status(item_in.item_type, item_in.status)

    existing = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == item_in.item_type,
        UserLibraryItem.external_id == item_in.external_id
    ).first()
    
    if existing:
        if existing.tracking_list_id is not None or item_in.item_type not in ("series", "anime"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This item is already in your library"
            )
        
    tracking_list_id = existing.tracking_list_id if existing else None
    
    if item_in.item_type in ("series", "anime") and not tracking_list_id:
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
        
        try:
            episodes = TVMazeService.get_season_episodes(item_in.external_id, 1)
            for idx, ep in enumerate(episodes, start=1):
                ep_num = ep.get("episode_number")
                ep_name = ep.get("name") or "Untitled Episode"
                title = f"{item_in.title} - S01E{ep_num:02d} - {ep_name}"
                image_url = ep.get('image')
                db_item = ListItem(
                    list_id=private_list.id,
                    order_index=idx,
                    item_type=ItemTypeEnum.SERIES,
                    external_id=f"tvm-ep-{ep.get('id')}",
                    title=title,
                    image_url=image_url,
                    custom_notes=ep.get("summary"),
                    section="Season 1"
                )
                db.add(db_item)
            db.commit()
        except Exception as e:
            print(f"Failed to auto-populate series episodes: {e}")
            
    status_val = item_in.status
    if item_in.item_type in ("series", "anime") and status_val == UserLibraryStatusEnum.PLAN_TO_WATCH:
        status_val = UserLibraryStatusEnum.WATCHING

    pages_val = item_in.pages_read if item_in.pages_read is not None else 0
    if pages_val > 0 and status_val not in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED):
        status_val = UserLibraryStatusEnum.READING
    elif pages_val == 0 and status_val in (UserLibraryStatusEnum.READING, UserLibraryStatusEnum.READ):
        status_val = UserLibraryStatusEnum.PLAN_TO_READ

    completed_at_val = None
    last_title = None
    if status_val in (UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.READ):
        completed_at_val = datetime.now(timezone.utc)
        if item_in.item_type in ("series", "anime") and tracking_list_id:
            last_title = bulk_complete_series_episodes(db, current_user.id, tracking_list_id, item_in.external_id, item_in.title)

    if item_in.item_type in ("series", "anime"):
        sync_last = sync_show_episodes_and_get_last_seen(db, current_user.id, tracking_list_id, item_in.title)
        if sync_last:
            last_title = sync_last
            if status_val == UserLibraryStatusEnum.PLAN_TO_WATCH:
                status_val = UserLibraryStatusEnum.WATCHING

    if existing:
        existing.status = status_val
        if item_in.is_favorite is not None:
            existing.is_favorite = item_in.is_favorite
        existing.completed_at = completed_at_val
        if last_title:
            existing.last_seen_episode = last_title
        existing.pages_read = pages_val
        existing.tracking_list_id = tracking_list_id
        new_lib_item = existing
    else:
        new_lib_item = UserLibraryItem(
            user_id=current_user.id,
            item_type=item_in.item_type,
            external_id=item_in.external_id,
            imdb_id=item_in.imdb_id,
            title=item_in.title,
            image_url=item_in.image_url,
            status=status_val,
            is_favorite=item_in.is_favorite if item_in.is_favorite is not None else False,
            completed_at=completed_at_val,
            last_seen_episode=last_title,
            pages_read=pages_val,
            tracking_list_id=tracking_list_id
        )
        db.add(new_lib_item)
    
    if item_in.item_type in ("series", "anime"):
        loose_items = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.item_type.in_(["episode", "season"]),
            UserLibraryItem.last_seen_episode == item_in.title
        ).all()
        for loose in loose_items:
            db.delete(loose)
            
    db.commit()
    
    # Record activity log
    activity = UserActivityLog(
            user_id=current_user.id,
        activity_type="shelf_add",
        item_title=item_in.title,
        item_type=item_in.item_type,
        external_id=item_in.external_id,
        image_url=item_in.image_url,
        details=item_in.status.value if hasattr(item_in.status, "value") else str(item_in.status)
    )
    db.add(activity)
    
    db.commit()
    db.refresh(new_lib_item)
    return new_lib_item

@router.get("/", response_model=List[LibraryItemResponse])
def get_library(
    user_id: Optional[int] = Query(None, description="Get library of a specific user"),
    status: Optional[UserLibraryStatusEnum] = Query(None, description="Filter library by status"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import desc, func
    target_user_id = user_id if user_id is not None else current_user.id
    query = db.query(UserLibraryItem).filter(UserLibraryItem.user_id == target_user_id)
    if status:
        query = query.filter(UserLibraryItem.status == status)
    
    # Sort by completed_at or updated_at, whichever is newer
    query = query.order_by(desc(func.coalesce(UserLibraryItem.completed_at, UserLibraryItem.updated_at)))
    items = query.offset(skip).limit(limit).all()
    return items

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
        
    if item_in.status is not None:
        validate_media_status(lib_item.item_type, item_in.status)
        lib_item.status = item_in.status
        
        # Set completed_at date
        if item_in.status in (UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.READ):
            lib_item.completed_at = datetime.now(timezone.utc)
            if lib_item.item_type == "series" and lib_item.tracking_list_id:
                last_title = bulk_complete_series_episodes(db, current_user.id, lib_item.tracking_list_id, lib_item.external_id, lib_item.title)
                if last_title:
                    lib_item.last_seen_episode = last_title
        else:
            lib_item.completed_at = None
            
        lib_item.updated_at = datetime.now(timezone.utc)
        
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="shelf_status",
            item_title=lib_item.title,
            item_type=lib_item.item_type,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details=item_in.status.value if hasattr(item_in.status, "value") else str(item_in.status)
        )
        db.add(activity)
        
    if item_in.is_favorite is not None:
        lib_item.is_favorite = item_in.is_favorite
        lib_item.updated_at = datetime.now(timezone.utc)
        
        # Record activity log
        activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="shelf_favorite",
            item_title=lib_item.title,
            item_type=lib_item.item_type,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details="starred" if item_in.is_favorite else "unstarred"
        )
        db.add(activity)

    if item_in.pages_read is not None:
        lib_item.pages_read = item_in.pages_read
        lib_item.updated_at = datetime.now(timezone.utc)
        if item_in.pages_read > 0 and lib_item.status not in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED):
            lib_item.status = UserLibraryStatusEnum.READING
            activity = UserActivityLog(
                user_id=current_user.id,
            activity_type="shelf_status",
            item_title=lib_item.title,
            item_type=lib_item.item_type,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details=lib_item.status.value
        )
            db.add(activity)
        elif item_in.pages_read == 0 and lib_item.status in (UserLibraryStatusEnum.READING, UserLibraryStatusEnum.READ):
            lib_item.status = UserLibraryStatusEnum.PLAN_TO_READ
            activity = UserActivityLog(
            user_id=current_user.id,
            activity_type="shelf_status",
            item_title=lib_item.title,
            item_type=lib_item.item_type,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details=lib_item.status.value
        )
            db.add(activity)

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
        
    # Record activity log
    activity = UserActivityLog(
        user_id=current_user.id,
        activity_type="shelf_remove",
        item_title=lib_item.title,
        item_type=lib_item.item_type,
        external_id=lib_item.external_id,
        image_url=lib_item.image_url,
        details="removed"
    )
    db.add(activity)

    # If there is an associated private tracking list, delete it too
    if lib_item.tracking_list_id:
        private_list = db.query(ReadingList).filter(ReadingList.id == lib_item.tracking_list_id).first()
        if private_list:
            db.delete(private_list)
            
    db.delete(lib_item)
    db.commit()
    return None
