from typing import List
from fastapi import APIRouter, Query, HTTPException, status, Request
from app.services.base import SearchResultItem
from app.services.mangadex import MangaDexService
from app.services.comicvine import ComicVineService
from app.services.tmdb import TMDBService
from app.services.googlebooks import GoogleBooksService
from app.services.rawg import RAWGService
from app.core.limiter import limiter

router = APIRouter()

@router.get("/", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    type: str = Query(..., description="The media type: 'comic', 'manga', 'book', 'game', 'movie' or 'series'")
):
    type_lower = type.lower()
    if type_lower == "manga":
        return MangaDexService.search_manga(q)
    elif type_lower == "comic":
        return ComicVineService.search_comics(q)
    elif type_lower == "book":
        return GoogleBooksService.search_books(q)
    elif type_lower == "game":
        return RAWGService.search_games(q)
    elif type_lower in ("movie", "series"):
        return TMDBService.search_media(q, type_lower)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search type. Must be 'comic', 'manga', 'book', 'game', 'movie' or 'series'."
        )

@router.get("/all", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_all_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term")
):
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        future_movies = executor.submit(TMDBService.search_media, q, "movie")
        future_series = executor.submit(TMDBService.search_media, q, "series")
        future_books = executor.submit(GoogleBooksService.search_books, q)
        future_games = executor.submit(RAWGService.search_games, q)
        future_mangas = executor.submit(MangaDexService.search_manga, q)
        future_comics = executor.submit(ComicVineService.search_comics, q)
        
        movies = future_movies.result()
        series = future_series.result()
        books = future_books.result()
        games = future_games.result()
        mangas = future_mangas.result()
        comics = future_comics.result()
        
    combined = []
    combined.extend(movies)
    combined.extend(series)
    combined.extend(books)
    combined.extend(games)
    combined.extend(mangas)
    combined.extend(comics)
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
