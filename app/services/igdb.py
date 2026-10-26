import json
import logging
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from app.core.config import settings
from app.services.base import SearchResultItem

logger = logging.getLogger(__name__)


class IGDBService:
    """
    Centralized and hardened service for IGDB (Internet Game Database) API v4:
    - Thread-safe Twitch OAuth2 token acquisition and automatic refresh on expiry/401
    - Rate limit compliance: max 4 requests per second with burst pacing (min 260ms spacing)
    - Strict concurrency cap: max 6 open requests (respecting IGDB's 8 concurrent requests maximum)
    - Circuit breaker with exponential backoff and Retry-After header parsing on HTTP 429
    - In-memory response caching with TTL to alleviate API pressure as recommended by IGDB FAQ
    """

    _token_lock = threading.Lock()
    _access_token: Optional[str] = None
    _token_expiry: Optional[datetime] = None

    _lock = threading.Lock()
    _timestamps: deque = deque()
    _blocked_until: float = 0.0
    _consecutive_429s: int = 0
    _concurrency_semaphore = threading.BoundedSemaphore(6)

    _cache_lock = threading.Lock()
    _cache: Dict[str, Tuple[float, Any]] = {}
    _CACHE_MAX_ENTRIES = 1200

    @classmethod
    def _invalidate_token(cls):
        """Invalidate cached Twitch access token to force re-authentication."""
        with cls._token_lock:
            cls._access_token = None
            cls._token_expiry = None

    @classmethod
    def _get_access_token(cls) -> Optional[str]:
        """
        Thread-safe token acquisition with double-checked locking and 5-minute expiry buffer.
        Twitch allows max 25 active access tokens per client_id.
        """
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        client_secret = getattr(settings, "TWITCH_CLIENT_SECRET", None)

        if not client_id or not client_secret:
            return None

        now = datetime.now()
        if cls._access_token and cls._token_expiry and now < cls._token_expiry:
            return cls._access_token

        with cls._token_lock:
            now = datetime.now()
            if cls._access_token and cls._token_expiry and now < cls._token_expiry:
                return cls._access_token

            url = (
                f"https://id.twitch.tv/oauth2/token?client_id={client_id}"
                f"&client_secret={client_secret}&grant_type=client_credentials"
            )
            req = urllib.request.Request(url, method="POST", headers={"User-Agent": settings.USER_AGENT})

            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        cls._access_token = data.get("access_token")
                        expires_in = data.get("expires_in", 3600)
                        # Buffer of 5 minutes before expiration
                        cls._token_expiry = datetime.now() + timedelta(seconds=max(expires_in - 300, 60))
                        logger.info("Successfully refreshed Twitch/IGDB access token")
                        return cls._access_token
            except Exception as e:
                logger.error(f"IGDB Auth Error: {e}")
            return None

    @classmethod
    def _handle_igdb_rate_limit(cls, headers: Any, url: str):
        """
        Handle HTTP 429 rate limiting:
        Extract Retry-After header or apply exponential backoff (15s -> 30s -> 60s -> 120s -> max 300s).
        """
        with cls._lock:
            cls._consecutive_429s += 1
            backoff_base = min(15.0 * (2 ** (cls._consecutive_429s - 1)), 300.0)

            wait_s = backoff_base
            try:
                if headers:
                    retry_after = headers.get("Retry-After")
                    if retry_after:
                        wait_s = max(float(retry_after), 10.0)
                    else:
                        reset_header = headers.get("X-RateLimit-Reset")
                        if reset_header:
                            diff = float(reset_header) - time.time()
                            if diff > 0:
                                wait_s = max(diff + 1.0, 10.0)
            except Exception:
                pass

            now = time.time()
            cls._blocked_until = max(cls._blocked_until, now + wait_s)
            logger.warning(
                f"IGDB 429 rate limit hit for '{url}'. "
                f"Consecutive 429s: {cls._consecutive_429s}. "
                f"Circuit breaker active for {wait_s:.1f}s. Halting IGDB requests."
            )

    @classmethod
    def get_rate_limit_status(cls) -> Optional[dict]:
        """
        Returns active cooldown status if IGDB circuit breaker is open.
        """
        now = time.time()
        if cls._blocked_until > now:
            return {
                "category": "game",
                "reason": "rate_limit_cooldown",
                "reset_at": cls._blocked_until
            }
        return None

    @classmethod
    def _rate_limit_igdb(cls) -> bool:
        """
        Enforce token-bucket sliding window pacing:
        1. Check circuit breaker.
        2. Clean sliding window (1.0s window, max 4 requests).
        3. Enforce minimum spacing of 260ms between requests (peak ~3.84 req/s).
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
                    logger.info(f"IGDB circuit breaker holding requests (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window (clean timestamps older than 1.0 second)
            while cls._timestamps and cls._timestamps[0] <= now - 1.0:
                cls._timestamps.popleft()

            # Cap: max 4 requests per 1.0 second
            if len(cls._timestamps) >= 4:
                sleep_needed = 1.0 - (now - cls._timestamps[0]) + 0.05
                if sleep_needed > 0:
                    if sleep_needed <= 1.5:
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._timestamps and cls._timestamps[0] <= now - 1.0:
                            cls._timestamps.popleft()
                    else:
                        logger.warning(f"IGDB pacing capacity reached (sleep needed: {sleep_needed:.1f}s). Fast failing.")
                        return False

            # 3. Burst limiter protection: min spacing of 260ms between requests
            if cls._timestamps:
                elapsed = now - cls._timestamps[-1]
                if elapsed < 0.26:
                    time.sleep(0.26 - elapsed)
                    now = time.time()

            cls._timestamps.append(now)
            return True

    @classmethod
    def _save_to_cache(cls, cache_key: str, data: Any):
        with cls._cache_lock:
            if len(cls._cache) >= cls._CACHE_MAX_ENTRIES:
                now = time.time()
                cls._cache = {
                    k: v for k, v in cls._cache.items()
                    if now - v[0] < 3600
                }
                if len(cls._cache) >= cls._CACHE_MAX_ENTRIES:
                    sorted_items = sorted(cls._cache.items(), key=lambda item: item[1][0])
                    cls._cache = dict(sorted_items[len(sorted_items) // 4:])
            cls._cache[cache_key] = (time.time(), data)

    @classmethod
    def apicalypse_request(
        cls,
        endpoint: str,
        body: str,
        timeout: float = 8.0,
        use_cache: bool = True,
        cache_ttl: int = 900
    ) -> Optional[List[dict]]:
        """
        Executes an APICalypse query against https://api.igdb.com/v4/{endpoint}
        with strict concurrency limiting (max 6 open requests), token pacing (4 req/s),
        in-memory TTL caching, token refresh on 401, and circuit breaking on 429.
        """
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()
        if not client_id or not token:
            return None

        clean_endpoint = endpoint.strip().lstrip("/")
        clean_body = body.strip()
        cache_key = f"{clean_endpoint}:{clean_body}"
        now = time.time()

        # 1. Cache lookup
        if use_cache:
            with cls._cache_lock:
                if cache_key in cls._cache:
                    cached_ts, cached_data = cls._cache[cache_key]
                    if now - cached_ts < cache_ttl:
                        return cached_data

        # 2. Concurrency limiting (Max 6 open requests across whole application)
        acquired = cls._concurrency_semaphore.acquire(timeout=8.0)
        if not acquired:
            logger.warning("IGDB concurrency limit reached (all 6 request slots active). Fast-failing.")
            return None

        try:
            # 3. Rate limiting & burst spacing
            if not cls._rate_limit_igdb():
                return None

            url = f"https://api.igdb.com/v4/{clean_endpoint}"

            def make_request(current_token: str):
                headers = {
                    "Client-ID": client_id,
                    "Authorization": f"Bearer {current_token}",
                    "Accept": "application/json",
                    "User-Agent": settings.USER_AGENT
                }
                req = urllib.request.Request(url, data=clean_body.encode("utf-8"), headers=headers)
                return urllib.request.urlopen(req, timeout=timeout)

            response = None
            try:
                response = make_request(token)
            except urllib.error.HTTPError as he:
                if he.code == 401:
                    logger.warning("IGDB 401 Unauthorized received. Refreshing Twitch token and retrying once...")
                    cls._invalidate_token()
                    new_token = cls._get_access_token()
                    if new_token:
                        try:
                            response = make_request(new_token)
                        except urllib.error.HTTPError as retry_he:
                            if retry_he.code == 429:
                                cls._handle_igdb_rate_limit(retry_he.headers, url)
                            else:
                                logger.error(f"IGDB retry failed with HTTP {retry_he.code}: {retry_he.reason}")
                            return None
                    else:
                        logger.error("Failed to re-authenticate with Twitch after 401")
                        return None
                elif he.code == 429:
                    cls._handle_igdb_rate_limit(he.headers, url)
                    return None
                else:
                    logger.error(f"IGDB HTTP error {he.code} on {clean_endpoint}: {he.reason}")
                    return None
            except Exception as e:
                logger.error(f"IGDB network error on {clean_endpoint}: {e}")
                return None

            if response and response.status == 200:
                try:
                    raw_data = response.read().decode("utf-8", errors="replace")
                    data = json.loads(raw_data)
                    if isinstance(data, list):
                        if use_cache:
                            cls._save_to_cache(cache_key, data)
                        with cls._lock:
                            cls._consecutive_429s = 0
                        return data
                    return []
                except Exception as e:
                    logger.error(f"IGDB JSON parse error: {e}")
                    return []
                finally:
                    response.close()
            elif response and response.status == 429:
                cls._handle_igdb_rate_limit(response.headers, url)
                return None

            return []
        finally:
            cls._concurrency_semaphore.release()

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

        safe_query = query.replace('"', '\\"')
        fields_str = (
            "fields id, name, status, category, game_type, parent_game, version_parent, "
            "cover.image_id, first_release_date, summary, total_rating, rating_count, "
            "hypes, follows, themes, age_ratings.rating;"
        )
        body = f'search "{safe_query}"; {fields_str} limit 100;'

        try:
            data = cls.apicalypse_request("games", body, timeout=8.0, use_cache=True, cache_ttl=900) or []

            # If full-text search yielded 0 items (e.g. stopwords), fallback to wildcard matching
            if not data:
                body_where = f'where name ~ *"{safe_query}"*; {fields_str} limit 100;'
                data = cls.apicalypse_request("games", body_where, timeout=8.0, use_cache=True, cache_ttl=900) or []

            if not data:
                return []

            # Smart sorting: Collections -> Editions -> Base Games -> Expansions -> DLCs
            def calculate_score(item):
                name = item.get("name", "")
                name_lower = name.lower().strip()
                cat = item.get("game_type") if item.get("game_type") is not None else item.get("category", 0)
                has_version_parent = bool(item.get("version_parent"))

                if cat == 3 and not has_version_parent:
                    tier = 0
                elif cat == 10 or (cat in (0, 3) and has_version_parent):
                    tier = 1
                elif cat in (0, 8, 9, None):
                    tier = 2
                elif cat in (2, 4, 6):
                    tier = 3
                else:
                    tier = 4

                rating_count = item.get("rating_count") or 0
                hypes = item.get("hypes") or 0
                follows = item.get("follows") or 0
                total_rating = item.get("total_rating") or 0

                q_lower = query.lower().strip()
                exact_boost = 500 if name_lower == q_lower else (150 if name_lower.startswith(q_lower) else 0)

                cover_boost = 100 if item.get("cover") else -200
                has_date_boost = 50 if item.get("first_release_date") else -50
                has_summary_boost = 30 if item.get("summary") else 0

                pop_score = (
                    (rating_count * 5)
                    + (hypes * 3)
                    + (follows * 3)
                    + (total_rating / 5.0)
                    + exact_boost
                    + cover_boost
                    + has_date_boost
                    + has_summary_boost
                )
                return (tier, -pop_score)

            sorted_items = sorted(data, key=calculate_score)

            results = []
            for item in sorted_items:
                image_url = None
                cover = item.get("cover")
                if cover and cover.get("image_id"):
                    image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"

                release_date = None
                release_ts = item.get("first_release_date")
                if release_ts:
                    try:
                        release_date = datetime.fromtimestamp(release_ts).strftime("%Y-%m-%d")
                    except Exception:
                        pass

                pop_val = None
                total_rating = item.get("total_rating")
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

                themes = item.get("themes") or []
                age_ratings = [ar.get("rating") for ar in item.get("age_ratings", []) if isinstance(ar, dict)]
                game_title = item.get("name") or "Untitled Game"

                from app.core.sfw_filter import is_safe_media_item
                if 42 in themes or not is_safe_media_item(game_title, desc):
                    continue

                cat = item.get("game_type") if item.get("game_type") is not None else item.get("category", 0)
                has_version_parent = bool(item.get("version_parent"))
                game_status_val = item.get("status")

                badge = None
                if cat in (2, 4, 6):
                    badge = "expansion"
                elif cat == 5:
                    badge = "mod"
                elif cat in (1, 13, 14):
                    badge = "dlc"
                elif cat == 10 or (cat in (0, 3) and has_version_parent):
                    badge = "edition"
                elif cat == 3 and not has_version_parent:
                    badge = "collection"
                elif cat == 8:
                    badge = "remake"
                elif cat == 9:
                    badge = "remaster"
                elif game_status_val in (2, 3, 4, 7) or (not release_date and (item.get("hypes", 0) > 0 or item.get("follows", 0) > 0)):
                    badge = "upcoming"

                mapped_status = "Upcoming" if (badge == "upcoming" or game_status_val in (2, 3, 4, 7)) else None

                results.append(
                    SearchResultItem(
                        external_id=str(item.get("id")),
                        title=game_title,
                        image_url=image_url,
                        description=desc,
                        item_type="game",
                        release_date=release_date,
                        popularity=pop_val,
                        status=mapped_status,
                        badge=badge
                    )
                )
            return results

        except Exception as e:
            logger.error(f"IGDB API Search Error: {e}")
            return []

    @classmethod
    def get_game_relations(cls, game_id: str):
        """
        Fetches bidirectional relations for a game with in-memory TTL caching:
        - collections/bundles containing this game
        - bundle_games: games included in this bundle
        - editions: alternative versions (GOTY, remakes, remasters, version_parent)
        - dlcs: expansions, DLCs, standalone expansions
        - parent_game: base game
        """
        try:
            gid = int(game_id)
        except (ValueError, TypeError):
            return {}

        cache_key = f"relations:{gid}"
        now = time.time()
        with cls._cache_lock:
            if cache_key in cls._cache:
                cached_ts, cached_val = cls._cache[cache_key]
                if now - cached_ts < 3600:
                    return cached_val

        def format_item(item_data):
            if not item_data or not isinstance(item_data, dict):
                return None
            image_url = None
            cover = item_data.get("cover")
            if cover and isinstance(cover, dict) and cover.get("image_id"):
                image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"

            release_date = None
            release_ts = item_data.get("first_release_date")
            if release_ts:
                try:
                    release_date = datetime.fromtimestamp(release_ts).strftime("%Y")
                except Exception:
                    pass

            return {
                "id": str(item_data.get("id")),
                "external_id": str(item_data.get("id")),
                "title": item_data.get("name") or "Untitled Game",
                "image_url": image_url,
                "release_year": release_date,
                "item_type": "game"
            }

        body_main = f"""fields id, name, category,
            bundles.id, bundles.name, bundles.cover.image_id, bundles.first_release_date,
            dlcs.id, dlcs.name, dlcs.cover.image_id, dlcs.first_release_date,
            expansions.id, expansions.name, expansions.cover.image_id, expansions.first_release_date,
            standalone_expansions.id, standalone_expansions.name, standalone_expansions.cover.image_id, standalone_expansions.first_release_date,
            parent_game.id, parent_game.name, parent_game.cover.image_id, parent_game.first_release_date,
            version_parent.id, version_parent.name, version_parent.cover.image_id, version_parent.first_release_date,
            remakes.id, remakes.name, remakes.cover.image_id, remakes.first_release_date,
            remasters.id, remasters.name, remasters.cover.image_id, remasters.first_release_date;
            where id = {gid};"""

        relations = {
            "collections": [],
            "bundle_games": [],
            "editions": [],
            "dlcs": [],
            "parent_game": None
        }

        try:
            data_main = cls.apicalypse_request("games", body_main, timeout=8.0, use_cache=True, cache_ttl=3600) or []
            vpid = None
            parent_id = None
            if data_main and len(data_main) > 0:
                game = data_main[0]

                if game.get("parent_game"):
                    relations["parent_game"] = format_item(game.get("parent_game"))
                elif game.get("version_parent"):
                    relations["parent_game"] = format_item(game.get("version_parent"))

                parent_id = relations["parent_game"]["id"] if relations.get("parent_game") else None

                if game.get("version_parent"):
                    vp = game.get("version_parent")
                    vpid = vp.get("id") if isinstance(vp, dict) else vp

                seen_coll = set()
                for b in game.get("bundles", []):
                    item = format_item(b)
                    if item and item["id"] not in seen_coll and item["id"] != str(gid):
                        seen_coll.add(item["id"])
                        relations["collections"].append(item)

                seen_dlcs = set()
                for d in game.get("dlcs", []) + game.get("expansions", []) + game.get("standalone_expansions", []):
                    item = format_item(d)
                    if item and item["id"] not in seen_dlcs and item["id"] != str(gid):
                        seen_dlcs.add(item["id"])
                        relations["dlcs"].append(item)

                seen_editions = set()
                for e in game.get("remakes", []) + game.get("remasters", []):
                    item = format_item(e)
                    if item and item["id"] not in seen_editions and item["id"] != str(gid):
                        seen_editions.add(item["id"])
                        relations["editions"].append(item)

            valid_vpids = tuple(filter(None, [gid, vpid]))
            version_targets = f"{gid}, {vpid}" if vpid else str(gid)
            body_children = f"""fields id, name, category, game_type, cover.image_id, first_release_date, bundles, version_parent, parent_game;
                where bundles = ({gid}) | version_parent = ({version_targets}) | parent_game = ({gid}); limit 50;"""

            data_children = cls.apicalypse_request("games", body_children, timeout=8.0, use_cache=True, cache_ttl=3600) or []
            for child in data_children:
                item = format_item(child)
                if not item or item["id"] == str(gid):
                    continue
                if parent_id and item["id"] == parent_id:
                    continue
                cat = child.get("game_type") if child.get("game_type") is not None else child.get("category", 0)
                bundles_list = child.get("bundles", []) or []

                child_vp = child.get("version_parent")
                child_vpid = child_vp.get("id") if isinstance(child_vp, dict) else child_vp

                if (
                    child.get("parent_game") == gid
                    or (isinstance(child.get("parent_game"), dict) and child.get("parent_game", {}).get("id") == gid)
                    or cat in (1, 2, 4, 6, 13, 14)
                ):
                    if not any(d["id"] == item["id"] for d in relations["dlcs"]):
                        relations["dlcs"].append(item)
                elif gid in bundles_list or str(gid) in [str(x) for x in bundles_list]:
                    if not any(b["id"] == item["id"] for b in relations["bundle_games"]):
                        relations["bundle_games"].append(item)
                elif (child_vpid and child_vpid in valid_vpids) or cat in (8, 9, 10):
                    if not any(e["id"] == item["id"] for e in relations["editions"]):
                        relations["editions"].append(item)
                else:
                    if not any(d["id"] == item["id"] for d in relations["dlcs"]):
                        relations["dlcs"].append(item)

            cls._save_to_cache(cache_key, relations)
        except Exception as e:
            logger.error(f"IGDB Relations Error: {e}")

        return relations

    @classmethod
    def _execute_query(cls, body: str, use_cache: bool = True, cache_ttl: int = 900) -> List[SearchResultItem]:
        data = cls.apicalypse_request("games", body, timeout=8.0, use_cache=use_cache, cache_ttl=cache_ttl)
        if not data:
            return []

        results = []
        for item in data:
            image_url = None
            cover = item.get("cover")
            if cover and cover.get("image_id"):
                image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"
            release_timestamp = item.get("first_release_date")
            release_date = datetime.fromtimestamp(release_timestamp).strftime("%Y-%m-%d") if release_timestamp else None

            cat = item.get("game_type") if item.get("game_type") is not None else item.get("category", 0)
            has_version_parent = bool(item.get("version_parent"))
            name_lower = (item.get("name") or "").lower()
            badge = None
            if cat in (2, 4, 6):
                badge = "expansion"
            elif cat == 5:
                badge = "mod"
            elif cat in (1, 13, 14):
                badge = "dlc"
            elif cat == 10 or (cat in (0, 3) and has_version_parent):
                badge = "edition"
            elif cat == 3 and not has_version_parent:
                badge = "collection"
            elif cat == 8:
                badge = "remake"
            elif cat == 9:
                badge = "remaster"
            elif any(w in name_lower for w in ["edition", "edición", "deluxe", "goty", "director's cut", "definitive"]):
                badge = "edition"
            elif any(w in name_lower for w in ["collection", "colección", "bundle", "trilogy", "anthology"]):
                badge = "collection"
            elif "remaster" in name_lower:
                badge = "remaster"
            elif "remake" in name_lower:
                badge = "remake"

            results.append(
                SearchResultItem(
                    external_id=str(item.get("id")),
                    title=item.get("name") or "Untitled Game",
                    image_url=image_url,
                    description=item.get("summary") or "No description available.",
                    item_type="game",
                    release_date=release_date,
                    badge=badge
                )
            )
        return results

    @classmethod
    def get_new_games(cls) -> List[SearchResultItem]:
        now = int(time.time())
        body = (
            f"fields id, name, category, game_type, parent_game, version_parent, cover.image_id, "
            f"first_release_date, summary; where first_release_date < {now} & cover != null & "
            f"(game_type = (0, 2, 3, 4, 8, 9, 10) | category = (0, 2, 3, 4, 8, 9, 10)); "
            f"sort first_release_date desc; limit 100;"
        )
        return cls._execute_query(body, use_cache=True, cache_ttl=1800)

    @classmethod
    def get_trending_games(cls) -> List[SearchResultItem]:
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()
        if not client_id or not token:
            return []

        try:
            lists = []
            for pop_type in [9, 34, 5]:
                body = f"fields game_id, value; where popularity_type = {pop_type}; sort value desc; limit 15;"
                data = cls.apicalypse_request("popularity_primitives", body, timeout=5.0, use_cache=True, cache_ttl=1800) or []
                lists.append([str(p["game_id"]) for p in data if "game_id" in p])

            # Interleave round-robin to balance sales surges, streams, and active players
            gids = []
            for i in range(15):
                for l in lists:
                    if i < len(l) and l[i] not in gids:
                        gids.append(l[i])

            if gids:
                joined_gids = ",".join(gids[:35])
                body_games = (
                    f"fields id, name, category, game_type, parent_game, version_parent, cover.image_id, "
                    f"first_release_date, summary, total_rating; where id = ({joined_gids}) & cover != null; limit 35;"
                )
                items = cls._execute_query(body_games, use_cache=True, cache_ttl=1800)
                id_to_item = {str(item.external_id): item for item in items}
                ordered_results = [id_to_item[gid] for gid in gids if gid in id_to_item]
                if ordered_results:
                    return ordered_results[:24]
        except Exception as e:
            logger.error(f"IGDB popularity_primitives error: {e}")

        # Fallback query without date restrictions
        body_fallback = (
            "fields id, name, category, game_type, parent_game, version_parent, cover.image_id, "
            "first_release_date, summary, total_rating; where cover != null & total_rating != null; "
            "sort total_rating desc; limit 24;"
        )
        return cls._execute_query(body_fallback, use_cache=True, cache_ttl=1800)

    # ---------------------------------------------------------
    # Helper APIs for Characters and Banners services
    # ---------------------------------------------------------

    @classmethod
    def search_characters(cls, query: str, limit: int = 12) -> List[dict]:
        """Search character records from IGDB endpoint /v4/characters."""
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, mug_shot.image_id, games.name; limit {limit};'
        return cls.apicalypse_request("characters", body, timeout=6.0, use_cache=True, cache_ttl=1800) or []

    @classmethod
    def get_characters_for_games(cls, game_ids: List[Union[str, int]], limit: int = 20) -> List[dict]:
        """Fetch character records for a given list of game IDs."""
        if not game_ids:
            return []
        clean_ids = [str(x) for x in game_ids if str(x).isdigit()][:15]
        if not clean_ids:
            return []
        body = f'where games = ({",".join(clean_ids)}); fields id, name, mug_shot.image_id, games.name; limit {limit};'
        return cls.apicalypse_request("characters", body, timeout=6.0, use_cache=True, cache_ttl=1800) or []

    @classmethod
    def search_game_artworks_and_screenshots(cls, query: str, limit: int = 15) -> List[dict]:
        """Search games with 1080p artwork and screenshot image IDs."""
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, artworks.image_id, screenshots.image_id; limit {limit};'
        return cls.apicalypse_request("games", body, timeout=6.0, use_cache=True, cache_ttl=1800) or []
