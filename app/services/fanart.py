import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

USER_AGENT = settings.USER_AGENT
FANART_API_KEY = settings.FANART_API_KEY
FANART_BASE_URL = "https://webservice.fanart.tv/v3"


class FanartService:
    """
    Centralized and hardened service for Fanart.tv API:
    - Token bucket sliding window pacing (max 10 req/s, min 80ms spacing)
    - Circuit breaker with exponential backoff and Retry-After header parsing on HTTP 429
    - Graceful handling of HTTP 404 (non-existent/empty media entries)
    - In-memory response caching with TTL to eliminate redundant queries
    """

    _lock = threading.Lock()
    _timestamps: deque = deque()
    _blocked_until: float = 0.0
    _consecutive_429s: int = 0
    _cache: Dict[str, Tuple[float, Optional[dict]]] = {}
    _CACHE_TTL = 3600 * 6  # 6 hours in-memory TTL for images

    @classmethod
    def _handle_fanart_rate_limit(cls, headers: Any, url: str):
        """
        Handle HTTP 429 by extracting Retry-After or applying exponential backoff.
        Fanart.tv uses a token bucket with exponential penalties for repeated violations.
        """
        with cls._lock:
            cls._consecutive_429s += 1
            # Exponential backoff base: 30s -> 60s -> 120s -> max 300s
            backoff_base = min(30.0 * (2 ** (cls._consecutive_429s - 1)), 300.0)

            wait_s = backoff_base
            try:
                if headers:
                    retry_after = headers.get("Retry-After")
                    if retry_after:
                        wait_s = max(float(retry_after), wait_s)
                    else:
                        reset_header = headers.get("X-RateLimit-Reset")
                        if reset_header:
                            reset_ts = float(reset_header)
                            diff = reset_ts - time.time()
                            if diff > 0:
                                wait_s = max(diff + 1.0, wait_s)
            except Exception:
                pass

            now = time.time()
            cls._blocked_until = max(cls._blocked_until, now + wait_s)
            logger.warning(
                f"Fanart.tv 429 rate limit hit for '{url}'. "
                f"Consecutive 429s: {cls._consecutive_429s}. "
                f"Circuit breaker active for {wait_s:.1f}s. Halting Fanart.tv requests."
            )

    @classmethod
    def _rate_limit_fanart(cls) -> bool:
        """
        Enforce token-bucket pacing:
        1. Check circuit breaker status.
        2. Clean sliding window (1.0s window, max 10 requests).
        3. Enforce minimum inter-request spacing of 80ms.
        """
        with cls._lock:
            now = time.time()

            # 1. Circuit breaker check
            if cls._blocked_until > now:
                wait_time = cls._blocked_until - now
                if wait_time <= 0.5:
                    time.sleep(wait_time)
                    now = time.time()
                else:
                    logger.info(f"Fanart.tv circuit breaker holding requests (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window (clean timestamps older than 1.0 second)
            while cls._timestamps and cls._timestamps[0] <= now - 1.0:
                cls._timestamps.popleft()

            # Cap: max 10 requests per 1.0 second
            if len(cls._timestamps) >= 10:
                sleep_needed = 1.0 - (now - cls._timestamps[0]) + 0.05
                if sleep_needed > 0:
                    if sleep_needed <= 1.5:
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._timestamps and cls._timestamps[0] <= now - 1.0:
                            cls._timestamps.popleft()
                    else:
                        logger.warning(f"Fanart.tv pacing limit reached (sleep needed: {sleep_needed:.1f}s). Fast failing.")
                        return False

            # 3. Burst limiter protection: min spacing of 80ms between requests
            if cls._timestamps:
                elapsed = now - cls._timestamps[-1]
                if elapsed < 0.08:
                    time.sleep(0.08 - elapsed)
                    now = time.time()

            cls._timestamps.append(now)
            return True

    @classmethod
    def _request(cls, endpoint: str, timeout: float = 3.0) -> Optional[dict]:
        """
        Execute centralized Fanart.tv request with caching, pacing, and 429 handling.
        """
        if not FANART_API_KEY:
            return None

        # Check cache
        cache_key = endpoint.strip()
        now = time.time()
        with cls._lock:
            if cache_key in cls._cache:
                cached_time, cached_val = cls._cache[cache_key]
                if now - cached_time < cls._CACHE_TTL:
                    return cached_val

        if not cls._rate_limit_fanart():
            return None

        url = f"{FANART_BASE_URL}/{endpoint}?api_key={FANART_API_KEY}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode("utf-8", errors="replace"))
                    with cls._lock:
                        cls._cache[cache_key] = (now, data)
                        cls._consecutive_429s = 0  # Reset penalty counter on success
                    return data
                elif res.status == 429:
                    cls._handle_fanart_rate_limit(res.headers, url)
                    return None
        except urllib.error.HTTPError as he:
            if he.code == 429:
                cls._handle_fanart_rate_limit(he.headers, url)
                return None
            elif he.code in (404, 400):
                # 404 simply means no Fanart images available for this entry; cache as None for 1 hour
                with cls._lock:
                    cls._cache[cache_key] = (now, None)
                return None
            else:
                logger.warning(f"Fanart.tv HTTP {he.code} for '{endpoint}': {he}")
                return None
        except Exception as e:
            logger.warning(f"Fanart.tv request error for '{endpoint}': {e}")
            return None

        return None

    @classmethod
    def get_movie_images(cls, imdb_or_tmdb_id: str, timeout: float = 2.5) -> Optional[dict]:
        """Fetch movie images (movieposter, moviebackground, moviebanner, etc.)."""
        if not imdb_or_tmdb_id:
            return None
        return cls._request(f"movies/{imdb_or_tmdb_id}", timeout=timeout)

    @classmethod
    def get_tv_images(cls, tvdb_or_imdb_id: str, timeout: float = 2.5) -> Optional[dict]:
        """Fetch TV series images (showbackground, tvbanner, clearlogo, etc.)."""
        if not tvdb_or_imdb_id:
            return None
        return cls._request(f"tv/{tvdb_or_imdb_id}", timeout=timeout)

    @classmethod
    def get_music_images(cls, mbid: str, timeout: float = 3.0) -> Optional[dict]:
        """Fetch artist music images (artistbackground, musicbanner, etc.)."""
        if not mbid:
            return None
        return cls._request(f"music/{mbid}", timeout=timeout)
