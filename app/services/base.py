from pydantic import BaseModel
from typing import Optional

class SearchResultItem(BaseModel):
    external_id: str
    title: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    item_type: str  # 'manga', 'comic', etc.
    release_date: Optional[str] = None
    popularity: Optional[float] = 0.0
    imdb_id: Optional[str] = None
