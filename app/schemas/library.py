from typing import Optional
from pydantic import BaseModel
from app.models.library import UserLibraryStatusEnum
from datetime import datetime

class LibraryItemCreate(BaseModel):
    item_type: str
    external_id: str
    imdb_id: Optional[str] = None
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum = UserLibraryStatusEnum.PLAN_TO_READ
    is_favorite: Optional[bool] = False
    favorite_order: Optional[int] = 0
    is_hundred_percent: Optional[bool] = False
    completed_at: Optional[datetime] = None
    custom_badge: Optional[str] = None
    pages_read: Optional[int] = 0
    total_pages: Optional[int] = None
    release_date: Optional[str] = None

class LibraryItemUpdate(BaseModel):
    status: Optional[UserLibraryStatusEnum] = None
    is_favorite: Optional[bool] = None
    favorite_order: Optional[int] = None
    is_hundred_percent: Optional[bool] = None
    completed_at: Optional[datetime] = None
    last_seen_episode: Optional[str] = None
    custom_badge: Optional[str] = None
    pages_read: Optional[int] = None
    total_pages: Optional[int] = None
    release_date: Optional[str] = None

class LibraryItemResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    external_id: str
    imdb_id: Optional[str] = None
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum
    is_favorite: bool = False
    favorited_at: Optional[datetime] = None
    favorite_order: Optional[int] = 0
    is_hundred_percent: bool = False
    completed_at: Optional[datetime] = None
    updated_at: datetime
    last_seen_episode: Optional[str] = None
    custom_badge: Optional[str] = None
    pages_read: int
    total_pages: Optional[int] = None
    release_date: Optional[str] = None
    tracking_list_id: Optional[int] = None
    times_completed: Optional[int] = 1
    times_completed_standard: Optional[int] = 1
    times_completed_hundred: Optional[int] = 0
    last_seen_episode_count: Optional[int] = 1
    completed_episodes_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ReorderFavoritesRequest(BaseModel):
    item_ids: list[int]
