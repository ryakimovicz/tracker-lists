from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)

class UserResponse(UserBase):
    id: int
    created_at: datetime
    photo_url: str
    is_admin: bool = False
    lastfm_username: str | None = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: int | None = None

from typing import List
from app.schemas.list import ReadingListResponse

class UserDashboardResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime
    photo_url: str
    is_admin: bool = False
    lastfm_username: str | None = None
    created_lists: List[ReadingListResponse] = []
    saved_lists: List[ReadingListResponse] = []

    class Config:
        from_attributes = True
