from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reset_token = Column(String(250), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    refresh_token = Column(String(250), nullable=True)
    lastfm_username = Column(String(100), nullable=True)
    lastfm_session_key = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    show_nsfw = Column(Boolean, default=False, nullable=False)

    # Relationships
    lists = relationship("ReadingList", back_populates="creator", cascade="all, delete-orphan")
    saved_lists = relationship("SavedList", back_populates="user", cascade="all, delete-orphan")
    progress_records = relationship("ItemProgress", back_populates="user", cascade="all, delete-orphan")

    @property
    def photo_url(self) -> str:
        import hashlib
        email_hash = hashlib.md5(self.email.strip().lower().encode("utf-8")).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=identicon"
