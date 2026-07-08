from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class ItemProgress(Base):
    __tablename__ = "item_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_item_id = Column(Integer, ForeignKey("list_items.id", ondelete="CASCADE"), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="progress_records")
    list_item = relationship("ListItem", back_populates="progress_records")

    # Enforce uniqueness for the combination of user and list item
    __table_args__ = (
        UniqueConstraint("user_id", "list_item_id", name="uq_user_item_progress"),
    )
