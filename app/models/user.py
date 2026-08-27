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
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(250), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reset_token = Column(String(250), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    refresh_token = Column(String(250), nullable=True)

    lastfm_username = Column(String(100), nullable=True)
    lastfm_session_key = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    show_nsfw = Column(Boolean, default=False, nullable=False)
    is_pro = Column(Boolean, default=False, nullable=False)
    is_vip = Column(Boolean, default=False, nullable=False)
    pro_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_suspended = Column(Boolean, default=False, nullable=False)
    suspended_until = Column(DateTime(timezone=True), nullable=True)
    suspension_reason = Column(String(500), nullable=True)
    admin_warning = Column(String(500), nullable=True)
    admin_warning_at = Column(DateTime(timezone=True), nullable=True)
    dodo_subscription_id = Column(String(100), nullable=True)
    dodo_customer_id = Column(String(100), nullable=True)
    profile_color = Column(String(20), nullable=True)
    custom_photo_url = Column(String(500), nullable=True)

    custom_banner_url = Column(String(500), nullable=True)
    custom_background_url = Column(String(500), nullable=True)

    # Relationships

    lists = relationship("ReadingList", back_populates="creator", cascade="all, delete-orphan")
    saved_lists = relationship("SavedList", back_populates="user", cascade="all, delete-orphan")
    progress_records = relationship("ItemProgress", back_populates="user", cascade="all, delete-orphan")

    @property
    def photo_url(self) -> str:
        if self.custom_photo_url:
            return self.custom_photo_url
        import hashlib
        email_hash = hashlib.md5(self.email.strip().lower().encode("utf-8")).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=identicon"

    @photo_url.setter
    def photo_url(self, value: str | None):
        self.custom_photo_url = value

    @property
    def banner_url(self) -> str | None:
        return self.custom_banner_url

    @banner_url.setter
    def banner_url(self, value: str | None):
        self.custom_banner_url = value

    @property
    def background_url(self) -> str | None:
        return self.custom_background_url

    @background_url.setter
    def background_url(self, value: str | None):
        self.custom_background_url = value



