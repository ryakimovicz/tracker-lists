import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class JikanService:
    @staticmethod
    def search_manga(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.jikan.moe/v4/manga?q={encoded_query}&limit=15"
        
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
                        images = item.get("images", {})
                        jpg_images = images.get("jpg", {})
                        image_url = jpg_images.get("large_image_url") or jpg_images.get("image_url")
                        
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("mal_id")),
                                title=item.get("title"),
                                image_url=image_url,
                                description=item.get("synopsis"),
                                item_type="manga"
                            )
                        )
                    return results
        except Exception as e:
            # Fail silently or log error for diagnostics
            print(f"Jikan API Error: {e}")
            return []
        return []
