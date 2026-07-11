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

        # IGDB Apicalypse query
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, cover.image_id, first_release_date, summary, total_rating; limit 15;'
        
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
                    results = []
                    for item in data:
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

                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=item.get("name") or "Untitled Game",
                                image_url=image_url,
                                description=desc,
                                item_type="game",
                                release_date=release_date,
                                popularity=pop_val
                            )
                        )
                    return results
        except Exception as e:
            print(f"IGDB API Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar IGDB",
                    image_url=None,
                    description=str(e),
                    item_type="game"
                )
            ]
        return []
