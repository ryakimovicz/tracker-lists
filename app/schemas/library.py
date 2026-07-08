from typing import Optional
from pydantic import BaseModel
from app.models.library import UserLibraryStatusEnum

class LibraryItemCreate(BaseModel):
    item_type: str
    external_id: str
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum = UserLibraryStatusEnum.PLAN_TO_READ

class LibraryItemUpdate(BaseModel):
    status: UserLibraryStatusEnum

class LibraryItemResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    external_id: str
    title: str
    image_url: Optional[str] = None
    status: UserLibraryStatusEnum
    tracking_list_id: Optional[int] = None

    class Config:
        from_attributes = True
