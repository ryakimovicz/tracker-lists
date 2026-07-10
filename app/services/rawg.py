import json
import urllib.request
import urllib.parse
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem

class RAWGService:
    @staticmethod
    def search_games(query: str) -> List[SearchResultItem]:
        if not query:
            return []
            
        api_key = settings.RAWG_API_KEY
        if not api_key:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title="[Configuracion Requerida] RAWG API Key Faltante",
                    image_url=None,
                    description="Agrega tu RAWG_API_KEY en el archivo .env para habilitar busquedas reales de Videojuegos.",
                    item_type="game"
                )
            ]
            
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.rawg.io/api/games?key={api_key}&search={encoded_query}&page_size=15"
        
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
                    for item in data.get("results", []):
                        # RAWG returns background_image
                        image_url = item.get("background_image")
                        
                        pop_val = float(item.get("added") or 0) / 10.0
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=item.get("name") or "Untitled Game",
                                image_url=image_url,
                                description=f"Rating: {item.get('rating')}/5. Released: {item.get('released')}.",
                                item_type="game",
                                release_date=item.get("released"),
                                popularity=pop_val
                            )
                        )
                    return results
        except Exception as e:
            print(f"RAWG API Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar RAWG",
                    image_url=None,
                    description=str(e),
                    item_type="game"
                )
            ]
        return []
