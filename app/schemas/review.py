from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class MediaReviewCreate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating from 1 to 5 stars")
    content: Optional[str] = Field(None, description="Optional text commentary review")
    media_url: Optional[str] = Field(None, description="Optional attached media/GIF URL")
    media_type: Optional[str] = Field(None, description="Optional media type (gif, sticker, meme, clip)")
    parent_id: Optional[int] = Field(None, description="Parent review ID if this is a reply")

class MediaReviewResponse(BaseModel):
    id: int
    user_id: int
    username: str
    photo_url: Optional[str] = None
    item_type: str
    external_id: str
    rating: Optional[int] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    parent_id: Optional[int] = None
    is_edited: Optional[datetime] = None
    created_at: datetime
    vote_count: int = 0
    is_voted_by_me: bool = False

    class Config:
        from_attributes = True

class ReviewReportCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=250)
