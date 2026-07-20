import urllib.request
import urllib.parse
import json
from typing import List
from app.services.base import SearchResultItem

class TVMazeService:
    @staticmethod
    def search_shows(query: str, is_anime: bool = False) -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.tvmaze.com/search/shows?q={encoded_query}"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TrackerLists/1.0"}
        )
        
        results = []
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for item in data:
                        show = item.get("show", {})
                        
                        # TVMaze doesn't have a strict 'anime' genre flag that is 100% reliable,
                        # but we can filter by language (Japanese) or genres if the user explicitly searched for anime.
                        genres = show.get("genres", [])
                        language = show.get("language", "")
                        
                        if is_anime:
                            # Strict filter: Must be Animation AND from Japan, or explicitly have Anime genre
                            if "Anime" not in genres and language != "Japanese":
                                continue
                        else:
                            # Filter OUT anime if we are searching for series
                            if "Anime" in genres or language == "Japanese":
                                continue
                                
                        # Use medium image if available, else original
                        image_data = show.get("image")
                        image_url = None
                        if image_data:
                            image_url = image_data.get("original") or image_data.get("medium")
                            
                        premiered = show.get("premiered")
                        release_date = premiered[:4] if premiered else None

                        externals = show.get("externals", {})
                        imdb_id = externals.get("imdb")

                        results.append(
                            SearchResultItem(
                                external_id=f"tvm_{show.get('id')}",
                                title=show.get("name"),
                                image_url=image_url,
                                description=show.get("summary", ""),
                                item_type="anime" if is_anime else "series",
                                release_date=release_date,
                                imdb_id=imdb_id
                            )
                        )
        except Exception as e:
            print(f"TVMaze Search API Error: {e}")
            
        return results

    @staticmethod
    def get_series_detail(series_id: str) -> dict:
        # TVMaze id is like tvm_123, we need to extract 123
        real_id = series_id.replace('tvm_', '') if str(series_id).startswith('tvm_') else series_id
        url = f"https://api.tvmaze.com/shows/{real_id}"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    seasons = []
                    try:
                        with urllib.request.urlopen(f"https://api.tvmaze.com/shows/{real_id}/seasons", timeout=5) as s_response:
                            if s_response.status == 200:
                                seasons_data = json.loads(s_response.read().decode())
                                for s in seasons_data:
                                    num = s.get("number")
                                    if num is not None and num > 0:
                                        seasons.append({
                                            "id": s.get("id"),
                                            "season_number": num,
                                            "episode_count": s.get("episodeOrder") or 999
                                        })
                    except Exception:
                        pass
                    
                    return {
                        "id": series_id,
                        "name": data.get("name"),
                        "number_of_seasons": len(seasons),
                        "seasons": seasons
                    }
        except Exception:
            pass
        return None

    @staticmethod
    def get_all_episodes(series_id: str) -> List[dict]:
        real_id = series_id.replace('tvm_', '') if str(series_id).startswith('tvm_') else series_id
        url = f"https://api.tvmaze.com/shows/{real_id}/episodes"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        
        episodes = []
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for ep in data:
                        img = ep.get("image")
                        episodes.append({
                            "id": ep.get("id"),
                            "name": ep.get("name"),
                            "episode_number": ep.get("number"),
                            "season_number": ep.get("season"),
                            "still_path": img.get("original") if img else None,
                            "overview": ep.get("summary", "")
                        })
        except Exception:
            pass
        return episodes

    @staticmethod
    def get_episode_detail(series_id: str, season_number: int, episode_number: int) -> dict:
        real_id = series_id.replace('tvm_', '') if str(series_id).startswith('tvm_') else series_id
        url = f"https://api.tvmaze.com/shows/{real_id}/episodebynumber?season={season_number}&number={episode_number}"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    ep = json.loads(response.read().decode())
                    img = ep.get("image")
                    return {
                        "id": ep.get("id"),
                        "name": ep.get("name"),
                        "episode_number": ep.get("number"),
                        "season_number": ep.get("season"),
                        "still_path": img.get("original") if img else None,
                        "overview": ep.get("summary", "")
                    }
        except Exception:
            pass
        return None
