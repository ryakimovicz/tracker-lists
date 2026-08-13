from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base

class TranslationCache(Base):
    __tablename__ = "translation_cache"

    id = Column(Integer, primary_key=True, index=True)
    text_hash = Column(String(64), index=True, nullable=False)
    translated_text = Column(Text, nullable=False)
    target_language = Column(String(10), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_translation_cache_hash_lang', 'text_hash', 'target_language', unique=True),
    )
