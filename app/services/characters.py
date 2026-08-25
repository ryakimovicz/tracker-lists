import json
import urllib.request
import urllib.parse
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService

class CharacterSearchResult:
    def __init__(self, name: str, image_url: str, category: str, origin: str = ""):
        self.name = name
        self.image_url = image_url
        self.category = category # 'anime', 'comic', 'game', 'movie'
        self.origin = origin

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "image_url": self.image_url,
            "category": self.category,
            "origin": self.origin
        }

class CharacterService:
    @staticmethod
    def _search_anilist(query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
        url = "https://graphql.anilist.co"
        graphql_query = """
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            characters(search: $search, sort: FAVOURITES_DESC) {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              media(page: 1, perPage: 1) {
                nodes {
                  title {
                    english
                    romaji
                  }
                  type
                }
              }
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

        results = []
        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    characters = data.get("data", {}).get("Page", {}).get("characters", [])
                    for ch in characters:
                        name_obj = ch.get("name", {})
                        full_name = name_obj.get("full") or name_obj.get("native") or "Unknown Character"
                        img_obj = ch.get("image", {})
                        img_url = img_obj.get("large") or img_obj.get("medium")
                        
                        origin = ""
                        media_nodes = ch.get("media", {}).get("nodes", [])
                        if media_nodes:
                            first_media = media_nodes[0]
                            title_obj = first_media.get("title", {})
                            origin = title_obj.get("english") or title_obj.get("romaji") or ""
                            
                        if img_url and not img_url.endswith("default.jpg"):
                            results.append(CharacterSearchResult(
                                name=full_name,
                                image_url=img_url,
                                category="anime",
                                origin=origin
                            ))
        except Exception as e:
            print(f"AniList Character Search Error: {e}")
        return results

    @staticmethod
    def _search_comicvine(query: str) -> List[CharacterSearchResult]:
        if not query or not settings.COMIC_VINE_API_KEY:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://comicvine.gamespot.com/api/characters/?api_key={settings.COMIC_VINE_API_KEY}&format=json&filter=name:{encoded_query}&limit=10&field_list=id,name,real_name,image,publisher"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
        )

        results = []
        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for ch in data.get("results", []):
                        name = ch.get("name") or "Unknown Character"
                        img_obj = ch.get("image", {}) or {}
                        img_url = img_obj.get("medium_url") or img_obj.get("super_url") or img_obj.get("small_url")
                        publisher = (ch.get("publisher") or {}).get("name") or "Comic"
                        
                        if img_url and "default" not in img_url.lower():
                            results.append(CharacterSearchResult(
                                name=name,
                                image_url=img_url,
                                category="comic",
                                origin=publisher
                            ))
        except Exception as e:
            print(f"Comic Vine Character Search Error: {e}")
        return results

    @staticmethod
    def _search_igdb(query: str) -> List[CharacterSearchResult]:
        if not query or not settings.TWITCH_CLIENT_ID:
            return []
        
        token = IGDBService._get_access_token()
        if not token:
            return []
        
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, mug_shot.image_id, games.name; limit 10;'
        
        req = urllib.request.Request(
            "https://api.igdb.com/v4/characters",
            data=body.encode("utf-8"),
            headers={
                "Client-ID": settings.TWITCH_CLIENT_ID,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
        )

        results = []
        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for ch in data:
                        name = ch.get("name") or "Unknown Character"
                        mug_shot = ch.get("mug_shot")
                        img_url = None
                        if mug_shot and mug_shot.get("image_id"):
                            img_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{mug_shot['image_id']}.jpg"
                        
                        games = ch.get("games") or []
                        origin = games[0].get("name") if games and isinstance(games[0], dict) else "Video Game"
                        
                        if img_url:
                            results.append(CharacterSearchResult(
                                name=name,
                                image_url=img_url,
                                category="game",
                                origin=origin
                            ))
        except Exception as e:
            print(f"IGDB Character Search Error: {e}")
        return results

    @classmethod
    def search_all(cls, query: str) -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return []

        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_anilist = executor.submit(cls._search_anilist, query)
            future_comicvine = executor.submit(cls._search_comicvine, query)
            future_igdb = executor.submit(cls._search_igdb, query)

            for future in (future_anilist, future_comicvine, future_igdb):
                try:
                    res = future.result()
                    all_results.extend(res)
                except Exception:
                    pass

        # Deduplicate by image_url and return as dicts
        seen_images = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_images:
                seen_images.add(r.image_url)
                deduped.append(r.to_dict())

        return deduped
