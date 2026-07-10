from typing import Optional
from pydantic import BaseModel
from app.models.library import UserLibraryStatusEnum
from datetime import datetime

class LibraryItemCreate(BaseModel):
    item_type: str
    external_id: str
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum = UserLibraryStatusEnum.PLAN_TO_READ
    is_favorite: Optional[bool] = False
    completed_at: Optional[datetime] = None
    pages_read: Optional[int] = 0

class LibraryItemUpdate(BaseModel):
    status: Optional[UserLibraryStatusEnum] = None
    is_favorite: Optional[bool] = None
    completed_at: Optional[datetime] = None
    last_seen_episode: Optional[str] = None
    pages_read: Optional[int] = None

class LibraryItemResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    external_id: str
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum
    is_favorite: bool = False
    completed_at: Optional[datetime] = None
    updated_at: datetime
    last_seen_episode: Optional[str] = None
    pages_read: int = 0
    tracking_list_id: Optional[int] = None

    class Config:
        from_attributes = True
