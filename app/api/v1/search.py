from typing import List
from fastapi import APIRouter, Query, HTTPException, status, Request, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
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
    type: str = Query("movie", description="The type of media to search for")
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
    db: Session = Depends(get_db)
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

@router.get("/series/{series_id}/season/{season_number}")
def get_series_season_episodes(
    series_id: int,
    season_number: int
):
    try:
        return TVMazeService.get_season_episodes(series_id, season_number)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch season episodes: {str(e)}"
        )

@router.get("/series/{series_id}")
def get_series_detail(
    series_id: int
):
    try:
        return TVMazeService.get_series_detail(series_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch series detail: {str(e)}"
        )
