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

USER_AGENT = "Pathd/1.0 (https://pathd.net; contact@pathd.net)"
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

def _rate_limit_metron():
    """Ensure respectful spacing and strict adherence to Metron's 20 req/min limit."""
    with _rate_limit_lock:
        now = time.time()
        # Remove timestamps older than 60 seconds
        while _request_timestamps and _request_timestamps[0] <= now - 60.0:
            _request_timestamps.popleft()

        # If at 18 requests in the last 60 seconds, wait until oldest expires
        if len(_request_timestamps) >= 18:
            sleep_needed = 60.0 - (now - _request_timestamps[0]) + 0.1
            if sleep_needed > 0:
                time.sleep(sleep_needed)
                now = time.time()
                while _request_timestamps and _request_timestamps[0] <= now - 60.0:
                    _request_timestamps.popleft()

        # Also enforce a minimum spacing between consecutive requests
        if _request_timestamps:
            elapsed = now - _request_timestamps[-1]
            if elapsed < 0.4:
                time.sleep(0.4 - elapsed)
                now = time.time()

        _request_timestamps.append(now)

def _metron_request(endpoint: str, params: Optional[Dict[str, Any]] = None, timeout: int = 8) -> Optional[dict]:
    token = getattr(settings, "METRON_API_TOKEN", None)
    if not token:
        logger.warning("METRON_API_TOKEN is not configured in settings")
        return None

    _rate_limit_metron()

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

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                return json.loads(response.read().decode())
            elif response.status == 429:
                retry_after = int(response.headers.get("Retry-After", 5))
                logger.warning(f"Metron rate limited. Retry-After: {retry_after}s")
                time.sleep(min(retry_after, 5))
                return None
    except Exception as e:
        logger.warning(f"Metron request error for '{url}': {e}")

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

        # 2. Concurrently fetch series metadata (for issue counts) and issue #1 (for covers)
        with ThreadPoolExecutor(max_workers=2) as executor:
            fut_issue1 = executor.submit(_metron_request, "issue/", {
                "series_name": cleaned_query,
                "number": "1",
                "limit": 30
            })
            fut_series = executor.submit(_metron_request, "series/", {
                "name": cleaned_query,
                "limit": 50
            })

        series_data = fut_series.result()
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

        issue1_data = fut_issue1.result()
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

        # Fetch missing issue counts for top results (up to 5)
        if missing_count_sids:
            top_missing = missing_count_sids[:5]
            def _fetch_single_series_count(t: Tuple[int, int]):
                sid, idx = t
                s_dt = _metron_request(f"series/{sid}/")
                return idx, s_dt.get("issue_count") if s_dt else None

            with ThreadPoolExecutor(max_workers=5) as executor:
                for idx, c in executor.map(_fetch_single_series_count, top_missing):
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

        # Paginate if series has more than 100 issues (fetch full issue list up to 10,000 issues concurrently)
        total_pages = math.ceil(total_count / 100)
        if total_pages > 1:
            def _fetch_issue_page(p: int):
                return _metron_request(f"series/{s_id}/issue_list/", {"limit": 100, "page": p})

            max_fetch_pages = min(total_pages + 1, 101)  # Up to 10,000 issues
            with ThreadPoolExecutor(max_workers=8) as executor:
                pages_res = list(executor.map(_fetch_issue_page, range(2, max_fetch_pages)))
            for p_res in pages_res:
                if p_res and p_res.get("results"):
                    raw_issues.extend(p_res["results"])

        # Sort numerically by issue number
        sorted_issues = sorted(raw_issues, key=lambda x: _parse_issue_num(x.get("number")))

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
        cache_key = "metron_trending_comics_wiki_v1"
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
            {
                "name": "Absolute Superman",
                "wiki": "Superman",
                "title": "Absolute Superman (2025)",
                "year": "2025",
                "img": "https://static.metron.cloud/media/issue/2024/11/06/absolute-superman-1.jpg",
                "desc": "The Man of Steel in DC's new Absolute Universe.",
                "ext_id": "metron_series_8400"
            },
            {
                "name": "Teenage Mutant Ninja Turtles",
                "wiki": "Teenage_Mutant_Ninja_Turtles",
                "title": "Teenage Mutant Ninja Turtles (2024)",
                "year": "2024",
                "img": "https://static.metron.cloud/media/issue/2024/07/26/tmnt-1.jpg",
                "desc": "The legendary Ninja Turtles in their acclaimed modern run.",
                "ext_id": "metron_series_7881"
            },
            {
                "name": "Absolute Batman",
                "wiki": "Absolute_Batman",
                "title": "Absolute Batman (2024)",
                "year": "2024",
                "img": "https://static.metron.cloud/media/issue/2024/07/26/absolute-batman-1.jpg",
                "desc": "DC's Absolute Universe reimagining of Batman by Scott Snyder.",
                "ext_id": "metron_series_8350"
            },
            {
                "name": "Watchmen",
                "wiki": "Watchmen",
                "title": "Watchmen (1986)",
                "year": "1986",
                "img": "https://static.metron.cloud/media/issue/2019/08/19/watchmen-1.jpg",
                "desc": "Alan Moore and Dave Gibbons' groundbreaking graphic novel masterpiece.",
                "ext_id": "metron_series_537"
            },
            {
                "name": "X-Men",
                "wiki": "X-Men",
                "title": "X-Men (2024)",
                "year": "2024",
                "img": "https://static.metron.cloud/media/issue/2024/07/10/x-men-1.jpg",
                "desc": "Marvel's flagship mutant ongoing series in the From the Ashes era.",
                "ext_id": "metron_series_7700"
            },
            {
                "name": "V for Vendetta",
                "wiki": "V_for_Vendetta",
                "title": "V for Vendetta (1988)",
                "year": "1988",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/v-for-vendetta-1.jpg",
                "desc": "Alan Moore and David Lloyd's iconic dystopian graphic novel.",
                "ext_id": "metron_series_5676"
            },
            {
                "name": "Hellboy",
                "wiki": "Hellboy",
                "title": "Hellboy: Seed of Destruction (1994)",
                "year": "1994",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/hellboy-1.jpg",
                "desc": "Mike Mignola's supernatural detective masterpiece.",
                "ext_id": "metron_series_52"
            },
            {
                "name": "Maus",
                "wiki": "Maus",
                "title": "Maus: A Survivor's Tale (1986)",
                "year": "1986",
                "img": "https://static.metron.cloud/media/issue/2026/03/16/large-6702113.jpg",
                "desc": "Art Spiegelman's Pulitzer Prize-winning graphic novel.",
                "ext_id": "metron_series_15420"
            },
            {
                "name": "Invincible",
                "wiki": "Invincible_(comics)",
                "title": "Invincible (2003)",
                "year": "2003",
                "img": "https://static.metron.cloud/media/issue/2021/04/10/invincible-1.jpg",
                "desc": "Robert Kirkman's beloved superhero comic epic.",
                "ext_id": "metron_series_2186"
            },
            {
                "name": "The Sandman",
                "wiki": "The_Sandman_(comic_book)",
                "title": "Sandman (1989)",
                "year": "1989",
                "img": "https://static.metron.cloud/media/issue/2022/04/07/the-sandman-1.jpg",
                "desc": "Neil Gaiman's acclaimed dark fantasy comic book series.",
                "ext_id": "metron_series_3315"
            },
            {
                "name": "The Dark Knight Returns",
                "wiki": "The_Dark_Knight_Returns",
                "title": "Batman: The Dark Knight (1986)",
                "year": "1986",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/batman-the-dark-knight-1.jpg",
                "desc": "Frank Miller's seminal dark vision of an aging Bruce Wayne.",
                "ext_id": "metron_series_6891"
            },
            {
                "name": "The Walking Dead",
                "wiki": "The_Walking_Dead_(comic_book)",
                "title": "The Walking Dead (2003)",
                "year": "2003",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/the-walking-dead-1.jpg",
                "desc": "Robert Kirkman and Charlie Adlard's global zombie phenomenon.",
                "ext_id": "metron_series_376"
            },
            {
                "name": "Batman: The Killing Joke",
                "wiki": "Batman:_The_Killing_Joke",
                "title": "Batman: The Killing Joke (1988)",
                "year": "1988",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/batman-the-killing-joke-1.jpg",
                "desc": "The origin of the Joker by Alan Moore and Brian Bolland.",
                "ext_id": "metron_series_761"
            },
            {
                "name": "Scott Pilgrim",
                "wiki": "Scott_Pilgrim",
                "title": "Scott Pilgrim EX (2026)",
                "year": "2026",
                "img": "https://static.metron.cloud/media/issue/2026/04/10/scott-pilgrim.jpg",
                "desc": "Bryan Lee O'Malley's iconic graphic novel saga.",
                "ext_id": "metron_series_17521"
            },
            {
                "name": "Persepolis",
                "wiki": "Persepolis_(comics)",
                "title": "Persepolis GN (2003)",
                "year": "2003",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/persepolis.jpg",
                "desc": "Marjane Satrapi's autobiographical graphic novel.",
                "ext_id": "metron_series_820"
            },
            {
                "name": "Something Is Killing the Children",
                "wiki": "Something_Is_Killing_the_Children",
                "title": "Something Is Killing the Children (2019)",
                "year": "2019",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/something-is-killing-the-children-1.jpg",
                "desc": "James Tynion IV and Werther Dell'Edera's hit horror series.",
                "ext_id": "metron_series_614"
            },
            {
                "name": "Batman: Year One",
                "wiki": "Batman:_Year_One",
                "title": "Batman: Year One (2005)",
                "year": "2005",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/batman-year-one.jpg",
                "desc": "Frank Miller and David Mazzucchelli's definitive Batman origin.",
                "ext_id": "metron_series_17378"
            },
            {
                "name": "Saga",
                "wiki": "Saga_(comics)",
                "title": "Saga (2012)",
                "year": "2012",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/saga-1.jpg",
                "desc": "Brian K. Vaughan and Fiona Staples' epic space opera.",
                "ext_id": "metron_series_916"
            },
            {
                "name": "Ultimate Spider-Man",
                "wiki": "Ultimate_Spider-Man",
                "title": "Ultimate Spider-Man (2024)",
                "year": "2024",
                "img": "https://static.metron.cloud/media/issue/2024/01/10/ultimate-spider-man-1.jpg",
                "desc": "Jonathan Hickman and Marco Checchetto's hit new Ultimate series.",
                "ext_id": "metron_series_6600"
            },
            {
                "name": "Sin City",
                "wiki": "Sin_City",
                "title": "Sin City: A Dame to Kill For (1993)",
                "year": "1993",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/sin-city-1.jpg",
                "desc": "Frank Miller's hardboiled noir graphic novel series.",
                "ext_id": "metron_series_6128"
            },
            {
                "name": "Preacher",
                "wiki": "Preacher_(comics)",
                "title": "Preacher (1995)",
                "year": "1995",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/preacher-1.jpg",
                "desc": "Garth Ennis and Steve Dillon's subversive Vertigo classic.",
                "ext_id": "metron_series_4970"
            },
            {
                "name": "Locke & Key",
                "wiki": "Locke_%26_Key",
                "title": "Locke & Key (2008)",
                "year": "2008",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/locke-and-key-1.jpg",
                "desc": "Joe Hill and Gabriel Rodriguez's acclaimed horror-fantasy.",
                "ext_id": "metron_series_482"
            },
            {
                "name": "Transformers",
                "wiki": "Transformers_(comics)",
                "title": "Transformers (2023)",
                "year": "2023",
                "img": "https://static.metron.cloud/media/issue/2023/10/04/transformers-1.jpg",
                "desc": "Daniel Warren Johnson's Eisner-winning Energon Universe series.",
                "ext_id": "metron_series_6100"
            },
            {
                "name": "Blacksad",
                "wiki": "Blacksad",
                "title": "Blacksad (2010)",
                "year": "2010",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/blacksad.jpg",
                "desc": "Juan Díaz Canales and Juanjo Guarnido's celebrated anthropomorphic noir masterpiece.",
                "ext_id": "metron_series_1100"
            },
            {
                "name": "Monstress",
                "wiki": "Monstress_(comics)",
                "title": "Monstress (2015)",
                "year": "2015",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/monstress-1.jpg",
                "desc": "Marjorie Liu and Sana Takeda's award-winning dark fantasy.",
                "ext_id": "metron_series_890"
            },
            {
                "name": "Transmetropolitan",
                "wiki": "Transmetropolitan",
                "title": "Transmetropolitan (1997)",
                "year": "1997",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/transmetropolitan-1.jpg",
                "desc": "Warren Ellis and Darick Robertson's cyberpunk satire.",
                "ext_id": "metron_series_5500"
            },
            {
                "name": "Spawn",
                "wiki": "Spawn_(comics)",
                "title": "Spawn (1992)",
                "year": "1992",
                "img": "https://static.metron.cloud/media/issue/2020/07/19/spawn-1.jpg",
                "desc": "Todd McFarlane's record-breaking independent superhero series.",
                "ext_id": "metron_series_120"
            }
        ]

        def _fetch_pageviews(item: dict) -> Tuple[dict, int]:
            art = item["wiki"]
            url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{art}/daily/{start_str}/{end_str}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        items = data.get("items", [])
                        total_views = sum(x.get("views", 0) for x in items)
                        return (item, total_views)
            except Exception:
                pass
            return (item, 0)

        with ThreadPoolExecutor(max_workers=8) as ex:
            ranked = list(ex.map(_fetch_pageviews, candidates))

        # Sort dynamically by real-world readership momentum (highest Wikipedia pageviews first)
        ranked.sort(key=lambda x: x[1], reverse=True)

        results: List[SearchResultItem] = []
        for it, views in ranked[:24]:
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
