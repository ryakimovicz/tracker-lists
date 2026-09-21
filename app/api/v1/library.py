from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.item_progress import ItemProgress
from app.schemas.library import LibraryItemCreate, LibraryItemUpdate, LibraryItemResponse, ReorderFavoritesRequest
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
    if not tracking_list_id:
        return None
    import re
    # Only look at list items that actually belong to this tracking list!
    track_items = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).all()
    if not track_items:
        return None

    track_item_ids = [ti.id for ti in track_items]
    user_progs = db.query(ItemProgress).filter(
        ItemProgress.user_id == user_id,
        ItemProgress.list_item_id.in_(track_item_ids),
        ItemProgress.is_completed == True
    ).all()

    completed_eps = []
    for prog in user_progs:
        li = next((x for x in track_items if x.id == prog.list_item_id), None)
        if li and li.title:
            match = re.search(r'S(\d+)E(\d+)', li.title, re.IGNORECASE)
            if match:
                s_num = int(match.group(1))
                e_num = int(match.group(2))
                ep_code = f"S{s_num:02d}E{e_num:02d}"
                completed_eps.append((s_num, e_num, ep_code, li.external_id, li.title))

    if not completed_eps:
        return None

    completed_eps.sort(key=lambda x: (x[0], x[1]))
    return completed_eps[-1][4]

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
    
    if not item:
        if item_id.isdigit():
            # Check if item_id corresponds to a ListItem (e.g. an episode)
            list_item = db.query(ListItem).filter(ListItem.id == int(item_id)).first()
            if list_item:
                external_id = list_item.external_id
            else:
                external_id = item_id
        else:
            external_id = item_id

    resolved_type = (item.item_type if item else item_type) or ""
    tracking_list_id = item.tracking_list_id if item else None

    is_single_ep_or_issue = (
        str(external_id).startswith("tvm-ep-") or
        str(external_id).startswith("cv_issue_") or
        item_type == "episode"
    )

    if resolved_type in ("series", "anime", "comic") and external_id and not is_single_ep_or_issue:
        all_canonical_ids = []
        if resolved_type in ("series", "anime"):
            try:
                from app.services.tvmaze import TVMazeService
                tvm_eps = TVMazeService.get_all_episodes(external_id)
                if tvm_eps:
                    all_canonical_ids = [f"tvm-ep-{e['id']}" for e in tvm_eps if e.get('id') and not e.get('is_extra') and e.get('season_number', 1) > 0]
            except Exception as e:
                print(f"Failed to fetch TVMaze episodes for history calculation: {e}")
        elif resolved_type == "comic":
            try:
                from app.services.comicvine import ComicVineService
                cv_issues = ComicVineService.get_comic_volume_issues(external_id)
                if cv_issues:
                    all_canonical_ids = [f"cv_issue_{i['id']}" for i in cv_issues if i.get('id')]
            except Exception as e:
                print(f"Failed to fetch ComicVine issues for history calculation: {e}")

        # Fallback to tracking list items only if canonical items could not be fetched AND item is marked completed
        if not all_canonical_ids and tracking_list_id and (item and item.completed_at):
            list_items = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).all()
            all_canonical_ids = [it.external_id for it in list_items if it.external_id]

        if all_canonical_ids:
            from collections import defaultdict
            ep_consumptions = defaultdict(list)
            # Query all possible representations of issue/episode external IDs
            clean_ids = [str(eid).replace("cv_issue_", "").replace("tvm-ep-", "") for eid in all_canonical_ids]
            query_ids = list(set(all_canonical_ids + clean_ids))
            all_ep_ch = db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id.in_(query_ids)
            ).order_by(ConsumptionHistory.consumed_at.asc()).all()
            
            for ch in all_ep_ch:
                matched_canonical = None
                for cid in all_canonical_ids:
                    if ch.external_id == cid or ch.external_id == str(cid).replace("cv_issue_", "").replace("tvm-ep-", ""):
                        matched_canonical = cid
                        break
                if matched_canonical:
                    ep_consumptions[matched_canonical].append(ch)
            
            # The series/volume is completed N times ONLY IF ALL canonical episodes/issues have at least N consumptions
            if len(ep_consumptions) >= len(all_canonical_ids):
                min_completed_times = min(len(ep_consumptions[eid]) for eid in all_canonical_ids)
            else:
                min_completed_times = 0
            
            series_entries = []
            for run_idx in range(min_completed_times):
                run_timestamps = [ep_consumptions[eid][run_idx].consumed_at for eid in all_canonical_ids]
                completion_time = max(run_timestamps)
                series_entries.append({
                    "id": ep_consumptions[all_canonical_ids[0]][run_idx].id,
                    "consumed_at": completion_time,
                    "is_hundred_percent": False
                })
            
            series_entries.sort(key=lambda x: x["consumed_at"], reverse=True)
            result_dates = [e["consumed_at"] for e in series_entries]
            return {
                "count": len(series_entries),
                "history": result_dates,
                "entries": series_entries
            }
        else:
            return {
                "count": 0,
                "history": [],
                "entries": []
            }

    query_ids = [external_id] if external_id else []
    if external_id:
        clean_id = str(external_id).replace("cv_issue_", "").replace("tvm-ep-", "")
        if f"cv_issue_{clean_id}" not in query_ids:
            query_ids.append(f"cv_issue_{clean_id}")
        if f"tvm-ep-{clean_id}" not in query_ids:
            query_ids.append(f"tvm-ep-{clean_id}")
        if clean_id not in query_ids:
            query_ids.append(clean_id)

    history = db.query(ConsumptionHistory).filter(
        ConsumptionHistory.user_id == current_user.id,
        ConsumptionHistory.external_id.in_(query_ids)
    ).order_by(ConsumptionHistory.consumed_at.desc()).all() if query_ids else []
    
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
    
    if item_in.item_type in ("series", "anime", "comic") and not tracking_list_id:
        private_list = ReadingList(
            creator_id=current_user.id,
            title=f"Tracker: {item_in.title}",
            description=f"Auto-generated tracking for '{item_in.title}'",
            visibility=VisibilityEnum.PRIVATE
        )
        db.add(private_list)
        db.commit()
        db.refresh(private_list)
        tracking_list_id = private_list.id
        
        if item_in.item_type in ("series", "anime"):
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
        if item_in.release_date is not None:
            existing.release_date = item_in.release_date
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
            favorited_at=datetime.now(timezone.utc) if item_in.is_favorite else None,
            favorite_order=0 if item_in.is_favorite else 0,
            is_hundred_percent=item_in.is_hundred_percent if item_in.is_hundred_percent is not None else False,
            completed_at=completed_at_val,
            last_seen_episode=last_title,
            custom_badge=item_in.custom_badge,
            pages_read=pages_val,
            total_pages=item_in.total_pages,
            release_date=item_in.release_date,
            tracking_list_id=tracking_list_id
        )
        if item_in.is_favorite:
            db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.is_favorite == True
            ).update({UserLibraryItem.favorite_order: UserLibraryItem.favorite_order + 1}, synchronize_session=False)
        db.add(new_lib_item)
    
    if item_in.item_type in ("series", "anime"):
        loose_items = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.item_type.in_(["episode", "season"]),
            UserLibraryItem.last_seen_episode == item_in.title
        ).all()
        for loose in loose_items:
            db.delete(loose)

    if completed_at_val and item_in.item_type not in ("series", "anime", "comic") and not tracking_list_id:
        from app.models.consumption import ConsumptionHistory
        existing_ch = db.query(ConsumptionHistory).filter(
            ConsumptionHistory.user_id == current_user.id,
            ConsumptionHistory.external_id == item_in.external_id
        ).order_by(ConsumptionHistory.consumed_at.desc()).first()
        
        should_record_ch = True
        if existing_ch and existing_ch.consumed_at:
            diff_s = (completed_at_val - (existing_ch.consumed_at.replace(tzinfo=timezone.utc) if existing_ch.consumed_at.tzinfo is None else existing_ch.consumed_at)).total_seconds()
            if diff_s < 60:
                should_record_ch = False
                existing_ch.is_hundred_percent = bool(item_in.is_hundred_percent)
                
        if should_record_ch:
            ch = ConsumptionHistory(
                user_id=current_user.id,
                item_type=item_in.item_type.value if hasattr(item_in.item_type, 'value') else item_in.item_type,
                external_id=item_in.external_id,
                consumed_at=completed_at_val,
                is_hundred_percent=bool(item_in.is_hundred_percent if item_in.is_hundred_percent is not None else False)
            )
            db.add(ch)
            
    db.commit()
    db.refresh(new_lib_item)

    # Record activity log: item_added_to_library
    from app.services.activity_service import ActivityService
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="item_added_to_library",
        item_title=item_in.title,
        item_type=item_in.item_type.value if hasattr(item_in.item_type, "value") else str(item_in.item_type),
        external_id=item_in.external_id,
        image_url=item_in.image_url,
        details=item_in.status.value if hasattr(item_in.status, "value") else str(item_in.status)
    )
    
    return new_lib_item

@router.get("/", response_model=List[LibraryItemResponse])
def get_library(
    request: Request,
    user_id: Optional[int] = Query(None, description="Get library of a specific user"),
    status: Optional[UserLibraryStatusEnum] = Query(None, description="Filter library by status"),
    skip: int = 0,
    limit: Optional[int] = Query(None, description="Limit of items to return. If None, returns all."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

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
    hundred_counts_map = {}
    if ext_ids:
        from sqlalchemy import case
        counts = db.query(
            ConsumptionHistory.external_id,
            func.count(ConsumptionHistory.id),
            func.sum(case((ConsumptionHistory.is_hundred_percent == True, 1), else_=0))
        ).filter(
            ConsumptionHistory.user_id == target_user_id,
            ConsumptionHistory.external_id.in_(ext_ids)
        ).group_by(ConsumptionHistory.external_id).all()
        for ext_id, c, h_c in counts:
            counts_map[ext_id] = c
            hundred_counts_map[ext_id] = int(h_c or 0)

    # For series, anime, and tracked comic volumes, query episode/issue consumption counts if tracked to get accurate completions and last seen episode/issue count
    series_items = [it for it in items if it.item_type in ("series", "anime", "comic") and it.tracking_list_id]
    series_times_map = {}
    series_last_ep_count_map = {}
    series_completed_eps_count_map = {}
    if series_items:
        from app.models.list_item import ListItem
        for s_it in series_items:
            list_eps = db.query(ListItem.id, ListItem.title, ListItem.external_id).filter(
                ListItem.list_id == s_it.tracking_list_id,
                ListItem.external_id.isnot(None)
            ).all()
            ep_eids = [le.external_id for le in list_eps if le.external_id]
            if ep_eids:
                from collections import defaultdict
                ep_c = db.query(
                    ConsumptionHistory.external_id,
                    func.count(ConsumptionHistory.id)
                ).filter(
                    ConsumptionHistory.user_id == target_user_id,
                    ConsumptionHistory.external_id.in_(ep_eids)
                ).group_by(ConsumptionHistory.external_id).all()
                ep_c_dict = dict(ep_c)
                
                is_done = s_it.status in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED) or s_it.completed_at is not None
                if is_done:
                    min_c = min(ep_c_dict.get(eid, 0) for eid in ep_eids) if ep_eids else 1
                    series_times_map[s_it.external_id] = max(min_c, 1)
                else:
                    series_times_map[s_it.external_id] = 0

                if list_eps:
                    from app.models.item_progress import ItemProgress
                    lep_ids = [it.id for it in list_eps if it.id]
                    lep_exts = [it.external_id for it in list_eps if it.external_id]
                    clean_lep_exts = [eid.replace('cv_issue_', '').replace('tvm-ep-', '') for eid in lep_exts]
                    all_lep_match = set(lep_exts + clean_lep_exts)
                    
                    prog_recs = db.query(ItemProgress).filter(
                        ItemProgress.user_id == target_user_id,
                        ItemProgress.is_completed == True,
                        (ItemProgress.list_item_id.in_(lep_ids) | ItemProgress.external_id.in_(list(all_lep_match)))
                    ).all() if (lep_ids or all_lep_match) else []
                    
                    prog_item_ids = {p.list_item_id for p in prog_recs if p.list_item_id}
                    prog_ext_ids = {p.external_id for p in prog_recs if p.external_id}
                    
                    c_titles = [
                        it.title for it in list_eps
                        if (it.id in prog_item_ids or it.external_id in prog_ext_ids or (it.external_id and it.external_id.replace('cv_issue_', '') in prog_ext_ids)) and it.title
                    ]
                    series_completed_eps_count_map[s_it.id] = len(c_titles)
                    if c_titles:
                        import re
                        if s_it.item_type == "comic":
                            def parse_issue_num(t):
                                m = re.search(r'#(\d+(\.\d+)?)', t)
                                return float(m.group(1)) if m else -1.0
                            sorted_c_titles = sorted(c_titles, key=parse_issue_num)
                            s_it.last_seen_episode = sorted_c_titles[-1]
                        else:
                            ep_tups = []
                            for t_str in c_titles:
                                m_ep = re.search(r'S(\d+)E(\d+)', t_str, re.IGNORECASE)
                                if m_ep:
                                    ep_tups.append((int(m_ep.group(1)), int(m_ep.group(2)), t_str))
                            if ep_tups:
                                ep_tups.sort(key=lambda x: (x[0], x[1]))
                                s_it.last_seen_episode = ep_tups[-1][2]
                            else:
                                s_it.last_seen_episode = c_titles[-1]
                    else:
                        s_it.last_seen_episode = None

                if s_it.last_seen_episode:
                    # Find matching episode / issue item by title
                    import re
                    matched_eid = None
                    if s_it.item_type == "comic":
                        issue_m = re.search(r'#(\d+)', s_it.last_seen_episode)
                        for le in list_eps:
                            if issue_m and re.search(r'#' + issue_m.group(1) + r'\b', le.title or ''):
                                matched_eid = le.external_id
                                break
                            elif le.title == s_it.last_seen_episode:
                                matched_eid = le.external_id
                                break
                    else:
                        m_last = re.search(r'S(\d+)E(\d+)', s_it.last_seen_episode, re.IGNORECASE)
                        for le in list_eps:
                            if m_last and re.search(r'S0?' + str(int(m_last.group(1))) + r'E0?' + str(int(m_last.group(2))) + r'\b', le.title or '', re.IGNORECASE):
                                matched_eid = le.external_id
                                break
                            elif le.title == s_it.last_seen_episode:
                                matched_eid = le.external_id
                                break

                    if matched_eid:
                        series_last_ep_count_map[s_it.id] = max(ep_c_dict.get(matched_eid, 1), 1)

    res = []
    for it in items:
        # Pydantic will convert from attributes/dict
        c_val = counts_map.get(it.external_id, 0)
        if it.item_type in ("series", "anime", "comic") and it.tracking_list_id:
            times_c = series_times_map.get(it.external_id, 1 if (it.completed_at or it.status in (UserLibraryStatusEnum.READ, UserLibraryStatusEnum.COMPLETED)) else 0)
            times_hundred = 0
            times_standard = times_c
        else:
            raw_hundred = hundred_counts_map.get(it.external_id, 0)
            if c_val == 0 and it.completed_at:
                times_c = 1
                times_hundred = 1 if it.is_hundred_percent else 0
                times_standard = 0 if it.is_hundred_percent else 1
            else:
                times_c = max(c_val, 1 if it.completed_at else 0)
                times_hundred = raw_hundred
                times_standard = max(times_c - times_hundred, 0)

        last_ep_cnt = series_last_ep_count_map.get(it.id, 1) if it.item_type in ("series", "anime", "comic") else 1

        display_title = it.title
        display_last_seen = it.last_seen_episode
        if it.item_type == "series" and it.external_id and it.external_id.startswith("tvm_"):
            try:
                sid_str = it.external_id.replace("tvm_", "").replace("tvm-", "")
                if sid_str.isdigit():
                    loc_title = TVMazeService.get_localized_title(int(sid_str), it.title, lang=client_lang, country_code=client_country)
                    display_title = loc_title
                    if display_last_seen and it.title and loc_title != it.title:
                        # Replace parent series name in last_seen_episode format
                        if display_last_seen.startswith(it.title):
                            display_last_seen = loc_title + display_last_seen[len(it.title):]
            except Exception:
                pass

        it_dict = {
            "id": it.id,
            "user_id": it.user_id,
            "item_type": it.item_type.value if hasattr(it.item_type, 'value') else it.item_type,
            "external_id": it.external_id,
            "imdb_id": it.imdb_id,
            "title": display_title,
            "image_url": it.image_url,
            "status": it.status,
            "is_favorite": it.is_favorite,
            "favorited_at": it.favorited_at,
            "favorite_order": it.favorite_order if it.favorite_order is not None else 0,
            "is_hundred_percent": it.is_hundred_percent,
            "completed_at": it.completed_at,
            "updated_at": it.updated_at,
            "last_seen_episode": display_last_seen,
            "custom_badge": it.custom_badge,
            "pages_read": it.pages_read or 0,
            "total_pages": it.total_pages,
            "release_date": it.release_date,
            "tracking_list_id": it.tracking_list_id,
            "times_completed": times_c,
            "times_completed_standard": times_standard,
            "times_completed_hundred": times_hundred,
            "last_seen_episode_count": last_ep_cnt,
            "completed_episodes_count": series_completed_eps_count_map.get(it.id, it.pages_read or 0)
        }
        res.append(it_dict)

    return res

@router.put("/favorites/reorder")
def reorder_favorites(
    req: ReorderFavoritesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.id.in_(req.item_ids)
    ).all()
    item_map = {it.id: it for it in items}
    for idx, item_id in enumerate(req.item_ids):
        if item_id in item_map:
            item_map[item_id].favorite_order = idx
    db.commit()
    return {"status": "success", "reordered_count": len(req.item_ids)}

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
        
        # Ensure tracking list exists for series, anime, comic
        t_str = lib_item.item_type.value if hasattr(lib_item.item_type, "value") else str(lib_item.item_type)
        if t_str in ("series", "anime", "comic") and not lib_item.tracking_list_id:
            private_list = ReadingList(
                creator_id=current_user.id,
                title=f"Tracker: {lib_item.title}",
                description=f"Auto-generated tracking for '{lib_item.title}'",
                visibility=VisibilityEnum.PRIVATE
            )
            db.add(private_list)
            db.commit()
            db.refresh(private_list)
            lib_item.tracking_list_id = private_list.id
        
        # Set completed_at date
        if item_in.status in (UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.READ):
            now_dt = datetime.now(timezone.utc)
            lib_item.completed_at = now_dt
            
            # For movies, books, games: record consumption history on manual complete
            # For series/anime/comic: individual episodes/issues already record their own consumption history.
            # Only record series consumption history if all aired episodes are genuinely completed
            if lib_item.item_type not in ("series", "anime", "comic") and not lib_item.tracking_list_id:
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
            if item_in.status in (UserLibraryStatusEnum.PLAN_TO_WATCH, UserLibraryStatusEnum.PLAN_TO_READ):
                lib_item.last_seen_episode = None
            
        lib_item.updated_at = datetime.now(timezone.utc)
        
        # Record activity log with structured metadata
        from app.services.activity_service import ActivityService
        t_str = lib_item.item_type.value if hasattr(lib_item.item_type, 'value') else str(lib_item.item_type)
        stat_str = item_in.status.value if hasattr(item_in.status, "value") else str(item_in.status)

        act_meta = {
            "status": stat_str,
            "is_hundred_percent": bool(item_in.is_hundred_percent if item_in.is_hundred_percent is not None else lib_item.is_hundred_percent),
            "pages_read": lib_item.pages_read or 0,
            "total_pages": lib_item.total_pages or 0,
            "last_seen_episode": lib_item.last_seen_episode,
            "item_type": t_str
        }

        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="item_status_changed",
            item_title=lib_item.title,
            item_type=t_str,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details=stat_str,
            metadata=act_meta
        )

    if item_in.is_hundred_percent is not None:
        lib_item.is_hundred_percent = item_in.is_hundred_percent
        # If status was NOT just set to completed/read in this request (which already added/updated ch), update latest ch
        if item_in.status not in (UserLibraryStatusEnum.COMPLETED, UserLibraryStatusEnum.READ):
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
        from app.services.activity_service import ActivityService
        t_str = lib_item.item_type.value if hasattr(lib_item.item_type, 'value') else str(lib_item.item_type)

        if item_in.is_favorite:
            lib_item.favorited_at = datetime.now(timezone.utc)
            lib_item.favorite_order = 0
            # Shift existing favorites so the new favorite is at index 0
            db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.is_favorite == True,
                UserLibraryItem.id != lib_item.id
            ).update({UserLibraryItem.favorite_order: UserLibraryItem.favorite_order + 1}, synchronize_session=False)

            # Record activity log
            ActivityService.record_activity(
                db=db,
                user_id=current_user.id,
                activity_type="item_favorited",
                item_title=lib_item.title,
                item_type=t_str,
                external_id=lib_item.external_id,
                image_url=lib_item.image_url,
                details="favorited"
            )
        else:
            lib_item.favorited_at = None
            # Reversible cleanup when unfavorited
            ActivityService.delete_activity(
                db=db,
                user_id=current_user.id,
                activity_type="item_favorited",
                external_id=lib_item.external_id
            )

    if item_in.custom_badge is not None:
        lib_item.custom_badge = item_in.custom_badge
    if item_in.release_date is not None:
        lib_item.release_date = item_in.release_date
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

        from app.services.activity_service import ActivityService
        t_str = lib_item.item_type.value if hasattr(lib_item.item_type, 'value') else str(lib_item.item_type)
        stat_str = lib_item.status.value if hasattr(lib_item.status, "value") else str(lib_item.status)

        act_meta = {
            "status": stat_str,
            "is_hundred_percent": bool(lib_item.is_hundred_percent),
            "pages_read": lib_item.pages_read or 0,
            "total_pages": lib_item.total_pages or 0,
            "last_seen_episode": lib_item.last_seen_episode,
            "item_type": t_str
        }

        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="item_status_changed",
            item_title=lib_item.title,
            item_type=t_str,
            external_id=lib_item.external_id,
            image_url=lib_item.image_url,
            details=stat_str,
            metadata=act_meta
        )

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
        
    ext_id = lib_item.external_id
    item_type = lib_item.item_type
    tracking_list_id = lib_item.tracking_list_id

    # If this item was linked to a private tracking list, detach it so cascade / delete doesn't fail
    if tracking_list_id:
        lib_item.tracking_list_id = None
        db.flush()

    # If it was a favorite, handle reordering
    if lib_item.is_favorite and lib_item.favorite_order is not None:
        reorder_favorites_after_delete(
            db=db,
            user_id=current_user.id,
            deleted_order=lib_item.favorite_order,
            item_type=item_type
        )

    # Clean up activities for this library item (reversible cleanup)
    from app.services.activity_service import ActivityService
    ActivityService.delete_activity(
        db=db,
        user_id=current_user.id,
        external_id=ext_id
    )

    # If delete_history is requested, completely wipe progress, consumption history, and reviews
    if delete_history:
        ext_ids_to_wipe = set()
        item_ids_to_wipe = set()

        if ext_id:
            ext_ids_to_wipe.add(ext_id)
            clean_ext = str(ext_id).replace("cv_vol_", "").replace("cv_issue_", "").replace("tvm-ep-", "").replace("tvm_", "").replace("4050-", "").replace("4000-", "")
            if clean_ext:
                ext_ids_to_wipe.add(clean_ext)
                ext_ids_to_wipe.add(f"cv_vol_{clean_ext}")
                ext_ids_to_wipe.add(f"4050-{clean_ext}")
                ext_ids_to_wipe.add(f"tvm_{clean_ext}")

        # If it was a comic volume, fetch all issues to wipe their history & progress
        if item_type == "comic" or (ext_id and ("cv_vol_" in str(ext_id) or "4050-" in str(ext_id))):
            try:
                from app.services.comicvine import ComicVineService
                cv_issues = ComicVineService.get_comic_volume_issues(ext_id)
                if cv_issues:
                    for iss in cv_issues:
                        i_id = iss.get("id")
                        if i_id:
                            str_id = str(i_id).replace("cv_issue_", "").replace("4000-", "")
                            ext_ids_to_wipe.add(f"cv_issue_{str_id}")
                            ext_ids_to_wipe.add(f"4000-{str_id}")
                            ext_ids_to_wipe.add(str_id)
                        if iss.get("external_id"):
                            ext_ids_to_wipe.add(str(iss.get("external_id")))
            except Exception as e:
                print(f"Error fetching comic issues to wipe history: {e}")

        # If it was a series/anime, fetch all episodes to wipe their history & progress
        elif item_type in ["series", "anime"] or (ext_id and ("tvm" in str(ext_id))):
            try:
                from app.services.tvmaze import TVMazeService
                tvm_eps = TVMazeService.get_all_episodes(ext_id)
                if tvm_eps:
                    for ep in tvm_eps:
                        e_id = ep.get("id")
                        if e_id:
                            str_id = str(e_id).replace("tvm-ep-", "")
                            ext_ids_to_wipe.add(f"tvm-ep-{str_id}")
                            ext_ids_to_wipe.add(str_id)
                        if ep.get("external_id"):
                            ext_ids_to_wipe.add(str(ep.get("external_id")))
            except Exception as e:
                print(f"Error fetching series episodes to wipe history: {e}")

        # If it was linked to a private tracking list, collect all its items
        if tracking_list_id:
            list_items = db.query(ListItem).filter(ListItem.list_id == tracking_list_id).all()
            for it in list_items:
                item_ids_to_wipe.add(it.id)
                if it.external_id:
                    ext_ids_to_wipe.add(it.external_id)
                    clean_it = str(it.external_id).replace("cv_issue_", "").replace("tvm-ep-", "")
                    ext_ids_to_wipe.add(clean_it)
                    if it.external_id.startswith("cv_issue_"):
                        ext_ids_to_wipe.add(f"4000-{clean_it}")
                    elif it.external_id.startswith("tvm-ep-"):
                        ext_ids_to_wipe.add(f"tvm-ep-{clean_it}")

        # Wipe ItemProgress, ConsumptionHistory, and MediaReview
        if ext_ids_to_wipe:
            ext_list = list(ext_ids_to_wipe)
            db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.external_id.in_(ext_list)
            ).delete(synchronize_session=False)
            db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.external_id.in_(ext_list)
            ).delete(synchronize_session=False)
            db.query(MediaReview).filter(
                MediaReview.user_id == current_user.id,
                MediaReview.external_id.in_(ext_list)
            ).delete(synchronize_session=False)
            # Delete loose episode/issue cards from library if any
            db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == current_user.id,
                UserLibraryItem.external_id.in_(ext_list),
                UserLibraryItem.id != lib_item.id
            ).delete(synchronize_session=False)

        if item_ids_to_wipe:
            it_list = list(item_ids_to_wipe)
            db.query(ItemProgress).filter(
                ItemProgress.user_id == current_user.id,
                ItemProgress.list_item_id.in_(it_list)
            ).delete(synchronize_session=False)
            db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == current_user.id,
                ConsumptionHistory.list_item_id.in_(it_list)
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
