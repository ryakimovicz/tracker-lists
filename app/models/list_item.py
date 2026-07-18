import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class ItemTypeEnum(str, enum.Enum):
    ANIME = "anime"
    MANGA = "manga"
    BOOK = "book"
    MOVIE = "movie"
    SERIES = "series"
    GAME = "game"
    CUSTOM = "custom"

class ListItem(Base):
    __tablename__ = "list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    item_type = Column(Enum(ItemTypeEnum), default=ItemTypeEnum.CUSTOM, nullable=False)
    external_id = Column(String(100), nullable=True)  # Nullable for manual/custom items
    title = Column(String(250), nullable=False)        # Item title
    image_url = Column(String(500), nullable=True)     # Portada/Image URL
    custom_notes = Column(Text, nullable=True)         # Personal commentary/notes
    section = Column(String(100), nullable=True)      # Nullable section/part name (e.g., 'Parte 1: El Origen')
    importance_rank = Column(Integer, nullable=True)  # Priority level override (1 to 5)

    # Relationships
    reading_list = relationship("ReadingList", back_populates="items")
    progress_records = relationship("ItemProgress", back_populates="list_item", cascade="all, delete-orphan")
