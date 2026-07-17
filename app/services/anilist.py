import json
import urllib.request
from typing import List
from app.services.base import SearchResultItem

class AnilistService:
    @staticmethod
    def search_manga(query: str) -> List[SearchResultItem]:
        if not query:
            return []

        url = "https://graphql.anilist.co"
        graphql_query = """
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
              }
              description
              coverImage {
                large
              }
              startDate {
                year
                month
                day
              }
              averageScore
            }
          }
        }
        """
        
        payload = json.dumps({
            "query": graphql_query,
            "variables": {"search": query}
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Pathd/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media_list = data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        # Prefer english title if available, otherwise romaji
                        title_obj = item.get("title", {})
                        title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                        
                        cover_obj = item.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        
                        start_date_obj = item.get("startDate", {})
                        year = start_date_obj.get("year")
                        month = start_date_obj.get("month")
                        day = start_date_obj.get("day")
                        release_date = ""
                        if year:
                            release_date = str(year)
                            if month:
                                release_date = f"{year}-{month:02d}"
                                if day:
                                    release_date = f"{year}-{month:02d}-{day:02d}"
                                    
                        # Remove html tags from description if present
                        desc = item.get("description") or ""
                        import re
                        desc = re.sub('<[^<]+?>', '', desc)
                        
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=title,
                                image_url=image_url,
                                description=desc,
                                item_type="manga",
                                release_date=release_date,
                                popularity=float(item.get("averageScore") or 0)
                            )
                        )
                    return results
        except Exception as e:
            print(f"AniList API Search Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar AniList",
                    image_url=None,
                    description=str(e),
                    item_type="manga"
                )
            ]
        return []
