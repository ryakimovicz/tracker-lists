from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)

class CommentResponse(BaseModel):
    id: int
    user_id: int
    list_id: int
    content: str
    created_at: datetime
    creator_username: str
    vote_count: int = 0
    is_voted_by_me: bool = False

    class Config:
        from_attributes = True

class ReportCreate(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)

class ActivityFeedItemResponse(BaseModel):
    id: int
    user_id: int
    username: str
    activity_type: str
    item_title: Optional[str] = None
    item_type: Optional[str] = None
    external_id: Optional[str] = None
    list_id: Optional[int] = None
    image_url: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UpNextItemResponse(BaseModel):
    item_id: int
    list_id: int
    list_title: str
    order_index: int
    item_type: str
    title: str
    image_url: Optional[str] = None
    section: Optional[str] = None
    is_addition: bool = False
    addition_id: Optional[int] = None
    addition_item_id: Optional[int] = None

    class Config:
        from_attributes = True

class UpNextResponse(BaseModel):
    guides: List[UpNextItemResponse] = []
    personal: List[UpNextItemResponse] = []
