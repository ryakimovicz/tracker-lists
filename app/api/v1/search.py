from typing import List
from fastapi import APIRouter, Query, HTTPException, status, Request, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.services.base import SearchResultItem
from app.services.comicvine import ComicVineService
from app.services.tmdb import TMDBService
from app.services.googlebooks import GoogleBooksService
from app.services.rawg import RAWGService
from app.services.anilist import AniListService
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
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_books = executor.submit(GoogleBooksService.search_books, q)
            future_comics = executor.submit(ComicVineService.search_comics, q)
            books_res = future_books.result()
            comics_res = future_comics.result()
            
        combined = []
        if books_res:
            combined.extend(books_res)
        if comics_res:
            combined.extend(comics_res)
            
        # Re-sort combined results by score since they were fetched separately
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
    elif type_lower == "game":
        return RAWGService.search_games(q)
    elif type_lower == "movie":
        return TMDBService.search_media(q, "movie")
    elif type_lower == "series":
        combined = TMDBService.search_media(q, "series")
        
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
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_movies = executor.submit(TMDBService.search_media, q, "movie")
        future_series = executor.submit(TMDBService.search_media, q, "series")
        future_books = executor.submit(GoogleBooksService.search_books, q)
        future_games = executor.submit(RAWGService.search_games, q)
        future_comics = executor.submit(ComicVineService.search_comics, q)
        
        movies = future_movies.result()
        series = future_series.result()
        books = future_books.result()
        games = future_games.result()
        comics = future_comics.result()
        
    combined = []
    combined.extend(movies)
    combined.extend(series)
    combined.extend(books)
    combined.extend(games)
    combined.extend(comics)

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
        return TMDBService.get_season_episodes(series_id, season_number)
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
        return TMDBService.get_series_detail(series_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch series detail: {str(e)}"
        )
