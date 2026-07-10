import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class GoogleBooksService:
    @staticmethod
    def search_books(query: str) -> List[SearchResultItem]:
        """
        Search books using the Open Library Search API.
        We use Open Library because it is completely open, does not require API keys,
        and does not trigger HTTP 429 Rate Limits.
        """
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://openlibrary.org/search.json?q={encoded_query}&limit=15"
        
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"
            }
        )
        
        try:
            # Increase timeout to 10s as Open Library can be slightly slower
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("docs", []):
                        # Cover URL format from Open Library
                        cover_i = item.get("cover_i")
                        image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None
                        
                        author = item.get("author_name", ["Unknown Author"])[0]
                        first_publish = item.get("first_publish_year")
                        desc = f"Author: {author}."
                        if first_publish:
                            desc += f" First published in {first_publish}."
                        
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("key", "")).replace("/works/", ""),
                                title=item.get("title") or "Untitled Book",
                                image_url=image_url,
                                description=desc,
                                item_type="book",
                                release_date=str(item.get("first_publish_year")) if item.get("first_publish_year") else None
                            )
                        )
                    return results
        except Exception as e:
            print(f"Open Library API Error: {e}")
            return []
        return []
