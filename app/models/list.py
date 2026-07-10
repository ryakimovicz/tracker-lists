import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class VisibilityEnum(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"
    DRAFT = "draft"

class ReadingList(Base):
    __tablename__ = "reading_lists"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(Enum(VisibilityEnum), default=VisibilityEnum.PUBLIC, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Custom importance levels naming and defaults mapping
    importance_labels = Column(JSON, nullable=True, default=lambda: {"1": "Optional", "2": "Recommended", "3": "Highly Recommended", "4": "Mandatory", "5": "Essential"})
    section_importances = Column(JSON, nullable=True, default=dict)
    section_descriptions = Column(JSON, nullable=True, default=dict)

    # Relationships
    creator = relationship("User", back_populates="lists")
    items = relationship("ListItem", back_populates="reading_list", cascade="all, delete-orphan", order_by="ListItem.order_index")
    saved_by_users = relationship("SavedList", back_populates="reading_list", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="reading_list", cascade="all, delete-orphan")
    votes = relationship("ListVote", backref="reading_list", cascade="all, delete-orphan")
