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
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
