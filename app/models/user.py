from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    lists = relationship("ReadingList", back_populates="creator", cascade="all, delete-orphan")
    saved_lists = relationship("SavedList", back_populates="user", cascade="all, delete-orphan")
    progress_records = relationship("ItemProgress", back_populates="user", cascade="all, delete-orphan")
