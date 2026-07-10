import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class MangaDexService:
    @staticmethod
    def search_manga(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        # We use includes[]=cover_art to get the cover image details in the same request
        url = f"https://api.mangadex.org/manga?title={encoded_query}&limit=15&includes[]=cover_art"
        
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"
            }
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("data", []):
                        manga_id = item.get("id")
                        attributes = item.get("attributes", {})
                        
                        # Extract title (prefer English, fallback to first available title)
                        titles = attributes.get("title", {})
                        title = titles.get("en") or next(iter(titles.values()), "Untitled Manga")
                        
                        # Extract description (prefer English)
                        descriptions = attributes.get("description", {})
                        description = descriptions.get("en") or next(iter(descriptions.values()), "")
                        
                        # Extract cover filename from relationships
                        cover_filename = None
                        for rel in item.get("relationships", []):
                            if rel.get("type") == "cover_art":
                                rel_attrs = rel.get("attributes", {})
                                cover_filename = rel_attrs.get("fileName")
                                break
                        
                        # Build Cover Image URL
                        image_url = None
                        if cover_filename:
                            image_url = f"https://uploads.mangadex.org/covers/{manga_id}/{cover_filename}.256.jpg"
                        
                        results.append(
                            SearchResultItem(
                                external_id=manga_id,
                                title=title,
                                image_url=image_url,
                                description=description,
                                item_type="manga",
                                release_date=str(attributes.get("year")) if attributes.get("year") else None
                            )
                        )
                    return results
        except Exception as e:
            print(f"MangaDex API Error: {e}")
            return []
        return []
