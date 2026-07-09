from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class ItemProgress(Base):
    __tablename__ = "item_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_item_id = Column(Integer, ForeignKey("list_items.id", ondelete="CASCADE"), nullable=True)
    addition_item_id = Column(Integer, ForeignKey("list_addition_items.id", ondelete="CASCADE"), nullable=True)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_skipped = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="progress_records")
    list_item = relationship("ListItem", back_populates="progress_records")
    addition_item = relationship("ListAdditionItem", back_populates="progress_records")

    # Enforce uniqueness for user item combinations
    __table_args__ = (
        UniqueConstraint("user_id", "list_item_id", name="uq_user_item_progress"),
        UniqueConstraint("user_id", "addition_item_id", name="uq_user_addition_item_progress"),
    )
