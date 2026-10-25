import urllib.request
import urllib.parse
import json
import time
import re
import math
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

from app.services.base import SearchResultItem
from app.core.config import settings


class TraktService:
    @classmethod
    def get_client_id(cls) -> str:
        return settings.TRAKT_CLIENT_ID or ""

    # In-memory caches to save API requests and honor rate limits
    _details_cache: Dict[str, Tuple[float, SearchResultItem]] = {}
    _search_cache: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
    _fanart_cache: Dict[str, Optional[str]] = {}
    
    CACHE_TTL_DETAILS = 3600 * 24  # 24 hours
    CACHE_TTL_SEARCH = 3600 * 2    # 2 hours
    CACHE_TTL_EXPLORE = 3600 * 4   # 4 hours

    @classmethod
    def _build_headers(cls) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "trakt-api-version": "2",
            "trakt-api-key": cls.get_client_id(),
            "User-Agent": settings.USER_AGENT
        }

    @classmethod
    def _resolve_image_url(cls, raw_path: Optional[str]) -> Optional[str]:
        if not raw_path or not isinstance(raw_path, str):
            return None
        raw_path = raw_path.strip()
        if not raw_path:
            return None
        if raw_path.startswith("http://") or raw_path.startswith("https://"):
            return raw_path
        return f"https://{raw_path}"

    @classmethod
    def _get_fanart_fallback(cls, imdb_id: Optional[str]) -> Optional[str]:
        if not settings.FANART_API_KEY or not imdb_id:
            return None

        if imdb_id in cls._fanart_cache:
            return cls._fanart_cache[imdb_id]

        url = f"https://webservice.fanart.tv/v3/movies/{imdb_id}?api_key={settings.FANART_API_KEY}"
        req = urllib.request.Request(url, headers={"User-Agent": settings.USER_AGENT})

        poster_url = None
        try:
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    posters = data.get("movieposter", [])
                    if posters:
                        poster_url = posters[0].get("url")
        except Exception:
            pass

        cls._fanart_cache[imdb_id] = poster_url
        return poster_url

    @classmethod
    def _format_movie_item(cls, data: dict, override_external_id: Optional[str] = None) -> SearchResultItem:
        ids = data.get("ids", {})
        trakt_id = ids.get("trakt")
        imdb_id = ids.get("imdb")

        # Prioritize override_external_id (e.g. omdb_tt0111161) to preserve existing user library items
        if override_external_id and str(override_external_id).startswith("trakt_"):
            external_id = override_external_id
        elif trakt_id:
            external_id = f"trakt_{trakt_id}"
        elif ids.get("slug"):
            external_id = f"trakt_{ids.get('slug')}"
        elif imdb_id:
            external_id = f"trakt_{imdb_id}"
        elif override_external_id:
            external_id = override_external_id
        else:
            import hashlib
            external_id = f"trakt_{hashlib.md5(str(data.get('title')).encode()).hexdigest()[:10]}"

        # Resolve image: poster -> fanart -> thumb -> Fanart.tv fallback
        images = data.get("images", {})
        poster_list = images.get("poster") or []
        fanart_list = images.get("fanart") or []
        thumb_list = images.get("thumb") or []

        image_url = None
        if poster_list and poster_list[0]:
            image_url = cls._resolve_image_url(poster_list[0])
        elif thumb_list and thumb_list[0]:
            image_url = cls._resolve_image_url(thumb_list[0])
        elif fanart_list and fanart_list[0]:
            image_url = cls._resolve_image_url(fanart_list[0])

        if not image_url and imdb_id:
            image_url = cls._get_fanart_fallback(imdb_id)

        # Release date and upcoming status
        release_date = data.get("released") or (str(data.get("year")) if data.get("year") else None)
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        is_upcoming = False
        if release_date and str(release_date) > today_str:
            is_upcoming = True
        elif data.get("status") in ("in production", "planned", "post production"):
            is_upcoming = True

        # Popularity score based on votes
        votes = data.get("votes") or 0
        pop_score = min(100.0, round(math.log10(votes + 1) * 15.0, 2)) if votes > 0 else 0.0

        runtime = data.get("runtime")

        return SearchResultItem(
            external_id=external_id,
            title=data.get("title") or "Untitled Movie",
            image_url=image_url,
            description=data.get("overview") or "",
            item_type="movie",
            release_date=str(release_date) if release_date else None,
            popularity=pop_score,
            imdb_id=imdb_id,
            page_count=runtime if isinstance(runtime, int) else None,
            status="Upcoming" if is_upcoming else None,
            badge="upcoming" if is_upcoming else None
        )

    @classmethod
    def get_movie_detail(cls, external_id: str) -> Optional[SearchResultItem]:
        client_id = cls.get_client_id()
        if not external_id or not client_id:
            return None

        # Check in-memory details cache
        cache_key = external_id.strip()
        if cache_key in cls._details_cache:
            ts, cached_item = cls._details_cache[cache_key]
            if time.time() - ts < cls.CACHE_TTL_DETAILS:
                return cached_item

        # Extract lookup ID for Trakt API:
        # Handles "omdb_tt1104001", "trakt_12345", "tt1104001", "12345", or slug
        lookup_id = external_id.strip()
        if lookup_id.startswith("omdb_"):
            lookup_id = lookup_id.replace("omdb_", "").strip()
        elif lookup_id.startswith("trakt_"):
            lookup_id = lookup_id.replace("trakt_", "").strip()

        if not lookup_id:
            return None

        encoded_id = urllib.parse.quote(lookup_id)
        url = f"https://api.trakt.tv/movies/{encoded_id}?extended=full,images"

        try:
            req = urllib.request.Request(url, headers=cls._build_headers())
            with urllib.request.urlopen(req, timeout=4) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode())
                    result = cls._format_movie_item(data, override_external_id=external_id)
                    cls._details_cache[cache_key] = (time.time(), result)
                    return result
        except Exception as e:
            print(f"Trakt get_movie_detail error for {external_id} ({lookup_id}): {e}")

        return None

    @classmethod
    def search_movies(cls, query: str) -> List[SearchResultItem]:
        client_id = cls.get_client_id()
        if not query or not client_id:
            return []

        cache_key = query.strip().lower()
        if cache_key in cls._search_cache:
            ts, cached_results = cls._search_cache[cache_key]
            if time.time() - ts < cls.CACHE_TTL_SEARCH:
                return cached_results

        encoded_query = urllib.parse.quote(query.strip())
        url = f"https://api.trakt.tv/search/movie?query={encoded_query}&extended=full,images&limit=24"

        results: List[SearchResultItem] = []
        try:
            req = urllib.request.Request(url, headers=cls._build_headers())
            with urllib.request.urlopen(req, timeout=4) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode())
                    from app.core.sfw_filter import is_safe_media_item
                    for entry in data:
                        movie_data = entry.get("movie")
                        if movie_data:
                            item = cls._format_movie_item(movie_data)
                            if is_safe_media_item(item.title, item.description):
                                results.append(item)
        except Exception as e:
            print(f"Trakt search_movies error: {e}")

        if results:
            cls._search_cache[cache_key] = (time.time(), results)

        return results

    @classmethod
    def get_trending_movies(cls) -> List[SearchResultItem]:
        cache_key = "_trakt_trending_movies_v1"
        now_ts = time.time()
        if cache_key in cls._search_cache:
            ts, data = cls._search_cache[cache_key]
            if now_ts - ts < cls.CACHE_TTL_EXPLORE:
                return data

        client_id = cls.get_client_id()
        if not client_id:
            return []

        url = "https://api.trakt.tv/movies/trending?extended=full,images&limit=24"
        results: List[SearchResultItem] = []

        try:
            req = urllib.request.Request(url, headers=cls._build_headers())
            with urllib.request.urlopen(req, timeout=5) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode())
                    from app.core.sfw_filter import is_safe_media_item
                    for entry in data:
                        movie_data = entry.get("movie")
                        if movie_data:
                            item = cls._format_movie_item(movie_data)
                            if is_safe_media_item(item.title, item.description):
                                results.append(item)
        except Exception as e:
            print(f"Trakt get_trending_movies error: {e}")

        if results:
            cls._search_cache[cache_key] = (now_ts, results)

        return results

    @classmethod
    def search_movie_banners(cls, query: str) -> List[Dict[str, Any]]:
        """Returns fanarts, wallpapers, and banners from Trakt and Fanart.tv"""
        client_id = cls.get_client_id()
        if not query or not client_id:
            return []

        results: List[Dict[str, Any]] = []
        seen = set()

        encoded = urllib.parse.quote(query.strip())
        url = f"https://api.trakt.tv/search/movie?query={encoded}&extended=full,images&limit=8"

        try:
            req = urllib.request.Request(url, headers=cls._build_headers())
            with urllib.request.urlopen(req, timeout=3.5) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode())
                    for entry in data:
                        m = entry.get("movie") or {}
                        title = m.get("title") or query
                        images = m.get("images") or {}

                        # Trakt fanarts & banners
                        for fan in images.get("fanart") or []:
                            resolved = cls._resolve_image_url(fan)
                            if resolved and resolved not in seen:
                                seen.add(resolved)
                                results.append({
                                    "title": title,
                                    "image_url": resolved,
                                    "category": "movie",
                                    "origin": title,
                                    "kind": "wallpaper"
                                })
                        for ban in images.get("banner") or []:
                            resolved = cls._resolve_image_url(ban)
                            if resolved and resolved not in seen:
                                seen.add(resolved)
                                results.append({
                                    "title": title,
                                    "image_url": resolved,
                                    "category": "movie",
                                    "origin": title,
                                    "kind": "banner"
                                })

                        # Fanart.tv backgrounds if FANART_API_KEY is present
                        imdb_id = m.get("ids", {}).get("imdb")
                        if settings.FANART_API_KEY and imdb_id:
                            try:
                                fan_url = f"https://webservice.fanart.tv/v3/movies/{imdb_id}?api_key={settings.FANART_API_KEY}"
                                req_fan = urllib.request.Request(fan_url, headers={"User-Agent": settings.USER_AGENT})
                                with urllib.request.urlopen(req_fan, timeout=2.0) as resp_f:
                                    if resp_f.status == 200:
                                        fan_data = json.loads(resp_f.read().decode())
                                        for bg in fan_data.get("moviebackground", [])[:3]:
                                            bg_url = bg.get("url")
                                            if bg_url and bg_url not in seen:
                                                seen.add(bg_url)
                                                results.append({
                                                    "title": title,
                                                    "image_url": bg_url,
                                                    "category": "movie",
                                                    "origin": title,
                                                    "kind": "wallpaper"
                                                })
                                        for mb in fan_data.get("moviebanner", [])[:2]:
                                            mb_url = mb.get("url")
                                            if mb_url and mb_url not in seen:
                                                seen.add(mb_url)
                                                results.append({
                                                    "title": title,
                                                    "image_url": mb_url,
                                                    "category": "movie",
                                                    "origin": title,
                                                    "kind": "banner"
                                                })
                            except Exception:
                                pass
        except Exception as e:
            print(f"Trakt search_movie_banners error: {e}")

        return results

    @classmethod
    def get_new_movies(cls) -> List[SearchResultItem]:
        from datetime import datetime, timedelta
        today = datetime.utcnow()
        min_date = (today - timedelta(days=14)).strftime("%Y-%m-%d")
        max_date = (today + timedelta(days=14)).strftime("%Y-%m-%d")

        cache_key = f"_trakt_new_movies_window_{min_date}_{max_date}"
        now_ts = time.time()
        if cache_key in cls._search_cache:
            ts, data = cls._search_cache[cache_key]
            if now_ts - ts < cls.CACHE_TTL_EXPLORE:
                return data

        client_id = cls.get_client_id()
        if not client_id:
            return []

        results: List[SearchResultItem] = []
        seen_ids = set()
        from app.core.sfw_filter import is_safe_media_item

        # 1. Official theatrical calendar: 14 days back (last week & current week) to 14 days forward (+2 weeks)
        cal_url = f"https://api.trakt.tv/calendars/all/movies/{min_date}/28?extended=full,images"
        try:
            req = urllib.request.Request(cal_url, headers=cls._build_headers())
            with urllib.request.urlopen(req, timeout=7) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode())
                    for entry in data:
                        movie_data = entry.get("movie")
                        if not movie_data:
                            continue
                        rel_date = entry.get("released") or movie_data.get("released")
                        movie_year = movie_data.get("year") or 0
                        # Enforce strict 4-week window (previous week, current week, and up to 2 weeks ahead)
                        if not rel_date or str(rel_date) < min_date or str(rel_date) > max_date:
                            continue
                        # Exclude vintage catalog re-releases (e.g. 1991 movies)
                        if movie_year < today.year - 1:
                            continue
                        movie_data["released"] = rel_date
                        item = cls._format_movie_item(movie_data)
                        if item.external_id not in seen_ids and is_safe_media_item(item.title, item.description):
                            seen_ids.add(item.external_id)
                            results.append(item)
        except Exception as e:
            print(f"Trakt get_new_movies (calendar) error: {e}")

        # 2. Box office supplement (films currently in theaters within the requested window)
        try:
            bo_url = "https://api.trakt.tv/movies/boxoffice?extended=full,images"
            req_bo = urllib.request.Request(bo_url, headers=cls._build_headers())
            with urllib.request.urlopen(req_bo, timeout=5) as res_bo:
                if res_bo.status == 200:
                    bo_data = json.loads(res_bo.read().decode())
                    for entry in bo_data:
                        movie_data = entry.get("movie")
                        if not movie_data:
                            continue
                        rel_date = movie_data.get("released")
                        movie_year = movie_data.get("year") or 0
                        if not rel_date or str(rel_date) < min_date or str(rel_date) > max_date:
                            continue
                        if movie_year < today.year - 1:
                            continue
                        item = cls._format_movie_item(movie_data)
                        if item.external_id not in seen_ids and is_safe_media_item(item.title, item.description):
                            seen_ids.add(item.external_id)
                            results.append(item)
        except Exception as e:
            print(f"Trakt get_new_movies (box office) error: {e}")

        # Sort descending by release date (upcoming films in next 14 days, followed by current & last week)
        results.sort(key=lambda x: str(x.release_date or ""), reverse=True)

        if results:
            cls._search_cache[cache_key] = (now_ts, results)

        return results
