from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class ListVote(Base):
    __tablename__ = "list_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, default=5, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "list_id", name="uq_user_list_vote"),
    )

class ListReport(Base):
    __tablename__ = "list_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    reading_list = relationship("ReadingList")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="comments")
    reading_list = relationship("ReadingList", back_populates="comments")
    votes = relationship("CommentVote", backref="comment", cascade="all, delete-orphan")
    replies = relationship("Comment", cascade="all, delete-orphan")

class CommentVote(Base):
    __tablename__ = "comment_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_user_comment_vote"),
    )

class CommentReport(Base):
    __tablename__ = "comment_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    comment = relationship("Comment")

class Follow(Base):
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("follower_id", "followed_id", name="uq_follower_followed"),
    )

class MediaItemReport(Base):
    __tablename__ = "media_item_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(50), nullable=False)  # movie, series, anime, book, comic, manga, game
    external_id = Column(String(100), nullable=False)
    title = Column(String(255), nullable=True)
    image_url = Column(String(500), nullable=True)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")

class BlockedMediaItem(Base):
    __tablename__ = "blocked_media_items"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(50), nullable=False)  # movie, series, anime, book, comic, manga, game
    external_id = Column(String(100), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=True)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class BlockedFranchise(Base):
    """
    Stores blocked sagas, magazines, volumes or publishers (by ID and name)
    to filter out entire series across search and new releases.
    """
    __tablename__ = "blocked_franchises"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String(50), nullable=False)  # 'volume' (saga/revista), 'publisher' (editorial), 'author', 'franchise'
    target_id = Column(String(100), nullable=False, index=True)  # e.g., 'cv_vol_88907', 'cv_pub_7358'
    name = Column(String(255), nullable=False)
    item_type = Column(String(50), default="comic", nullable=False)  # comic, manga, anime, etc.
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# --- 0.9.9 Social & Notifications System ---

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(50), nullable=False)  # 'activity_like', 'activity_comment', 'comment_reply', 'new_follower', 'follow_request', 'mention'
    entity_type = Column(String(50), nullable=True)  # 'activity', 'review', 'user', 'guide'
    entity_id = Column(String(100), nullable=True)
    extra_data_json = Column(String(1000), nullable=True)
    is_read = Column(DateTime(timezone=True), nullable=True)  # Null if unread, timestamp if read
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    recipient = relationship("User", foreign_keys=[recipient_id])
    actor = relationship("User", foreign_keys=[actor_id])


class ActivityLike(Base):
    __tablename__ = "activity_likes"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("user_activity_logs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
    activity = relationship("UserActivityLog", backref="likes")

    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_activity_user_like"),
    )


class ActivityComment(Base):
    __tablename__ = "activity_comments"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("user_activity_logs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("activity_comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=True)
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(50), nullable=True)  # 'gif', 'meme', 'sticker', 'clip', 'emoji'
    audio_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
    activity = relationship("UserActivityLog", backref="comments")
    replies = relationship("ActivityComment", cascade="all, delete-orphan")
    votes = relationship("ActivityCommentVote", backref="comment", cascade="all, delete-orphan")


class ActivityCommentVote(Base):
    __tablename__ = "activity_comment_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(Integer, ForeignKey("activity_comments.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_activity_comment_vote"),
    )


class FollowRequest(Base):
    __tablename__ = "follow_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    requester = relationship("User", foreign_keys=[requester_id])
    target = relationship("User", foreign_keys=[target_id])

    __table_args__ = (
        UniqueConstraint("requester_id", "target_id", name="uq_follow_request"),
    )

