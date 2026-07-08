from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class SavedList(Base):
    __tablename__ = "saved_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    saved_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="saved_lists")
    reading_list = relationship("ReadingList", back_populates="saved_by_users")

    # Enforce that a user can save a specific list only once
    __table_args__ = (
        UniqueConstraint("user_id", "list_id", name="uq_user_saved_list"),
    )
