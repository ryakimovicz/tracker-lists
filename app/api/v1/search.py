from typing import List
from fastapi import APIRouter, Query, HTTPException, status
from app.services.base import SearchResultItem
from app.services.mangadex import MangaDexService
from app.services.comicvine import ComicVineService

router = APIRouter()

@router.get("/", response_model=List[SearchResultItem])
def search_media(
    q: str = Query(..., min_length=1, description="The search query term"),
    type: str = Query(..., description="The media type: 'comic' or 'manga'")
):
    type_lower = type.lower()
    if type_lower == "manga":
        return MangaDexService.search_manga(q)
    elif type_lower == "comic":
        return ComicVineService.search_comics(q)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search type. Must be 'comic' or 'manga'."
        )
