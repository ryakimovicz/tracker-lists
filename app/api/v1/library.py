from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
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
        allowed = {UserLibraryStatusEnum.PLAN_TO_PLAY, UserLibraryStatusEnum.PLAYING, UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.ENDLESS}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for game. Must be 'plan_to_play', 'playing', 'completed', 'endless', or 'dropped'."
            )
    elif t_lower == "movie":
        allowed = {UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.WATCHING, UserLibraryStatusEnum.COMPLETED}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for movie. Must be 'plan_to_watch', 'watching', 'completed', or 'dropped'."
            )
    elif t_lower in ("series", "anime"):
        allowed = {UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.WATCHING, UserLibraryStatusEnum.COMPLETED}
        if status_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status for series. Must be 'plan_to_watch', 'watching', 'completed', or 'dropped'."
            )
    elif t_lower in ("book", "comic", "manga"):
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
        
        now_dt = datetime.now(timezone.utc)
        now_date = now_dt.strftime("%Y-%m-%d")

        def is_ep_aired(ep_dict):
            astamp = ep_dict.get("airstamp")
            if astamp:
                try:
                    ep_dt = datetime.fromisoformat(astamp.replace("Z", "+00:00"))
                    return ep_dt <= now_dt
                except Exception:
                    pass
            adate = ep_dict.get("air_date") or ep_dict.get("airdate")
            return bool(adate and adate <= now_date)

        # get series detail to know seasons
        series_detail = TVMazeService.get_series_detail(external_id)
        s_count = series_detail.get('number_of_seasons', 1) if series_detail else 1
        
        last_completed_title = None
        for s_num in range(1, s_count + 1):
            episodes = TVMazeService.get_season_episodes(external_id, s_num)
            for ep in episodes:
                # Do NOT mark unreleased episodes as completed!
                if not is_ep_aired(ep):
                    continue

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
                    progress.completed_at = now_dt
                else:
                    progress = ItemProgress(
                        user_id=user_id,
                        item_type=ItemTypeEnum.SERIES,
                        external_id=ext_id,
                        list_item_id=li.id,
                        is_completed=True,
                        is_skipped=False,
                        completed_at=now_dt
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

@router.get("/{item_id}/consumption-history")
def get_library_item_consumption_history(
    item_id: str,
    item_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.consumption import ConsumptionHistory
    from app.models.list_item import ListItem
    from app.models.list import ReadingList
    
    item = None
    if item_id.isdigit():
        item = db.query(UserLibraryItem).filter(
            UserLibraryItem.id == int(item_id),
            UserLibraryItem.user_id == current_user.id
        ).first()
    
    external_id = item.external_id if item else None
    
    if not item and item_id.isdigit():
        # Check if item_id corresponds to a ListItem (e.g. an episode)
        list_item = db.query(ListItem).filter(ListItem.id == int(item_id)).first()
        if list_item:
            external_id = list_item.external_id
    elif not item and not item_id.isdigit():
        external_id = item_id

    resolved_type = (item.item_type if item else item_type) or ""
    tracking_list_id = item.tracking_list_id if item else None

    # If item is not in library or tracking_list_id is missing, look up an existing tracking list for this series
    if not tracking_list_id and resolved_type in ("series", "anime") and external_id:
        series_clean = external_id.replace("tvm_", "").replace("tvm-", "")
        # Find any list containing episodes for this series
        found_li = db.query(ListItem).join(ReadingList).filter(
            ReadingList.creator_id == current_user.id,
            ListItem.item_type == ItemTypeEnum.SERIES
        ).first()
        if found_li:
            tracking_list_id = found_li.list_id

    if resolved_type in ("series", "anime") and tracking_list_id:
        list_items = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).all()
        ep_ext_ids = [it.external_id for it in list_items if it.external_id]
        if ep_ext_ids:
            # Group consumption history by episode
            from collections import defaultdict
            ep_consumptions = defaultdict(list)
            all_ep_ch = db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id.in_(ep_ext_ids)
            ).order_by(ConsumptionHistory.consumed_at.asc()).all()
            
            for ch in all_ep_ch:
                ep_consumptions[ch.external_id].append(ch)
            
            # The series is completed N times if all episodes have at least N consumptions
            min_completed_times = min(len(ep_consumptions[eid]) for eid in ep_ext_ids) if len(ep_consumptions) == len(ep_ext_ids) else 0
            
            series_entries = []
            for run_idx in range(min_completed_times):
                # The timestamp for run_idx completion of the series is the latest timestamp among all episodes for that run
                run_timestamps = [ep_consumptions[eid][run_idx].consumed_at for eid in ep_ext_ids]
                completion_time = max(run_timestamps)
                series_entries.append({
                    "id": ep_consumptions[ep_ext_ids[0]][run_idx].id,
                    "consumed_at": completion_time,
                    "is_hundred_percent": False
                })
            
            # Sort descending for display
            series_entries.sort(key=lambda x: x["consumed_at"], reverse=True)
            result_dates = [e["consumed_at"] for e in series_entries]
            return {
                "count": len(series_entries),
                "history": result_dates,
                "entries": series_entries
            }

    history = db.query(ConsumptionHistory).filter(
        ConsumptionHistory.user_id == current_user.id,
        ConsumptionHistory.external_id == external_id
    ).order_by(ConsumptionHistory.consumed_at.desc()).all()
    
    # If no history records yet, but library item was completed, backfill the original completion date
    if not history and item and item.completed_at:
        ch = ConsumptionHistory(
            user_id=current_user.id,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            consumed_at=item.completed_at,
            is_hundred_percent=bool(item.is_hundred_percent)
        )
        db.add(ch)
        db.commit()
        history = [ch]
        
    result_entries = [
        {
            "id": ch.id,
            "consumed_at": ch.consumed_at,
            "is_hundred_percent": bool(ch.is_hundred_percent)
        } for ch in history
    ]
    result_dates = [ch.consumed_at for ch in history]
    return {
        "count": len(result_entries),
        "history": result_dates,
        "entries": result_entries
    }

@router.delete("/{item_id}/consumption-history/latest", response_model=LibraryItemResponse)
def remove_latest_consumption(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.consumption import ConsumptionHistory
    item = db.query(UserLibraryItem).filter(
        UserLibraryItem.id == item_id,
        UserLibraryItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")
        
    history = db.query(ConsumptionHistory).filter(
        ConsumptionHistory.user_id == current_user.id,
        ConsumptionHistory.external_id == item.external_id
    ).order_by(ConsumptionHistory.consumed_at.desc()).all()
    
    if history:
        # Delete only the latest consumption record
        latest_entry = history[0]
        db.delete(latest_entry)
        remaining = history[1:]
        
        if remaining:
            # Still has prior consumptions! Keep status completed/read and update completed_at and is_hundred_percent to the previous one
            item.completed_at = remaining[0].consumed_at
            item.is_hundred_percent = bool(remaining[0].is_hundred_percent)
        else:
            # No more consumptions left -> uncomplete
            item.completed_at = None
            item.is_hundred_percent = False
            if item.item_type in ['book', 'comic', 'manga']:
                item.status = UserLibraryStatusEnum.PLAN_TO_READ
            elif item.item_type == 'game':
                item.status = UserLibraryStatusEnum.PLAN_TO_PLAY
            else:
                item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
    else:
        # No history entries -> uncomplete
        item.completed_at = None
        item.is_hundred_percent = False
        if item.item_type in ['book', 'comic', 'manga']:
            item.status = UserLibraryStatusEnum.PLAN_TO_READ
        elif item.item_type == 'game':
            item.status = UserLibraryStatusEnum.PLAN_TO_PLAY
        else:
            item.status = UserLibraryStatusEnum.PLAN_TO_WATCH
            
    db.commit()
    db.refresh(item)
    return item

@router.post("/{item_id}/mark-consumed", response_model=LibraryItemResponse, status_code=status.HTTP_200_OK)
def mark_library_item_consumed(
    item_id: int,
    is_hundred_percent: Optional[bool] = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(UserLibraryItem).filter(
        UserLibraryItem.id == item_id,
        UserLibraryItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")
        
    from app.models.consumption import ConsumptionHistory
    
    is_user_pro = bool(current_user.is_pro or current_user.is_vip or current_user.is_admin)
    existing_count = db.query(ConsumptionHistory).filter(
        ConsumptionHistory.user_id == current_user.id,
        ConsumptionHistory.external_id == item.external_id
    ).count()
    
    if not is_user_pro and existing_count >= 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los usuarios gratuitos solo pueden registrar hasta 2 visualizaciones/lecturas. ¡Pásate a Premium para registros ilimitados e historial detallado!"
        )
        
    # If item was already completed earlier and has completed_at, but no history record exists, backfill it first
    if existing_count == 0 and item.completed_at:
        ch_prev = ConsumptionHistory(
            user_id=current_user.id,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            external_id=item.external_id,
            consumed_at=item.completed_at,
            is_hundred_percent=bool(item.is_hundred_percent)
        )
        db.add(ch_prev)
        db.commit()

    # Mark as completed (or read/played) and update date
    if item.item_type in ['book', 'comic', 'manga']:
        item.status = UserLibraryStatusEnum.READ
    elif item.item_type == 'game':
        item.status = UserLibraryStatusEnum.COMPLETED
    else:
        item.status = UserLibraryStatusEnum.COMPLETED
        
    now_dt = datetime.now(timezone.utc)
    item.completed_at = now_dt
    if is_hundred_percent is not None:
        item.is_hundred_percent = is_hundred_percent
    
    ch = ConsumptionHistory(
        user_id=current_user.id,
        item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
        external_id=item.external_id,
        consumed_at=now_dt,
        is_hundred_percent=bool(is_hundred_percent)
    )
    db.add(ch)
    db.commit()
    db.refresh(item)
    return item

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
    
    if existing and existing.tracking_list_id is not None:
        # If already tracked, gracefully return existing or update its status
        if item_in.status:
            existing.status = item_in.status
            db.commit()
            db.refresh(existing)
        return existing
        
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

    pages_val = item_in.pages_read if item_in.pages_read is not None else 0
    if pages_val > 0 and status_val not in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.ENDLESS, UserLibraryStatusEnum.DROPPED):
        if item_in.item_type == "game":
            status_val = UserLibraryStatusEnum.PLAYING
        else:
            status_val = UserLibraryStatusEnum.READING

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
        if item_in.is_hundred_percent is not None:
            existing.is_hundred_percent = item_in.is_hundred_percent
        if item_in.custom_badge is not None:
            existing.custom_badge = item_in.custom_badge
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
            is_hundred_percent=item_in.is_hundred_percent if item_in.is_hundred_percent is not None else False,
            completed_at=completed_at_val,
            last_seen_episode=last_title,
            custom_badge=item_in.custom_badge,
            pages_read=pages_val,
            total_pages=item_in.total_pages,
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
    limit: Optional[int] = Query(None, description="Limit of items to return. If None, returns all."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import desc, func
    from app.models.consumption import ConsumptionHistory
    target_user_id = user_id if user_id is not None else current_user.id
    query = db.query(UserLibraryItem).filter(UserLibraryItem.user_id == target_user_id)
    if status:
        query = query.filter(UserLibraryItem.status == status)
    
    # Sort by completed_at or updated_at, whichever is newer
    query = query.order_by(desc(func.coalesce(UserLibraryItem.completed_at, UserLibraryItem.updated_at)))
    if skip:
        query = query.offset(skip)
    if limit is not None and limit > 0:
        query = query.limit(limit)
    items = query.all()

    # Batch query consumption history counts for these items
    ext_ids = [it.external_id for it in items if it.external_id]
    counts_map = {}
    if ext_ids:
        counts = db.query(
            ConsumptionHistory.external_id,
            func.count(ConsumptionHistory.id)
        ).filter(
            ConsumptionHistory.user_id == target_user_id,
            ConsumptionHistory.external_id.in_(ext_ids)
        ).group_by(ConsumptionHistory.external_id).all()
        for ext_id, c in counts:
            counts_map[ext_id] = c

    res = []
    for it in items:
        # Pydantic will convert from attributes/dict
        c_val = counts_map.get(it.external_id, 0)
        # If item has completed_at but no consumption history yet, treat as 1
        times_c = max(c_val, 1 if it.completed_at else 0)
        it_dict = {
            "id": it.id,
            "user_id": it.user_id,
            "item_type": it.item_type.value if hasattr(it.item_type, 'value') else it.item_type,
            "external_id": it.external_id,
            "imdb_id": it.imdb_id,
            "title": it.title,
            "image_url": it.image_url,
            "status": it.status,
            "is_favorite": it.is_favorite,
            "is_hundred_percent": it.is_hundred_percent,
            "completed_at": it.completed_at,
            "updated_at": it.updated_at,
            "last_seen_episode": it.last_seen_episode,
            "custom_badge": it.custom_badge,
            "pages_read": it.pages_read or 0,
            "total_pages": it.total_pages,
            "tracking_list_id": it.tracking_list_id,
            "times_completed": times_c
        }
        res.append(it_dict)

    return res

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
            now_dt = datetime.now(timezone.utc)
            lib_item.completed_at = now_dt
            
            # For movies, books, games: record consumption history on manual complete
            # For series/anime: individual episodes already record their own consumption history.
            # Only record series consumption history if all aired episodes are genuinely completed
            if lib_item.item_type not in ("series", "anime"):
                from app.models.consumption import ConsumptionHistory
                is_user_pro = bool(current_user.is_pro or current_user.is_vip or current_user.is_admin)
                existing_count = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == lib_item.external_id
                ).count()
                
                # Check if this consumption was already recorded in the last 60 seconds
                latest_c = db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id == lib_item.external_id
                ).order_by(ConsumptionHistory.consumed_at.desc()).first()
                
                should_record = True
                if latest_c and latest_c.consumed_at:
                    diff_seconds = (now_dt - latest_c.consumed_at.replace(tzinfo=timezone.utc) if latest_c.consumed_at.tzinfo is None else (now_dt - latest_c.consumed_at)).total_seconds()
                    if diff_seconds < 60:
                        should_record = False
                        
                if should_record:
                    if not is_user_pro and existing_count >= 2:
                        pass
                    else:
                        ch = ConsumptionHistory(
                            user_id=current_user.id,
                            item_type=lib_item.item_type.value if hasattr(lib_item.item_type, 'value') else lib_item.item_type,
                            external_id=lib_item.external_id,
                            consumed_at=now_dt,
                            is_hundred_percent=bool(item_in.is_hundred_percent if item_in.is_hundred_percent is not None else lib_item.is_hundred_percent)
                        )
                        db.add(ch)
        else:
            lib_item.completed_at = None
            if item_in.is_hundred_percent is None:
                lib_item.is_hundred_percent = False
            
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

    if item_in.is_hundred_percent is not None:
        lib_item.is_hundred_percent = item_in.is_hundred_percent
        # If toggled on/off, update the latest consumption history record if exists, or backfill if completed
        from app.models.consumption import ConsumptionHistory
        latest_ch = db.query(ConsumptionHistory).filter(
            ConsumptionHistory.user_id == current_user.id,
            ConsumptionHistory.external_id == lib_item.external_id
        ).order_by(ConsumptionHistory.consumed_at.desc()).first()
        if latest_ch:
            latest_ch.is_hundred_percent = bool(item_in.is_hundred_percent)
        elif lib_item.completed_at:
            ch_init = ConsumptionHistory(
                user_id=current_user.id,
                item_type=lib_item.item_type.value if hasattr(lib_item.item_type, 'value') else lib_item.item_type,
                external_id=lib_item.external_id,
                consumed_at=lib_item.completed_at,
                is_hundred_percent=bool(item_in.is_hundred_percent)
            )
            db.add(ch_init)
        
    if item_in.is_favorite is not None:
        if item_in.is_favorite and not lib_item.is_favorite:
            # Cannot favorite unconsumed items (plan_to_watch, plan_to_read, plan_to_play)
            if lib_item.status in (UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.PLAN_TO_READ, UserLibraryStatusEnum.PLAN_TO_PLAY):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Solo puedes destacar elementos que hayas empezado a consumir o completado."
                )

            # Check limits per category: 1 for free, 10 for pro/admin/vip
            is_pro_user = bool(getattr(current_user, 'is_pro', False) or getattr(current_user, 'is_admin', False) or getattr(current_user, 'is_vip', False))
            existing_favs = db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.item_type == lib_item.item_type,
                UserLibraryItem.is_favorite == True,
                UserLibraryItem.id != lib_item.id
            ).order_by(UserLibraryItem.updated_at.desc()).all()
            
            if is_pro_user:
                if len(existing_favs) >= 10:
                    category_name = str(lib_item.item_type).capitalize()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Premium limit reached: Maximum 10 featured items allowed for {category_name}."
                    )
            else:
                # For free users: smoothly swap the active featured favorite
                for old_fav in existing_favs:
                    old_fav.is_favorite = False
                    
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


    if item_in.custom_badge is not None:
        lib_item.custom_badge = item_in.custom_badge
    if item_in.pages_read is not None:
        lib_item.pages_read = item_in.pages_read
    if item_in.total_pages is not None:
        lib_item.total_pages = item_in.total_pages
        lib_item.updated_at = datetime.now(timezone.utc)
    
    pages_val = item_in.pages_read if item_in.pages_read is not None else (lib_item.pages_read or 0)
    if pages_val > 0 and lib_item.status not in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.ENDLESS, UserLibraryStatusEnum.DROPPED, UserLibraryStatusEnum.WATCHING, UserLibraryStatusEnum.PLAYING, UserLibraryStatusEnum.READING):
        if lib_item.item_type == "game":
            lib_item.status = UserLibraryStatusEnum.PLAYING
        elif lib_item.item_type in ("movie", "series", "anime"):
            lib_item.status = UserLibraryStatusEnum.WATCHING
        else:
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

    db.commit()
    db.refresh(lib_item)
    return lib_item

@router.delete("/{library_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_from_library(
    library_item_id: int,
    delete_history: Optional[bool] = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.consumption import ConsumptionHistory
    from app.models.item_progress import ItemProgress
    from app.models.review import MediaReview

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

    ext_id = lib_item.external_id
    tracking_list_id = lib_item.tracking_list_id

    # If delete_history is requested, completely wipe progress, consumption history, and reviews
    if delete_history:
        # Delete consumption history for this item
        if ext_id:
            db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id == ext_id
            ).delete()
            # Also delete reviews if any
            db.query(MediaReview).filter(
                MediaReview.user_id == current_user.id,
                MediaReview.external_id == ext_id
            ).delete()
            # Delete direct ItemProgress
            db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.external_id == ext_id
            ).delete()

        # If it was a series/anime with a private tracking list, wipe all episode progress & history
        if tracking_list_id:
            list_items = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).all()
            ep_ext_ids = [it.external_id for it in list_items if it.external_id]
            ep_item_ids = [it.id for it in list_items]
            if ep_ext_ids:
                db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    ItemProgress.external_id.in_(ep_ext_ids)
                ).delete(synchronize_session=False)
                db.query(ConsumptionHistory).filter(
                    ConsumptionHistory.user_id == current_user.id,
                    ConsumptionHistory.external_id.in_(ep_ext_ids)
                ).delete(synchronize_session=False)
            if ep_item_ids:
                db.query(ItemProgress).filter(
                    ItemProgress.user_id == current_user.id,
                    ItemProgress.list_item_id.in_(ep_item_ids)
                ).delete(synchronize_session=False)

    # Only delete the associated tracking list if delete_history is True
    if delete_history and tracking_list_id:
        private_list = db.query(ReadingList).filter(ReadingList.id == tracking_list_id).first()
        if private_list:
            db.delete(private_list)
            
    db.delete(lib_item)
    db.commit()
    return None

class ReportMediaRequest(BaseModel):
    item_type: str
    external_id: str
    title: Optional[str] = None
    image_url: Optional[str] = None
    reason: str

@router.post("/report-media")
def report_media_item(
    body: ReportMediaRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.social import MediaItemReport
    report = MediaItemReport(
        user_id=current_user.id,
        item_type=body.item_type,
        external_id=body.external_id,
        title=body.title,
        image_url=body.image_url,
        reason=body.reason
    )
    db.add(report)
    db.commit()
    return {"success": True, "message": "Reporte enviado para revisión por los administradores."}
