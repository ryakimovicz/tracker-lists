import urllib.request
import urllib.parse
import json
import time
from typing import List, Dict, Optional
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item

# In-memory cache for show akas (localized titles): show_id -> (timestamp, list of akas)
_TVMAZE_AKAS_CACHE: Dict[int, tuple[float, List[dict]]] = {}
_TVMAZE_AKAS_TTL = 3600 * 24  # 24 hours

LATAM_COUNTRY_CODES = {
    'AR', 'MX', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 
    'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'
}

class TVMazeService:
    @staticmethod
    def get_show_akas(show_id: int) -> List[dict]:
        now = time.time()
        if show_id in _TVMAZE_AKAS_CACHE:
            ts, cached_akas = _TVMAZE_AKAS_CACHE[show_id]
            if now - ts < _TVMAZE_AKAS_TTL:
                return cached_akas
        
        url = f"https://api.tvmaze.com/shows/{show_id}/akas"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=3) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8')) or []
                    _TVMAZE_AKAS_CACHE[show_id] = (now, data)
                    return data
        except Exception:
            pass
        _TVMAZE_AKAS_CACHE[show_id] = (now, [])
        return []

    @staticmethod
    def get_localized_title(show_id: int, original_name: str, lang: str = 'es', country_code: str = 'AR') -> str:
        if lang != 'es':
            return original_name

        akas = TVMazeService.get_show_akas(show_id)
        if not akas:
            return original_name

        clean_country = (country_code or 'AR').upper()
        is_spain_user = (clean_country == 'ES')

        latam_title = None
        spain_title = None
        other_es_title = None

        for aka in akas:
            aka_name = aka.get("name")
            if not aka_name:
                continue
            aka_country = aka.get("country")
            c_code = (aka_country.get("code") or "").upper() if aka_country else ""

            if c_code == 'ES':
                spain_title = aka_name
            elif c_code in LATAM_COUNTRY_CODES:
                latam_title = aka_name
            elif not c_code or c_code in ('', 'US', 'INT', 'GLOBAL'):
                if not other_es_title:
                    other_es_title = aka_name

        # Priority resolution
        if is_spain_user:
            return spain_title or latam_title or other_es_title or original_name
        else:
            # Latin America or any other region with Spanish language active (including US)
            return latam_title or other_es_title or spain_title or original_name

    @staticmethod
    def search_shows(query: str, is_anime: bool = False, lang: str = 'es', country_code: str = 'AR') -> List[SearchResultItem]:
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
                        
                        raw_show_name = show.get("name") or "Untitled Show"
                        show_summary = show.get("summary") or ""
                        if not is_safe_media_item(raw_show_name, show_summary):
                            continue

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
                        weight = show.get("weight")
                        pop_score = float(weight) if weight is not None else None

                        # Resolve localized title if lang is 'es'
                        show_id_int = show.get("id")
                        localized_name = TVMazeService.get_localized_title(show_id_int, raw_show_name, lang, country_code) if show_id_int else raw_show_name

                        results.append(
                            SearchResultItem(
                                external_id=f"tvm_{show.get('id')}",
                                title=localized_name,
                                image_url=image_url,
                                description=show_summary,
                                item_type="anime" if is_anime else "series",
                                release_date=release_date,
                                imdb_id=imdb_id,
                                popularity=pop_score
                            )
                        )
        except Exception as e:
            print(f"TVMaze Search API Error: {e}")
            
        return results

    @staticmethod
    def get_series_detail(series_id: str, lang: str = 'es', country_code: str = 'AR') -> dict:
        # TVMaze id is like tvm_123, we need to extract 123
        real_id = str(series_id).replace('tvm_', '').replace('tvm-', '')
        url = f"https://api.tvmaze.com/shows/{real_id}"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    seasons = []
                    # Fetch episodes first to know the real episode count per season
                    all_eps = TVMazeService.get_all_episodes(series_id)
                    eps_per_season = {}
                    extras_count = 0
                    for ep in all_eps:
                        if ep.get("is_extra") or ep.get("season_number") == 0:
                            extras_count += 1
                        else:
                            s_num = ep.get("season_number")
                            if s_num is not None and s_num > 0:
                                eps_per_season[s_num] = eps_per_season.get(s_num, 0) + 1

                    try:
                        with urllib.request.urlopen(f"https://api.tvmaze.com/shows/{real_id}/seasons", timeout=5) as s_response:
                            if s_response.status == 200:
                                seasons_data = json.loads(s_response.read().decode())
                                for s in seasons_data:
                                    num = s.get("number")
                                    if num is not None and num > 0:
                                        real_count = eps_per_season.get(num, 0)
                                        order_count = s.get("episodeOrder")
                                        # Only include seasons that have episodes or a defined episode order
                                        if real_count > 0 or order_count is not None:
                                            seasons.append({
                                                "id": s.get("id"),
                                                "season_number": num,
                                                "episode_count": real_count if real_count > 0 else (order_count or 1)
                                            })
                    except Exception:
                        pass
                    
                    if not seasons and eps_per_season:
                        for num, count in sorted(eps_per_season.items()):
                            seasons.append({
                                "id": num,
                                "season_number": num,
                                "episode_count": count
                            })

                    # If there are insignificant specials / extras, append the Extras season (season_number: 0) at the end
                    if extras_count > 0:
                        seasons.append({
                            "id": "extras",
                            "season_number": 0,
                            "is_extras": True,
                            "episode_count": extras_count
                        })
                    
                    raw_name = data.get("name")
                    show_int_id = int(real_id) if real_id.isdigit() else 0
                    localized_series_name = TVMazeService.get_localized_title(show_int_id, raw_name, lang, country_code) if show_int_id else raw_name

                    return {
                        "id": series_id,
                        "name": localized_series_name,
                        "status": data.get("status"),
                        "number_of_seasons": len(seasons),
                        "seasons": seasons,
                        "overview": data.get("summary", ""),
                        "first_air_date": data.get("premiered"),
                        "image_url": data.get("image", {}).get("original") if data.get("image") else None
                    }
        except Exception:
            pass
        return None

    @staticmethod
    def get_all_episodes(series_id: str) -> List[dict]:
        real_id = str(series_id).replace('tvm_', '').replace('tvm-', '')
        url = f"https://api.tvmaze.com/shows/{real_id}/episodes?specials=1"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        
        episodes = []
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for ep in data:
                        img = ep.get("image")
                        ep_type = ep.get("type", "regular")
                        is_significant = (ep_type == "significant_special")
                        is_extra = (ep_type == "insignificant_special")
                        raw_season = ep.get("season")
                        
                        # For extras (insignificant specials), assign season_number = 0
                        # For significant specials, keep their natural broadcast season (or 0 if none)
                        if is_extra:
                            season_num = 0
                        else:
                            season_num = raw_season if raw_season is not None else 1

                        episodes.append({
                            "id": ep.get("id"),
                            "name": ep.get("name"),
                            "episode_number": ep.get("number"),
                            "season_number": season_num,
                            "still_path": img.get("original") if img else None,
                            "overview": ep.get("summary", ""),
                            "air_date": ep.get("airdate"),
                            "airtime": ep.get("airtime"),
                            "airstamp": ep.get("airstamp"),
                            "ep_type": ep_type,
                            "is_significant_special": is_significant,
                            "is_extra": is_extra
                        })
        except Exception:
            pass
        return episodes

    @staticmethod
    def get_season_episodes(series_id: str, season_number: int) -> List[dict]:
        all_eps = TVMazeService.get_all_episodes(series_id)
        return [ep for ep in all_eps if ep.get("season_number") == season_number]


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
                        "overview": ep.get("summary", ""),
                        "air_date": ep.get("airdate")
                    }
        except Exception:
            pass
        return None


    _schedule_cache = {}

    @staticmethod
    def get_new_shows() -> List[SearchResultItem]:
        import json, urllib.request, datetime, time
        import concurrent.futures
        
        cache_key = "tvmaze_new_shows_v1"
        now_ts = time.time()
        if cache_key in TVMazeService._schedule_cache:
            ts, data = TVMazeService._schedule_cache[cache_key]
            if now_ts - ts < 1800: # 30 min cache
                return data

        today = datetime.date.today()
        dates = [(today - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(5)]
        
        urls = []
        for d in dates:
            urls.append(f"https://api.tvmaze.com/schedule/web?date={d}")
            urls.append(f"https://api.tvmaze.com/schedule?date={d}&country=US")

        def fetch_url(u):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    if response.status == 200:
                        return json.loads(response.read().decode())
            except Exception:
                pass
            return []

        all_episodes = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            for items in executor.map(fetch_url, urls):
                all_episodes.extend(items)

        shows_map = {}
        for ep in all_episodes:
            show = ep.get("_embedded", {}).get("show")
            if not show or not show.get("id"):
                continue

            # Exclude anime from general series list
            genres = show.get("genres", [])
            lang = show.get("language")
            show_type = show.get("type")
            is_anime = ("Anime" in genres) or (lang == "Japanese" and show_type == "Animation")
            if is_anime:
                continue

            show_id = show.get("id")
            airdate = ep.get("airdate")
            season = ep.get("season")
            number = ep.get("number")
            if not airdate:
                continue

            ep_info = {
                "airdate": airdate,
                "season": season,
                "number": number
            }

            if show_id not in shows_map:
                shows_map[show_id] = {
                    "show": show,
                    "latest_ep": ep_info
                }
            else:
                cur = shows_map[show_id]["latest_ep"]
                if (airdate, season or 0, number or 0) > (cur["airdate"], cur["season"] or 0, cur["number"] or 0):
                    shows_map[show_id]["latest_ep"] = ep_info

        sorted_shows = sorted(
            shows_map.values(),
            key=lambda x: (x["latest_ep"]["airdate"], x["show"].get("weight", 0)),
            reverse=True
        )[:60]

        results = []
        for item in sorted_shows:
            show = item["show"]
            lep = item["latest_ep"]
            image_data = show.get("image")
            image_url = image_data.get("original") or image_data.get("medium") if image_data else None

            results.append(SearchResultItem(
                external_id=f"tvm_{show.get('id')}",
                title=show.get("name"),
                image_url=image_url,
                description=show.get("summary", ""),
                item_type="series",
                release_date=lep["airdate"],
                latest_season=lep.get("season"),
                latest_episode=lep.get("number"),
                popularity=show.get("weight", 0)
            ))

        TVMazeService._schedule_cache[cache_key] = (now_ts, results)
        return results

    @staticmethod
    def get_new_anime() -> List[SearchResultItem]:
        import json, urllib.request, datetime, time
        import concurrent.futures

        cache_key = "tvmaze_new_anime_v1"
        now_ts = time.time()
        if cache_key in TVMazeService._schedule_cache:
            ts, data = TVMazeService._schedule_cache[cache_key]
            if now_ts - ts < 1800: # 30 min cache
                return data

        today = datetime.date.today()
        dates = [(today - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(5)]
        
        urls = []
        for d in dates:
            urls.append(f"https://api.tvmaze.com/schedule/web?date={d}")
            urls.append(f"https://api.tvmaze.com/schedule?date={d}&country=JP")

        def fetch_url(u):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    if response.status == 200:
                        return json.loads(response.read().decode())
            except Exception:
                pass
            return []

        all_episodes = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            for items in executor.map(fetch_url, urls):
                all_episodes.extend(items)

        anime_map = {}
        for ep in all_episodes:
            show = ep.get("_embedded", {}).get("show")
            if not show or not show.get("id"):
                continue

            genres = show.get("genres", [])
            lang = show.get("language")
            show_type = show.get("type")
            is_anime = ("Anime" in genres) or (lang == "Japanese" and show_type == "Animation")
            if not is_anime:
                continue

            show_id = show.get("id")
            airdate = ep.get("airdate")
            season = ep.get("season")
            number = ep.get("number")
            if not airdate:
                continue

            ep_info = {
                "airdate": airdate,
                "season": season,
                "number": number
            }

            if show_id not in anime_map:
                anime_map[show_id] = {
                    "show": show,
                    "latest_ep": ep_info
                }
            else:
                cur = anime_map[show_id]["latest_ep"]
                if (airdate, season or 0, number or 0) > (cur["airdate"], cur["season"] or 0, cur["number"] or 0):
                    anime_map[show_id]["latest_ep"] = ep_info

        sorted_anime = sorted(
            anime_map.values(),
            key=lambda x: (x["latest_ep"]["airdate"], x["show"].get("weight", 0)),
            reverse=True
        )[:60]

        results = []
        for item in sorted_anime:
            show = item["show"]
            lep = item["latest_ep"]
            image_data = show.get("image")
            image_url = image_data.get("original") or image_data.get("medium") if image_data else None

            results.append(SearchResultItem(
                external_id=f"tvm_{show.get('id')}",
                title=show.get("name"),
                image_url=image_url,
                description=show.get("summary", ""),
                item_type="anime",
                release_date=lep["airdate"],
                latest_season=lep.get("season"),
                latest_episode=lep.get("number"),
                popularity=show.get("weight", 0)
            ))

        TVMazeService._schedule_cache[cache_key] = (now_ts, results)
        return results

    @staticmethod
    def get_trending_shows() -> List[SearchResultItem]:
        # TVMaze doesn't have a direct trending endpoint, we can use shows sorted by weight/rating
        import json, urllib.request
        url = "https://api.tvmaze.com/shows"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        results = []
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    sorted_shows = sorted(data, key=lambda x: x.get("weight", 0), reverse=True)[:15]
                    for show in sorted_shows:
                        image_data = show.get("image")
                        image_url = image_data.get("original") or image_data.get("medium") if image_data else None
                        premiered = show.get("premiered")
                        results.append(SearchResultItem(
                            external_id=f"tvm_{show.get('id')}",
                            title=show.get("name"),
                            image_url=image_url,
                            description=show.get("summary", ""),
                            item_type="series",
                            release_date=premiered,
                            popularity=show.get("weight", 0)
                        ))
                    return results
        except Exception:
            pass
        return []

