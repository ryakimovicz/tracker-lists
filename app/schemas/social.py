from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class ListRatingCreate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)

class ListRatingResponse(BaseModel):
    user_rating: Optional[int] = None
    average_rating: Optional[float] = None
    total_ratings: int = 0

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[int] = None

class CommentResponse(BaseModel):
    id: int
    user_id: int
    list_id: int
    parent_id: Optional[int] = None
    content: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    creator_username: str
    photo_url: Optional[str] = None
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
    user_photo_url: Optional[str] = None
    activity_type: str
    item_title: Optional[str] = None
    item_type: Optional[str] = None
    external_id: Optional[str] = None
    list_id: Optional[int] = None
    image_url: Optional[str] = None
    details: Optional[str] = None
    metadata_json: Optional[str] = None
    is_hidden: bool = False
    likes_count: int = 0
    is_liked_by_me: bool = False
    comments_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class ActivityLikeToggleResponse(BaseModel):
    liked: bool
    likes_count: int

class ActivityCommentCreate(BaseModel):
    content: Optional[str] = Field(None, max_length=1500)
    parent_id: Optional[int] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # 'gif', 'meme', 'sticker', 'clip', 'emoji'
    audio_url: Optional[str] = None

class ActivityCommentResponse(BaseModel):
    id: int
    activity_id: int
    user_id: int
    username: str
    photo_url: Optional[str] = None
    parent_id: Optional[int] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    audio_url: Optional[str] = None
    is_deleted: bool = False
    votes_count: int = 0
    is_voted_by_me: bool = False
    created_at: datetime
    replies: List["ActivityCommentResponse"] = []

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    actor_id: int
    actor_username: str
    actor_photo_url: Optional[str] = None
    notification_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    extra_data_json: Optional[str] = None
    is_read: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class FollowRequestResponse(BaseModel):
    id: int
    requester_id: int
    requester_username: str
    requester_photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UpNextItemResponse(BaseModel):
    item_id: int
    list_id: int
    list_title: str
    order_index: int
    item_type: str
    external_id: Optional[str] = None
    title: str
    image_url: Optional[str] = None
    custom_notes: Optional[str] = None
    section: Optional[str] = None
    is_addition: bool = False
    addition_id: Optional[int] = None
    addition_item_id: Optional[int] = None

    class Config:
        from_attributes = True

class UpNextResponse(BaseModel):
    guides: List[UpNextItemResponse] = []
    personal: List[UpNextItemResponse] = []
