from sqlalchemy import Column, Integer, String, Text, Float
from app.core.database import Base

class ExploreGlobalCache(Base):
    """
    Persistent global cache for Explore catalog tabs (Novedades & Tendencias).
    Shared across all users, server restarts, and multiple workers so external API
    quotas are never consumed per user request.
    """
    __tablename__ = "explore_global_cache"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(100), unique=True, index=True, nullable=False)
    payload_json = Column(Text, nullable=False)
    updated_at = Column(Float, nullable=False)
