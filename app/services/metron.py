import json
import urllib.request
import urllib.parse
import re
import time
import datetime
import logging
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

_last_request_ts: float = 0.0

def _rate_limit_metron():
    """Ensure respectful spacing between requests (min 300ms) to stay well under burst limit."""
    global _last_request_ts
    now = time.time()
    elapsed = now - _last_request_ts
    if elapsed < 0.35:
        time.sleep(0.35 - elapsed)
    _last_request_ts = time.time()

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

        # 2. Search series via issue #1 (returns matching series with issue #1 cover artwork)
        issue1_data = _metron_request("issue/", {
            "series_name": cleaned_query,
            "number": "1",
            "limit": 25
        })
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

                # Use cv_id if present for seamless backward compatibility, else metron_series_{id}
                cv_id = s_info.get("cv_id")
                ext_id = f"cv_vol_{cv_id}" if cv_id else f"metron_series_{s_id}"

                results.append(SearchResultItem(
                    external_id=ext_id,
                    title=full_title,
                    image_url=img_url,
                    description=desc,
                    item_type="comic",
                    badge=None,
                    release_date=str(s_year) if s_year else None
                ))

        # 3. Fallback: Search series endpoint directly
        if len(results) < 8:
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

                    results.append(SearchResultItem(
                        external_id=ext_id,
                        title=s_title,
                        image_url=None, # Loaded on detail
                        description=desc,
                        item_type="comic",
                        badge=None,
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

        # Paginate if series has more than 100 issues (up to 500)
        page = 2
        while len(raw_issues) < total_count and len(raw_issues) < 500:
            next_page = _metron_request(f"series/{s_id}/issue_list/", {"limit": 100, "page": page})
            if not next_page or not next_page.get("results"):
                break
            raw_issues.extend(next_page["results"])
            page += 1

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
        cache_key = "metron_new_comics_v1"
        now_ts = time.time()
        if cache_key in _NEW_COMICS_CACHE:
            ts, data = _NEW_COMICS_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_EXPLORE:
                return data

        # Query issues published in the last 60 days
        date_cutoff = (datetime.date.today() - datetime.timedelta(days=60)).isoformat()
        res = _metron_request("issue/", {
            "store_date_range_after": date_cutoff,
            "limit": 35
        })

        results: List[SearchResultItem] = []
        seen_ids = set()

        if res and res.get("results"):
            for iss in res.get("results", []):
                iss_id = iss.get("id")
                img_url = iss.get("image")
                if not iss_id or not img_url or iss_id in seen_ids:
                    continue
                seen_ids.add(iss_id)

                title = iss.get("issue") or f"Issue #{iss.get('number')}"
                store_date = iss.get("store_date") or iss.get("cover_date")
                desc = f"Published: {store_date}." if store_date else "Recent comic release."

                if not is_safe_media_item(title, desc):
                    continue

                cv_id = iss.get("cv_id")
                ext_id = f"cv_issue_{cv_id}" if cv_id else f"metron_issue_{iss_id}"

                results.append(SearchResultItem(
                    external_id=ext_id,
                    title=title,
                    image_url=img_url,
                    description=desc,
                    item_type="comic",
                    badge="issue",
                    release_date=store_date
                ))

                if len(results) >= 24:
                    break

        if results:
            _NEW_COMICS_CACHE[cache_key] = (now_ts, results)

        return results

    @classmethod
    def get_trending_comics(cls) -> List[SearchResultItem]:
        cache_key = "metron_trending_comics_v2"
        now_ts = time.time()
        if cache_key in _TRENDING_COMICS_CACHE:
            ts, data = _TRENDING_COMICS_CACHE[cache_key]
            if now_ts - ts < _CACHE_TTL_EXPLORE:
                return data

        # Query issue #1 releases from the last 18 months to showcase trending/new ongoing series
        current_year = datetime.datetime.now().year
        cutoff_date = f"{current_year - 1}-01-01"
        res = _metron_request("issue/", {
            "store_date_range_after": cutoff_date,
            "number": "1",
            "limit": 40
        })

        results: List[SearchResultItem] = []
        seen_series_ids = set()

        if res and res.get("results"):
            for iss in res.get("results", []):
                s_info = iss.get("series") or {}
                s_id = s_info.get("id")
                img_url = iss.get("image")
                if not s_id or not img_url or s_id in seen_series_ids:
                    continue
                seen_series_ids.add(s_id)

                s_name = s_info.get("name") or iss.get("issue", "").split("#")[0].strip()
                s_year = s_info.get("year_began") or current_year
                title = f"{s_name} ({s_year})" if s_year else s_name
                store_date = iss.get("store_date") or iss.get("cover_date") or str(s_year)
                desc = iss.get("desc") or f"Comic series begun in {s_year}."

                if not is_safe_media_item(title, desc):
                    continue

                cv_id = s_info.get("cv_id")
                ext_id = f"cv_vol_{cv_id}" if cv_id else f"metron_series_{s_id}"

                results.append(SearchResultItem(
                    external_id=ext_id,
                    title=title,
                    image_url=img_url,
                    description=desc,
                    item_type="comic",
                    badge=None,
                    release_date=str(s_year) if s_year else None
                ))

                if len(results) >= 24:
                    break

        if results:
            _TRENDING_COMICS_CACHE[cache_key] = (now_ts, results)

        return results


# Backward compatibility alias
ComicVineService = MetronService
