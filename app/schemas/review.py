from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class MediaReviewCreate(BaseModel):
    rating: Optional[float] = Field(None, ge=0.5, le=5.0, description="Rating from 0.5 to 5.0 stars")
    content: Optional[str] = Field(None, description="Optional text commentary review")
    media_url: Optional[str] = Field(None, description="Optional attached media/GIF URL")
    media_type: Optional[str] = Field(None, description="Optional media type (gif, sticker, meme, clip)")
    parent_id: Optional[int] = Field(None, description="Parent review ID if this is a reply")
    is_comment: Optional[bool] = Field(False, description="True if this is a community comment, not an official review")
    item_title: Optional[str] = Field(None, description="Resolved title of the item or episode/issue")
    image_url: Optional[str] = Field(None, description="Resolved image/poster/cover URL")
    metadata_json: Optional[str] = Field(None, description="Optional JSON metadata dictionary for episodes/issues")

class MediaReviewResponse(BaseModel):
    id: int
    user_id: int
    username: str
    photo_url: Optional[str] = None
    item_type: str
    external_id: str
    rating: Optional[float] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    parent_id: Optional[int] = None
    is_edited: Optional[datetime] = None
    is_deleted: bool = False
    created_at: datetime
    vote_count: int = 0
    is_voted_by_me: bool = False

    class Config:
        from_attributes = True

class ReviewReportCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=250)
