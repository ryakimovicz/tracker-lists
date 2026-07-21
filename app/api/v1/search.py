from typing import List
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

router = APIRouter()

@router.get("/", response_model=List[SearchResultItem])
@limiter.limit("30/minute")
def search_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    type: str = Query("movie", description="The type of media to search for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    type_lower = type.lower()
    
    if type_lower == "comic":
        return ComicVineService.search_comics(q)
    elif type_lower == "book":
        return GoogleBooksService.search_books(q)
    elif type_lower == "manga":
        return AnilistService.search_manga(q)
    elif type_lower == "game":
        return IGDBService.search_games(q)
    elif type_lower == "movie":
        return OMDbService.search_movies(q)
    elif type_lower == "anime":
        return TVMazeService.search_shows(q, is_anime=True)
    elif type_lower == "series":
        combined = TVMazeService.search_shows(q, is_anime=False)
        
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
            
            # Density boost: Shorter titles matching the query density get prioritized
            if len(item.title) > 0:
                score += (1.0 / len(item.title)) * 10.0
                
            # Popularity boost (capped at 100 to prevent overtaking text similarity but breaking ties)
            score += min(item.popularity or 0.0, 100.0)
            return score
        combined.sort(key=calculate_score, reverse=True)
        return combined
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search type. Must be 'comic', 'book', 'game', 'movie' or 'series'."
        )

@router.get("/all", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_all_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        future_movies = executor.submit(OMDbService.search_movies, q)
        future_series = executor.submit(TVMazeService.search_shows, q, False)
        future_anime = executor.submit(TVMazeService.search_shows, q, True)
        future_books = executor.submit(GoogleBooksService.search_books, q)
        future_games = executor.submit(IGDBService.search_games, q)
        future_comics = executor.submit(ComicVineService.search_comics, q)
        future_manga = executor.submit(AnilistService.search_manga, q)
        
        movies = future_movies.result()
        series = future_series.result()
        anime = future_anime.result()
        books = future_books.result()
        games = future_games.result()
        comics = future_comics.result()
        mangas = future_manga.result()
        
    combined = []
    combined.extend(movies)
    combined.extend(series)
    combined.extend(anime)
    combined.extend(books)
    combined.extend(games)
    combined.extend(comics)
    combined.extend(mangas)

    # Search users and guides in database
    search_pattern = f"%{q.lower()}%"
    db_users = db.query(User).filter(User.username.like(search_pattern)).limit(20).all()
    db_guides = db.query(ReadingList).filter(
        ReadingList.visibility == VisibilityEnum.PUBLIC,
        (ReadingList.title.like(search_pattern) | ReadingList.description.like(search_pattern))
    ).limit(20).all()
    
    for u in db_users:
        combined.append(SearchResultItem(
            external_id=str(u.id),
            title=u.username,
            image_url=u.photo_url or "",
            description="Usuario de Pathd",
            item_type="user",
            popularity=0.0
        ))
        
    for g in db_guides:
        creator_name = g.creator.username if g.creator else "Usuario"
        combined.append(SearchResultItem(
            external_id=str(g.id),
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
            score += 100.0
        elif title_clean.startswith(query_clean):
            score += 50.0
        elif query_clean in title_clean:
            score += 30.0
        title_words = set(title_clean.split())
        common_words = query_words.intersection(title_words)
        score += len(common_words) * 15.0
        
        # Density boost: Shorter titles matching the query density get prioritized
        if len(item.title) > 0:
            score += (1.0 / len(item.title)) * 10.0
            
        # Popularity boost (capped at 100 to prevent overtaking text similarity but breaking ties)
        score += min(item.popularity or 0.0, 100.0)
        return score

    combined.sort(key=calculate_score, reverse=True)
    return combined

@router.get("/series/{series_id}/episodes")
def get_all_episodes(
    series_id: str
):
    try:
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
        return TVMazeService.get_series_detail(series_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch series detail: {str(e)}"
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
                
                        # Agregamos los resultados asegurandonos de no duplicar
            existing_ids = set([str(i.external_id) for i in for_you])
            existing_titles = set([i.title.lower() for i in for_you])
            added_count = 0
            for res in results:
                if str(res.external_id) not in existing_ids and res.title.lower() not in existing_titles:
                    for_you.append(res)
                    existing_ids.add(str(res.external_id))
                    existing_titles.add(res.title.lower())
                    added_count += 1
                if added_count >= 10:
                    break
        except Exception as e:
            print(f"Error en fallback de recomendaciones: {e}")
            
    # Si sigue estando muy vacío, le sumamos las tendencias
    if len(for_you) < 5:
        for t in trending:
            for_you.append(t)
            
    # De-duplicar "Para ti"
    seen = set()
    final_for_you = []
    for item in for_you:
        if item.external_id not in seen:
            seen.add(item.external_id)
            final_for_you.append(item)

    return RecommendationResponse(
        for_you=final_for_you,
        trending=trending,
        featured_guides=featured_guides
    )
