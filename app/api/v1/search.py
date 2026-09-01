from typing import List, Dict, Tuple, Any
from fastapi import APIRouter, Query, HTTPException, status, Request, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.services.base import SearchResultItem
from app.services.comicvine import ComicVineService
from app.services.tvmaze import TVMazeService
from app.services.omdb import OMDbService
from app.services.googlebooks import GoogleBooksService
from app.services.igdb import IGDBService
from app.services.anilist import AnilistService
from app.core.limiter import limiter
from app.core.sfw_filter import is_safe_text, is_safe_media_item

import re
import concurrent.futures

router = APIRouter()

def get_query_variations(q: str) -> List[str]:
    pattern = r'\b(y|and)\b|\s+&\s+'
    if not re.search(pattern, q, re.IGNORECASE):
        return [q.strip()]
    v1 = re.sub(pattern, ' y ', q, flags=re.IGNORECASE).strip()
    v2 = re.sub(pattern, ' and ', q, flags=re.IGNORECASE).strip()
    v3 = re.sub(pattern, ' & ', q, flags=re.IGNORECASE).strip()
    
    vars_set = []
    for v in [q.strip(), v1, v2, v3]:
        v = re.sub(r'\s+', ' ', v).strip()
        if v and v not in vars_set:
            vars_set.append(v)
    return vars_set

@router.get("/", response_model=List[SearchResultItem])
@limiter.limit("30/minute")
def search_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    type: str = Query("movie", description="The type of media to search for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    # Strict SFW query check
    if not is_safe_text(q):
        return []

    type_lower = type.lower()
    
    if type_lower not in ["comic", "book", "manga", "game", "movie", "anime", "series"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search type. Must be 'comic', 'book', 'manga', 'game', 'movie', 'anime' or 'series'."
        )
        
    variations = [v for v in get_query_variations(q) if is_safe_text(v)]
    if not variations:
        return []

    combined = []
    seen = set()
    
    def fetch_var(var):
        if type_lower == "comic":
            return ComicVineService.search_comics(var)
        elif type_lower == "book":
            return GoogleBooksService.search_books(var)
        elif type_lower == "manga":
            return AnilistService.search_manga(var)
        elif type_lower == "game":
            return IGDBService.search_games(var)
        elif type_lower == "movie":
            return OMDbService.search_movies(var)
        elif type_lower == "anime":
            return TVMazeService.search_shows(var, is_anime=True)
        elif type_lower == "series":
            return TVMazeService.search_shows(var, is_anime=False)
        return []

    from app.models.social import BlockedMediaItem
    blocked_ids = {b.external_id for b in db.query(BlockedMediaItem.external_id).all()}

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(variations))) as executor:
        future_to_var = {executor.submit(fetch_var, var): var for var in variations}
        for future in concurrent.futures.as_completed(future_to_var):
            try:
                res = future.result()
                for r in res:
                    if r.external_id not in seen and r.external_id not in blocked_ids and is_safe_media_item(r.title, r.description):
                        seen.add(r.external_id)
                        combined.append(r)
            except Exception as e:
                print(f"Error fetching var {future_to_var[future]}: {e}")

    if type_lower == "series":
        query_clean = q.lower().strip()
        query_words = set(query_clean.split())
        def calculate_score(item: SearchResultItem):
            title_clean = item.title.lower().strip()
            score = 0.0
            if title_clean == query_clean:
                score += 100.0
            elif title_clean.startswith(query_clean):
                score += 50.0
            elif query_clean in title_clean:
                score += 30.0
            title_words = set(title_clean.split())
            common_words = query_words.intersection(title_words)
            score += len(common_words) * 15.0
            
            if len(item.title) > 0:
                score += (1.0 / len(item.title)) * 10.0
                
            score += min(item.popularity or 0.0, 100.0)
            return score
        combined.sort(key=calculate_score, reverse=True)
        
    return combined

@router.get("/all", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_all_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    variations = get_query_variations(q)
    combined = []
    seen = set()

    from app.models.social import BlockedMediaItem
    blocked_ids = {b.external_id for b in db.query(BlockedMediaItem.external_id).all()}

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(7, len(variations) * 7)) as executor:
        futures = []
        for var in variations:
            futures.append(executor.submit(OMDbService.search_movies, var))
            futures.append(executor.submit(TVMazeService.search_shows, var, False))
            futures.append(executor.submit(TVMazeService.search_shows, var, True))
            futures.append(executor.submit(GoogleBooksService.search_books, var))
            futures.append(executor.submit(IGDBService.search_games, var))
            futures.append(executor.submit(ComicVineService.search_comics, var))
            futures.append(executor.submit(AnilistService.search_manga, var))
            
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                for r in res:
                    if r.external_id not in seen and r.external_id not in blocked_ids:
                        seen.add(r.external_id)
                        combined.append(r)
            except Exception as e:
                print(f"Error fetching in all search: {e}")

    # Search users and guides in database for all variations
    seen_users = set()
    seen_guides = set()
    for var in variations:
        search_pattern = f"%{var.strip()}%"
        db_users = db.query(User).filter(User.username.ilike(search_pattern)).limit(20).all()
        db_guides = db.query(ReadingList).filter(
            ReadingList.visibility == VisibilityEnum.PUBLIC,
            (ReadingList.title.ilike(search_pattern) | ReadingList.description.ilike(search_pattern))
        ).limit(20).all()

        
        for u in db_users:
            if u.id not in seen_users:
                seen_users.add(u.id)
                ext_id = str(u.id)
                if ext_id not in seen:
                    seen.add(ext_id)
                    combined.append(SearchResultItem(
                        external_id=ext_id,
                        title=u.username,
                        image_url=u.photo_url or "",
                        description="Usuario de Pathd",
                        item_type="user",
                        popularity=0.0
                    ))
            
        for g in db_guides:
            if g.id not in seen_guides:
                seen_guides.add(g.id)
                ext_id = str(g.id)
                if ext_id not in seen:
                    seen.add(ext_id)
                    creator_name = g.creator.username if g.creator else "Usuario"
                    combined.append(SearchResultItem(
                        external_id=ext_id,
                        title=g.title,
                        image_url="",
                        description=g.description or f"Guía creada por {creator_name}",
                        item_type="guide",
                        popularity=10.0
                    ))

    query_clean = q.lower().strip()
    query_words = set(query_clean.split())

    def calculate_score(item: SearchResultItem):
        title_clean = item.title.lower().strip()
        score = 0.0

        if title_clean == query_clean:
            score += 1000.0
        elif title_clean.startswith(query_clean):
            score += 500.0
        elif query_clean in title_clean:
            score += 250.0

        title_words = set(title_clean.split())
        common_words = query_words.intersection(title_words)
        score += len(common_words) * 100.0
        
        # Prefer shorter titles on equal match (e.g. "Arrow" over "Arrow: Blood Rush" for query "Arrow")
        if len(item.title) > 0:
            score += (1.0 / len(item.title)) * 200.0

        # Cosmetic DLCs get a small penalty so primary works appear first
        if getattr(item, "badge", None) == "dlc":
            score -= 300.0
            
        score += min(item.popularity or 0.0, 100.0)
        return score

    combined.sort(key=calculate_score, reverse=True)
    return combined


@router.get("/series/{series_id}/episodes")
def get_all_episodes(
    series_id: str
):
    try:
        if str(series_id).startswith("anime_"):
            return AnilistService.get_anime_episodes(series_id)
        return TVMazeService.get_all_episodes(series_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch episodes: {str(e)}"
        )

@router.get("/series/{series_id}")
def get_series_detail(
    series_id: str
):
    try:
        if str(series_id).startswith("anime_"):
            detail = AnilistService.get_anime_detail(series_id)
            if not detail:
                raise HTTPException(status_code=404, detail="Anime not found")
            return detail
        return TVMazeService.get_series_detail(series_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch series detail: {str(e)}"
        )

@router.get("/movies/{movie_id}")
def get_movie_detail(
    movie_id: str
):
    try:
        detail = OMDbService.get_movie_detail(movie_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Movie not found")
        return detail
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch movie detail: {str(e)}"
        )

from datetime import datetime, timedelta, timezone
from sqlalchemy import func
import random
from typing import Optional, Dict, Any
from app.models.activity import UserActivityLog
from app.models.library import UserLibraryItem
from app.models.list import ReadingList
from app.models.user import User
from pydantic import BaseModel

class RecommendationResponse(BaseModel):
    for_you: List[SearchResultItem]
    trending: List[SearchResultItem]
    featured_guides: List[Dict[str, Any]]

@router.get("/explore/recommendations", response_model=RecommendationResponse)
@limiter.limit("30/minute")
def get_explore_recommendations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    now = datetime.now(timezone.utc)
    
    # 1. TENDENCIAS GLOBALES
    # Buscamos en UserActivityLog (últimos 7 días)
    week_ago = now - timedelta(days=7)
    trending_logs = db.query(
        UserActivityLog.external_id, 
        UserActivityLog.item_type,
        UserActivityLog.item_title,
        UserActivityLog.image_url,
        func.count(UserActivityLog.id).label('count')
    ).filter(
        UserActivityLog.created_at >= week_ago,
        UserActivityLog.activity_type.in_(['shelf_add', 'item_completed', 'item_added']),
        UserActivityLog.external_id.isnot(None)
    ).group_by(
        UserActivityLog.external_id, 
        UserActivityLog.item_type,
        UserActivityLog.item_title,
        UserActivityLog.image_url
    ).order_by(func.count(UserActivityLog.id).desc()).limit(15).all()

    # Si hay pocos (arranque en frío), buscamos histórico
    if len(trending_logs) < 5:
        trending_logs = db.query(
            UserActivityLog.external_id, 
            UserActivityLog.item_type,
            UserActivityLog.item_title,
            UserActivityLog.image_url,
            func.count(UserActivityLog.id).label('count')
        ).filter(
            UserActivityLog.activity_type.in_(['shelf_add', 'item_completed', 'item_added']),
            UserActivityLog.external_id.isnot(None)
        ).group_by(
            UserActivityLog.external_id, 
            UserActivityLog.item_type,
            UserActivityLog.item_title,
            UserActivityLog.image_url
        ).order_by(func.count(UserActivityLog.id).desc()).limit(15).all()

    trending = []
    for log in trending_logs:
        trending.append(SearchResultItem(
            external_id=log.external_id,
            title=log.item_title,
            item_type=log.item_type or "unknown",
            image_url=log.image_url or "",
            description=""
        ))

    # 2. GUÍAS DESTACADAS
    # Buscamos guías públicas con más actividad reciente (últimos 30 días)
    month_ago = now - timedelta(days=30)
    featured_guide_logs = db.query(
        UserActivityLog.list_id,
        func.count(UserActivityLog.id).label('count')
    ).filter(
        UserActivityLog.created_at >= month_ago,
        UserActivityLog.activity_type.in_(['guide_followed', 'item_added', 'guide_commented']),
        UserActivityLog.list_id.isnot(None)
    ).group_by(
        UserActivityLog.list_id
    ).order_by(func.count(UserActivityLog.id).desc()).limit(10).all()

    featured_guides = []
    if not featured_guide_logs:
        # Fallback histórico
        fallback_guides = db.query(ReadingList).filter(ReadingList.visibility == VisibilityEnum.PUBLIC).limit(10).all()
        for g in fallback_guides:
            user = db.query(User).filter(User.id == g.creator_id).first()
            featured_guides.append({
                "id": g.id,
                "title": g.title,
                "description": g.description,
                "creator_name": user.username if user else "Unknown"
            })
    else:
        for log in featured_guide_logs:
            g = db.query(ReadingList).filter(ReadingList.id == log.list_id, ReadingList.visibility == VisibilityEnum.PUBLIC).first()
            if g:
                user = db.query(User).filter(User.id == g.creator_id).first()
                featured_guides.append({
                    "id": g.id,
                    "title": g.title,
                    "description": g.description,
                    "creator_name": user.username if user else "Unknown"
                })

    # 3. PARA TI (Filtrado Colaborativo o Fallback)
    for_you = []
    
    # Intento de filtrado colaborativo
    if current_user:
        # Obtenemos los items del usuario
        user_items = db.query(UserLibraryItem.external_id).filter(UserLibraryItem.user_id == current_user.id).all()
        user_ext_ids = [i[0] for i in user_items if i[0]]
        
        if user_ext_ids:
            # Buscamos usuarios que tengan al menos uno de esos items
            similar_users = db.query(UserLibraryItem.user_id).filter(
                UserLibraryItem.external_id.in_(user_ext_ids),
                UserLibraryItem.user_id != current_user.id
            ).distinct().all()
            sim_user_ids = [u[0] for u in similar_users]
            
            if sim_user_ids:
                # Buscamos los items más comunes de esos usuarios, que el usuario actual NO tenga
                recommended = db.query(
                    UserLibraryItem.external_id,
                    UserLibraryItem.title,
                    UserLibraryItem.item_type,
                    UserLibraryItem.image_url,
                    func.count(UserLibraryItem.id).label('count')
                ).filter(
                    UserLibraryItem.user_id.in_(sim_user_ids),
                    ~UserLibraryItem.external_id.in_(user_ext_ids)
                ).group_by(
                    UserLibraryItem.external_id,
                    UserLibraryItem.title,
                    UserLibraryItem.item_type,
                    UserLibraryItem.image_url
                ).order_by(func.count(UserLibraryItem.id).desc()).limit(15).all()
                
                for r in recommended:
                    for_you.append(SearchResultItem(
                        external_id=r.external_id,
                        title=r.title,
                        item_type=r.item_type,
                        image_url=r.image_url or "",
                        description=""
                    ))

    # Si "Para ti" está vacío (arranque en frío), rellenamos con APIs externas!
    if len(for_you) < 5:
        # Usamos consultas populares como fallback
        fallback_queries = [
            ("movie", "Avengers"),
            ("movie", "Star Wars"),
            ("anime", "Naruto"),
            ("anime", "Dragon Ball"),
            ("game", "Mario"),
            ("game", "Zelda"),
            ("series", "Breaking Bad"),
            ("series", "Game of Thrones")
        ]
        q_type, q_term = random.choice(fallback_queries)
        
        try:
            if q_type == "movie":
                results = OMDbService.search_movies(q_term)
            elif q_type == "anime":
                results = TVMazeService.search_shows(q_term, is_anime=True)
            elif q_type == "game":
                results = IGDBService.search_games(q_term)
            elif q_type == "series":
                results = TVMazeService.search_shows(q_term, is_anime=False)
            else:
                results = []
                
            existing_ids = set([str(i.external_id) for i in for_you])
            existing_titles = set([i.title.lower() for i in for_you])
            added_count = 0
            for res in results:
                if str(res.external_id) not in existing_ids and res.title.lower() not in existing_titles and is_safe_media_item(res.title, res.description):
                    for_you.append(res)
                    existing_ids.add(str(res.external_id))
                    existing_titles.add(res.title.lower())
                    added_count += 1
                if added_count >= 10:
                    break
        except Exception as e:
            print(f"Error en fallback de recomendaciones: {e}")
            
    if len(for_you) < 5:
        for t in trending:
            if is_safe_media_item(t.title, t.description):
                for_you.append(t)
            
    seen = set()
    final_for_you = []
    for item in for_you:
        if item.external_id not in seen and is_safe_media_item(item.title, item.description):
            seen.add(item.external_id)
            final_for_you.append(item)

    return RecommendationResponse(
        for_you=final_for_you,
        trending=trending,
        featured_guides=featured_guides
    )

class ExploreTabsResponse(BaseModel):
    agregado: List[SearchResultItem]
    nuevo: List[SearchResultItem]
    descubrir: List[SearchResultItem]

# In-memory TTL cache for explore new items
_EXPLORE_NUEVO_CACHE: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
_EXPLORE_CACHE_TTL = 4 * 3600  # 4 hours

@router.get("/explore/tabs", response_model=ExploreTabsResponse)
@limiter.limit("60/minute")
def get_explore_tabs(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    import time
    agregado = []
    
    # 1. Agregado (UserLibraryItem filtered)
    if current_user:
        user_items = db.query(UserLibraryItem).filter(
            UserLibraryItem.user_id == current_user.id
        ).order_by(UserLibraryItem.id.desc()).all()
        for item in user_items:
            if not item.external_id.startswith("tvm-ep-") and is_safe_media_item(item.title):
                agregado.append(SearchResultItem(
                    external_id=item.external_id,
                    title=item.title,
                    image_url=item.image_url,
                    item_type=item.item_type,
                    status=item.status
                ))
    
    # 2. Nuevo (APIs with 4-hour in-memory cache)
    now_ts = time.time()
    cache_key = "explore_nuevo_global"
    if cache_key in _EXPLORE_NUEVO_CACHE:
        cache_time, cached_items = _EXPLORE_NUEVO_CACHE[cache_key]
        if now_ts - cache_time < _EXPLORE_CACHE_TTL and len(cached_items) > 0:
            return ExploreTabsResponse(
                agregado=agregado,
                nuevo=cached_items,
                descubrir=[]
            )

    nuevo = []
    import concurrent.futures
    
    def fetch_new_tv():
        try: return [x for x in TVMazeService.get_new_shows() if is_safe_media_item(x.title, x.description)]
        except: return []

    def fetch_new_anime():
        try: return [x for x in TVMazeService.get_new_anime() if is_safe_media_item(x.title, x.description)]
        except: return []
        
    def fetch_new_manga():
        try: return [x for x in AnilistService.get_new_manga() if is_safe_media_item(x.title, x.description)]
        except: return []

    def fetch_new_games():
        try: return [x for x in IGDBService.get_new_games() if is_safe_media_item(x.title, x.description)]
        except: return []

    def fetch_new_movies():
        try: return [x for x in OMDbService.get_new_movies() if is_safe_media_item(x.title, x.description)]
        except: return []

    def fetch_new_books():
        try: return [x for x in GoogleBooksService.get_new_books() if is_safe_media_item(x.title, x.description)]
        except: return []

    def fetch_new_comics():
        try: return [x for x in ComicVineService.get_new_comics() if is_safe_media_item(x.title, x.description)]
        except: return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        f_ntv = executor.submit(fetch_new_tv)
        f_nan = executor.submit(fetch_new_anime)
        f_nmg = executor.submit(fetch_new_manga)
        f_ngm = executor.submit(fetch_new_games)
        f_nmv = executor.submit(fetch_new_movies)
        f_nbk = executor.submit(fetch_new_books)
        f_ncm = executor.submit(fetch_new_comics)
        
        nuevo.extend(f_nmv.result())
        nuevo.extend(f_ntv.result())
        nuevo.extend(f_nan.result())
        nuevo.extend(f_nbk.result())
        nuevo.extend(f_ncm.result())
        nuevo.extend(f_nmg.result())
        nuevo.extend(f_ngm.result())

    if len(nuevo) > 0:
        _EXPLORE_NUEVO_CACHE[cache_key] = (now_ts, nuevo)

    return ExploreTabsResponse(
        agregado=agregado,
        nuevo=nuevo,
        descubrir=[]
    )

@router.get("/game/{game_id}/relations")
def get_game_relations(
    game_id: str,
    request: Request
):
    try:
        return IGDBService.get_game_relations(game_id)
    except Exception as e:
        print(f"Error fetching game relations for {game_id}: {e}")
        return {"collections": [], "bundle_games": [], "editions": [], "dlcs": [], "parent_game": None}


