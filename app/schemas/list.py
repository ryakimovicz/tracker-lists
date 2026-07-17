from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.list import VisibilityEnum
from app.models.list_item import ItemTypeEnum

class ListItemBase(BaseModel):
    order_index: int = 0
    item_type: ItemTypeEnum = ItemTypeEnum.CUSTOM
    external_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=250)
    image_url: Optional[str] = None
    custom_notes: Optional[str] = None
    section: Optional[str] = None
    importance_rank: Optional[int] = Field(None, ge=1, le=5)

class ListItemCreate(ListItemBase):
    pass

class ListItemUpdate(BaseModel):
    title: Optional[str] = None
    custom_notes: Optional[str] = None
    section: Optional[str] = None
    order_index: Optional[int] = None
    importance_rank: Optional[int] = Field(None, ge=1, le=5)

class ListItemResponse(ListItemBase):
    id: int
    list_id: int
    is_nsfw: bool = False

    class Config:
        from_attributes = True

class ListItemProgressResponse(ListItemResponse):
    is_completed: bool = False
    is_skipped: bool = False
    is_addition: bool = False
    addition_id: Optional[int] = None
    addition_item_id: Optional[int] = None
    inherited_importance_rank: Optional[int] = None

# Reading List schemas
class ReadingListBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    visibility: VisibilityEnum = VisibilityEnum.PUBLIC
    importance_labels: Optional[dict] = None
    section_importances: Optional[dict] = None
    section_descriptions: Optional[dict] = None

class ReadingListCreate(ReadingListBase):
    pass

class ReadingListUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[VisibilityEnum] = None
    importance_labels: Optional[dict] = None
    section_importances: Optional[dict] = None
    section_descriptions: Optional[dict] = None

class ReadingListResponse(ReadingListBase):
    id: int
    creator_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ReadingListDetailsResponse(ReadingListResponse):
    creator_username: str
    is_saved_by_me: bool = False
    completed_count: int = 0
    skipped_count: int = 0
    total_count: int = 0
    progress_percentage: float = 0.0
    skipped_percentage: float = 0.0
    items: List[ListItemProgressResponse] = []

import enum
class TVImportType(str, enum.Enum):
    SERIES = "series"
    SEASON = "season"
    EPISODE = "episode"

class TVImportRequest(BaseModel):
    series_id: str
    import_type: TVImportType
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    starting_order_index: int = 0

class SectionBulkActionRequest(BaseModel):
    section_name: str
    action: str # "skip", "unskip", "complete", "uncomplete"

class BulkToggleRequest(BaseModel):
    item_ids: List[int]
    completed: bool

class ToggleTMDBEpisodeRequest(BaseModel):
    tmdb_episode_id: int
    title: str
    image_url: Optional[str] = None
    overview: Optional[str] = None
    season_number: int
    episode_number: int

class BulkToggleSeasonRequest(BaseModel):
    season_number: int
    episodes: Optional[List[dict]] = None
    completed: bool

