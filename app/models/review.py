from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class MediaReview(Base):
    __tablename__ = "media_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(50), nullable=False)  # comic, manga, book, movie, series, game
    external_id = Column(String(100), nullable=False)
    rating = Column(Integer, nullable=True)  # 1 to 5 stars
    content = Column(Text, nullable=True)     # Review commentary text
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="media_reviews")
    votes = relationship("MediaReviewVote", back_populates="review", cascade="all, delete-orphan")
    reports = relationship("MediaReviewReport", back_populates="review", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "external_id", name="uq_user_item_review"),
    )

class MediaReviewVote(Base):
    __tablename__ = "media_review_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    review_id = Column(Integer, ForeignKey("media_reviews.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    review = relationship("MediaReview", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("user_id", "review_id", name="uq_user_review_vote"),
    )

class MediaReviewReport(Base):
    __tablename__ = "media_review_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    review_id = Column(Integer, ForeignKey("media_reviews.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(250), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    review = relationship("MediaReview", back_populates="reports")
