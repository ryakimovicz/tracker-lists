import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class VisibilityEnum(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"

class ReadingList(Base):
    __tablename__ = "reading_lists"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(Enum(VisibilityEnum), default=VisibilityEnum.PUBLIC, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    creator = relationship("User", back_populates="lists")
    items = relationship("ListItem", back_populates="reading_list", cascade="all, delete-orphan", order_by="ListItem.order_index")
    saved_by_users = relationship("SavedList", back_populates="reading_list", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="reading_list", cascade="all, delete-orphan")
    votes = relationship("ListVote", backref="reading_list", cascade="all, delete-orphan")
