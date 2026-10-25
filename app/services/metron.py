import json
import urllib.request
import urllib.parse
import re
import time
import math
import datetime
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Tuple, Optional, Any
from app.core.config import settings
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item

logger = logging.getLogger(__name__)

USER_AGENT = settings.USER_AGENT
BASE_URL = "https://metron.cloud/api"

# In-memory caches to respect Metron's 20 req/min and 5,000 req/day limits
_CACHE_TTL_SEARCH = 3600 * 6       # 6 hours
_CACHE_TTL_SERIES = 3600 * 24      # 24 hours
_CACHE_TTL_ISSUES = 3600 * 24      # 24 hours
_CACHE_TTL_EXPLORE = 3600 * 4      # 4 hours

_SEARCH_CACHE: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
_SERIES_DETAIL_CACHE: Dict[str, Tuple[float, Optional[dict]]] = {}
_SERIES_ISSUES_CACHE: Dict[str, Tuple[float, List[dict]]] = {}
_ISSUE_DETAIL_CACHE: Dict[str, Tuple[float, Optional[dict]]] = {}
_NEW_COMICS_CACHE: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
_TRENDING_COMICS_CACHE: Dict[str, Tuple[float, List[SearchResultItem]]] = {}

import threading
from collections import deque

_rate_limit_lock = threading.Lock()
_request_timestamps = deque()
_blocked_until: float = 0.0  # Unix timestamp until which all Metron requests are paused (circuit breaker)
_daily_blocked_until: float = 0.0  # Unix timestamp until which Metron requests are cut off if daily quota runs low

def _update_rate_limit_from_headers(headers: Any):
    """Inspect Metron rate limit headers to proactively back off before hitting 429 or exceeding daily limits."""
    global _blocked_until, _daily_blocked_until
    if not headers:
        return
    try:
        burst_rem_str = headers.get("X-Ratelimit-Burst-Remaining")
        burst_reset_str = headers.get("X-Ratelimit-Burst-Reset")
        sustained_rem_str = headers.get("X-Ratelimit-Sustained-Remaining")
        sustained_reset_str = headers.get("X-Ratelimit-Sustained-Reset")

        now = time.time()

        if burst_rem_str is not None:
            burst_rem = int(burst_rem_str)
            burst_reset = float(burst_reset_str) if burst_reset_str else 0.0
            # If 2 or fewer requests remain in this 60s burst window, proactively pause until reset
            if burst_rem <= 2 and burst_reset > now:
                with _rate_limit_lock:
                    if burst_reset + 1.0 > _blocked_until:
                        _blocked_until = burst_reset + 1.0
                        logger.warning(
                            f"Metron burst quota nearing limit ({burst_rem} remaining). "
                            f"Proactively pausing all requests for {_blocked_until - now:.1f}s until reset."
                        )

        if sustained_rem_str is not None:
            sustained_rem = int(sustained_rem_str)
            sustained_reset = float(sustained_reset_str) if sustained_reset_str else 0.0
            # Safety fuse: if fewer than 25 requests remain out of 5,000, cut off outgoing requests until reset
            if sustained_rem <= 25 and sustained_reset > now:
                with _rate_limit_lock:
                    if sustained_reset + 2.0 > _daily_blocked_until:
                        _daily_blocked_until = sustained_reset + 2.0
                        logger.critical(
                            f"Metron daily sustained limit safety fuse triggered ({sustained_rem} left). "
                            f"Suspending outgoing requests until daily reset at {datetime.datetime.fromtimestamp(_daily_blocked_until).isoformat()}."
                        )
            elif sustained_rem <= 100:
                logger.warning(f"Metron daily sustained quota running low: {sustained_rem} requests remaining today.")
    except Exception as e:
        logger.debug(f"Failed to parse Metron rate limit headers: {e}")

def _handle_429(headers: Any, url: str):
    """Handle 429 Too Many Requests by activating an immediate global circuit breaker."""
    global _blocked_until
    wait_s = 60.0
    try:
        if headers:
            burst_reset = headers.get("X-Ratelimit-Burst-Reset")
            retry_after = headers.get("Retry-After")
            if burst_reset:
                wait_s = max(float(burst_reset) - time.time(), 5.0) + 1.5
            elif retry_after:
                wait_s = float(retry_after) + 1.5
    except Exception:
        pass

    with _rate_limit_lock:
        now = time.time()
        _blocked_until = now + wait_s

    logger.error(f"Metron 429 rate limit reached for '{url}'. Global circuit breaker active for {wait_s:.1f}s. Halting requests.")

def _rate_limit_metron():
    """Ensure respectful spacing and strict adherence to Metron's limits (max 10 req/min, 1.5s spacing)."""
    global _blocked_until
    with _rate_limit_lock:
        now = time.time()

        # 1. Honor circuit breaker / proactive backoff
        if _blocked_until > now:
            wait_time = _blocked_until - now
            logger.info(f"Metron rate limiter holding requests for {wait_time:.1f}s...")
            time.sleep(wait_time)
            now = time.time()

        # 2. Sliding window: clean timestamps older than 60 seconds
        while _request_timestamps and _request_timestamps[0] <= now - 60.0:
            _request_timestamps.popleft()

        # 3. Conservative cap: max 10 requests per 60 seconds (Metron allows 20)
        if len(_request_timestamps) >= 10:
            sleep_needed = 60.0 - (now - _request_timestamps[0]) + 0.5
            if sleep_needed > 0:
                logger.info(f"Metron client rate limit reached (10/min), sleeping for {sleep_needed:.1f}s...")
                time.sleep(sleep_needed)
                now = time.time()
                while _request_timestamps and _request_timestamps[0] <= now - 60.0:
                    _request_timestamps.popleft()

        # 4. Enforce minimum spacing of 1.5 seconds between consecutive requests
        if _request_timestamps:
            elapsed = now - _request_timestamps[-1]
            if elapsed < 1.5:
                time.sleep(1.5 - elapsed)
                now = time.time()

        _request_timestamps.append(now)

def _metron_request(endpoint: str, params: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Optional[dict]:
    global _daily_blocked_until
    if _daily_blocked_until > time.time():
        logger.warning("Metron request aborted: daily limit safety fuse active until daily window reset.")
        return None

    token = getattr(settings, "METRON_API_TOKEN", None)
    if not token:
        logger.warning("METRON_API_TOKEN is not configured in settings")
        return None

    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    if params:
        query_str = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        if query_str:
            url = f"{url}?{query_str}" if "?" not in url else f"{url}&{query_str}"

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
    }

    _rate_limit_metron()
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            _update_rate_limit_from_headers(response.headers)
            if response.status == 200:
                return json.loads(response.read().decode())
            elif response.status == 429:
                _handle_429(response.headers, url)
                return None
    except urllib.error.HTTPError as he:
        _update_rate_limit_from_headers(he.headers)
        if he.code == 429:
            _handle_429(he.headers, url)
            return None
        logger.warning(f"Metron HTTP {he.code} for '{url}': {he}")
        return None
    except Exception as e:
        logger.warning(f"Metron request error for '{url}': {e}")
        return None

    return None

def _clean_html(raw_html: Optional[str]) -> str:
    if not raw_html:
        return ""
    clean = re.sub(r'<[^<]+?>', '', raw_html)
    return " ".join(clean.split())

def _parse_issue_num(num_val: Any) -> float:
    if num_val is None:
        return 999999.0
    try:
        return float(str(num_val).strip())
    except Exception:
        m = re.search(r'\d+', str(num_val))
        return float(m.group(0)) if m else 999999.0


class MetronService:
    """Service to search and fetch comics from Metron (https://metron.cloud), replacing Comic Vine."""

    @classmethod
    def search_comics(cls, query: str) -> List[SearchResultItem]:
        if not query or not query.strip():
            return []

        cleaned_query = query.replace("#", " ")
        cleaned_query = " ".join(cleaned_query.split())
        cache_key = cleaned_query.lower()
        now_ts = time.time()

        if cache_key in _SEARCH_CACHE:
            ts, cached_res = _SEARCH_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_SEARCH:
                return cached_res

        token = getattr(settings, "METRON_API_TOKEN", None)
        if not token:
            return []

        results: List[SearchResultItem] = []
        seen_ids = set()

        # Check if query ends with an issue number (e.g. "Batman 1" or "Spider-Man #300")
        issue_number_match = re.search(r'^(.*?)\s*#?\s*(\d+)$', cleaned_query)
        if issue_number_match:
            series_name = issue_number_match.group(1).strip()
            issue_number = issue_number_match.group(2).strip()

            if series_name:
                # 1. Search specific issue directly
                issue_data = _metron_request("issue/", {
                    "series_name": series_name,
                    "number": issue_number,
                    "limit": 10
                })
                if issue_data:
                    for iss in issue_data.get("results", []):
                        iss_id = iss.get("id")
                        if not iss_id or iss_id in seen_ids:
                            continue
                        seen_ids.add(iss_id)

                        iss_title = iss.get("issue") or f"{series_name} #{issue_number}"
                        img_url = iss.get("image")
                        desc = iss.get("desc") or f"Issue #{issue_number} of {series_name}"
                        if not is_safe_media_item(iss_title, desc):
                            continue

                        cv_id = iss.get("cv_id")
                        ext_id = f"cv_issue_{cv_id}" if cv_id else f"metron_issue_{iss_id}"

                        results.append(SearchResultItem(
                            external_id=ext_id,
                            title=iss_title,
                            image_url=img_url,
                            description=desc,
                            item_type="comic",
                            badge="issue",
                            release_date=iss.get("store_date") or iss.get("cover_date")
                        ))

        # 2. Sequentially fetch issue #1 (for covers) and series metadata (for issue counts)
        issue1_data = _metron_request("issue/", {
            "series_name": cleaned_query,
            "number": "1",
            "limit": 30
        })
        series_data = _metron_request("series/", {
            "name": cleaned_query,
            "limit": 50
        })

        series_counts: Dict[Any, int] = {}
        if series_data and series_data.get("results"):
            for s in series_data["results"]:
                sid = s.get("id")
                ic = s.get("issue_count")
                if sid and ic is not None:
                    series_counts[sid] = ic
                s_title = (s.get("series") or s.get("name") or "").lower().strip()
                if s_title and ic is not None:
                    series_counts[s_title] = ic

        missing_count_sids: List[Tuple[int, int]] = []
        if issue1_data:
            for iss in issue1_data.get("results", []):
                s_info = iss.get("series", {})
                s_id = s_info.get("id")
                if not s_id or f"series_{s_id}" in seen_ids:
                    continue
                seen_ids.add(f"series_{s_id}")

                s_name = s_info.get("name") or iss.get("issue", "").split("#")[0].strip()
                s_year = s_info.get("year_began")
                full_title = f"{s_name} ({s_year})" if s_year else s_name
                img_url = iss.get("image")
                desc = iss.get("desc") or f"Comic series started in {s_year}."

                if not is_safe_media_item(full_title, desc):
                    continue

                cv_id = s_info.get("cv_id")
                ext_id = f"cv_vol_{cv_id}" if cv_id else f"metron_series_{s_id}"

                ic = series_counts.get(s_id) or series_counts.get(s_name.lower())
                if ic is None:
                    missing_count_sids.append((s_id, len(results)))

                badge_val = f"{ic} {'Número' if ic == 1 else 'Números'}" if (ic is not None and ic > 0) else None

                results.append(SearchResultItem(
                    external_id=ext_id,
                    title=full_title,
                    image_url=img_url,
                    description=desc,
                    item_type="comic",
                    badge=badge_val,
                    page_count=ic,
                    release_date=str(s_year) if s_year else None
                ))

        # Fetch missing issue counts for top results (up to 2, sequentially)
        if missing_count_sids:
            for sid, idx in missing_count_sids[:2]:
                s_dt = _metron_request(f"series/{sid}/")
                if s_dt:
                    c = s_dt.get("issue_count")
                    if c is not None and c > 0:
                        results[idx].page_count = c
                        results[idx].badge = f"{c} {'Número' if c == 1 else 'Números'}"

        # 3. Fallback: Search series endpoint directly if too few results
        if len(results) < 8:
            if not series_data:
                series_data = _metron_request("series/", {
                    "name": cleaned_query,
                    "limit": 15
                })
            if series_data:
                for s in series_data.get("results", []):
                    s_id = s.get("id")
                    if not s_id or f"series_{s_id}" in seen_ids:
                        continue
                    seen_ids.add(f"series_{s_id}")

                    s_title = s.get("series") or s.get("name")
                    s_year = s.get("year_began")
                    publisher = s.get("publisher", {}).get("name") if isinstance(s.get("publisher"), dict) else None
                    desc = f"Publisher: {publisher}. Started in {s_year}." if publisher else f"Started in {s_year}."

                    cv_id = s.get("cv_id")
                    ext_id = f"cv_vol_{cv_id}" if cv_id else f"metron_series_{s_id}"

                    ic = s.get("issue_count") or series_counts.get(s_id)
                    badge_val = f"{ic} {'Número' if ic == 1 else 'Números'}" if (ic is not None and ic > 0) else None

                    results.append(SearchResultItem(
                        external_id=ext_id,
                        title=s_title,
                        image_url=None, # Loaded on detail
                        description=desc,
                        item_type="comic",
                        badge=badge_val,
                        page_count=ic,
                        release_date=str(s_year) if s_year else None
                    ))

        if results:
            def _comic_sort_key(item: SearchResultItem) -> float:
                t_clean = item.title.lower().strip()
                t_base = re.sub(r'\s*\(\d{4}\)', '', t_clean).replace('#', ' ').strip()
                q_clean = re.sub(r'\s*\(\d{4}\)', '', cleaned_query.lower()).replace('#', ' ').strip()
                q_num = [w for w in q_clean.split() if w.isdigit()]
                score = 0.0
                if t_base == q_clean:
                    score += 2000.0
                elif t_base.startswith(q_clean):
                    score += 1000.0
                elif q_clean in t_base:
                    score += 500.0
                if q_num:
                    if all(n in t_base.split() for n in q_num):
                        score += 800.0
                    else:
                        score -= 400.0
                m = re.search(r'\b(19\d\d|20\d\d)\b', item.title)
                if m:
                    score += min(50.0, max(0.0, (int(m.group(1)) - 1930) * 0.5))
                return score

            results.sort(key=_comic_sort_key, reverse=True)
            _SEARCH_CACHE[cache_key] = (now_ts, results)

        return results

    @classmethod
    def get_comic_volume_detail(cls, vol_id: str) -> Optional[dict]:
        if not vol_id:
            return None

        clean_id = str(vol_id).strip()
        cache_key = clean_id.lower()
        now_ts = time.time()

        if cache_key in _SERIES_DETAIL_CACHE:
            ts, cached = _SERIES_DETAIL_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_SERIES:
                return cached

        # Resolve series ID
        s_id: Optional[int] = None

        if clean_id.startswith("cv_vol_") or clean_id.startswith("cv_volume_") or clean_id.startswith("cv_"):
            raw_cv_id = clean_id.replace("cv_vol_", "").replace("cv_volume_", "").replace("cv_", "")
            if raw_cv_id.isdigit():
                cv_res = _metron_request("series/", {"cv_id": raw_cv_id})
                if cv_res and cv_res.get("results"):
                    s_id = cv_res["results"][0].get("id")

        elif clean_id.startswith("metron_series_"):
            raw_id = clean_id.replace("metron_series_", "")
            if raw_id.isdigit():
                s_id = int(raw_id)
        elif clean_id.isdigit():
            s_id = int(clean_id)

        if not s_id:
            return None

        # Fetch series detail
        s = _metron_request(f"series/{s_id}/")
        if not s:
            return None

        vol_name = s.get("name") or s.get("series") or "Untitled Series"
        start_yr = s.get("year_began")
        issue_count = s.get("issue_count") or 0
        desc = _clean_html(s.get("desc"))

        publisher_name = None
        if isinstance(s.get("publisher"), dict):
            publisher_name = s["publisher"].get("name")
        elif s.get("publisher"):
            publisher_name = str(s.get("publisher"))

        # Fetch first issue cover for series artwork
        img_url = None
        issue_sample = _metron_request(f"series/{s_id}/issue_list/", {"limit": 1})
        if issue_sample and issue_sample.get("results"):
            img_url = issue_sample["results"][0].get("image")

        status_str = "Ended" if (s.get("year_end") or s.get("status") in ("completed", "cancelled")) else "Running"
        is_ended = (status_str == "Ended")

        seasons = [{
            "id": s_id,
            "season_number": 1,
            "episode_count": issue_count,
            "name": f"Volumen ({start_yr})" if start_yr else "Volumen"
        }]

        vol_result = {
            "id": f"cv_vol_{s.get('cv_id')}" if s.get("cv_id") else f"metron_series_{s_id}",
            "name": vol_name,
            "volume_name": vol_name,
            "start_year": start_yr,
            "publisher": publisher_name,
            "number_of_seasons": 1,
            "seasons": seasons,
            "overview": desc,
            "first_air_date": str(start_yr) if start_yr else None,
            "image_url": img_url,
            "count_of_issues": issue_count,
            "status": status_str,
            "is_ended": is_ended
        }

        _SERIES_DETAIL_CACHE[cache_key] = (now_ts, vol_result)
        return vol_result

    @classmethod
    def get_comic_volume_issues(cls, vol_id: str) -> List[dict]:
        if not vol_id:
            return []

        clean_id = str(vol_id).strip()
        cache_key = clean_id.lower()
        now_ts = time.time()

        if cache_key in _SERIES_ISSUES_CACHE:
            ts, cached_eps = _SERIES_ISSUES_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_ISSUES:
                return cached_eps

        # Resolve series ID
        s_id: Optional[int] = None
        if clean_id.startswith("cv_vol_") or clean_id.startswith("cv_volume_") or clean_id.startswith("cv_"):
            raw_cv_id = clean_id.replace("cv_vol_", "").replace("cv_volume_", "").replace("cv_", "")
            if raw_cv_id.isdigit():
                cv_res = _metron_request("series/", {"cv_id": raw_cv_id})
                if cv_res and cv_res.get("results"):
                    s_id = cv_res["results"][0].get("id")

        elif clean_id.startswith("metron_series_"):
            raw_id = clean_id.replace("metron_series_", "")
            if raw_id.isdigit():
                s_id = int(raw_id)
        elif clean_id.isdigit():
            s_id = int(clean_id)

        if not s_id:
            return []

        # Fetch all issues for this series
        issues_res = _metron_request(f"series/{s_id}/issue_list/", {"limit": 100})
        if not issues_res:
            return []

        raw_issues = list(issues_res.get("results", []))
        total_count = issues_res.get("count", 0)

        # Paginate sequentially if series has more than 100 issues (strictly avoid concurrent workers)
        total_pages = math.ceil(total_count / 100)
        if total_pages > 1:
            max_fetch_pages = min(total_pages + 1, 11)  # Up to 1,000 issues sequentially
            for p in range(2, max_fetch_pages):
                p_res = _metron_request(f"series/{s_id}/issue_list/", {"limit": 100, "page": p})
                if p_res and p_res.get("results"):
                    raw_issues.extend(p_res["results"])
                else:
                    break

        # Sort chronologically by publication date, then numerically by issue number
        def _issue_chronological_key(x: dict):
            d = str(x.get("store_date") or x.get("cover_date") or "9999-12-31").strip()[:10]
            if not d or d == "None":
                d = "9999-12-31"
            return (d, _parse_issue_num(x.get("number")))

        sorted_issues = sorted(raw_issues, key=_issue_chronological_key)

        episodes = []
        for idx, itm in enumerate(sorted_issues, start=1):
            i_id = str(itm.get("id"))
            num_str = itm.get("number") or str(idx)
            parsed_num = _parse_issue_num(num_str)

            title_str = f"#{num_str}"
            if itm.get("issue"):
                title_str = itm.get("issue")
            elif itm.get("title"):
                title_str = f"#{num_str} - {itm.get('title')}"

            img_url = itm.get("image")
            desc = _clean_html(itm.get("desc"))
            air_date = itm.get("store_date") or itm.get("cover_date")

            cv_id = itm.get("cv_id")
            ext_id = f"cv_issue_{cv_id}" if cv_id else f"metron_issue_{i_id}"

            episodes.append({
                "id": ext_id,
                "external_id": ext_id,
                "title": title_str,
                "name": title_str,
                "issue_number": int(parsed_num) if parsed_num < 999999 else idx,
                "episode_number": int(parsed_num) if parsed_num < 999999 else idx,
                "season_number": 1,
                "still_path": img_url,
                "image_url": img_url,
                "overview": desc,
                "air_date": air_date
            })

        if episodes:
            _SERIES_ISSUES_CACHE[cache_key] = (now_ts, episodes)

        return episodes

    @classmethod
    def get_comic_issue_detail(cls, issue_id: str) -> Optional[dict]:
        if not issue_id:
            return None

        clean_id = str(issue_id).strip()
        cache_key = clean_id.lower()
        now_ts = time.time()

        if cache_key in _ISSUE_DETAIL_CACHE:
            ts, cached = _ISSUE_DETAIL_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_ISSUES:
                return cached

        # Resolve issue ID
        clean_id = clean_id.replace("cv_issue_metron_issue_", "metron_issue_").replace("cv_vol_metron_series_", "metron_series_")
        i_id: Optional[int] = None
        if "metron_issue_" in clean_id:
            raw_id = clean_id.split("metron_issue_")[-1]
            if raw_id.isdigit():
                i_id = int(raw_id)
        elif clean_id.startswith("cv_issue_") or clean_id.startswith("cv_"):
            raw_cv = clean_id.replace("cv_issue_", "").replace("cv_", "")
            if raw_cv.isdigit():
                cv_res = _metron_request("issue/", {"cv_id": raw_cv})
                if cv_res and cv_res.get("results"):
                    i_id = cv_res["results"][0].get("id")
        elif clean_id.isdigit():
            i_id = int(clean_id)

        if not i_id:
            return None

        iss = _metron_request(f"issue/{i_id}/")
        if not iss:
            return None

        series_data = iss.get("series") or {}
        s_id = series_data.get("id")
        s_name = series_data.get("name") or "Comic Series"

        num_str = iss.get("number") or "1"
        iss_name = iss.get("issue") or f"{s_name} #{num_str}"
        desc = _clean_html(iss.get("desc"))
        img_url = iss.get("image")
        air_date = iss.get("store_date") or iss.get("cover_date")

        characters_list = [c.get("name") for c in iss.get("characters", []) if isinstance(c, dict) and c.get("name")]
        creators_list = []
        for c in iss.get("credits", []):
            c_name = c.get("creator", {}).get("name") if isinstance(c.get("creator"), dict) else c.get("creator")
            if c_name:
                creators_list.append(str(c_name))

        series_ext_id = f"cv_vol_{series_data.get('cv_id')}" if series_data.get("cv_id") else f"metron_series_{s_id}"
        issue_result = {
            "id": f"cv_issue_{iss.get('cv_id')}" if iss.get("cv_id") else f"metron_issue_{i_id}",
            "external_id": f"cv_issue_{iss.get('cv_id')}" if iss.get("cv_id") else f"metron_issue_{i_id}",
            "title": iss_name,
            "name": iss_name,
            "issue_number": num_str,
            "cover_date": iss.get("cover_date"),
            "store_date": iss.get("store_date"),
            "air_date": air_date,
            "image_url": img_url,
            "still_path": img_url,
            "description": desc,
            "overview": desc,
            "page_count": iss.get("page"),
            "price": iss.get("price"),
            "volume": {
                "id": series_ext_id,
                "external_id": series_ext_id,
                "name": s_name,
                "title": s_name
            },
            "parent_series": {
                "id": series_ext_id,
                "external_id": series_ext_id,
                "name": s_name,
                "title": s_name,
                "item_type": "comic",
                "image_url": series_data.get("image") or img_url
            },
            "characters": characters_list,
            "credits": creators_list
        }

        _ISSUE_DETAIL_CACHE[cache_key] = (now_ts, issue_result)
        return issue_result

    @classmethod
    def get_new_comics(cls) -> List[SearchResultItem]:
        cache_key = "metron_new_comics_v3"
        now_ts = time.time()
        if cache_key in _NEW_COMICS_CACHE:
            ts, data = _NEW_COMICS_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_EXPLORE:
                return data

        today = datetime.date.today()
        today_str = today.isoformat()
        date_cutoff = (today - datetime.timedelta(days=45)).isoformat()

        # Query issues published strictly up to today (never in the future)
        res = _metron_request("issue/", {
            "store_date_range_after": date_cutoff,
            "store_date_range_before": today_str,
            "limit": 60
        })

        raw_results: List[Tuple[SearchResultItem, str]] = []
        seen_ids = set()

        if res and res.get("results"):
            for iss in res.get("results", []):
                iss_id = iss.get("id")
                img_url = iss.get("image")
                if not iss_id or not img_url or iss_id in seen_ids:
                    continue
                seen_ids.add(iss_id)

                store_date = iss.get("store_date") or iss.get("cover_date")
                # Strict check: never allow issues from the future!
                if not store_date or store_date > today_str:
                    continue

                s_info = iss.get("series") or {}
                s_name = s_info.get("name") or iss.get("issue", "").split("#")[0].strip()
                s_year = s_info.get("year_began")
                clean_title = f"{s_name} ({s_year})" if (s_year and f"({s_year})" not in s_name) else s_name
                if not clean_title:
                    clean_title = re.sub(r"\s*#\d+\s*$", "", iss.get("issue") or "")

                desc = f"Published: {store_date}."
                if not is_safe_media_item(clean_title, desc):
                    continue

                cv_id = iss.get("cv_id")
                ext_id = f"cv_issue_{cv_id}" if cv_id else f"metron_issue_{iss_id}"

                # Show issue number as badge (e.g. #15, #6), never the generic word "issue"
                iss_num = iss.get("number")
                badge_val = f"#{iss_num}" if iss_num else "Número"

                item = SearchResultItem(
                    external_id=ext_id,
                    title=clean_title,
                    image_url=img_url,
                    description=desc,
                    item_type="comic",
                    badge=badge_val,
                    release_date=store_date
                )
                raw_results.append((item, store_date))

        # Sort descending by store_date so the freshest releases come first!
        raw_results.sort(key=lambda x: x[1], reverse=True)
        results = [x[0] for x in raw_results[:24]]

        if results:
            _NEW_COMICS_CACHE[cache_key] = (now_ts, results)

        return results

    @classmethod
    def get_trending_comics(cls) -> List[SearchResultItem]:
        cache_key = "metron_trending_comics_wiki_v3"
        now_ts = time.time()
        if cache_key in _TRENDING_COMICS_CACHE:
            ts, data = _TRENDING_COMICS_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_EXPLORE:
                return data

        # Wikimedia pageviews across diverse, iconic, and modern comics from all eras
        today_utc = datetime.datetime.now(datetime.timezone.utc)
        end_dt = today_utc - datetime.timedelta(days=2)
        start_dt = end_dt - datetime.timedelta(days=7)
        start_str = start_dt.strftime("%Y%m%d")
        end_str = end_dt.strftime("%Y%m%d")

        candidates = [
            {"title": "Absolute Batman (2024)", "wiki": "Absolute_Batman", "year": "2024", "desc": "DC's Absolute Universe reimagining of Batman by Scott Snyder and Nick Dragotta.", "ext_id": "metron_series_8477"},
            {"title": "Absolute Superman (2025)", "wiki": "Absolute_Superman", "year": "2025", "desc": "The Man of Steel reimagined in DC's new Absolute Universe by Jason Aaron.", "ext_id": "metron_series_8746"},
            {"title": "Watchmen (1986)", "wiki": "Watchmen", "year": "1986", "desc": "Alan Moore and Dave Gibbons' groundbreaking graphic novel masterpiece.", "ext_id": "metron_series_537"},
            {"title": "The Dark Knight Returns (1986)", "wiki": "The_Dark_Knight_Returns", "year": "1986", "desc": "Frank Miller, Klaus Janson and Lynn Varley's defining Batman classic.", "ext_id": "metron_series_6891"},
            {"title": "The Boys (2006)", "wiki": "The_Boys_(comics)", "year": "2006", "desc": "Garth Ennis and Darick Robertson's subversive superhero satire.", "ext_id": "metron_series_3607"},
            {"title": "Maus (1986)", "wiki": "Maus", "year": "1986", "desc": "Art Spiegelman's Pulitzer Prize-winning graphic novel.", "ext_id": "metron_series_15420"},
            {"title": "The Sandman (1989)", "wiki": "The_Sandman_(comic_book)", "year": "1989", "desc": "Neil Gaiman's legendary dark fantasy masterpiece from Vertigo/DC.", "ext_id": "metron_series_3315"},
            {"title": "Teenage Mutant Ninja Turtles (2024)", "wiki": "Teenage_Mutant_Ninja_Turtles_(comic_book)", "year": "2024", "desc": "The legendary Ninja Turtles in their acclaimed modern comic run.", "ext_id": "metron_series_7881"},
            {"title": "V for Vendetta (1988)", "wiki": "V_for_Vendetta", "year": "1988", "desc": "Alan Moore and David Lloyd's dystopian graphic novel masterpiece.", "ext_id": "metron_series_5676"},
            {"title": "Invincible (2003)", "wiki": "Invincible_(comics)", "year": "2003", "desc": "Robert Kirkman, Cory Walker and Ryan Ottley's celebrated superhero saga.", "ext_id": "metron_series_2186"},
            {"title": "The Walking Dead (2003)", "wiki": "The_Walking_Dead_(comic_book)", "year": "2003", "desc": "Robert Kirkman and Charlie Adlard's landmark zombie survival epic.", "ext_id": "metron_series_376"},
            {"title": "Batman: The Killing Joke (1988)", "wiki": "Batman:_The_Killing_Joke", "year": "1988", "desc": "Alan Moore and Brian Bolland's definitive Joker story.", "ext_id": "metron_series_761"},
            {"title": "Batman: The Long Halloween (1996)", "wiki": "Batman:_The_Long_Halloween", "year": "1996", "desc": "Jeph Loeb and Tim Sale's iconic Gotham mystery noir.", "ext_id": "metron_series_1029"},
            {"title": "Batman: Year One (1987)", "wiki": "Batman:_Year_One", "year": "1987", "desc": "Frank Miller and David Mazzucchelli's canonical Batman origin.", "ext_id": "metron_series_17378"},
            {"title": "All-Star Superman (2005)", "wiki": "All-Star_Superman", "year": "2005", "desc": "Grant Morrison and Frank Quitely's acclaimed Superman classic.", "ext_id": "metron_series_3988"},
            {"title": "Saga (2012)", "wiki": "Saga_(comics)", "year": "2012", "desc": "Brian K. Vaughan and Fiona Staples' acclaimed sci-fi fantasy space opera.", "ext_id": "metron_series_916"},
            {"title": "Spawn (1992)", "wiki": "Spawn_(comics)", "year": "1992", "desc": "Todd McFarlane's record-breaking independent superhero series.", "ext_id": "metron_series_4210"},
            {"title": "Something Is Killing the Children (2019)", "wiki": "Something_Is_Killing_the_Children", "year": "2019", "desc": "James Tynion IV and Werther Dell'Edera's hit horror series.", "ext_id": "metron_series_614"},
            {"title": "Hellboy: Seed of Destruction (1994)", "wiki": "Hellboy", "year": "1994", "desc": "Mike Mignola's legendary paranormal dark fantasy comic.", "ext_id": "metron_series_52"},
            {"title": "Preacher (1995)", "wiki": "Preacher_(comics)", "year": "1995", "desc": "Garth Ennis and Steve Dillon's subversive Vertigo classic.", "ext_id": "metron_series_4970"},
            {"title": "The Amazing Spider-Man (1963)", "wiki": "The_Amazing_Spider-Man", "year": "1963", "desc": "Stan Lee and Steve Ditko's legendary flagship superhero series.", "ext_id": "metron_series_835"},
            {"title": "Ultimate Spider-Man (2000)", "wiki": "Ultimate_Spider-Man", "year": "2000", "desc": "Brian Michael Bendis and Mark Bagley's landmark Marvel reboot.", "ext_id": "metron_series_5537"},
            {"title": "Monstress (2015)", "wiki": "Monstress_(comics)", "year": "2015", "desc": "Marjorie Liu and Sana Takeda's award-winning dark fantasy saga.", "ext_id": "metron_series_4733"},
            {"title": "Sin City (1991)", "wiki": "Sin_City", "year": "1991", "desc": "Frank Miller's definitive neo-noir crime comic masterpiece.", "ext_id": "metron_series_6128"},
            {"title": "Y: The Last Man (2002)", "wiki": "Y:_The_Last_Man", "year": "2002", "desc": "Brian K. Vaughan and Pia Guerra's post-apocalyptic Vertigo epic.", "ext_id": "metron_series_4935"},
            {"title": "Civil War (2006)", "wiki": "Civil_War_(comics)", "year": "2006", "desc": "Mark Millar and Steve McNiven's Marvel crossover blockbuster.", "ext_id": "metron_series_402"},
            {"title": "The Infinity Gauntlet (1991)", "wiki": "The_Infinity_Gauntlet", "year": "1991", "desc": "Jim Starlin, George Pérez and Ron Lim's cosmic Marvel epic.", "ext_id": "metron_series_3047"},
            {"title": "Paper Girls (2015)", "wiki": "Paper_Girls", "year": "2015", "desc": "Brian K. Vaughan and Cliff Chiang's sci-fi mystery series.", "ext_id": "metron_series_70"},
            {"title": "Bone (1991)", "wiki": "Bone_(comics)", "year": "1991", "desc": "Jeff Smith's legendary high fantasy epic.", "ext_id": "metron_series_119"},
            {"title": "Persepolis (2000)", "wiki": "Persepolis_(comics)", "year": "2000", "desc": "Marjane Satrapi's autobiographical graphic novel masterpiece.", "ext_id": "metron_series_12614"}
        ]

        def _fetch_candidate_data(item: dict) -> Tuple[dict, int]:
            art = item["wiki"]
            img = None
            try:
                s_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{art}"
                req_s = urllib.request.Request(s_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req_s, timeout=4) as res_s:
                    if res_s.status == 200:
                        sd = json.loads(res_s.read().decode())
                        img = sd.get("thumbnail", {}).get("source")
            except Exception:
                pass

            views = 0
            try:
                pv_url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{art}/daily/{start_str}/{end_str}"
                req_p = urllib.request.Request(pv_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req_p, timeout=4) as res_p:
                    if res_p.status == 200:
                        pd = json.loads(res_p.read().decode())
                        views = sum(x.get("views", 0) for x in pd.get("items", []))
            except Exception:
                pass

            item_copy = dict(item)
            item_copy["img"] = img
            return (item_copy, views)

        with ThreadPoolExecutor(max_workers=10) as ex:
            ranked = list(ex.map(_fetch_candidate_data, candidates))

        # Filter strictly to candidates with verified, working covers (eliminates placeholder cards)
        valid_items = [x for x in ranked if x[0].get("img")]
        # Sort dynamically by real-world readership momentum (highest 7-day Wikipedia pageviews first)
        valid_items.sort(key=lambda x: x[1], reverse=True)

        results: List[SearchResultItem] = []
        for it, views in valid_items[:24]:
            results.append(SearchResultItem(
                external_id=it["ext_id"],
                title=it["title"],
                image_url=it["img"],
                description=it["desc"],
                item_type="comic",
                badge=None,  # Do not display issue counts in trending
                release_date=it["year"]
            ))

        if results:
            _TRENDING_COMICS_CACHE[cache_key] = (now_ts, results)

        return results

# Backward compatibility alias
ComicVineService = MetronService
