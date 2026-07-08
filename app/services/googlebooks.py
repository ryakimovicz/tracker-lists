import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class GoogleBooksService:
    @staticmethod
    def search_books(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&maxResults=15"
        
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
                    for item in data.get("items", []):
                        volume_info = item.get("volumeInfo", {})
                        
                        # Build safe Image URL (force https)
                        image_links = volume_info.get("imageLinks", {})
                        image_url = image_links.get("thumbnail") or image_links.get("smallThumbnail")
                        if image_url and image_url.startswith("http://"):
                            image_url = image_url.replace("http://", "https://", 1)
                        
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=volume_info.get("title") or "Untitled Book",
                                image_url=image_url,
                                description=volume_info.get("description"),
                                item_type="book"
                            )
                        )
                    return results
        except Exception as e:
            print(f"Google Books API Error: {e}")
            return []
        return []
