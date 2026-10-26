import datetime
import json
import logging
import re
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.sfw_filter import is_safe_media_item
from app.services.base import SearchResultItem

logger = logging.getLogger(__name__)

USER_AGENT = settings.USER_AGENT

_ANILIST_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": USER_AGENT,
}


class AnilistService:
    # AniList GraphQL rate limiting & burst protection state:
    # Standard limit: 90 req/min; Degraded state: 30 req/min.
    # Safe sliding window target: max 24 requests / 60.0s window, min 0.70s spacing between calls.
    _anilist_lock = threading.Lock()
    _anilist_timestamps: deque = deque()
    _anilist_blocked_until: float = 0.0
    _anilist_rate_limit_remaining: Optional[int] = None
    _anilist_reset_timestamp: Optional[float] = None

    @classmethod
    def _handle_anilist_rate_limit(cls, headers: Any, url: str, error_msg: str = ""):
        """Handle AniList 429 / 403 by activating circuit breaker honoring Retry-After / X-RateLimit-Reset."""
        wait_s = 60.0  # AniList documentation explicitly enforces a 1-minute timeout on 429
        try:
            if headers:
                retry_after = headers.get("Retry-After")
                if retry_after:
                    wait_s = max(float(retry_after), 10.0)
                else:
                    reset_header = headers.get("X-RateLimit-Reset")
                    if reset_header:
                        reset_ts = float(reset_header)
                        diff = reset_ts - time.time()
                        if diff > 0:
                            wait_s = max(diff + 1.0, 10.0)
        except Exception:
            wait_s = 60.0

        now = time.time()
        cls._anilist_blocked_until = max(cls._anilist_blocked_until, now + wait_s)
        logger.warning(
            f"AniList rate limit hit for '{url}' ({error_msg or '429 Too Many Requests'}). "
            f"Global circuit breaker active for {wait_s:.1f}s. Halting AniList requests."
        )

    @classmethod
    def _rate_limit_anilist(cls) -> bool:
        """
        Enforce respectful rate pacing for AniList:
        1. Check circuit breaker (HTTP 429 / 403 cooldown).
        2. Sliding window: max 24 requests per 60.0 seconds (respecting 30 req/min degraded limit).
        3. Burst limiter protection: minimum spacing of 0.70 seconds between calls.
        """
        with cls._anilist_lock:
            now = time.time()

            # 1. Circuit breaker / active rate limit
            if cls._anilist_blocked_until > now:
                wait_time = cls._anilist_blocked_until - now
                if wait_time <= 1.0:
                    time.sleep(wait_time)
                    now = time.time()
                else:
                    logger.info(f"AniList circuit breaker active (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window: clean timestamps older than 60.0 seconds
            while cls._anilist_timestamps and cls._anilist_timestamps[0] <= now - 60.0:
                cls._anilist_timestamps.popleft()

            # Proactive check if response headers indicated 0 remaining
            if cls._anilist_rate_limit_remaining == 0 and cls._anilist_reset_timestamp:
                diff = cls._anilist_reset_timestamp - now
                if diff > 0:
                    if diff <= 2.5:
                        time.sleep(diff + 0.1)
                        now = time.time()
                    else:
                        return False

            # Cap: max 24 requests per 60 seconds
            if len(cls._anilist_timestamps) >= 24:
                sleep_needed = 60.0 - (now - cls._anilist_timestamps[0]) + 0.1
                if sleep_needed > 0:
                    if sleep_needed <= 2.5:
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._anilist_timestamps and cls._anilist_timestamps[0] <= now - 60.0:
                            cls._anilist_timestamps.popleft()
                    else:
                        logger.warning(f"AniList rate limit capacity reached (sleep needed: {sleep_needed:.1f}s > 2.5s). Fast failing.")
                        return False

            # 3. Burst limiter protection: min spacing of 0.70s between requests
            if cls._anilist_timestamps:
                elapsed = now - cls._anilist_timestamps[-1]
                if elapsed < 0.70:
                    time.sleep(0.70 - elapsed)
                    now = time.time()

            cls._anilist_timestamps.append(now)
            return True

    @classmethod
    def _graphql_request(cls, query: str, variables: Optional[dict] = None, timeout: int = 6) -> Optional[dict]:
        """
        Centralized AniList GraphQL request handler:
        - Rate limiting & burst spacing
        - Circuit breaker on 429 & 403
        - Parses GraphQL error arrays (even when status is 200)
        - Tracks X-RateLimit response headers
        """
        if not cls._rate_limit_anilist():
            return None

        url = "https://graphql.anilist.co"
        body: Dict[str, Any] = {"query": query}
        if variables:
            body["variables"] = variables
        payload = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers=_ANILIST_HEADERS)

        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                # Update rate limit tracking headers
                try:
                    rem_header = res.headers.get("X-RateLimit-Remaining")
                    if rem_header is not None:
                        cls._anilist_rate_limit_remaining = int(rem_header)
                    reset_header = res.headers.get("X-RateLimit-Reset")
                    if reset_header is not None:
                        cls._anilist_reset_timestamp = float(reset_header)
                except Exception:
                    pass

                if res.status == 200:
                    data = json.loads(res.read().decode("utf-8"))
                    # Check for GraphQL-level errors inside 200 OK
                    errors = data.get("errors")
                    if errors and isinstance(errors, list):
                        for err in errors:
                            err_status = err.get("status")
                            err_msg = str(err.get("message", ""))
                            if err_status == 429 or "too many requests" in err_msg.lower():
                                cls._handle_anilist_rate_limit(res.headers, url, error_msg=err_msg)
                                return None
                            elif err_status == 403:
                                cls._handle_anilist_rate_limit(res.headers, url, error_msg=f"403: {err_msg}")
                                return None
                    return data
                elif res.status in (429, 403):
                    cls._handle_anilist_rate_limit(res.headers, url, error_msg=f"HTTP {res.status}")
                    return None
        except urllib.error.HTTPError as he:
            if he.code in (429, 403):
                cls._handle_anilist_rate_limit(he.headers, url, error_msg=f"HTTP {he.code}")
                return None
            logger.warning(f"AniList HTTP {he.code} for GraphQL query: {he}")
            return None
        except Exception as e:
            logger.warning(f"AniList GraphQL error: {e}")
            return None
        return None

    @classmethod
    def search_manga(cls, query: str) -> List[SearchResultItem]:
        if not query:
            return []

        graphql_query = """
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
              id
              isAdult
              status
              genres
              title {
                romaji
                english
              }
              description
              coverImage {
                large
              }
              startDate {
                year
                month
                day
              }
              averageScore
            }
          }
        }
        """

        try:
            data = cls._graphql_request(graphql_query, {"search": query}, timeout=8)
            if not data or not isinstance(data, dict):
                return []

            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            results = []
            for item in media_list:
                genres = item.get("genres", [])
                if item.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue

                title_obj = item.get("title", {})
                title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                cover_obj = item.get("coverImage", {})
                image_url = cover_obj.get("large")
                start_date_obj = item.get("startDate", {}) or {}
                year = start_date_obj.get("year")
                month = start_date_obj.get("month")
                day = start_date_obj.get("day")
                release_date = ""
                if year:
                    release_date = str(year)
                    if month:
                        release_date = f"{year}-{month:02d}"
                        if day:
                            release_date = f"{year}-{month:02d}-{day:02d}"

                desc = item.get("description") or ""
                desc = re.sub(r'<[^<]+?>', '', desc)

                if not is_safe_media_item(title, desc):
                    continue

                ani_status = item.get("status")
                is_upcoming = ani_status == "NOT_YET_RELEASED"
                mapped_status = "Upcoming" if is_upcoming else None
                badge = "upcoming" if is_upcoming else None

                results.append(
                    SearchResultItem(
                        external_id=str(item.get("id")),
                        title=title,
                        image_url=image_url,
                        description=desc,
                        item_type="manga",
                        release_date=release_date,
                        popularity=float(item.get("averageScore") or 0),
                        status=mapped_status,
                        badge=badge
                    )
                )
            return results

        except Exception as e:
            logger.warning(f"AniList API Search Error: {e}")
            return []

    @classmethod
    def get_trending_manga(cls) -> List[SearchResultItem]:
        graphql_query = """
        query {
          Page(page: 1, perPage: 30) {
            media(type: MANGA, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
              popularity
              genres
              isAdult
            }
          }
        }
        """
        try:
            data = cls._graphql_request(graphql_query, timeout=6)
            if not data or not isinstance(data, dict):
                return []

            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            results = []
            for item in media_list:
                genres = item.get("genres", [])
                if item.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue
                title_obj = item.get("title", {})
                title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                cover_obj = item.get("coverImage", {})
                image_url = cover_obj.get("large")
                start_date_obj = item.get("startDate", {}) or {}
                year = start_date_obj.get("year") or item.get("seasonYear")
                month = start_date_obj.get("month")
                day = start_date_obj.get("day")
                release_date = ""
                if year:
                    release_date = str(year)
                    if month:
                        release_date = f"{year}-{month:02d}"
                        if day:
                            release_date = f"{year}-{month:02d}-{day:02d}"
                desc = item.get("description") or ""
                desc = re.sub(r'<[^<]+?>', '', desc)

                if not is_safe_media_item(title, desc):
                    continue

                results.append(SearchResultItem(
                    external_id=str(item.get("id")),
                    title=title,
                    image_url=image_url,
                    description=desc,
                    item_type="manga",
                    release_date=release_date or None,
                    popularity=float(item.get("popularity") or item.get("averageScore") or 0)
                ))
            return results
        except Exception as e:
            logger.warning(f"Error fetching trending manga from AniList: {e}")
            return []

    @classmethod
    def get_new_manga(cls) -> List[SearchResultItem]:
        today_int = int(datetime.date.today().strftime("%Y%m%d"))

        graphql_query = """
        query ($end: FuzzyDateInt) {
          Page(page: 1, perPage: 50) {
            media(type: MANGA, sort: [START_DATE_DESC], startDate_greater: 20260101, startDate_lesser: $end, isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
              genres
              isAdult
            }
          }
        }
        """
        try:
            data = cls._graphql_request(graphql_query, {"end": today_int}, timeout=6)
            if not data or not isinstance(data, dict):
                return []

            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            results = []
            for item in media_list:
                genres = item.get("genres", [])
                if item.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue

                title_obj = item.get("title", {})
                title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                cover_obj = item.get("coverImage", {})
                image_url = cover_obj.get("large")
                start_date_obj = item.get("startDate", {}) or {}
                year = start_date_obj.get("year") or item.get("seasonYear")
                month = start_date_obj.get("month")
                day = start_date_obj.get("day")
                release_date = ""
                if year:
                    release_date = str(year)
                    if month:
                        release_date = f"{year}-{month:02d}"
                        if day:
                            release_date = f"{year}-{month:02d}-{day:02d}"
                desc = item.get("description") or ""
                desc = re.sub(r'<[^<]+?>', '', desc)

                if not is_safe_media_item(title, desc):
                    continue

                results.append(SearchResultItem(
                    external_id=str(item.get("id")),
                    title=title,
                    image_url=image_url,
                    description=desc,
                    item_type="manga",
                    release_date=release_date or None,
                    popularity=float(item.get("averageScore") or 0)
                ))
            return results
        except Exception as e:
            logger.warning(f"Error fetching new manga from AniList: {e}")
            return []

    @staticmethod
    def _parse_season_and_base_title(title: str):
        m = re.search(r'[\s:,-]+(?:Season|Temporada|Cour|Part|Parte)\s*(\d+)', title, re.IGNORECASE)
        if m:
            season_num = int(m.group(1))
            base_title = title[:m.start()].strip()
            return base_title, season_num

        m2 = re.search(r'[\s:,-]+(\d+)$', title)
        if m2:
            season_num = int(m2.group(1))
            base_title = title[:m2.start()].strip()
            return base_title, season_num

        return title, 1

    @classmethod
    def get_new_anime(cls) -> List[SearchResultItem]:
        now = int(time.time())
        start_day = now - (5 * 86400)  # Past 5 days
        end_day = now                  # Exclude future broadcasts (only already aired episodes)

        graphql_query = """
        query ($start: Int, $end: Int) {
          Page(page: 1, perPage: 50) {
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_DESC) {
              id
              airingAt
              episode
              media {
                id
                title {
                  romaji
                  english
                }
                coverImage {
                  large
                }
                description
                averageScore
                popularity
                isAdult
                genres
              }
            }
          }
        }
        """
        try:
            data = cls._graphql_request(graphql_query, {"start": start_day, "end": end_day}, timeout=6)
            if not data or not isinstance(data, dict):
                return []

            schedules = data.get("data", {}).get("Page", {}).get("airingSchedules", [])
            results = []
            seen_ids = set()

            for item in schedules:
                media = item.get("media", {})
                media_id = media.get("id")
                if not media_id or media_id in seen_ids:
                    continue
                genres = media.get("genres", [])
                if media.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue

                seen_ids.add(media_id)

                raw_title = media.get("title", {}).get("english") or media.get("title", {}).get("romaji") or "Untitled Anime"
                base_title, season_num = cls._parse_season_and_base_title(raw_title)

                cover_obj = media.get("coverImage", {})
                image_url = cover_obj.get("large")

                airdate = datetime.datetime.fromtimestamp(item.get("airingAt")).strftime("%Y-%m-%d")
                ep_num = item.get("episode")

                desc = media.get("description") or ""
                desc = re.sub(r'<[^<]+?>', '', desc)

                if not is_safe_media_item(base_title, desc):
                    continue

                results.append(SearchResultItem(
                    external_id=f"anime_{media_id}",
                    title=base_title,
                    image_url=image_url,
                    description=desc,
                    item_type="anime",
                    release_date=airdate,
                    latest_season=season_num,
                    latest_episode=ep_num,
                    popularity=float(media.get("averageScore") or 0)
                ))
            return results
        except Exception as e:
            logger.warning(f"Error fetching new anime from AniList: {e}")
            return []

    @classmethod
    def get_trending_anime(cls) -> List[SearchResultItem]:
        graphql_query = """
        query {
          Page(page: 1, perPage: 15) {
            media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
              genres
              isAdult
            }
          }
        }
        """
        try:
            data = cls._graphql_request(graphql_query, timeout=6)
            if not data or not isinstance(data, dict):
                return []

            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            results = []
            for item in media_list:
                genres = item.get("genres", [])
                if item.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue

                title_obj = item.get("title", {})
                title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Anime"
                cover_obj = item.get("coverImage", {})
                image_url = cover_obj.get("large")
                start_date_obj = item.get("startDate", {}) or {}
                year = start_date_obj.get("year") or item.get("seasonYear")
                month = start_date_obj.get("month")
                day = start_date_obj.get("day")
                release_date = ""
                if year:
                    release_date = str(year)
                    if month:
                        release_date = f"{year}-{month:02d}"
                        if day:
                            release_date = f"{year}-{month:02d}-{day:02d}"
                desc = item.get("description") or ""
                desc = re.sub(r'<[^<]+?>', '', desc)

                if not is_safe_media_item(title, desc):
                    continue

                results.append(SearchResultItem(
                    external_id=f"anime_{item.get('id')}",
                    title=title,
                    image_url=image_url,
                    description=desc,
                    item_type="anime",
                    release_date=release_date or None,
                    popularity=float(item.get("averageScore") or 0)
                ))
            return results
        except Exception as e:
            logger.warning(f"Error fetching trending anime from AniList: {e}")
            return []

    @classmethod
    def get_anime_detail(cls, anime_id: str) -> Optional[dict]:
        real_id = str(anime_id).replace("anime_", "").replace("anime-", "")
        if not real_id.isdigit():
            return None

        graphql_query = """
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
            }
            description
            coverImage {
              extraLarge
              large
            }
            episodes
            duration
            status
            startDate {
              year
              month
              day
            }
            nextAiringEpisode {
              episode
            }
            genres
            isAdult
          }
        }
        """
        try:
            data = cls._graphql_request(graphql_query, {"id": int(real_id)}, timeout=6)
            if not data or not isinstance(data, dict):
                return None

            media = data.get("data", {}).get("Media", {})
            if not media:
                return None

            raw_title = media.get("title", {}).get("english") or media.get("title", {}).get("romaji") or "Untitled Anime"
            base_title, current_season = cls._parse_season_and_base_title(raw_title)

            total_eps = media.get("episodes")
            next_ep = media.get("nextAiringEpisode", {})
            if not total_eps and next_ep and next_ep.get("episode"):
                total_eps = next_ep.get("episode") - 1
            total_eps = total_eps or 12

            seasons = []
            for s_idx in range(1, max(current_season + 1, 2)):
                seasons.append({
                    "id": s_idx,
                    "season_number": s_idx,
                    "episode_count": total_eps if s_idx == current_season else 12
                })

            desc = media.get("description") or ""
            desc = re.sub(r'<[^<]+?>', '', desc)

            s_date = media.get("startDate", {}) or {}
            formatted_date = None
            if s_date.get("year"):
                y = s_date.get("year")
                m = s_date.get("month") or 1
                d = s_date.get("day") or 1
                formatted_date = f"{y}-{m:02d}-{d:02d}"

            return {
                "id": f"anime_{media.get('id')}",
                "name": base_title,
                "number_of_seasons": len(seasons),
                "seasons": seasons,
                "overview": desc,
                "first_air_date": formatted_date,
                "image_url": media.get("coverImage", {}).get("extraLarge") or media.get("coverImage", {}).get("large")
            }
        except Exception as e:
            logger.warning(f"AniList get_anime_detail error: {e}")
            return None

    @classmethod
    def get_anime_episodes(cls, anime_id: str) -> List[dict]:
        detail = cls.get_anime_detail(anime_id)
        if not detail:
            return []

        seasons = detail.get("seasons", [])
        episodes = []

        for s in seasons:
            s_num = s.get("season_number", 1)
            ep_count = s.get("episode_count", 12)
            for i in range(1, ep_count + 1):
                episodes.append({
                    "id": f"{anime_id}_s{s_num}_ep_{i}",
                    "name": f"Episode {i}",
                    "episode_number": i,
                    "season_number": s_num,
                    "still_path": detail.get("image_url"),
                    "overview": f"Episodio {i} - Temporada {s_num} de {detail.get('name')}",
                    "air_date": detail.get("first_air_date")
                })
        return episodes

    @classmethod
    def get_manga_relations(cls, manga_id: str) -> dict:
        clean_id = str(manga_id).replace("manga_", "").replace("anilist_", "")
        if not clean_id.isdigit():
            return {"sequels_prequels": [], "spin_offs_side_stories": [], "other_relations": []}

        graphql_query = """
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            title { romaji english }
            relations {
              edges {
                relationType
                node {
                  id
                  type
                  format
                  title { romaji english }
                  coverImage { large extraLarge }
                  startDate { year }
                  status
                  averageScore
                  genres
                  isAdult
                }
              }
            }
          }
        }
        """

        sequels_prequels = []
        spin_offs_side_stories = []
        other_relations = []

        try:
            data = cls._graphql_request(graphql_query, {"id": int(clean_id)}, timeout=6)
            if not data or not isinstance(data, dict):
                return {
                    "sequels_prequels": [],
                    "spin_offs_side_stories": [],
                    "other_relations": []
                }

            edges = data.get("data", {}).get("Media", {}).get("relations", {}).get("edges", [])

            seen_ids = set()
            for edge in edges:
                rel_type = edge.get("relationType")
                node = edge.get("node", {})
                n_id = node.get("id")
                if not n_id or n_id in seen_ids:
                    continue

                # We focus on MANGA, NOVEL, ONE_SHOT
                node_type = node.get("type")
                if node_type != "MANGA":
                    continue

                genres = node.get("genres", [])
                if node.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                    continue

                seen_ids.add(n_id)

                t_obj = node.get("title", {})
                title = t_obj.get("english") or t_obj.get("romaji") or "Untitled Manga"
                c_obj = node.get("coverImage", {})
                img_url = c_obj.get("extraLarge") or c_obj.get("large")
                s_year = node.get("startDate", {}).get("year")

                item_data = {
                    "id": str(n_id),
                    "external_id": str(n_id),
                    "title": title,
                    "image_url": img_url,
                    "release_year": str(s_year) if s_year else None,
                    "relation_type": rel_type,
                    "format": node.get("format"),
                    "status": node.get("status"),
                    "item_type": "manga"
                }

                if rel_type in ("SEQUEL", "PREQUEL"):
                    sequels_prequels.append(item_data)
                elif rel_type in ("SPIN_OFF", "SIDE_STORY", "ALTERNATIVE"):
                    spin_offs_side_stories.append(item_data)
                else:
                    other_relations.append(item_data)

        except Exception as e:
            logger.warning(f"AniList get_manga_relations error: {e}")

        return {
            "sequels_prequels": sequels_prequels,
            "spin_offs_side_stories": spin_offs_side_stories,
            "other_relations": other_relations
        }
