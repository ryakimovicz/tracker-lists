import sys
import os

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.tmdb import TMDBService

def test_tmdb():
    print("=== Testing TMDB Proxy ===")
    
    # 1. Test Search
    query = "Stranger Things"
    results = TMDBService.search_media(query, "series")
    
    print(f"Search for '{query}' returned {len(results)} results:")
    for item in results[:3]:
        safe_title = item.title.encode('ascii', 'ignore').decode()
        safe_desc = item.description[:100].encode('ascii', 'ignore').decode() if item.description else ""
        print(f" - [{item.external_id}] {safe_title}")
        print(f"   Image URL: {item.image_url}")
        print(f"   Synopsis: {safe_desc}...\n")
        
    if not settings.TMDB_API_KEY:
        assert len(results) == 1, "Should return exactly one warning result"
        assert results[0].external_id == "warning-no-key", "Should return warning-no-key id"
        episodes = TMDBService.get_season_episodes(1399, 1)
        assert len(episodes) == 0
    else:
        assert len(results) > 0, "Should return actual TV show results from TMDB"
        episodes = TMDBService.get_season_episodes(66732, 1) # Stranger Things Season 1
        assert len(episodes) > 0, "Should return episodes for Stranger Things season 1"
        print(f"Season 1 episodes fetched successfully: {len(episodes)} episodes.")

if __name__ == "__main__":
    try:
        test_tmdb()
        print("SUCCESS: TMDB proxy tests passed!")
    except Exception as e:
        print(f"Test Failed: {e}")
        sys.exit(1)
