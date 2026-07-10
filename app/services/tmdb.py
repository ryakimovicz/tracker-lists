import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any
from app.core.config import settings
from app.services.base import SearchResultItem

class TMDBService:
    @staticmethod
    def search_media(query: str, type: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        api_key = settings.TMDB_API_KEY
        if not api_key:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title=f"[Configuracion Requerida] TMDB API Key Faltante",
                    image_url=None,
                    description=f"Agrega tu TMDB_API_KEY en el archivo .env para habilitar busquedas reales de Peliculas y Series.",
                    item_type=type
                )
            ]
        
        encoded_query = urllib.parse.quote(query)
        # Select target endpoint based on type ('movie' or 'series' which maps to 'tv')
        tmdb_resource = "movie" if type == "movie" else "tv"
        url = f"https://api.themoviedb.org/3/search/{tmdb_resource}?api_key={api_key}&query={encoded_query}&language=en-US"
        
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
                        # Movies use 'title', TV shows use 'name'
                        title = item.get("title") or item.get("name") or "Untitled Media"
                        poster_path = item.get("poster_path")
                        image_url = f"https://image.tmdb.org/t/p/w185{poster_path}" if poster_path else None
                        
                        item_type_val = type
                        if type == "series":
                            is_anime = (
                                item.get("original_language") == "ja" or
                                "JP" in item.get("origin_country", []) or
                                16 in item.get("genre_ids", [])
                            )
                            if is_anime:
                                item_type_val = "anime"

                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=title,
                                image_url=image_url,
                                description=item.get("overview"),
                                item_type=item_type_val,
                                release_date=item.get("release_date") or item.get("first_air_date")
                            )
                        )
                    return results
        except Exception as e:
            print(f"TMDB API Search Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar TMDB",
                    image_url=None,
                    description=str(e),
                    item_type=type
                )
            ]
        return []

    @staticmethod
    def get_season_episodes(series_id: int, season_number: int) -> List[Dict[str, Any]]:
        api_key = settings.TMDB_API_KEY
        if not api_key:
            return []
            
        url = f"https://api.themoviedb.org/3/tv/{series_id}/season/{season_number}?api_key={api_key}&language=en-US"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TrackerLists/1.0"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    return data.get("episodes", [])
        except Exception as e:
            print(f"TMDB API Season Error: {e}")
            return []
        return []

    @staticmethod
    def get_episode_detail(series_id: int, season_number: int, episode_number: int) -> Dict[str, Any]:
        api_key = settings.TMDB_API_KEY
        if not api_key:
            return {}
            
        url = f"https://api.themoviedb.org/3/tv/{series_id}/season/{season_number}/episode/{episode_number}?api_key={api_key}&language=en-US"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TrackerLists/1.0"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    return json.loads(response.read().decode())
        except Exception as e:
            print(f"TMDB API Episode Error: {e}")
            return {}
        return {}
        
    @staticmethod
    def get_series_detail(series_id: int) -> Dict[str, Any]:
        api_key = settings.TMDB_API_KEY
        if not api_key:
            return {}
            
        url = f"https://api.themoviedb.org/3/tv/{series_id}?api_key={api_key}&language=en-US"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TrackerLists/1.0"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    return json.loads(response.read().decode())
        except Exception as e:
            print(f"TMDB API Series Detail Error: {e}")
            return {}
        return {}
