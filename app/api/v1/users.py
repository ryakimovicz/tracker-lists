import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy import text, func, or_
from sqlalchemy.orm import Session


from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional, get_current_user_allow_suspended

from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.library import UserLibraryItem
from app.models.addition import ListAddition, UserAdoptedAddition
from app.models.social import Follow
from app.core.security import verify_password, get_password_hash
from app.services.lastfm import LastFMService
from app.services.tvmaze import TVMazeService
from app.models.activity import UserActivityLog
from app.schemas.user import UserResponse, UserDashboardResponse
from app.schemas.list import ReadingListResponse
from app.schemas.social import UpNextResponse, UpNextItemResponse
from datetime import datetime, timezone
from app.schemas.auth import PasswordChangeRequest, UsernameUpdateRequest


router = APIRouter()
tvmaze_service = TVMazeService()

_cache_music_rankings: Dict[str, tuple] = {}
RANKINGS_CACHE_TTL = 300  # 5 minutes cache for Pathd community rankings

def check_user_is_pro(user: User) -> bool:
    if not user:
        return False
    now = datetime.now(timezone.utc)
    expires_active = False
    if user.pro_expires_at:
        exp = user.pro_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        expires_active = exp > now
    return bool(user.is_pro or user.is_admin or user.is_vip or expires_active)

@router.get("/me", response_model=UserDashboardResponse)
def get_user_dashboard(

    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-repair creator_id for any tracking lists owned by current_user
    db.execute(text("""
        UPDATE reading_lists 
        SET creator_id = :uid 
        WHERE id IN (
            SELECT tracking_list_id 
            FROM user_library_items 
            WHERE user_id = :uid AND tracking_list_id IS NOT NULL
        ) AND (creator_id IS NULL OR creator_id != :uid)
    """), {"uid": current_user.id})
    db.commit()

    # Fetch lists created by the user (exclude personal trackers from the dashboard guides)
    tracker_list_ids_query = db.query(UserLibraryItem.tracking_list_id).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.tracking_list_id.isnot(None)
    )
    
    is_pro = check_user_is_pro(current_user)
    raw_created_lists = db.query(ReadingList).filter(
        ReadingList.creator_id == current_user.id,
        ~ReadingList.id.in_(tracker_list_ids_query)
    ).order_by(ReadingList.created_at.asc()).all()

    
    created_lists = []
    for idx, rl in enumerate(raw_created_lists):
        rl_data = ReadingListResponse.model_validate(rl)
        rl_data.can_edit = True if (is_pro or idx < 2) else False
        created_lists.append(rl_data)
    
    # Fetch lists saved/followed by the user
    saved_entries = db.query(SavedList).join(
        ReadingList, SavedList.list_id == ReadingList.id
    ).filter(
        SavedList.user_id == current_user.id
    ).order_by(SavedList.saved_at.asc()).all()

    saved_lists = []
    other_saved_count = 0
    for se in saved_entries:
        rl = se.reading_list
        if not rl:
            continue
        is_own = (rl.creator_id == current_user.id)
        if is_pro or is_own:
            rl_data = ReadingListResponse.model_validate(rl)
            saved_lists.append(rl_data)
        else:
            # Free user: include up to 3 followed guides of other users
            if other_saved_count < 3:
                rl_data = ReadingListResponse.model_validate(rl)
                saved_lists.append(rl_data)
                other_saved_count += 1

    followers_count = db.query(Follow).filter(Follow.followed_id == current_user.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == current_user.id).count()
    
    return UserDashboardResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        photo_url=current_user.photo_url,
        banner_url=current_user.banner_url,
        background_url=current_user.background_url,
        is_admin=current_user.is_admin,
        show_nsfw=current_user.show_nsfw,
        is_pro=is_pro,
        is_pro_cancelled=bool(current_user.is_pro_cancelled),
        is_vip=bool(current_user.is_vip),
        has_active_subscription=bool(current_user.dodo_subscription_id and not current_user.is_pro_cancelled),
        pro_expires_at=current_user.pro_expires_at,
        is_suspended=bool(current_user.is_suspended),
        suspended_until=current_user.suspended_until,
        suspension_reason=current_user.suspension_reason,
        admin_warning=current_user.admin_warning,
        profile_color=current_user.profile_color,
        category_order=current_user.category_order,
        lastfm_username=current_user.lastfm_username,
        preferred_language=getattr(current_user, 'preferred_language', 'es') or 'es',
        is_private=bool(getattr(current_user, 'is_private', False)),
        followers_count=followers_count,
        following_count=following_count,
        is_following=False,
        follow_request_pending=False,
        is_private_locked=False,
        created_lists=created_lists,
        saved_lists=saved_lists
    )



@router.post("/me/lastfm/connect")
def connect_lastfm(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session_data = LastFMService.get_session(token)
    if not session_data:
        raise HTTPException(status_code=400, detail="Failed to connect to Last.fm")
        
    current_user.lastfm_username = session_data["name"]
    current_user.lastfm_session_key = session_data["key"]
    db.commit()

    from app.services.activity_service import ActivityService
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="lastfm_connected",
        details=session_data["name"]
    )

    return {"message": "Last.fm connected successfully", "username": session_data["name"]}

@router.delete("/me/lastfm/disconnect")
def disconnect_lastfm(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.lastfm_username = None
    current_user.lastfm_session_key = None
    db.commit()

    from app.services.activity_service import ActivityService
    ActivityService.delete_activity(
        db=db,
        user_id=current_user.id,
        activity_type="lastfm_connected"
    )

    return {"message": "Last.fm disconnected successfully"}

@router.get("/me/music/now-playing")
def get_now_playing(current_user: User = Depends(get_current_user)):
    if not current_user.lastfm_username:
        return None
    return LastFMService.get_now_playing(current_user.lastfm_username)

@router.get("/me/music/top-albums")
def get_top_albums(period: str = "7day", current_user: User = Depends(get_current_user)):
    if not current_user.lastfm_username:
        return []
    return LastFMService.get_top_albums(current_user.lastfm_username, period=period)

@router.get("/me/music/top-artists")
def get_top_artists(period: str = "7day", current_user: User = Depends(get_current_user)):
    if not current_user.lastfm_username:
        return []
    return LastFMService.get_top_artists(current_user.lastfm_username, period=period)

@router.get("/me/music/top-tracks")
def get_top_tracks(period: str = "7day", current_user: User = Depends(get_current_user)):
    if not current_user.lastfm_username:
        return []
    return LastFMService.get_top_tracks(current_user.lastfm_username, period=period)

@router.get("/{user_identifier}/music/now-playing")
def get_user_now_playing(user_identifier: str, db: Session = Depends(get_db)):
    if user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        user = db.query(User).filter(func.lower(User.username) == user_identifier.lower()).first()
    if not user or not user.lastfm_username:
        return None
    return LastFMService.get_now_playing(user.lastfm_username)

@router.get("/{user_identifier}/music/top-albums")
def get_user_top_albums(user_identifier: str, period: str = "7day", db: Session = Depends(get_db)):
    if user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        user = db.query(User).filter(func.lower(User.username) == user_identifier.lower()).first()
    if not user or not user.lastfm_username:
        return []
    return LastFMService.get_top_albums(user.lastfm_username, period=period)

@router.get("/{user_identifier}/music/top-artists")
def get_user_top_artists(user_identifier: str, period: str = "7day", db: Session = Depends(get_db)):
    if user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        user = db.query(User).filter(func.lower(User.username) == user_identifier.lower()).first()
    if not user or not user.lastfm_username:
        return []
    return LastFMService.get_top_artists(user.lastfm_username, period=period)

@router.get("/{user_identifier}/music/top-tracks")
def get_user_top_tracks(user_identifier: str, period: str = "7day", db: Session = Depends(get_db)):
    if user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        user = db.query(User).filter(func.lower(User.username) == user_identifier.lower()).first()
    if not user or not user.lastfm_username:
        return []
    return LastFMService.get_top_tracks(user.lastfm_username, period=period)

@router.get("/music/details")
def get_music_item_details(
    type: str = Query(..., description="Type of music item: 'artist', 'album', or 'track'"),
    artist: str = Query(..., description="Artist name"),
    name: Optional[str] = Query("", description="Album or track name (required for album/track)"),
    period: str = Query("7day", description="Ranking period: '7day', '1month', or 'overall'"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    clean_type = type.strip().lower()
    clean_artist = artist.strip()
    clean_name = (name or "").strip()
    clean_period = period if period in {"7day", "1month", "overall"} else "7day"

    # 1. Fetch item metadata
    details = None
    if clean_type == "artist":
        details = LastFMService.get_artist_details(clean_artist)
    elif clean_type == "album":
        details = LastFMService.get_album_details(clean_artist, clean_name)
    elif clean_type == "track":
        details = LastFMService.get_track_details(clean_artist, clean_name)

    if not details:
        # Construct fallback structure if Last.fm had network issue
        details = {
            "type": clean_type,
            "name": clean_name or clean_artist,
            "artist": clean_artist,
            "image": "",
            "bio": "",
            "tags": [],
            "listeners": "0",
            "playcount": "0"
        }

    # 2. Compute or retrieve cached Pathd community listeners rankings for all 3 periods ('7day', '1month', 'overall')
    periods = ["7day", "1month", "overall"]
    artist_norm = clean_artist.lower()
    item_norm = clean_name.lower()
    rank_cache_key = f"{clean_type}_{artist_norm}_{item_norm}"

    now_ts = time.time()
    period_entries_by_period = {}

    if rank_cache_key in _cache_music_rankings:
        cache_ts, cached_entries = _cache_music_rankings[rank_cache_key]
        if now_ts - cache_ts < RANKINGS_CACHE_TTL:
            period_entries_by_period = cached_entries

    if not period_entries_by_period:
        users_with_lastfm = db.query(User).filter(
            User.lastfm_username.isnot(None),
            User.lastfm_username != "",
            User.is_suspended == False
        ).all()

        import concurrent.futures

        def fetch_all_user_data(u: User):
            user_counts = {}
            for p in periods:
                cnt = 0
                if p == "overall":
                    cnt = LastFMService.get_user_item_playcount(u.lastfm_username, clean_type, clean_artist, clean_name)
                else:
                    if clean_type == "artist":
                        top_items = LastFMService.get_top_artists(u.lastfm_username, period=p, limit=50, enrich_images=False)
                        for item in top_items:
                            if item.get("name", "").strip().lower() == artist_norm:
                                cnt = int(item.get("playcount") or 0)
                                break
                    elif clean_type == "album":
                        top_items = LastFMService.get_top_albums(u.lastfm_username, period=p, limit=50, enrich_images=False)
                        for item in top_items:
                            if item.get("name", "").strip().lower() == item_norm and (not artist_norm or item.get("artist", "").strip().lower() == artist_norm):
                                cnt = int(item.get("playcount") or 0)
                                break
                    elif clean_type == "track":
                        top_items = LastFMService.get_top_tracks(u.lastfm_username, period=p, limit=50, enrich_images=False)
                        for item in top_items:
                            if item.get("name", "").strip().lower() == item_norm and (not artist_norm or item.get("artist", "").strip().lower() == artist_norm):
                                cnt = int(item.get("playcount") or 0)
                                break
                user_counts[p] = cnt
            return (u, user_counts)

        user_data_list = []
        if users_with_lastfm:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                user_data_list = list(executor.map(fetch_all_user_data, users_with_lastfm))

        for p in periods:
            period_entries = []
            for u, counts in user_data_list:
                cnt = counts.get(p, 0)
                if cnt > 0:
                    period_entries.append({
                        "user_id": u.id,
                        "username": u.username,
                        "photo_url": u.photo_url,
                        "profile_color": u.profile_color,
                        "is_pro": check_user_is_pro(u),
                        "is_vip": bool(u.is_vip),
                        "playcount": cnt
                    })

            # Sort descending by playcount
            period_entries.sort(key=lambda x: x["playcount"], reverse=True)
            for idx, entry in enumerate(period_entries):
                entry["rank"] = idx + 1
            period_entries_by_period[p] = period_entries

        _cache_music_rankings[rank_cache_key] = (now_ts, period_entries_by_period)

    rankings_by_period = {}
    for p in periods:
        period_entries = period_entries_by_period.get(p, [])
        top_10 = period_entries[:10]

        current_user_rank_entry = None
        if current_user and current_user.lastfm_username:
            user_in_full = next((e for e in period_entries if e["user_id"] == current_user.id), None)
            if user_in_full:
                if user_in_full["rank"] > 10:
                    current_user_rank_entry = user_in_full
            else:
                current_user_rank_entry = {
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "photo_url": current_user.photo_url,
                    "profile_color": current_user.profile_color,
                    "is_pro": check_user_is_pro(current_user),
                    "is_vip": bool(current_user.is_vip),
                    "playcount": 0,
                    "rank": None
                }

        rankings_by_period[p] = {
            "ranking": top_10,
            "total_listeners": len(period_entries),
            "current_user_rank": current_user_rank_entry
        }

    default_period_data = rankings_by_period.get(clean_period, rankings_by_period["7day"])

    return {
        "details": details,
        "ranking": default_period_data["ranking"],
        "total_listeners": default_period_data["total_listeners"],
        "current_user_rank": default_period_data["current_user_rank"],
        "rankings": rankings_by_period
    }

@router.get("/me/up-next", response_model=UpNextResponse)
def get_user_up_next(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

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
    completed_or_skipped_external_ids = {
        p.external_id for p in 
        db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.external_id.isnot(None),
            (ItemProgress.is_completed == True) | (ItemProgress.is_skipped == True)
        ).all()
    }
    
    for rlist in all_user_lists:
        addition_items = []
        for add in additions_by_list.get(rlist.id, []):
            addition_items.extend(add.items)
        addition_items.sort(key=lambda x: x.order_index)
        
        flow = rlist.section_descriptions.get("flow", []) if rlist.section_descriptions else []
        
        def extract_flow_item_ids(elements):
            ids = []
            if not elements:
                return ids
            for el in elements:
                if el.get("type") == "section":
                    ids.extend(extract_flow_item_ids(el.get("blocks", [])))
                elif el.get("type") == "block":
                    for item in el.get("items", []):
                        if "id" in item:
                            ids.append(item["id"])
                    ids.extend(extract_flow_item_ids(el.get("subblocks", [])))
                elif el.get("type") == "subblock":
                    for item in el.get("items", []):
                        if "id" in item:
                            ids.append(item["id"])
            return ids
            
        flow_item_ids = extract_flow_item_ids(flow)
        
        base_items_dict = {item.id: item for item in rlist.items}
        ordered_base_items = []
        for item_id in flow_item_ids:
            if item_id in base_items_dict:
                ordered_base_items.append(base_items_dict.pop(item_id))
        
        # Append any remaining items (if flow is out of sync or for personal lists)
        ordered_base_items.extend(sorted(base_items_dict.values(), key=lambda x: x.order_index))
        
        merged_items = []
        for item in ordered_base_items:
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
            is_completed = False
            if is_addition:
                if item_id in completed_or_skipped_addition_ids:
                    is_completed = True
            else:
                if item_id in completed_or_skipped_item_ids:
                    is_completed = True
                    
            if not is_completed and item.external_id and item.external_id in completed_or_skipped_external_ids:
                is_completed = True
                
            if not is_completed:
                first_uncompleted = (item, is_addition, add_id, add_item_id)
                break
                
        if first_uncompleted:
            item, is_addition, add_id, add_item_id = first_uncompleted
            item_title_val = item.title
            list_title_val = rlist.title
            
            # Localize series title if applicable
            if item.item_type == 'series' or (item.external_id and (item.external_id.startswith('tvm_') or item.external_id.startswith('tvm-ep-'))):
                clean_show_id = None
                if item.external_id:
                    if item.external_id.startswith('tvm_'):
                        clean_show_id = item.external_id.replace('tvm_', '')
                    elif item.external_id.startswith('tvm-ep-'):
                        pass # handled if needed
                if clean_show_id and clean_show_id.isdigit():
                    loc_name = TVMazeService.get_localized_title(int(clean_show_id), item.title or '', lang=client_lang, country_code=client_country)
                    if loc_name:
                        item_title_val = loc_name
            
            # Also check if it is a personal tracker list whose title starts with "Tracker: " or similar
            if list_title_val and list_title_val.startswith("Tracker: "):
                # If the item or tracker corresponds to a series, localize list title too
                if item.item_type == 'series' and item_title_val:
                    list_title_val = f"Tracker: {item_title_val}"

            up_next_item = UpNextItemResponse(
                item_id=item.id,
                list_id=rlist.id,
                list_title=list_title_val,
                order_index=item.order_index,
                item_type=item.item_type,
                external_id=item.external_id,
                title=item_title_val,
                image_url=item.image_url,
                custom_notes=item.custom_notes,
                section=item.section,
                is_addition=is_addition,
                addition_id=add_id,
                addition_item_id=add_item_id
            )
            
            if rlist.id in personal_tracker_ids or (rlist.title and rlist.title.startswith("Tracker: ")):
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
    search_pattern = f"%{q.strip()}%"
    users = db.query(User).filter(
        User.username.ilike(search_pattern)
    ).offset(skip).limit(limit).all()
    return users


@router.put("/me/username", response_model=UserResponse)
def update_username(
    req: UsernameUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    import re
    
    clean_username = req.username.strip()
    if len(clean_username) < 3 or len(clean_username) > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be between 3 and 30 characters"
        )
    if not re.match(r'^[a-zA-Z0-9_]+$', clean_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username can only contain letters, numbers and underscores"
        )

    # Check if username is already taken (case-insensitive)
    existing = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()
    if existing:
        if existing.id == current_user.id:
            # Case update for same user (e.g. from myuser to MyUser)
            current_user.username = clean_username
            db.commit()
            db.refresh(current_user)
            return current_user
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
        
    current_user.username = clean_username
    db.commit()
    db.refresh(current_user)

    from app.services.activity_service import ActivityService
    ActivityService.record_activity(
        db=db,
        user_id=current_user.id,
        activity_type="username_changed",
        details=clean_username
    )

    return current_user


def trim_downgraded_user_favorites(db: Session, user_id: int):
    # Retain user favorites in database without deleting so they restore when re-subscribing
    pass

                
class AvatarUpdateRequest(BaseModel):
    photo_url: str | None = None

@router.get("/characters/search")
def search_characters(
    query: str = Query("", description="Search term for character name"),
    current_user: User = Depends(get_current_user)
):
    from app.core.sfw_filter import is_safe_text
    if not is_safe_text(query):
        return []
    from app.services.characters import CharacterService
    results = CharacterService.search_all(query)
    clean_results = []
    for c in results:
        name = c.get("name") if isinstance(c, dict) else getattr(c, "name", "")
        if is_safe_text(name):
            clean_results.append(c)
    return clean_results

@router.put("/me/avatar", response_model=UserResponse)
def update_avatar(
    req: AvatarUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.photo_url = req.photo_url
    db.commit()
    db.refresh(current_user)

    if req.photo_url:
        from app.services.activity_service import ActivityService
        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="avatar_changed",
            image_url=req.photo_url,
            details="avatar_changed"
        )

    return current_user


class BannerUpdateRequest(BaseModel):
    banner_url: str | None = None

@router.get("/banners/search")
def search_banners(
    query: str = Query("", description="Search term for banner wallpaper"),
    type: str = Query("banner", description="Target type: 'banner' or 'background'"),
    current_user: User = Depends(get_current_user)
):
    from app.core.sfw_filter import is_safe_text
    if not is_safe_text(query):
        return []
    from app.services.banners import BannerService
    results = BannerService.search_all(query, target_type=type)
    clean_results = []
    for b in results:
        title = b.get("title") if isinstance(b, dict) else getattr(b, "title", "")
        if is_safe_text(title):
            clean_results.append(b)
    return clean_results

@router.put("/me/banner", response_model=UserResponse)
def update_banner(
    req: BannerUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not (current_user.is_pro or current_user.is_admin):
        raise HTTPException(status_code=403, detail="Setting a custom profile banner is a Pro feature")
    current_user.banner_url = req.banner_url
    db.commit()
    db.refresh(current_user)

    if req.banner_url:
        from app.services.activity_service import ActivityService
        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="banner_changed",
            image_url=req.banner_url,
            details="banner_changed"
        )

    return current_user


class BackgroundUpdateRequest(BaseModel):
    background_url: str | None = None

@router.put("/me/background", response_model=UserResponse)
def update_background(
    req: BackgroundUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not (current_user.is_pro or current_user.is_admin):
        raise HTTPException(status_code=403, detail="Setting a custom profile background is a Pro feature")
    current_user.background_url = req.background_url
    db.commit()
    db.refresh(current_user)

    if req.background_url:
        from app.services.activity_service import ActivityService
        ActivityService.record_activity(
            db=db,
            user_id=current_user.id,
            activity_type="background_changed",
            image_url=req.background_url,
            details="background_changed"
        )

    return current_user

class ColorUpdateRequest(BaseModel):
    profile_color: str | None = None

@router.put("/me/color", response_model=UserResponse)
def update_profile_color(
    req: ColorUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not (current_user.is_pro or current_user.is_admin):
        raise HTTPException(status_code=403, detail="Setting a custom profile color is a Pro feature")
    current_user.profile_color = req.profile_color
    db.commit()
    db.refresh(current_user)
    return current_user

class CategoryOrderUpdateRequest(BaseModel):
    category_order: str | None = None

@router.put("/me/category-order", response_model=UserResponse)
def update_category_order(
    req: CategoryOrderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not (current_user.is_pro or current_user.is_admin or current_user.is_vip):
        raise HTTPException(status_code=403, detail="Personalizar el orden de las categorías es una función Pro")
    current_user.category_order = req.category_order
    db.commit()
    db.refresh(current_user)
    return current_user



class UserSettingsUpdate(BaseModel):

    show_nsfw: bool | None = None
    is_pro: bool | None = None
    is_private: bool | None = None

@router.put("/me", response_model=UserResponse)
def update_user_settings(
    req: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.show_nsfw is not None:
        current_user.show_nsfw = req.show_nsfw
    
    if req.is_private is not None:
        current_user.is_private = req.is_private

    if req.is_pro is not None:
        was_pro = current_user.is_pro
        current_user.is_pro = req.is_pro
        if was_pro and not req.is_pro:
            trim_downgraded_user_favorites(db, current_user.id)
        
    db.commit()
    db.refresh(current_user)
    return current_user

class PrivacyUpdateRequest(BaseModel):
    is_private: bool

@router.put("/me/privacy", response_model=UserResponse)
def update_user_privacy(
    req: PrivacyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.is_private = req.is_private
    db.commit()
    db.refresh(current_user)
    return current_user

class LanguageUpdateRequest(BaseModel):
    language: str

@router.put("/me/language", response_model=UserResponse)
def update_user_language(
    req: LanguageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_lang = req.language.strip().lower()[:2]
    if clean_lang not in ("es", "en"):
        clean_lang = "es"
    current_user.preferred_language = clean_lang
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
    current_user: User = Depends(get_current_user_allow_suspended),
    db: Session = Depends(get_db)
):

    from app.models.library import UserLibraryItem
    from app.models.consumption import ConsumptionHistory
    from app.models.activity import UserActivityLog
    from app.models.social import Follow, Comment, CommentVote, ListVote, ListReport, CommentReport
    from app.models.review import MediaReview, MediaReviewVote, MediaReviewReport
    from app.models.addition import ListAddition, UserAdoptedAddition, AdditionVote, AdditionComment
    from app.models.saved_list import SavedList
    from app.models.item_progress import ItemProgress

    user_id = current_user.id

    # 0. Cancel Dodo Payments subscription if active so user is never billed again
    if current_user.dodo_subscription_id:
        try:
            import asyncio
            from app.api.v1.payments import cancel_dodo_subscription_direct
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(cancel_dodo_subscription_direct(current_user.dodo_subscription_id))
                else:
                    loop.run_until_complete(cancel_dodo_subscription_direct(current_user.dodo_subscription_id))
            except Exception:
                pass
        except Exception:
            pass

    # 1. Delete comments and review votes/reports

    db.query(CommentVote).filter(CommentVote.user_id == user_id).delete()
    db.query(CommentReport).filter(CommentReport.user_id == user_id).delete()
    db.query(Comment).filter(Comment.user_id == user_id).delete()

    db.query(ListVote).filter(ListVote.user_id == user_id).delete()
    db.query(ListReport).filter(ListReport.user_id == user_id).delete()

    db.query(MediaReviewVote).filter(MediaReviewVote.user_id == user_id).delete()
    db.query(MediaReviewReport).filter(MediaReviewReport.user_id == user_id).delete()
    db.query(MediaReview).filter(MediaReview.user_id == user_id).delete()

    # 2. Additions and votes
    db.query(AdditionVote).filter(AdditionVote.user_id == user_id).delete()
    db.query(AdditionComment).filter(AdditionComment.user_id == user_id).delete()
    db.query(UserAdoptedAddition).filter(UserAdoptedAddition.user_id == user_id).delete()
    db.query(ListAddition).filter(ListAddition.user_id == user_id).delete()

    # 3. Follows, activities, progress, library and consumptions
    db.query(Follow).filter((Follow.follower_id == user_id) | (Follow.followed_id == user_id)).delete()
    db.query(UserActivityLog).filter(UserActivityLog.user_id == user_id).delete()
    db.query(ItemProgress).filter(ItemProgress.user_id == user_id).delete()
    db.query(UserLibraryItem).filter(UserLibraryItem.user_id == user_id).delete()
    db.query(ConsumptionHistory).filter(ConsumptionHistory.user_id == user_id).delete()
    db.query(SavedList).filter(SavedList.user_id == user_id).delete()

    # 4. Delete user (which cascades to owned reading lists)
    db.delete(current_user)
    db.commit()
    return None

@router.get("/profile/{user_identifier}", response_model=UserDashboardResponse)
def get_any_user_profile(
    user_identifier: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user = None
    if user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    if not user:
        user = db.query(User).filter(User.username.ilike(user_identifier)).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Exclude tracking lists (personal series/episode trackers)
    tracker_list_ids_query = db.query(UserLibraryItem.tracking_list_id).filter(
        UserLibraryItem.user_id == user.id,
        UserLibraryItem.tracking_list_id.isnot(None)
    )
    
    is_pro = check_user_is_pro(user)
    raw_created_lists = db.query(ReadingList).filter(
        ReadingList.creator_id == user.id,
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        ~ReadingList.id.in_(tracker_list_ids_query)
    ).order_by(ReadingList.created_at.asc()).all()

    created_lists = []
    for idx, rl in enumerate(raw_created_lists):
        rl_data = ReadingListResponse.model_validate(rl)
        rl_data.can_edit = True if (is_pro or idx < 2) else False
        created_lists.append(rl_data)
    
    saved_entries = db.query(SavedList).join(
        ReadingList, SavedList.list_id == ReadingList.id
    ).filter(
        SavedList.user_id == user.id,
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).order_by(SavedList.saved_at.asc()).all()

    saved_lists = []
    other_saved_count = 0
    for se in saved_entries:
        rl = se.reading_list
        if not rl:
            continue
        is_own = (rl.creator_id == user.id)
        if is_pro or is_own:
            rl_data = ReadingListResponse.model_validate(rl)
            saved_lists.append(rl_data)
        else:
            if other_saved_count < 3:
                rl_data = ReadingListResponse.model_validate(rl)
                saved_lists.append(rl_data)
                other_saved_count += 1

    is_following = False
    follow_request_pending = False
    is_own = current_user is not None and current_user.id == user.id
    is_admin = current_user is not None and getattr(current_user, 'is_admin', False)

    from app.models.social import FollowRequest

    if current_user and not is_own:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.followed_id == user.id
        ).first() is not None

        if not is_following:
            follow_request_pending = db.query(FollowRequest).filter(
                FollowRequest.requester_id == current_user.id,
                FollowRequest.target_id == user.id
            ).first() is not None

    is_user_private = bool(getattr(user, 'is_private', False))
    is_private_locked = is_user_private and not is_own and not is_admin and not is_following

    followers_count = db.query(Follow).filter(Follow.followed_id == user.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == user.id).count()

    # If the profile is private and locked, hide lists
    final_created_lists = [] if is_private_locked else created_lists
    final_saved_lists = [] if is_private_locked else saved_lists

    return UserDashboardResponse(
        id=user.id,
        username=user.username,
        email=user.email if (is_own or is_admin) else None,
        created_at=user.created_at,
        photo_url=user.photo_url,
        banner_url=user.banner_url if not is_private_locked else None,
        background_url=user.background_url if not is_private_locked else None,
        is_admin=user.is_admin,
        show_nsfw=user.show_nsfw,
        is_pro=is_pro,
        is_pro_cancelled=bool(user.is_pro_cancelled),
        is_vip=bool(user.is_vip),
        has_active_subscription=bool(user.dodo_subscription_id and not user.is_pro_cancelled),
        pro_expires_at=user.pro_expires_at,
        is_suspended=bool(user.is_suspended),
        suspended_until=user.suspended_until,
        suspension_reason=user.suspension_reason,
        admin_warning=user.admin_warning if (current_user and (current_user.id == user.id or current_user.is_admin)) else None,
        profile_color=user.profile_color,
        category_order=user.category_order,
        lastfm_username=user.lastfm_username if not is_private_locked else None,
        is_private=is_user_private,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        follow_request_pending=follow_request_pending,
        is_private_locked=is_private_locked,
        created_lists=final_created_lists,
        saved_lists=final_saved_lists
    )


@router.post("/me/dismiss-warning")
def dismiss_admin_warning(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.admin_warning = None
    current_user.admin_warning_at = None
    db.commit()
    return {"message": "Warning dismissed"}


@router.get("/me/activity")
def get_my_activity(
    limit: int = 15,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    activities = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == current_user.id
    ).order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    
    # Pre-collect external_ids and titles missing images to bulk query
    missing_ext_ids = {
        act.external_id for act in activities
        if not act.image_url and act.activity_type.startswith('item_') and act.external_id
    }
    missing_titles = {
        act.item_title.lower() for act in activities
        if not act.image_url and act.activity_type.startswith('item_') and act.item_title
    }

    lib_by_ext = {}
    list_item_by_ext = {}
    lib_by_title = {}

    if missing_ext_ids:
        libs = db.query(UserLibraryItem.external_id, UserLibraryItem.image_url).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.external_id.in_(missing_ext_ids),
            UserLibraryItem.image_url.isnot(None)
        ).all()
        for ext_id, img_url in libs:
            if ext_id and img_url and ext_id not in lib_by_ext:
                lib_by_ext[ext_id] = img_url

        remaining_ext = missing_ext_ids - set(lib_by_ext.keys())
        if remaining_ext:
            list_items = db.query(ListItem.external_id, ListItem.image_url).filter(
                ListItem.external_id.in_(remaining_ext),
                ListItem.image_url.isnot(None)
            ).all()
            for ext_id, img_url in list_items:
                if ext_id and img_url and ext_id not in list_item_by_ext:
                    list_item_by_ext[ext_id] = img_url

    if missing_titles:
        title_libs = db.query(UserLibraryItem.title, UserLibraryItem.image_url).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.image_url.isnot(None)
        ).all()
        for t, img_url in title_libs:
            if t and img_url:
                norm_t = t.strip().lower()
                if norm_t in missing_titles and norm_t not in lib_by_title:
                    lib_by_title[norm_t] = img_url

    res = []
    for act in activities:
        img = act.image_url
        if not img and act.activity_type.startswith('item_'):
            if act.external_id:
                img = lib_by_ext.get(act.external_id) or list_item_by_ext.get(act.external_id)
            if not img and act.item_title:
                img = lib_by_title.get(act.item_title.strip().lower())

        res.append({
            "id": act.id,
            "activity_type": act.activity_type,
            "item_title": act.item_title,
            "item_type": act.item_type,
            "external_id": act.external_id,
            "list_id": act.list_id,
            "image_url": img,
            "details": act.details,
            "entity_id": act.entity_id,
            "metadata_json": act.metadata_json,
            "created_at": act.created_at,
            "updated_at": act.updated_at
        })
    return res

@router.get("/me/feed/guides-updates")
def get_guides_updates(
    limit: int = 15,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch followed list IDs
    followed_list_ids = [
        s.list_id for s in db.query(SavedList.list_id).filter(SavedList.user_id == current_user.id).all()
    ]
    
    if not followed_list_ids:
        return []

    guide_activity_types = [
        'item_added', 'item_removed', 'item_moved', 'block_edited',
        'guide_edited', 'guide_created', 'guide_published'
    ]

    details_patterns = [f"list_id:{lid}" for lid in followed_list_ids]

    activities = db.query(UserActivityLog).filter(
        UserActivityLog.activity_type.in_(guide_activity_types),
        or_(
            UserActivityLog.list_id.in_(followed_list_ids),
            UserActivityLog.details.in_(details_patterns)
        )
    ).order_by(UserActivityLog.created_at.desc()).limit(100).all()

    # Pre-fetch reading lists and creators
    reading_lists = {
        rl.id: rl for rl in db.query(ReadingList).filter(ReadingList.id.in_(followed_list_ids)).all()
    }
    creator_ids = {rl.creator_id for rl in reading_lists.values() if rl.creator_id}
    act_user_ids = {a.user_id for a in activities if a.user_id}
    all_user_ids = creator_ids.union(act_user_ids)
    users_by_id = {
        u.id: u for u in db.query(User).filter(User.id.in_(all_user_ids)).all()
    }

    results = []
    for a in activities:
        lid = a.list_id
        if not lid and a.details and "list_id:" in a.details:
            try:
                lid = int(a.details.split("list_id:")[1].strip())
            except Exception:
                pass
        
        rl = reading_lists.get(lid)
        if not rl:
            continue

        user = users_by_id.get(a.user_id) or users_by_id.get(rl.creator_id)
        username = user.username if user else "Usuario"
        photo_url = user.photo_url if user else None

        results.append({
            'id': a.id,
            'user_id': a.user_id or rl.creator_id,
            'username': username,
            'photo_url': photo_url,
            'creator_name': username,
            'creator_photo': photo_url,
            'activity_type': a.activity_type,
            'item_title': a.item_title or rl.title,
            'item_type': a.item_type or "guide",
            'list_id': rl.id,
            'list_title': rl.title,
            'guide_title': rl.title,
            'details': a.details,
            'created_at': a.created_at.isoformat() if a.created_at else None
        })

        if len(results) >= limit:
            break

    return results

@router.get("/me/feed/following-updates")
def get_following_updates(
    limit: int = 15,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch latest guides created by followed users
    followed_user_ids = [
        f.followed_id for f in db.query(Follow.followed_id).filter(Follow.follower_id == current_user.id).all()
    ]
    
    if not followed_user_ids:
        return []
        
    lists = db.query(ReadingList).filter(
        ReadingList.creator_id.in_(followed_user_ids),
        ReadingList.visibility == VisibilityEnum.PUBLIC
    ).order_by(ReadingList.created_at.desc()).limit(limit).all()
    
    results = []
    for l in lists:
        creator = db.query(User).filter(User.id == l.creator_id).first()
        results.append({
            'list_id': l.id,
            'title': l.title,
            'description': l.description,
            'creator_id': l.creator_id,
            'creator_name': creator.username if creator else 'Pathd User',
            'creator_photo': creator.photo_url if creator else None,
            'created_at': l.created_at,
            'items_count': len(l.items)
        })
        
    return results


@router.get("/{user_id}/activity")
def get_user_activity(
    user_id: int,
    request: Request,
    limit: int = 15,
    db: Session = Depends(get_db)
):
    accept_lang = request.headers.get("Accept-Language", "es")
    parts = accept_lang.split("-")
    client_lang = parts[0].lower() if parts else "es"
    client_country = parts[1].upper() if len(parts) > 1 else ("ES" if client_lang == "es" and "es-es" in accept_lang.lower() else "AR")

    activities = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == user_id
    ).order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    
    # Pre-collect external_ids and titles missing images to bulk query
    missing_ext_ids = {
        act.external_id for act in activities
        if not act.image_url and act.activity_type.startswith('item_') and act.external_id
    }
    missing_titles = {
        act.item_title.lower() for act in activities
        if not act.image_url and act.activity_type.startswith('item_') and act.item_title
    }

    lib_by_ext = {}
    list_item_by_ext = {}
    lib_by_title = {}

    if missing_ext_ids:
        libs = db.query(UserLibraryItem.external_id, UserLibraryItem.image_url).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.external_id.in_(missing_ext_ids),
            UserLibraryItem.image_url.isnot(None)
        ).all()
        for ext_id, img_url in libs:
            if ext_id and img_url and ext_id not in lib_by_ext:
                lib_by_ext[ext_id] = img_url

        remaining_ext = missing_ext_ids - set(lib_by_ext.keys())
        if remaining_ext:
            list_items = db.query(ListItem.external_id, ListItem.image_url).filter(
                ListItem.external_id.in_(remaining_ext),
                ListItem.image_url.isnot(None)
            ).all()
            for ext_id, img_url in list_items:
                if ext_id and img_url and ext_id not in list_item_by_ext:
                    list_item_by_ext[ext_id] = img_url

    if missing_titles:
        title_libs = db.query(UserLibraryItem.title, UserLibraryItem.image_url).filter(
            UserLibraryItem.user_id == user_id,
            UserLibraryItem.image_url.isnot(None)
        ).all()
        for t, img_url in title_libs:
            if t and img_url:
                norm_t = t.strip().lower()
                if norm_t in missing_titles and norm_t not in lib_by_title:
                    lib_by_title[norm_t] = img_url

    res = []
    for act in activities:
        final_title = act.item_title
        if act.item_type == 'series' and act.external_id and act.external_id.startswith('tvm_'):
            clean_show_id = act.external_id.replace('tvm_', '')
            if clean_show_id.isdigit():
                loc_name = TVMazeService.get_localized_title(int(clean_show_id), act.item_title or '', lang=client_lang, country_code=client_country)
                if loc_name:
                    final_title = loc_name
        
        img = act.image_url
        if not img and act.activity_type.startswith('item_'):
            if act.external_id:
                img = lib_by_ext.get(act.external_id) or list_item_by_ext.get(act.external_id)
            if not img and act.item_title:
                img = lib_by_title.get(act.item_title.strip().lower())

        res.append({
            "id": act.id,
            "activity_type": act.activity_type,
            "item_title": final_title,
            "item_type": act.item_type,
            "external_id": act.external_id,
            "list_id": act.list_id,
            "image_url": img,
            "details": act.details,
            "entity_id": act.entity_id,
            "metadata_json": act.metadata_json,
            "created_at": act.created_at,
            "updated_at": act.updated_at
        })
    return res

class MockProRequest(BaseModel):
    is_pro: bool

@router.post("/me/mock-pro")
def mock_pro_status(
    req: MockProRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.is_pro = req.is_pro
    db.commit()
    db.refresh(current_user)
    return {"message": f"User is now {'Pro' if req.is_pro else 'Free'}", "is_pro": req.is_pro}




class ColorUpdateRequest(BaseModel):
    color: str | None

@router.put("/me/color")
def update_profile_color(
    req: ColorUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_pro:
        raise HTTPException(status_code=403, detail="Only Pro users can set profile colors")
    current_user.profile_color = req.color
    db.commit()
    db.refresh(current_user)
    return {"message": "Color updated successfully", "color": req.color}

class BulkCheckRequest(BaseModel):
    external_ids: List[str]

@router.post("/me/progress/bulk-check")
def bulk_check_progress(
    req: BulkCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.external_ids:
        return {}
        
    records = db.query(ItemProgress).filter(
        ItemProgress.user_id == current_user.id,
        ItemProgress.external_id.in_(req.external_ids),
        ItemProgress.is_completed == True
    ).all()
    
    result = {ext_id: False for ext_id in req.external_ids}
    for record in records:
        if record.external_id:
            result[record.external_id] = True
            
    return result

