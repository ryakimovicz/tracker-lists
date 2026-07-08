import sys
import os

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.mangadex import MangaDexService
from app.services.comicvine import ComicVineService

def test_mangadex():
    print("=== Testing MangaDex API Proxy (Manga Search) ===")
    query = "Monster"
    results = MangaDexService.search_manga(query)
    
    print(f"Search for '{query}' returned {len(results)} results:")
    for item in results[:3]:
        safe_title = item.title.encode('ascii', 'ignore').decode()
        safe_desc = item.description[:100].encode('ascii', 'ignore').decode() if item.description else ""
        print(f" - [{item.external_id}] {safe_title}")
        print(f"   Image URL: {item.image_url}")
        print(f"   Type: {item.item_type}")
        print(f"   Synopsis: {safe_desc}...\n")
        
    assert len(results) > 0, "MangaDex search should return at least one result"

def test_comicvine_no_key():
    print("=== Testing Comic Vine Proxy (Without Key) ===")
    query = "Batman"
    results = ComicVineService.search_comics(query)
    
    print(f"Search for '{query}' without key returned {len(results)} results:")
    for item in results:
        print(f" - [{item.external_id}] {item.title}")
        print(f"   Description: {item.description}\n")
        
    assert len(results) == 1, "Should return exactly one warning result"
    assert results[0].external_id == "warning-no-key", "Should return warning-no-key id"

if __name__ == "__main__":
    try:
        test_mangadex()
        test_comicvine_no_key()
        print("SUCCESS: All Proxy Service tests passed!")
    except Exception as e:
        print(f"Test Failed: {e}")
        sys.exit(1)
