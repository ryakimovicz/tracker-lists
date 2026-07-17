from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base
from app.models.list_item import ItemTypeEnum

class ReportStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class MediaCoverReport(Base):
    __tablename__ = "media_cover_reports"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(SQLEnum(ItemTypeEnum), nullable=False, index=True)
    external_id = Column(String(100), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(ReportStatusEnum), default=ReportStatusEnum.PENDING, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    reporter = relationship("User")
