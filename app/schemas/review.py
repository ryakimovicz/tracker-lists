from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class MediaReviewCreate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating from 1 to 5 stars")
    content: Optional[str] = Field(None, description="Optional text commentary review")

class MediaReviewResponse(BaseModel):
    id: int
    user_id: int
    username: str
    item_type: str
    external_id: str
    rating: Optional[int]
    content: Optional[str]
    created_at: datetime
    vote_count: int = 0
    is_voted_by_me: bool = False

    class Config:
        from_attributes = True

class ReviewReportCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=250)
