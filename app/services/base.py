from pydantic import BaseModel
from typing import Dict, List, Optional

class SearchResultItem(BaseModel):
    external_id: str
    title: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    item_type: str  # 'manga', 'comic', etc.
    release_date: Optional[str] = None
    popularity: Optional[float] = 0.0
    imdb_id: Optional[str] = None
    status: Optional[str] = None
    page_count: Optional[int] = None
    latest_season: Optional[int] = None
    latest_episode: Optional[int] = None
    badge: Optional[str] = None
    description_source: Optional[str] = None
    image_source: Optional[str] = None
    cv_id: Optional[str] = None
    metron_id: Optional[str] = None
    creator: Optional[str] = None
    volumes: Optional[int] = None
    chapters: Optional[int] = None
    covers: Optional[List[str]] = None
    media_type_counts: Optional[Dict[str, int]] = None
    accent_color: Optional[str] = None
    banner_url: Optional[str] = None
    items_count: Optional[int] = None
    saves_count: Optional[int] = None
    average_rating: Optional[float] = None
    creator_photo_url: Optional[str] = None

