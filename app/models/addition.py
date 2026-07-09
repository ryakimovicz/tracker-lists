from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime, UniqueConstraint, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.list_item import ItemTypeEnum

class ListAddition(Base):
    __tablename__ = "list_additions"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    is_shared = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    reading_list = relationship("ReadingList", backref="additions")
    user = relationship("User", backref="additions_created")
    items = relationship("ListAdditionItem", back_populates="addition", cascade="all, delete-orphan")
    votes = relationship("AdditionVote", back_populates="addition", cascade="all, delete-orphan")
    comments = relationship("AdditionComment", back_populates="addition", cascade="all, delete-orphan")

class ListAdditionItem(Base):
    __tablename__ = "list_addition_items"

    id = Column(Integer, primary_key=True, index=True)
    addition_id = Column(Integer, ForeignKey("list_additions.id", ondelete="CASCADE"), nullable=False)
    after_item_id = Column(Integer, ForeignKey("list_items.id", ondelete="SET NULL"), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    item_type = Column(Enum(ItemTypeEnum), default=ItemTypeEnum.CUSTOM, nullable=False)
    external_id = Column(String(100), nullable=True)
    title = Column(String(250), nullable=False)
    image_url = Column(String(500), nullable=True)
    custom_notes = Column(Text, nullable=True)
    section = Column(String(100), nullable=True)

    # Relationships
    addition = relationship("ListAddition", back_populates="items")
    progress_records = relationship("ItemProgress", back_populates="addition_item", cascade="all, delete-orphan")

class UserAdoptedAddition(Base):
    __tablename__ = "user_adopted_additions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    addition_id = Column(Integer, ForeignKey("list_additions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="adopted_additions")
    addition = relationship("ListAddition", backref="adoptions")

    __table_args__ = (
        UniqueConstraint("user_id", "addition_id", name="uq_user_adopted_addition"),
    )

class AdditionVote(Base):
    __tablename__ = "addition_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    addition_id = Column(Integer, ForeignKey("list_additions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    addition = relationship("ListAddition", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("user_id", "addition_id", name="uq_user_addition_vote"),
    )

class AdditionComment(Base):
    __tablename__ = "addition_comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    addition_id = Column(Integer, ForeignKey("list_additions.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    addition = relationship("ListAddition", back_populates="comments")
