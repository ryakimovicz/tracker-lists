import json
import urllib.request
import urllib.parse
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem

class ComicVineService:
    @staticmethod
    def search_comics(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title="[Configuracion Requerida] Comic Vine API Key Faltante",
                    image_url=None,
                    description="Agrega tu COMIC_VINE_API_KEY en el archivo .env para habilitar busquedas reales de Comics occidentales.",
                    item_type="comic"
                )
            ]
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume&query={encoded_query}"
        
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
                        image_data = item.get("image", {})
                        image_url = image_data.get("super_url") or image_data.get("medium_url") or image_data.get("thumb_url")
                        
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=item.get("name") or "Untitled Volume",
                                image_url=image_url,
                                description=item.get("description"),
                                item_type="comic"
                            )
                        )
                    return results
        except Exception as e:
            print(f"Comic Vine API Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar Comic Vine",
                    image_url=None,
                    description=str(e),
                    item_type="comic"
                )
            ]
        return []
