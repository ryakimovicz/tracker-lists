from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.list_item import ItemTypeEnum

class ListAdditionItemCreate(BaseModel):
    after_item_id: Optional[int] = None
    item_type: ItemTypeEnum = ItemTypeEnum.CUSTOM
    external_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=250)
    image_url: Optional[str] = None
    custom_notes: Optional[str] = None
    section: Optional[str] = None
    order_index: int = 0

class ListAdditionItemResponse(BaseModel):
    id: int
    addition_id: int
    after_item_id: Optional[int]
    item_type: ItemTypeEnum
    external_id: Optional[str]
    title: str
    image_url: Optional[str]
    custom_notes: Optional[str]
    section: Optional[str]
    order_index: int

    class Config:
        from_attributes = True

class ListAdditionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    is_shared: bool = False

class ListAdditionResponse(BaseModel):
    id: int
    list_id: int
    user_id: int
    username: str
    title: str
    description: Optional[str]
    is_shared: bool
    created_at: datetime
    vote_count: int = 0
    is_voted_by_me: bool = False
    items: List[ListAdditionItemResponse] = []

    class Config:
        from_attributes = True

class AdditionCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)

class AdditionCommentResponse(BaseModel):
    id: int
    user_id: int
    username: str
    addition_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
