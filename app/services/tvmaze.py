import urllib.request
import urllib.parse
import urllib.error
import json
import time
import logging
import threading
from collections import deque
from typing import List, Dict, Optional, Any, Tuple
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item
from app.core.config import settings

logger = logging.getLogger(__name__)

USER_AGENT = settings.USER_AGENT

# In-memory cache for show akas (localized titles): show_id -> (timestamp, list of akas)
_TVMAZE_AKAS_CACHE: Dict[int, tuple[float, List[dict]]] = {}
_TVMAZE_AKAS_TTL = 3600 * 24  # 24 hours

LATAM_COUNTRY_CODES = {
    'AR', 'MX', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 
    'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'
}

_TVMAZE_SERIES_CACHE: Dict[str, tuple[float, dict]] = {}
_TVMAZE_EPISODES_CACHE: Dict[str, tuple[float, List[dict]]] = {}
_TVMAZE_CACHE_TTL = 3600 * 12  # 12 hours

import concurrent.futures

class TVMazeService:
    # Rate limiting & sliding window pacing state (TVMaze public limit: 20 req / 10s per IP)
    _rate_limit_lock = threading.Lock()
    _request_timestamps = deque()
    _blocked_until: float = 0.0  # Unix timestamp until which TVMaze calls are paused (circuit breaker)

    @classmethod
    def _handle_429(cls, headers: Any, url: str) -> None:
        """Handle 429 Too Many Requests by activating an immediate global circuit breaker."""
        now = time.time()
        wait_s = 15.0
        try:
            if headers:
                retry_after = headers.get("Retry-After")
                if retry_after:
                    wait_s = float(retry_after) + 1.5
        except Exception:
            pass

        with cls._rate_limit_lock:
            cls._blocked_until = now + wait_s

        logger.error(f"TVMaze 429 rate limit reached for '{url}'. Global circuit breaker active for {wait_s:.1f}s. Halting requests.")

    @classmethod
    def _rate_limit_tvmaze(cls) -> bool:
        """Enforce respectful sliding window pacing (max 18 req / 10s) and honor circuit breaker."""
        with cls._rate_limit_lock:
            now = time.time()

            # 1. Check circuit breaker / active rate limit (set by real 429)
            if cls._blocked_until > now:
                wait_time = cls._blocked_until - now
                if wait_time <= 1.0:
                    time.sleep(wait_time)
                    now = time.time()
                else:
                    logger.info(f"TVMaze circuit breaker holding requests (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window: clean timestamps older than 10.0 seconds
            while cls._request_timestamps and cls._request_timestamps[0] <= now - 10.0:
                cls._request_timestamps.popleft()

            # 3. Controlled cap: max 18 requests per 10 seconds (TVMaze allows 20)
            if len(cls._request_timestamps) >= 18:
                sleep_needed = 10.0 - (now - cls._request_timestamps[0]) + 0.1
                if sleep_needed > 0:
                    if sleep_needed <= 3.5:
                        logger.info(f"TVMaze sliding window rate pacing (18/10s), waiting {sleep_needed:.2f}s...")
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._request_timestamps and cls._request_timestamps[0] <= now - 10.0:
                            cls._request_timestamps.popleft()
                    else:
                        # Heavy burst - gracefully drop without falsely tripping the global circuit breaker
                        return False

            # 4. Enforce minimum spacing of 0.06 seconds between consecutive requests
            if cls._request_timestamps:
                elapsed = now - cls._request_timestamps[-1]
                if elapsed < 0.06:
                    time.sleep(0.06 - elapsed)
                    now = time.time()

            cls._request_timestamps.append(now)
            return True

    @classmethod
    def _tvmaze_request(cls, url: str, timeout: int = 5) -> Optional[Any]:
        """Central HTTP request runner with rate limiting, Retry-After header tracking, and 429 backoff."""
        if not cls._rate_limit_tvmaze():
            return None

        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                if res.status == 200:
                    return json.loads(res.read().decode('utf-8'))
                elif res.status == 429:
                    cls._handle_429(res.headers, url)
                    return None
        except urllib.error.HTTPError as he:
            if he.code == 429:
                cls._handle_429(he.headers, url)
                return None
            logger.warning(f"TVMaze HTTP {he.code} for '{url}': {he}")
            return None
        except Exception as e:
            logger.warning(f"TVMaze request error for '{url}': {e}")
            return None
        return None

    @classmethod
    def get_rate_limit_status(cls, category: str = "series") -> Optional[dict]:
        """Provides status for search router and frontend warning banner if TVMaze is limited."""
        now = time.time()
        if cls._blocked_until > now:
            return {
                "category": category,
                "reason": "burst_limit",
                "reset_at": cls._blocked_until
            }
        return None

    @classmethod
    def get_show_akas(cls, show_id: int) -> List[dict]:
        now = time.time()
        if show_id in _TVMAZE_AKAS_CACHE:
            ts, cached_akas = _TVMAZE_AKAS_CACHE[show_id]
            if now - ts < _TVMAZE_AKAS_TTL:
                return cached_akas
        
        url = f"https://api.tvmaze.com/shows/{show_id}/akas"
        data = cls._tvmaze_request(url, timeout=3)
        if data and isinstance(data, list):
            _TVMAZE_AKAS_CACHE[show_id] = (now, data)
            return data
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

        # Priority resolution: strictly Spanish regions
        if is_spain_user:
            return spain_title or latam_title or original_name
        else:
            # Latin America or any other region with Spanish language active
            return latam_title or spain_title or original_name

    @classmethod
    def search_shows(cls, query: str, is_anime: bool = False, lang: str = 'es', country_code: str = 'AR') -> List[SearchResultItem]:
        if not query:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.tvmaze.com/search/shows?q={encoded_query}"
        
        results = []
        data = cls._tvmaze_request(url, timeout=5)

        if data:
            valid_shows = []
            for item in data:
                show = item.get("show", {})
                raw_show_name = show.get("name") or "Untitled Show"
                show_summary = show.get("summary") or ""
                if not is_safe_media_item(raw_show_name, show_summary):
                    continue

                genres = show.get("genres", [])
                language = show.get("language", "")
                
                if is_anime:
                    if "Anime" not in genres and language != "Japanese":
                        continue
                else:
                    if "Anime" in genres or language == "Japanese":
                        continue
                valid_shows.append(show)

            for show in valid_shows:
                raw_show_name = show.get("name") or "Untitled Show"
                show_summary = show.get("summary") or ""
                image_data = show.get("image")
                image_url = (image_data.get("original") or image_data.get("medium")) if image_data else None
                premiered = show.get("premiered")
                release_date = premiered[:4] if premiered else None
                externals = show.get("externals", {})
                imdb_id = externals.get("imdb")
                weight = show.get("weight")
                pop_score = float(weight) if weight is not None else None
                show_id_int = show.get("id")

                # If AKAs are already in memory cache, use them; otherwise use raw_show_name instantly
                localized_name = raw_show_name
                if show_id_int and show_id_int in _TVMAZE_AKAS_CACHE:
                    localized_name = TVMazeService.get_localized_title(show_id_int, raw_show_name, lang, country_code)

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

        return results

    @classmethod
    def get_all_episodes(cls, series_id: str) -> List[dict]:
        real_id = str(series_id).replace('tvm_', '').replace('tvm-', '')
        now = time.time()
        if real_id in _TVMAZE_EPISODES_CACHE:
            ts, cached_eps = _TVMAZE_EPISODES_CACHE[real_id]
            if now - ts < _TVMAZE_CACHE_TTL:
                return cached_eps

        url = f"https://api.tvmaze.com/shows/{real_id}/episodes?specials=1"
        data = cls._tvmaze_request(url, timeout=6)
        episodes = []
        if data and isinstance(data, list):
            for ep in data:
                img = ep.get("image") or {}
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
                    "still_path": img.get("original") if isinstance(img, dict) else None,
                    "overview": ep.get("summary", ""),
                    "air_date": ep.get("airdate"),
                    "airtime": ep.get("airtime"),
                    "airstamp": ep.get("airstamp"),
                    "ep_type": ep_type,
                    "is_significant_special": is_significant,
                    "is_extra": is_extra
                })
            _TVMAZE_EPISODES_CACHE[real_id] = (now, episodes)
        return episodes

    @classmethod
    def get_series_detail(cls, series_id: str, lang: str = 'es', country_code: str = 'AR') -> Optional[dict]:
        real_id = str(series_id).replace('tvm_', '').replace('tvm-', '')
        cache_key = f"{real_id}_{lang}_{country_code}"
        now = time.time()
        if cache_key in _TVMAZE_SERIES_CACHE:
            ts, cached_detail = _TVMAZE_SERIES_CACHE[cache_key]
            if now - ts < _TVMAZE_CACHE_TTL:
                return cached_detail

        url = f"https://api.tvmaze.com/shows/{real_id}"
        data = cls._tvmaze_request(url, timeout=5)
        if data and isinstance(data, dict):
            seasons = []
            # Fetch episodes first to know the real episode count per season (uses cache)
            all_eps = cls.get_all_episodes(series_id)
            eps_per_season = {}
            extras_count = 0
            for ep in all_eps:
                if ep.get("is_extra") or ep.get("season_number") == 0:
                    extras_count += 1
                else:
                    s_num = ep.get("season_number")
                    if s_num is not None and s_num > 0:
                        eps_per_season[s_num] = eps_per_season.get(s_num, 0) + 1

            seasons_data = cls._tvmaze_request(f"https://api.tvmaze.com/shows/{real_id}/seasons", timeout=5)
            if seasons_data and isinstance(seasons_data, list):
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
            localized_series_name = cls.get_localized_title(show_int_id, raw_name, lang, country_code) if show_int_id else raw_name

            result = {
                "id": series_id,
                "name": localized_series_name,
                "status": data.get("status"),
                "number_of_seasons": len(seasons),
                "seasons": seasons,
                "overview": data.get("summary", ""),
                "first_air_date": data.get("premiered"),
                "image_url": data.get("image", {}).get("original") if data.get("image") else None
            }
            _TVMAZE_SERIES_CACHE[cache_key] = (now, result)
            return result
        return None

    @classmethod
    def get_season_episodes(cls, series_id: str, season_number: int) -> List[dict]:
        all_eps = cls.get_all_episodes(series_id)
        return [ep for ep in all_eps if ep.get("season_number") == season_number]

    @classmethod
    def get_episode_detail(cls, series_id: str, season_number: int, episode_number: int) -> Optional[dict]:
        real_id = series_id.replace('tvm_', '') if str(series_id).startswith('tvm_') else series_id
        url = f"https://api.tvmaze.com/shows/{real_id}/episodebynumber?season={season_number}&number={episode_number}"
        data = cls._tvmaze_request(url, timeout=5)
        if data and isinstance(data, dict):
            img = data.get("image") or {}
            return {
                "id": data.get("id"),
                "name": data.get("name"),
                "episode_number": data.get("number"),
                "season_number": data.get("season"),
                "still_path": img.get("original") if isinstance(img, dict) else None,
                "overview": data.get("summary", ""),
                "air_date": data.get("airdate")
            }
        return None


    _schedule_cache = {}

    @classmethod
    def get_new_shows(cls) -> List[SearchResultItem]:
        import json, urllib.request, datetime, time
        import concurrent.futures
        
        cache_key = "tvmaze_new_shows_v2"
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
            data = cls._tvmaze_request(u, timeout=4)
            return data if isinstance(data, list) else []

        all_episodes = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for items in executor.map(fetch_url, urls):
                all_episodes.extend(items)

        shows_map = {}
        for ep in all_episodes:
            show = ep.get("show") or ep.get("_embedded", {}).get("show")
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
        )

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

    @classmethod
    def get_new_anime(cls) -> List[SearchResultItem]:
        import json, urllib.request, datetime, time
        import concurrent.futures

        cache_key = "tvmaze_new_anime_v2"
        now_ts = time.time()
        if cache_key in TVMazeService._schedule_cache:
            ts, data = TVMazeService._schedule_cache[cache_key]
            if now_ts - ts < 1800: # 30 min cache
                return data

        today = datetime.date.today()
        # Look back up to 14 days to capture ongoing anime across 2 full broadcast weeks
        dates = [(today - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(14)]
        
        urls = []
        for d in dates:
            urls.append(f"https://api.tvmaze.com/schedule/web?date={d}")
            urls.append(f"https://api.tvmaze.com/schedule?date={d}&country=JP")

        def fetch_url(u):
            data = cls._tvmaze_request(u, timeout=4)
            return data if isinstance(data, list) else []

        all_episodes = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for items in executor.map(fetch_url, urls):
                all_episodes.extend(items)

        anime_map = {}
        for ep in all_episodes:
            show = ep.get("show") or ep.get("_embedded", {}).get("show")
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
        )

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

        # Guarantee at least 40 anime by completing with recent broadcasts from AniList
        if len(results) < 40:
            try:
                from app.services.anilist import AnilistService
                anilist_anime = AnilistService.get_new_anime()
                existing_titles = {r.title.lower().strip() for r in results}
                for a in anilist_anime:
                    norm = a.title.lower().strip()
                    if norm not in existing_titles:
                        existing_titles.add(norm)
                        results.append(a)
                    if len(results) >= 40:
                        break
            except Exception as e:
                print(f"Notice completing anime with AniList: {e}")

        TVMazeService._schedule_cache[cache_key] = (now_ts, results)
        return results

    @classmethod
    def get_trending_series(cls) -> List[SearchResultItem]:
        cache_key = "tvmaze_trending_series_wiki_v4"
        now_ts = time.time()
        if cache_key in TVMazeService._schedule_cache:
            ts, data = TVMazeService._schedule_cache[cache_key]
            if now_ts - ts < 14400:  # 4 hours
                return data

        import json, urllib.request, re, concurrent.futures
        from datetime import datetime, timedelta

        results: List[SearchResultItem] = []
        seen_ids = set()
        seen_titles = set()

        # 1. Fetch top Wikipedia articles in the last 24-72 hours
        try:
            articles = []
            for days_ago in [1, 2, 3]:
                dt = datetime.utcnow() - timedelta(days=days_ago)
                ymd = dt.strftime("%Y/%m/%d")
                top_url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{ymd}"
                try:
                    req = urllib.request.Request(top_url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req, timeout=7) as resp:
                        if resp.status == 200:
                            data = json.loads(resp.read().decode())
                            items = data.get("items", [{}])[0].get("articles", [])
                            if items:
                                articles = items
                                break
                except Exception:
                    continue

            series_titles = []
            for a in articles:
                art = a.get("article", "")
                if (re.search(r'_\((?:\d{4}_)?TV_series\)$', art, re.IGNORECASE) or 
                    re.search(r'_\([^\)]*television_series[^\)]*\)$', art, re.IGNORECASE) or
                    re.search(r'_\([^\)]*miniseries[^\)]*\)$', art, re.IGNORECASE) or
                    re.search(r'_\(season_\d+\)$', art, re.IGNORECASE)):
                    clean = re.sub(r'_\([^\)]+\)', '', art)
                    clean = re.sub(r'_season_\d+', '', clean, flags=re.IGNORECASE)
                    clean = clean.replace('_', ' ').strip()
                    if clean and clean not in series_titles and not art.startswith("List_of_"):
                        series_titles.append(clean)

            if series_titles:
                def fetch_tvm_show(title_query: str):
                    try:
                        shows = TVMazeService.search_shows(title_query)
                        if shows and shows[0].image_url:
                            return shows[0]
                    except Exception:
                        pass
                    return None

                # Keep max_workers low (3) to respect TVMaze public rate limit (max 20 req/10s)
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
                    matched_shows = list(ex.map(fetch_tvm_show, series_titles[:15]))

                for show in matched_shows:
                    if show and show.image_url and show.title:
                        norm = show.title.lower().strip()
                        if show.external_id not in seen_ids and norm not in seen_titles:
                            seen_ids.add(show.external_id)
                            seen_titles.add(norm)
                            results.append(show)
                        if len(results) >= 20:
                            break
        except Exception as e:
            print(f"Error fetching trending series via Wikipedia/TVMaze: {e}")

        # 2. Resilient fallback: if Wikipedia yielded fewer than 20, supplement with active running shows from schedule
        if len(results) < 20:
            try:
                today = datetime.utcnow().date()
                schedule_shows: List[dict] = []
                for days_back in [0, 1, 2, 3]:
                    d_str = (today - timedelta(days=days_back)).strftime("%Y-%m-%d")
                    for sched_url in [
                        f"https://api.tvmaze.com/schedule/web?date={d_str}",
                        f"https://api.tvmaze.com/schedule?date={d_str}&country=US"
                    ]:
                        s_data = cls._tvmaze_request(sched_url, timeout=3.5)
                        if s_data and isinstance(s_data, list):
                            for ep in s_data:
                                sh = ep.get("show") or ep.get("_embedded", {}).get("show")
                                if sh and sh.get("id") and sh.get("type") != "Animation":
                                    schedule_shows.append(sh)
                    if len(schedule_shows) >= 30:
                        break

                if schedule_shows:
                    sorted_sched = sorted(schedule_shows, key=lambda x: x.get("weight", 0), reverse=True)
                    for sh in sorted_sched:
                        ext_id = f"tvm_{sh.get('id')}"
                        norm = (sh.get("name") or "").lower().strip()
                        img = sh.get("image") or {}
                        img_url = img.get("original") or img.get("medium")
                        if ext_id not in seen_ids and norm not in seen_titles and img_url:
                            seen_ids.add(ext_id)
                            seen_titles.add(norm)
                            results.append(SearchResultItem(
                                external_id=ext_id,
                                title=sh.get("name"),
                                image_url=img_url,
                                description=sh.get("summary", ""),
                                item_type="series",
                                release_date=sh.get("premiered"),
                                popularity=sh.get("weight", 0)
                            ))
                        if len(results) >= 20:
                            break
            except Exception as e:
                print(f"Error in TVMaze schedule fallback: {e}")

        # 3. Final completion fallback from catalog if still < 20
        if len(results) < 20:
            try:
                url = "https://api.tvmaze.com/shows"
                data = cls._tvmaze_request(url, timeout=5)
                if data and isinstance(data, list):
                    series_list = []
                    for show in data:
                        network = show.get("network") if isinstance(show.get("network"), dict) else {}
                        web_channel = show.get("webChannel") if isinstance(show.get("webChannel"), dict) else {}
                        net_country = (network.get("country") or {}).get("code") if isinstance(network.get("country"), dict) else None
                        web_country = (web_channel.get("country") or {}).get("code") if isinstance(web_channel.get("country"), dict) else None
                        country_code = net_country or web_country
                        genres = show.get("genres") or []
                        is_anime = (country_code == "JP" and show.get("type") == "Animation") or "Anime" in genres
                        if not is_anime:
                            series_list.append(show)

                    sorted_shows = sorted(series_list, key=lambda x: (x.get("weight", 0), (x.get("rating") or {}).get("average") or 0), reverse=True)
                    for show in sorted_shows:
                        image_data = show.get("image")
                        image_url = image_data.get("original") or image_data.get("medium") if image_data else None
                        ext_id = f"tvm_{show.get('id')}"
                        norm = (show.get("name") or "").lower().strip()
                        if ext_id not in seen_ids and norm not in seen_titles and image_url:
                            seen_ids.add(ext_id)
                            seen_titles.add(norm)
                            results.append(SearchResultItem(
                                external_id=ext_id,
                                title=show.get("name"),
                                image_url=image_url,
                                description=show.get("summary", ""),
                                item_type="series",
                                release_date=show.get("premiered"),
                                popularity=show.get("weight", 0)
                            ))
                        if len(results) >= 20:
                            break
            except Exception as e:
                print(f"Error in TVMaze fallback trending series: {e}")

        if results:
            TVMazeService._schedule_cache[cache_key] = (now_ts, results)
        return results

    @classmethod
    def get_trending_anime(cls) -> List[SearchResultItem]:
        cache_key = "tvmaze_trending_anime_anilist_v3"
        now_ts = time.time()
        if cache_key in TVMazeService._schedule_cache:
            ts, data = TVMazeService._schedule_cache[cache_key]
            if now_ts - ts < 14400:  # 4 hours
                return data

        import json, urllib.request, datetime, re

        results: List[SearchResultItem] = []
        seen_ids = set()
        seen_titles = set()

        # 1. Fetch current trending anime from AniList (pure community trending algorithm)
        anilist_norms = []
        try:
            url_al = "https://graphql.anilist.co"
            graphql_query = """
            query {
              Page(page: 1, perPage: 35) {
                media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                  id
                  title { romaji english }
                  synonyms
                }
              }
            }
            """
            payload = json.dumps({"query": graphql_query}).encode("utf-8")
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Origin": "https://anilist.co",
                "Referer": "https://anilist.co/"
            }
            req_al = urllib.request.Request(url_al, data=payload, headers=headers)
            with urllib.request.urlopen(req_al, timeout=5) as resp_al:
                if resp_al.status == 200:
                    al_data = json.loads(resp_al.read().decode())
                    al_media = al_data.get("data", {}).get("Page", {}).get("media", [])
                    for item in al_media:
                        t_obj = item.get("title") or {}
                        syns = item.get("synonyms") or []
                        for raw_t in [t_obj.get("english"), t_obj.get("romaji")] + syns:
                            if raw_t:
                                norm = re.sub(r'[^a-z0-9]', '', raw_t.lower())
                                if len(norm) >= 4 and norm not in anilist_norms:
                                    anilist_norms.append(norm)
        except Exception as e:
            print(f"Error fetching AniList trending anime: {e}")

        # 2. Fetch TVMaze anime airing this week (live daily releases)
        today = datetime.date.today()
        anime_map = {}
        for days_ago in [0, 1, 2, 3]:
            d = (today - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d")
            urls = [
                f"https://api.tvmaze.com/schedule?country=JP&date={d}",
                f"https://api.tvmaze.com/schedule/web?date={d}"
            ]
            for u in urls:
                try:
                    sdata = cls._tvmaze_request(u, timeout=4)
                    if sdata and isinstance(sdata, list):
                        for item in sdata:
                            show = item.get("_embedded", {}).get("show") if "_embedded" in item else item.get("show") or item
                            if not show or not isinstance(show, dict) or not show.get("id"):
                                continue
                            network = show.get("network") or {}
                            web_channel = show.get("webChannel") or {}
                            country_code = network.get("country", {}).get("code") or web_channel.get("country", {}).get("code")
                            genres = show.get("genres") or []
                            is_anime = (country_code == "JP" and show.get("type") == "Animation") or "Anime" in genres
                            if is_anime:
                                sid = show.get("id")
                                if sid not in anime_map or show.get("weight", 0) > anime_map[sid].get("weight", 0):
                                    anime_map[sid] = show
                except Exception:
                    continue

        # Sort: first priority is matching AniList trending anime, then by TVMaze live weight/rating
        def anime_sort_key(show):
            name_norm = re.sub(r'[^a-z0-9]', '', (show.get("name") or "").lower())
            is_trending = 1 if any(name_norm in an or an in name_norm for an in anilist_norms if len(an) >= 5) else 0
            weight = show.get("weight", 0)
            avg_rating = (show.get("rating") or {}).get("average") or 0
            return (is_trending, weight, avg_rating)

        sorted_anime = sorted(anime_map.values(), key=anime_sort_key, reverse=True)

        for show in sorted_anime:
            image_data = show.get("image")
            image_url = image_data.get("original") or image_data.get("medium") if image_data else None
            if not image_url:
                continue

            sid = f"tvm_{show.get('id')}"
            norm = (show.get("name") or "").lower().strip()
            if sid not in seen_ids and norm not in seen_titles:
                seen_ids.add(sid)
                seen_titles.add(norm)
                results.append(SearchResultItem(
                    external_id=sid,
                    title=show.get("name"),
                    image_url=image_url,
                    description=show.get("summary", ""),
                    item_type="anime",
                    release_date=show.get("premiered"),
                    popularity=show.get("weight", 0)
                ))
            if len(results) >= 24:
                break

        # Fallback if too few
        if len(results) < 12:
            try:
                url_fb = "https://api.tvmaze.com/shows"
                fb_shows = cls._tvmaze_request(url_fb, timeout=5)
                if fb_shows and isinstance(fb_shows, list):
                    for show in sorted(fb_shows, key=anime_sort_key, reverse=True):
                        network = show.get("network") or {}
                        web_channel = show.get("webChannel") or {}
                        country_code = network.get("country", {}).get("code") or web_channel.get("country", {}).get("code")
                        genres = show.get("genres") or []
                        is_anime = (country_code == "JP" and show.get("type") == "Animation") or "Anime" in genres
                        if is_anime:
                            sid = f"tvm_{show.get('id')}"
                            norm = (show.get("name") or "").lower().strip()
                            image_data = show.get("image")
                            image_url = image_data.get("original") or image_data.get("medium") if image_data else None
                            if image_url and sid not in seen_ids and norm not in seen_titles:
                                seen_ids.add(sid)
                                seen_titles.add(norm)
                                results.append(SearchResultItem(
                                    external_id=sid,
                                    title=show.get("name"),
                                    image_url=image_url,
                                    description=show.get("summary", ""),
                                    item_type="anime",
                                    release_date=show.get("premiered"),
                                    popularity=show.get("weight", 0)
                                ))
                            if len(results) >= 24:
                                break
            except Exception as e:
                print(f"Error in TVMaze fallback anime: {e}")

        if results:
            TVMazeService._schedule_cache[cache_key] = (now_ts, results)
        return results


