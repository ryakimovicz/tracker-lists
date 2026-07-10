import json
import urllib.request
import urllib.parse
from typing import List
from app.services.base import SearchResultItem

class AniListService:
    @staticmethod
    def search_anime(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        graphql_query = """
        query ($search: String) {
          Page (page: 1, perPage: 12) {
            media (search: $search, type: ANIME) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
              description
              startDate {
                year
                month
                day
              }
              popularity
            }
          }
        }
        """
        
        variables = {
            "search": query
        }
        
        payload = {
            "query": graphql_query,
            "variables": variables
        }
        
        req = urllib.request.Request(
            "https://graphql.anilist.co",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "TrackerLists/1.0"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode())
                    media_list = res_data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        t = item.get("title", {})
                        title = t.get("english") or t.get("romaji") or t.get("native") or "Untitled Anime"
                        
                        cover = item.get("coverImage", {})
                        image_url = cover.get("large")
                        
                        # Extract start date
                        start = item.get("startDate", {})
                        release_date = None
                        if start.get("year"):
                            release_date = f"{start.get('year')}-{start.get('month'):02d}-{start.get('day'):02d}"
                            
                        desc = item.get("description") or ""
                        
                        pop_val = float(item.get("popularity") or 0) / 1000.0
                        
                        results.append(
                            SearchResultItem(
                                external_id=f"anilist-{item.get('id')}",
                                title=title,
                                image_url=image_url,
                                description=desc,
                                item_type="anime",
                                release_date=release_date,
                                popularity=pop_val
                            )
                        )
                    return results
        except Exception as e:
            print(f"AniList API Search Error: {e}")
            return None
        return []
