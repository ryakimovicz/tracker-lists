import time
import threading
from typing import Dict, List, Optional, Tuple, Any

class PopularCacheManager:
    """
    Thread-safe in-memory cache manager for popular, trending, and explore works.
    Maintains TTL-based caches and provides graceful stale fallbacks when external APIs
    are down or throttled.
    """
    def __init__(self, default_ttl: float = 14400.0):  # 4 hours
        self.default_ttl = default_ttl
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._stale_backup: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            if key in self._cache:
                timestamp, data = self._cache[key]
                if now - timestamp < self.default_ttl:
                    return data
            # Return stale backup if present as graceful degradation
            if key in self._stale_backup:
                return self._stale_backup[key]
        return None

    def set(self, key: str, data: Any, ttl: Optional[float] = None) -> None:
        if not data:
            return
        now = time.time()
        with self._lock:
            self._cache[key] = (now, data)
            self._stale_backup[key] = data

    def clear(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._stale_backup.pop(key, None)
            else:
                self._cache.clear()
                self._stale_backup.clear()

popular_cache = PopularCacheManager()
