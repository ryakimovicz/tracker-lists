import urllib.request
import urllib.parse
import urllib.error
import json
import time
import re
import math
import logging
import threading
from collections import deque
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

from app.services.base import SearchResultItem
from app.core.config import settings

logger = logging.getLogger(__name__)


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

    # Rate limiting & sliding window pacing state (Trakt allows 500 GET req / 5 min per Client ID + public IP)
    _rate_limit_lock = threading.Lock()
    _request_timestamps = deque()
    _blocked_until: float = 0.0  # Unix timestamp until which Trakt calls are paused (circuit breaker)

    @classmethod
    def _build_headers(cls) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "trakt-api-version": "2",
            "trakt-api-key": cls.get_client_id(),
            "User-Agent": settings.USER_AGENT
        }

    @classmethod
    def _update_rate_limit_from_headers(cls, headers: Any) -> None:
        """Inspect Trakt rate limit headers (X-Ratelimit and Retry-After) to proactively back off."""
        if not headers:
            return
        now = time.time()
        try:
            # 1. Parse Retry-After if present
            retry_after = headers.get("Retry-After")
            if retry_after:
                try:
                    wait_s = float(retry_after) + 1.5
                    with cls._rate_limit_lock:
                        if now + wait_s > cls._blocked_until:
                            cls._blocked_until = now + wait_s
                            logger.warning(f"Trakt Retry-After header received: pausing requests for {wait_s:.1f}s.")
                except Exception:
                    pass

            # 2. Parse X-Ratelimit JSON object if present
            raw_rl = headers.get("X-Ratelimit")
            if raw_rl:
                try:
                    rl_data = json.loads(raw_rl) if isinstance(raw_rl, str) else raw_rl
                    rem = int(rl_data.get("remaining", 999))
                    until_str = rl_data.get("until")
                    period = float(rl_data.get("period", 300))

                    if until_str:
                        clean_until = until_str.replace("Z", "+00:00")
                        until_ts = datetime.fromisoformat(clean_until).timestamp()
                    else:
                        until_ts = now + period

                    # Safety fuse: if 15 or fewer requests remain out of 500 in this 5-min window,
                    # proactively pause outgoing requests until window reset
                    if rem <= 15 and until_ts > now:
                        with cls._rate_limit_lock:
                            if until_ts + 1.0 > cls._blocked_until:
                                cls._blocked_until = until_ts + 1.0
                                logger.warning(
                                    f"Trakt quota nearing limit ({rem} remaining in 5-min window). "
                                    f"Proactively pausing requests until reset at {datetime.fromtimestamp(cls._blocked_until).isoformat()}."
                                )
                except Exception as ex_rl:
                    logger.debug(f"Could not parse Trakt X-Ratelimit header: {ex_rl}")
        except Exception as e:
            logger.debug(f"Failed to process Trakt rate limit headers: {e}")

    @classmethod
    def _handle_429(cls, headers: Any, url: str) -> None:
        """Handle 429 Too Many Requests by activating an immediate global circuit breaker."""
        now = time.time()
        wait_s = 60.0
        try:
            if headers:
                retry_after = headers.get("Retry-After")
                raw_rl = headers.get("X-Ratelimit")
                if retry_after:
                    wait_s = float(retry_after) + 2.0
                elif raw_rl:
                    rl_data = json.loads(raw_rl) if isinstance(raw_rl, str) else raw_rl
                    until_str = rl_data.get("until")
                    if until_str:
                        clean_until = until_str.replace("Z", "+00:00")
                        wait_s = max(float(datetime.fromisoformat(clean_until).timestamp() - now), 5.0) + 2.0
                    else:
                        wait_s = float(rl_data.get("period", 60)) + 2.0
        except Exception:
            pass

        with cls._rate_limit_lock:
            cls._blocked_until = now + wait_s

        logger.error(f"Trakt 429 rate limit reached for '{url}'. Global circuit breaker active for {wait_s:.1f}s. Halting requests.")

    @classmethod
    def _rate_limit_trakt(cls) -> bool:
        """Enforce respectful sliding window pacing (max 450 req / 300s) and honor circuit breaker."""
        with cls._rate_limit_lock:
            now = time.time()

            # 1. Check circuit breaker / active rate limit
            if cls._blocked_until > now:
                wait_time = cls._blocked_until - now
                if wait_time <= 1.5:
                    time.sleep(wait_time)
                    now = time.time()
                else:
                    logger.info(f"Trakt rate limiter holding requests (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window: clean timestamps older than 300 seconds (5 minutes)
            while cls._request_timestamps and cls._request_timestamps[0] <= now - 300.0:
                cls._request_timestamps.popleft()

            # 3. Controlled cap: max 450 requests per 300 seconds (Trakt allows 500)
            if len(cls._request_timestamps) >= 450:
                sleep_needed = 300.0 - (now - cls._request_timestamps[0]) + 0.5
                if sleep_needed > 0:
                    if sleep_needed <= 2.0:
                        logger.info(f"Trakt sliding window rate pacing (450/5min), waiting {sleep_needed:.1f}s...")
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._request_timestamps and cls._request_timestamps[0] <= now - 300.0:
                            cls._request_timestamps.popleft()
                    else:
                        cls._blocked_until = now + sleep_needed
                        return False

            # 4. Enforce minimum spacing of 0.05 seconds between consecutive requests
            if cls._request_timestamps:
                elapsed = now - cls._request_timestamps[-1]
                if elapsed < 0.05:
                    time.sleep(0.05 - elapsed)
                    now = time.time()

            cls._request_timestamps.append(now)
            return True

    @classmethod
    def _trakt_request(cls, url: str, timeout: int = 5) -> Optional[Any]:
        """Central HTTP request runner with rate limiting, proactive header tracking, and 429 backoff."""
        if not cls._rate_limit_trakt():
            return None

        client_id = cls.get_client_id()
        if not client_id:
            logger.warning("TRAKT_CLIENT_ID is not configured in settings")
            return None

        req = urllib.request.Request(url, headers=cls._build_headers())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                cls._update_rate_limit_from_headers(res.headers)
                if res.status == 200:
                    return json.loads(res.read().decode())
                elif res.status == 429:
                    cls._handle_429(res.headers, url)
                    return None
        except urllib.error.HTTPError as he:
            cls._update_rate_limit_from_headers(he.headers)
            if he.code == 429:
                cls._handle_429(he.headers, url)
                return None
            logger.warning(f"Trakt HTTP {he.code} for '{url}': {he}")
            return None
        except Exception as e:
            logger.warning(f"Trakt request error for '{url}': {e}")
            return None
        return None

    @classmethod
    def get_rate_limit_status(cls) -> Optional[dict]:
        """Provides status for search router and frontend warning banner if Trakt is limited."""
        now = time.time()
        if cls._blocked_until > now:
            return {
                "category": "movie",
                "reason": "temporary_limit",
                "reset_at": cls._blocked_until
            }
        return None

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
        if not imdb_id:
            return None

        from app.services.fanart import FanartService
        data = FanartService.get_movie_images(imdb_id, timeout=3.0)
        if data and isinstance(data, dict):
            posters = data.get("movieposter", [])
            if posters:
                return posters[0].get("url")
        return None

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

        data = cls._trakt_request(url, timeout=5)
        if data and isinstance(data, dict):
            result = cls._format_movie_item(data, override_external_id=external_id)
            cls._details_cache[cache_key] = (time.time(), result)
            return result

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
        data = cls._trakt_request(url, timeout=5)
        if data and isinstance(data, list):
            from app.core.sfw_filter import is_safe_media_item
            for entry in data:
                movie_data = entry.get("movie")
                if movie_data:
                    item = cls._format_movie_item(movie_data)
                    if is_safe_media_item(item.title, item.description):
                        results.append(item)

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

        data = cls._trakt_request(url, timeout=5)
        if data and isinstance(data, list):
            from app.core.sfw_filter import is_safe_media_item
            for entry in data:
                movie_data = entry.get("movie")
                if movie_data:
                    item = cls._format_movie_item(movie_data)
                    if is_safe_media_item(item.title, item.description):
                        results.append(item)

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

        data = cls._trakt_request(url, timeout=4)
        if data and isinstance(data, list):
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
                if imdb_id:
                    try:
                        from app.services.fanart import FanartService
                        fan_data = FanartService.get_movie_images(imdb_id, timeout=2.0)
                        if fan_data and isinstance(fan_data, dict):
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
        data = cls._trakt_request(cal_url, timeout=7)
        if data and isinstance(data, list):
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

        # 2. Box office supplement (films currently in theaters within the requested window)
        bo_url = "https://api.trakt.tv/movies/boxoffice?extended=full,images"
        bo_data = cls._trakt_request(bo_url, timeout=5)
        if bo_data and isinstance(bo_data, list):
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

        # Sort descending by release date (upcoming films in next 14 days, followed by current & last week)
        results.sort(key=lambda x: str(x.release_date or ""), reverse=True)

        if results:
            cls._search_cache[cache_key] = (now_ts, results)

        return results
