from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConsumptionHistory(Base):
    __tablename__ = "consumption_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Identify what was consumed
    item_type = Column(String(50), nullable=False)
    external_id = Column(String(100), nullable=True)
    list_item_id = Column(Integer, ForeignKey("list_items.id", ondelete="CASCADE"), nullable=True)
    
    # When it was consumed
    consumed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    is_hundred_percent = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", backref="consumptions")
    list_item = relationship("ListItem", backref="consumptions")
