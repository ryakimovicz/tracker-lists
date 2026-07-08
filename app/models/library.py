import enum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserLibraryStatusEnum(str, enum.Enum):
    PLAN_TO_WATCH = "plan_to_watch"
    WATCHING = "watching"
    COMPLETED = "completed"
    DROPPED = "dropped"
    PLAN_TO_READ = "plan_to_read"
    READING = "reading"
    READ = "read"
    PLAN_TO_PLAY = "plan_to_play"
    PLAYING = "playing"

class UserLibraryItem(Base):
    __tablename__ = "user_library_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(50), nullable=False)  # comic, manga, book, movie, series, custom
    external_id = Column(String(100), nullable=False)
    title = Column(String(250), nullable=False)
    image_url = Column(String(500), nullable=True)
    status = Column(Enum(UserLibraryStatusEnum), default=UserLibraryStatusEnum.PLAN_TO_READ, nullable=False)
    tracking_list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    user = relationship("User", backref="library_items")
    tracking_list = relationship("ReadingList", backref="library_association")

    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "external_id", name="uq_user_media_item"),
    )
