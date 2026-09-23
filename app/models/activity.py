from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    item_title = Column(String(250), nullable=True)
    item_type = Column(String(50), nullable=True)
    external_id = Column(String(100), nullable=True)
    list_id = Column(Integer, nullable=True)
    image_url = Column(String(500), nullable=True)
    details = Column(String(500), nullable=True)
    entity_id = Column(String(100), nullable=True, index=True)
    metadata_json = Column(String(2000), nullable=True)
    is_hidden = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    user = relationship("User", backref="activity_logs")
