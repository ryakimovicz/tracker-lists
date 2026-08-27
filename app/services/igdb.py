import urllib.request
import urllib.parse
import json
from datetime import datetime, timedelta
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem

class IGDBService:
    _access_token = None
    _token_expiry = None

    @classmethod
    def _get_access_token(cls) -> str:
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        client_secret = getattr(settings, "TWITCH_CLIENT_SECRET", None)

        if not client_id or not client_secret:
            return None

        # Check if we have a valid token cached
        if cls._access_token and cls._token_expiry and datetime.now() < cls._token_expiry:
            return cls._access_token

        # Fetch new token
        url = f"https://id.twitch.tv/oauth2/token?client_id={client_id}&client_secret={client_secret}&grant_type=client_credentials"
        req = urllib.request.Request(url, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    cls._access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    cls._token_expiry = datetime.now() + timedelta(seconds=expires_in - 300) # 5 min buffer
                    return cls._access_token
        except Exception as e:
            print(f"IGDB Auth Error: {e}")
        return None

    @classmethod
    def search_games(cls, query: str) -> List[SearchResultItem]:
        if not query:
            return []

        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()

        if not client_id or not token:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title="[Configuracion Requerida] Faltan Credenciales de IGDB",
                    image_url=None,
                    description="Agrega TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en tu .env para buscar juegos.",
                    item_type="game"
                )
            ]

        # IGDB Apicalypse query with metadata for smart ranking
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, category, parent_game, version_parent, cover.image_id, first_release_date, summary, total_rating, rating_count, hypes, follows, themes, age_ratings.rating; limit 100;'
        
        req = urllib.request.Request(
            "https://api.igdb.com/v4/games",
            data=body.encode("utf-8"),
            headers={
                "Client-ID": client_id,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if not data:
                        return []

                    # Smart sorting: Prioritize main games, remakes, remasters, and popular titles over DLCs/skins
                    import re
                    q_lower = query.lower().strip()
                    dlc_keywords = ["skin", "skins", "pack", "dlc", "soundtrack", "season pass", "costume", "expansion pack", "avatar", "theme", "wallpaper"]

                    def calculate_score(item):
                        name = item.get("name", "")
                        name_lower = name.lower().strip()
                        cat = item.get("category", 0)
                        has_parent = "parent_game" in item
                        
                        is_dlc_like = has_parent or cat in (1, 5, 13, 14) or any(re.search(rf"\b{kw}\b", name_lower) for kw in dlc_keywords)
                        
                        # Tier 0: Standalone main games / Remakes / Remasters / Standalone Expansions
                        if not is_dlc_like and cat in (0, 8, 9, 4, 10, None):
                            tier = 0
                        elif not is_dlc_like and cat in (2, 3, 6, 7, 11):
                            tier = 1
                        else:
                            tier = 2
                            
                        rating_count = item.get("rating_count") or 0
                        hypes = item.get("hypes") or 0
                        follows = item.get("follows") or 0
                        total_rating = item.get("total_rating") or 0
                        
                        # Exact or prefix match bonus
                        exact_boost = 500 if name_lower == q_lower else (150 if name_lower.startswith(q_lower) else 0)
                        
                        # Cover & release date bonus
                        cover_boost = 100 if item.get("cover") else -200
                        has_date_boost = 50 if item.get("first_release_date") else -50
                        has_summary_boost = 30 if item.get("summary") else 0
                        
                        pop_score = (rating_count * 5) + (hypes * 3) + (follows * 3) + (total_rating / 5.0) + exact_boost + cover_boost + has_date_boost + has_summary_boost
                        return (tier, -pop_score)

                    sorted_items = sorted(data, key=calculate_score)

                    results = []
                    for item in sorted_items:
                        image_url = None
                        cover = item.get("cover")
                        if cover and cover.get("image_id"):
                            image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"

                        # Parse release date
                        release_timestamp = item.get("first_release_date")
                        release_date = None
                        if release_timestamp:
                            release_date = datetime.fromtimestamp(release_timestamp).strftime("%Y-%m-%d")

                        # Normalize rating to 0.0 - 5.0
                        total_rating = item.get("total_rating")
                        pop_val = 0.0
                        if total_rating:
                            pop_val = round(total_rating / 20.0, 1)

                        description_parts = []
                        if pop_val:
                            description_parts.append(f"Rating: {pop_val}/5")
                        if release_date:
                            description_parts.append(f"Released: {release_date}")
                            
                        desc = ". ".join(description_parts) + "."
                        if item.get("summary"):
                            desc += f" {item['summary'][:150]}..."

                        themes = item.get("themes") or []
                        age_ratings = [ar.get("rating") for ar in item.get("age_ratings", []) if isinstance(ar, dict)]
                        is_mature_game = 42 in themes or 5 in age_ratings or 12 in age_ratings

                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=item.get("name") or "Untitled Game",
                                image_url=image_url,
                                description=desc,
                                item_type="game",
                                release_date=release_date,
                                popularity=pop_val,
                                is_nsfw=is_mature_game
                            )
                        )
                    return results

        except Exception as e:
            print(f"IGDB API Error: {e}")
            return []
        return []


    @classmethod
    def _execute_query(cls, body: str) -> List[SearchResultItem]:
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()
        if not client_id or not token: return []
        req = urllib.request.Request("https://api.igdb.com/v4/games", data=body.encode("utf-8"), headers={"Client-ID": client_id, "Authorization": f"Bearer {token}", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data:
                        image_url = None
                        cover = item.get("cover")
                        if cover and cover.get("image_id"):
                            image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"
                        release_timestamp = item.get("first_release_date")
                        release_date = datetime.fromtimestamp(release_timestamp).strftime("%Y-%m-%d") if release_timestamp else None
                        results.append(SearchResultItem(
                            external_id=str(item.get("id")),
                            title=item.get("name") or "Untitled Game",
                            image_url=image_url,
                            item_type="game",
                            release_date=release_date
                        ))
                    return results
        except Exception as e:
            pass
        return []

    @classmethod
    def get_new_games(cls) -> List[SearchResultItem]:
        import time
        now = int(time.time())
        body = f'fields id, name, cover.image_id, first_release_date, summary; where first_release_date < {now} & cover != null; sort first_release_date desc; limit 40;'
        return cls._execute_query(body)

    @classmethod
    def get_trending_games(cls) -> List[SearchResultItem]:
        import time
        now = int(time.time())
        six_months_ago = now - (180 * 86400)
        body = f'fields id, name, cover.image_id, first_release_date, summary, total_rating; where first_release_date > {six_months_ago} & first_release_date < {now} & cover != null & total_rating != null; sort total_rating desc; limit 15;'
        return cls._execute_query(body)
