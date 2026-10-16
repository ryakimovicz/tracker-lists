import time
from app.core.popular_cache import PopularCacheManager

def test_popular_cache_get_and_set():
    cache = PopularCacheManager(default_ttl=10.0)
    assert cache.get("test_key") is None

    cache.set("test_key", [{"id": 1, "title": "Dune"}])
    data = cache.get("test_key")
    assert data is not None
    assert len(data) == 1
    assert data[0]["title"] == "Dune"


def test_popular_cache_stale_fallback():
    # Cache with 0.1 second TTL
    cache = PopularCacheManager(default_ttl=0.1)
    cache.set("expiring_key", ["item1", "item2"])
    
    # Wait until it expires
    time.sleep(0.15)
    
    # Because stale backup exists, it returns stale backup rather than failing
    data = cache.get("expiring_key")
    assert data == ["item1", "item2"]


def test_popular_cache_clear():
    cache = PopularCacheManager()
    cache.set("key1", "val1")
    cache.set("key2", "val2")
    cache.clear("key1")
    assert cache.get("key1") is None
    assert cache.get("key2") == "val2"
