from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(50), nullable=False) # status_change, item_progress
    item_title = Column(String(250), nullable=True)
    item_type = Column(String(50), nullable=True)
    external_id = Column(String(100), nullable=True)
    list_id = Column(Integer, nullable=True)
    image_url = Column(String(500), nullable=True)
    details = Column(String(250), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", backref="activity_logs")
