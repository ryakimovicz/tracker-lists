import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class JikanService:
    @staticmethod
    def search_anime(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.jikan.moe/v4/anime?q={encoded_query}&limit=10"
        
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"
            }
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("data", []):
                        title = item.get("title") or "Untitled Anime"
                        
                        # Get cover image
                        images = item.get("images", {})
                        jpg_imgs = images.get("jpg", {})
                        image_url = jpg_imgs.get("large_image_url") or jpg_imgs.get("image_url")
                        
                        # Extract release date
                        aired = item.get("aired", {})
                        from_date = aired.get("from")
                        release_date = None
                        if from_date and isinstance(from_date, str):
                            release_date = from_date[:10]
                            
                        desc = item.get("synopsis") or ""
                        
                        results.append(
                            SearchResultItem(
                                external_id=f"jikan-{item.get('mal_id')}",
                                title=title,
                                image_url=image_url,
                                description=desc,
                                item_type="anime",
                                release_date=release_date
                            )
                        )
                    return results
        except Exception as e:
            print(f"Jikan API Search Error: {e}")
            return None
        return []
