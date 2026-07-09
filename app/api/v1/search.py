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
