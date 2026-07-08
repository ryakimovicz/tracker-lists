import sys
import os

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.tmdb import TMDBService

def test_tmdb_no_key():
    print("=== Testing TMDB Proxy (Without Key) ===")
    
    # 1. Test Search
    query = "Stranger Things"
    results = TMDBService.search_media(query, "series")
    
    print(f"Search for '{query}' returned {len(results)} results:")
    for item in results:
        print(f" - [{item.external_id}] {item.title}")
        print(f"   Description: {item.description}\n")
        
    assert len(results) == 1, "Should return exactly one warning result"
    assert results[0].external_id == "warning-no-key", "Should return warning-no-key id"
    
    # 2. Test Season retrieval details (should return empty list gracefully when no key)
    episodes = TMDBService.get_season_episodes(1399, 1)
    assert len(episodes) == 0, "Should return empty list since no TMDB key is set"
    print("Mocks/Warnings checked and handled correctly.")

if __name__ == "__main__":
    try:
        test_tmdb_no_key()
        print("SUCCESS: TMDB proxy offline/no-key tests passed!")
    except Exception as e:
        print(f"Test Failed: {e}")
        sys.exit(1)
