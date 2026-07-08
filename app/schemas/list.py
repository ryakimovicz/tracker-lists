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

class ListItemCreate(ListItemBase):
    pass

class ListItemResponse(ListItemBase):
    id: int
    list_id: int

    class Config:
        from_attributes = True

class ListItemProgressResponse(ListItemResponse):
    is_completed: bool = False

# Reading List schemas
class ReadingListBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    visibility: VisibilityEnum = VisibilityEnum.PUBLIC

class ReadingListCreate(ReadingListBase):
    pass

class ReadingListUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[VisibilityEnum] = None

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
    total_count: int = 0
    progress_percentage: float = 0.0
    items: List[ListItemProgressResponse] = []
