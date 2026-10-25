import json
import urllib.request
import urllib.parse
import urllib.error
import time
import datetime
import unicodedata
import re
import logging
import threading
from collections import deque
from typing import List, Tuple, Set, Optional, Dict, Any
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item
from app.core.config import settings

logger = logging.getLogger(__name__)

USER_AGENT = settings.USER_AGENT

def normalize_title(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    clean = "".join([c for c in nfkd if not unicodedata.combining(c)])
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', clean).lower()
    return " ".join(clean.split())

class BookSearchService:
    _search_cache: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
    _details_cache: Dict[str, Tuple[float, Optional[SearchResultItem]]] = {}
    _trending_cache: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
    _new_books_cache: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
    
    # Rate limiting & sliding window pacing state (Open Library limit: 3 req / sec for identified apps)
    _rate_limit_lock = threading.Lock()
    _request_timestamps = deque()
    _blocked_until: float = 0.0  # Unix timestamp until which Open Library calls are halted (circuit breaker)

    @classmethod
    def _handle_rate_limit(cls, headers: Any, url: str, status_code: int = 429) -> None:
        """Handle 429 or 403 by activating an immediate global circuit breaker honoring Retry-After."""
        now = time.time()
        wait_s = 60.0 if status_code == 403 else 30.0
        try:
            if headers:
                retry_after = headers.get("Retry-After")
                if retry_after:
                    wait_s = float(retry_after) + 2.0
        except Exception:
            pass

        with cls._rate_limit_lock:
            cls._blocked_until = now + wait_s

        logger.error(
            f"Open Library {status_code} limit reached for '{url}'. "
            f"Global circuit breaker active for {wait_s:.1f}s. Halting requests."
        )

    @classmethod
    def _rate_limit_ol(cls) -> bool:
        """
        Enforce thread-safe sliding window rate pacing for Open Library:
        - Max 3 requests in any 1.0 second rolling window (identified requests limit).
        - Min spacing of 0.33s (330ms) between consecutive requests.
        - Honors global circuit breaker when blocked by 429 or 403.
        """
        with cls._rate_limit_lock:
            now = time.time()

            # 1. Check circuit breaker / active rate limit
            if cls._blocked_until > now:
                wait_time = cls._blocked_until - now
                if wait_time <= 1.0:
                    time.sleep(wait_time)
                    now = time.time()
                else:
                    logger.info(f"Open Library circuit breaker holding requests (blocked for {wait_time:.1f}s remaining)")
                    return False

            # 2. Sliding window: clean timestamps older than 1.0 second
            while cls._request_timestamps and cls._request_timestamps[0] <= now - 1.0:
                cls._request_timestamps.popleft()

            # 3. Controlled cap: max 3 requests in any 1.0-second rolling window
            if len(cls._request_timestamps) >= 3:
                sleep_needed = 1.0 - (now - cls._request_timestamps[0]) + 0.05
                if sleep_needed > 0:
                    if sleep_needed <= 2.0:
                        time.sleep(sleep_needed)
                        now = time.time()
                        while cls._request_timestamps and cls._request_timestamps[0] <= now - 1.0:
                            cls._request_timestamps.popleft()
                    else:
                        return False

            # 4. Enforce minimum spacing of 0.33 seconds between consecutive requests
            if cls._request_timestamps:
                elapsed = now - cls._request_timestamps[-1]
                if elapsed < 0.33:
                    time.sleep(0.33 - elapsed)
                    now = time.time()

            cls._request_timestamps.append(now)
            return True

    @classmethod
    def _ol_request(cls, url: str, timeout: int = 8) -> Optional[Any]:
        """Centralized HTTP request handler with rate pacing, 429/403 circuit breaker, and Retry-After support."""
        if not cls._rate_limit_ol():
            return None

        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                if res.status == 200:
                    return json.loads(res.read().decode('utf-8'))
                elif res.status in (429, 403):
                    cls._handle_rate_limit(res.headers, url, res.status)
                    return None
        except urllib.error.HTTPError as he:
            if he.code in (429, 403):
                cls._handle_rate_limit(he.headers, url, he.code)
                return None
            logger.warning(f"Open Library HTTP {he.code} for '{url}': {he}")
            return None
        except Exception as e:
            logger.warning(f"Open Library request error for '{url}': {e}")
            return None
        return None

    @classmethod
    def get_rate_limit_status(cls) -> Optional[dict]:
        """Provides status for search router and frontend warning banner if Open Library is limited."""
        now = time.time()
        if cls._blocked_until > now:
            return {
                "category": "book",
                "reason": "rate_limit",
                "reset_at": cls._blocked_until
            }
        return None

    @staticmethod
    def _extract_inventaire_image(img: Any) -> Optional[str]:
        if not img:
            return None
        if isinstance(img, dict):
            url = img.get("url")
            if url and isinstance(url, str):
                return url
            file_name = img.get("file")
            if file_name and isinstance(file_name, str):
                return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(file_name)}?width=600"
        elif isinstance(img, str):
            if img.startswith("http://") or img.startswith("https://"):
                return img
            return f"https://inventaire.io{img}"
        return None

    @staticmethod
    def _extract_inventaire_label(ent: Dict[str, Any]) -> str:
        if not ent:
            return "Untitled Book"
        labels = ent.get("labels")
        if isinstance(labels, dict):
            for lang in ("es", "en"):
                if labels.get(lang):
                    return str(labels[lang])
            for val in labels.values():
                if val:
                    return str(val)
        label = ent.get("label")
        if label and isinstance(label, str):
            return label
        return "Untitled Book"

    @staticmethod
    def _extract_inventaire_description(ent: Dict[str, Any]) -> str:
        if not ent:
            return ""
        descs = ent.get("descriptions")
        if isinstance(descs, dict):
            for lang in ("es", "en"):
                if descs.get(lang):
                    return str(descs[lang])
            for val in descs.values():
                if val:
                    return str(val)
        desc = ent.get("description")
        if desc and isinstance(desc, str):
            return desc
        return ""

    @classmethod
    def fetch_open_library(cls, query: str) -> List[Tuple[SearchResultItem, List[str], Optional[str]]]:
        if not query:
            return []
        
        query_clean = query.strip().replace("-", "").replace(" ", "")
        is_isbn = query_clean.isdigit() and len(query_clean) in (10, 13)

        if is_isbn:
            url = f"https://openlibrary.org/search.json?isbn={query_clean}&limit=15"
        else:
            encoded_query = urllib.parse.quote(query.strip())
            url = f"https://openlibrary.org/search.json?q={encoded_query}&limit=20"

        data = cls._ol_request(url, timeout=8)
        if not data or not isinstance(data, dict):
            return []

        results: List[Tuple[SearchResultItem, List[str], Optional[str]]] = []
        for doc in data.get("docs", []):
            title = doc.get("title") or "Untitled Book"
            authors = doc.get("author_name", [])
            author_str = f"Author: {authors[0]}." if authors else ""
            first_publish = doc.get("first_publish_year")
            pub_str = f" First published in {first_publish}." if first_publish else ""
            desc = f"{author_str}{pub_str}"

            if not is_safe_media_item(title, desc):
                continue

            isbns: List[str] = []
            for raw_isbn in doc.get("isbn", [])[:5]:
                clean_val = str(raw_isbn).strip().replace("-", "").replace(" ", "").lower()
                if clean_val:
                    isbns.append(clean_val)

            cover_i = doc.get("cover_i")
            cover_edition_key = doc.get("cover_edition_key")
            image_url = None
            if cover_i:
                image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
            elif cover_edition_key:
                image_url = f"https://covers.openlibrary.org/b/olid/{cover_edition_key}-L.jpg"
            elif isbns:
                image_url = f"https://covers.openlibrary.org/b/isbn/{isbns[0]}-L.jpg"

            raw_key = str(doc.get("key", "")).replace("/works/", "").strip()
            ol_key = raw_key if raw_key.startswith("OL") else None
            ext_id = f"openlibrary-{raw_key}" if raw_key else f"openlibrary-{isbns[0] if isbns else 'unknown'}"

            page_count = doc.get("number_of_pages_median") or doc.get("number_of_pages")

            item = SearchResultItem(
                external_id=ext_id,
                title=title,
                image_url=image_url,
                description=desc,
                item_type="book",
                release_date=str(first_publish) if first_publish else None,
                page_count=int(page_count) if page_count and str(page_count).isdigit() else None
            )
            results.append((item, isbns, ol_key))

        return results

    @classmethod
    def fetch_inventaire(cls, query: str) -> List[Tuple[SearchResultItem, List[str], List[str]]]:
        if not query:
            return []

        query_clean = query.strip().replace("-", "").replace(" ", "")
        is_isbn = query_clean.isdigit() and len(query_clean) in (10, 13)

        results: List[Tuple[SearchResultItem, List[str], List[str]]] = []
        try:
            if is_isbn:
                url = f"https://inventaire.io/api/entities/by-uris?uris=isbn:{query_clean}"
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=6) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode())
                        entities = d.get("entities", {})
                        for uri, ent in entities.items():
                            label = cls._extract_inventaire_label(ent)
                            desc = cls._extract_inventaire_description(ent)
                            claims = ent.get("claims", {})
                            ol_claims = claims.get("wdt:P648", [])
                            image_url = cls._extract_inventaire_image(ent.get("image"))
                            ext_id = f"inventaire-{uri.replace(':', '_')}"
                            item = SearchResultItem(
                                external_id=ext_id,
                                title=label,
                                image_url=image_url,
                                description=desc,
                                item_type="book"
                            )
                            results.append((item, [query_clean], ol_claims))
            else:
                encoded = urllib.parse.quote(query.strip())
                url = f"https://inventaire.io/api/search?types=works&limit=10&search={encoded}"
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=6) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode())
                        for r in d.get("results", []):
                            label = cls._extract_inventaire_label(r)
                            desc = cls._extract_inventaire_description(r)
                            if not is_safe_media_item(label, desc):
                                continue

                            uri = r.get("uri") or f"inv:{r.get('id', '')}"
                            claims = r.get("claims", {})
                            ol_claims = claims.get("wdt:P648", [])
                            image_url = cls._extract_inventaire_image(r.get("image"))
                            ext_id = f"inventaire-{uri.replace(':', '_')}"

                            item = SearchResultItem(
                                external_id=ext_id,
                                title=label,
                                image_url=image_url,
                                description=desc,
                                item_type="book"
                            )
                            results.append((item, [], ol_claims))
        except Exception as e:
            logger.warning(f"Inventaire search error for '{query}': {e}")

        return results

    @classmethod
    def search_books(cls, query: str, order_by: str = None) -> List[SearchResultItem]:
        if not query or not query.strip():
            return []

        cache_key = query.strip().lower()
        now_ts = time.time()
        if cache_key in cls._search_cache:
            ts, cached_res = cls._search_cache[cache_key]
            if now_ts - ts < 600: # 10 min cache
                return cached_res

        # 1. Fetch Open Library and Inventaire in parallel
        import concurrent.futures
        ol_results: List[Tuple[SearchResultItem, List[str], Optional[str]]] = []
        inv_results: List[Tuple[SearchResultItem, List[str], List[str]]] = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_ol = executor.submit(cls.fetch_open_library, query)
            fut_inv = executor.submit(cls.fetch_inventaire, query)
            try:
                ol_results = fut_ol.result()
            except Exception as e:
                logger.warning(f"Error fetching Open Library in search: {e}")
            try:
                inv_results = fut_inv.result()
            except Exception as e:
                logger.warning(f"Error fetching Inventaire in search: {e}")

        # 2. Build deduplication sets from Open Library
        seen_ol_keys: Set[str] = set()
        seen_isbns: Set[str] = set()
        seen_norm_titles: Dict[str, SearchResultItem] = {}

        merged_results: List[SearchResultItem] = []
        for item, isbns, ol_key in ol_results:
            merged_results.append(item)
            if ol_key:
                seen_ol_keys.add(ol_key)
            for isbn in isbns:
                seen_isbns.add(isbn)
            norm_t = normalize_title(item.title)
            if norm_t:
                seen_norm_titles[norm_t] = item

        # 3. Complementary / Fallback: Deduplicate and merge Inventaire results
        # A book present in Open Library will NEVER be returned as a duplicate from Inventaire
        try:
            for inv_item, inv_isbns, inv_ol_claims in inv_results:
                is_duplicate = False
                matched_ol_item: Optional[SearchResultItem] = None

                # Check Open Library claim in Wikidata
                for ol_claim in inv_ol_claims:
                    if ol_claim in seen_ol_keys:
                        is_duplicate = True
                        break

                # Check ISBN overlap
                if not is_duplicate:
                    for isbn in inv_isbns:
                        if isbn in seen_isbns:
                            is_duplicate = True
                            break

                # Check normalized title
                if not is_duplicate:
                    norm_inv = normalize_title(inv_item.title)
                    if norm_inv in seen_norm_titles:
                        is_duplicate = True
                        matched_ol_item = seen_norm_titles[norm_inv]

                if is_duplicate:
                    # Enrich Open Library item with cover or description if missing
                    if matched_ol_item:
                        if not matched_ol_item.image_url and inv_item.image_url:
                            matched_ol_item.image_url = inv_item.image_url
                        if (not matched_ol_item.description or len(matched_ol_item.description) < 40) and inv_item.description:
                            matched_ol_item.description = inv_item.description
                    continue

                # Unique work found in Inventaire!
                merged_results.append(inv_item)
                for isbn in inv_isbns:
                    seen_isbns.add(isbn)
                norm_inv = normalize_title(inv_item.title)
                if norm_inv:
                    seen_norm_titles[norm_inv] = inv_item

        except Exception as e:
            logger.warning(f"Error merging Inventaire results: {e}")

        if merged_results:
            cls._search_cache[cache_key] = (now_ts, merged_results)

        return merged_results

    @classmethod
    def get_book_detail(cls, external_id: str) -> Optional[SearchResultItem]:
        if not external_id:
            return None

        clean_ext = external_id.strip()
        cache_key = clean_ext.lower()
        now_ts = time.time()
        if cache_key in cls._details_cache:
            ts, cached_detail = cls._details_cache[cache_key]
            if now_ts - ts < 1800: # 30 min cache
                return cached_detail

        # A) Open Library detail
        if clean_ext.startswith("openlibrary-") or clean_ext.startswith("ol_"):
            work_key = clean_ext.replace("openlibrary-", "").replace("ol_", "").strip()
            # If it's a numeric ISBN instead of work key (OL...W)
            if work_key.isdigit():
                try:
                    url = f"https://openlibrary.org/isbn/{work_key}.json"
                    data = cls._ol_request(url, timeout=6)
                    if data and isinstance(data, dict):
                        title = data.get("title") or "Untitled Book"
                        desc_raw = data.get("description")
                        desc = desc_raw.get("value") if isinstance(desc_raw, dict) else (desc_raw or "")
                        covers = data.get("covers") or []
                        image_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg" if covers else f"https://covers.openlibrary.org/b/isbn/{work_key}-L.jpg"
                        pub_date = data.get("publish_date")
                        result = SearchResultItem(
                            external_id=clean_ext,
                            title=title,
                            image_url=image_url,
                            description=desc,
                            item_type="book",
                            release_date=pub_date,
                            page_count=data.get("number_of_pages")
                        )
                        cls._details_cache[cache_key] = (now_ts, result)
                        return result
                except Exception:
                    pass

            try:
                url = f"https://openlibrary.org/works/{work_key}.json"
                data = cls._ol_request(url, timeout=6)
                if data and isinstance(data, dict):
                    title = data.get("title") or "Untitled Book"
                    desc_raw = data.get("description")
                    desc = desc_raw.get("value") if isinstance(desc_raw, dict) else (desc_raw or "")
                    covers = data.get("covers") or []
                    image_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg" if covers else None

                    # If work record does not have a direct cover, check first editions
                    if not image_url:
                        try:
                            ed_url = f"https://openlibrary.org/works/{work_key}/editions.json?limit=3"
                            ed_data = cls._ol_request(ed_url, timeout=4)
                            if ed_data and isinstance(ed_data, dict):
                                for entry in ed_data.get("entries", []):
                                    entry_covers = entry.get("covers") or []
                                    if entry_covers and entry_covers[0] > 0:
                                        image_url = f"https://covers.openlibrary.org/b/id/{entry_covers[0]}-L.jpg"
                                        break
                        except Exception:
                            pass

                    first_pub = data.get("first_publish_date")

                    # If Open Library description is empty, check Inventaire summary
                    if not desc:
                        try:
                            inv_url = f"https://inventaire.io/api/search?types=works&limit=1&search={urllib.parse.quote(title)}"
                            inv_req = urllib.request.Request(inv_url, headers={"User-Agent": USER_AGENT})
                            with urllib.request.urlopen(inv_req, timeout=4) as inv_res:
                                if inv_res.status == 200:
                                    inv_data = json.loads(inv_res.read().decode())
                                    results = inv_data.get("results", [])
                                    if results:
                                        first_uri = results[0].get("uri")
                                        if first_uri:
                                            sum_url = f"https://inventaire.io/api/data/summaries?uri={first_uri}"
                                            sum_req = urllib.request.Request(sum_url, headers={"User-Agent": USER_AGENT})
                                            with urllib.request.urlopen(sum_req, timeout=4) as sum_res:
                                                if sum_res.status == 200:
                                                    sum_json = json.loads(sum_res.read().decode())
                                                    summaries = sum_json.get("summaries", [])
                                                    if summaries:
                                                        desc = summaries[0].get("text") or ""
                        except Exception:
                            pass

                    result = SearchResultItem(
                        external_id=clean_ext,
                        title=title,
                        image_url=image_url,
                        description=desc,
                        item_type="book",
                        release_date=str(first_pub) if first_pub else None
                    )
                    cls._details_cache[cache_key] = (now_ts, result)
                    return result
            except Exception as e:
                logger.warning(f"Error fetching Open Library work {work_key}: {e}")

        # B) Inventaire detail
        elif clean_ext.startswith("inventaire-") or clean_ext.startswith("inv_"):
            uri = clean_ext.replace("inventaire-", "").replace("inv_", "").replace("_", ":").strip()
            try:
                # 1. Fetch entity
                ent_url = f"https://inventaire.io/api/entities/by-uris?uris={uri}"
                ent_req = urllib.request.Request(ent_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(ent_req, timeout=6) as ent_res:
                    if ent_res.status == 200:
                        ent_data = json.loads(ent_res.read().decode())
                        ent = ent_data.get("entities", {}).get(uri, {})
                        title = cls._extract_inventaire_label(ent)
                        image_url = cls._extract_inventaire_image(ent.get("image"))

                        # 2. Fetch rich summary
                        desc = cls._extract_inventaire_description(ent)
                        try:
                            sum_url = f"https://inventaire.io/api/data/summaries?uri={uri}"
                            sum_req = urllib.request.Request(sum_url, headers={"User-Agent": USER_AGENT})
                            with urllib.request.urlopen(sum_req, timeout=5) as sum_res:
                                if sum_res.status == 200:
                                    sum_json = json.loads(sum_res.read().decode())
                                    summaries = sum_json.get("summaries", [])
                                    if summaries and summaries[0].get("text"):
                                        desc = summaries[0]["text"]
                        except Exception:
                            pass

                        result = SearchResultItem(
                            external_id=clean_ext,
                            title=title,
                            image_url=image_url,
                            description=desc,
                            item_type="book"
                        )
                        cls._details_cache[cache_key] = (now_ts, result)
                        return result
            except Exception as e:
                logger.warning(f"Error fetching Inventaire entity {uri}: {e}")

        # C) Legacy Google Book external_id fallback
        elif clean_ext.startswith("googlebook-"):
            clean_title = clean_ext.replace("googlebook-", "").replace("-", " ")
            search_items = cls.search_books(clean_title)
            if search_items:
                result = search_items[0]
                cls._details_cache[cache_key] = (now_ts, result)
                return result

        return None

    @classmethod
    def get_trending_books(cls) -> List[SearchResultItem]:
        cache_key = "ol_trending_books_daily_v2"
        now_ts = time.time()
        if cache_key in cls._trending_cache:
            ts, data = cls._trending_cache[cache_key]
            if now_ts - ts < 14400: # 4 hours cache
                return data

        results: List[SearchResultItem] = []
        seen_keys: Set[str] = set()
        seen_titles: Set[str] = set()

        try:
            url = "https://openlibrary.org/trending/daily.json?limit=35"
            data = cls._ol_request(url, timeout=8)
            if data and isinstance(data, dict):
                for work in data.get("works", []):
                    title = work.get("title") or "Untitled Book"
                    norm = normalize_title(title)
                    if norm in seen_titles:
                        continue

                    authors = [a.get("name") for a in work.get("authors", []) if a.get("name")]
                    author_str = f"Author: {authors[0]}." if authors else ""
                    first_pub = work.get("first_publish_year")
                    pub_str = f" First published: {first_pub}." if first_pub else ""
                    desc = f"{author_str}{pub_str}"

                    if not is_safe_media_item(title, desc):
                        continue

                    cover_i = work.get("cover_i") or work.get("cover_id")
                    cover_edition_key = work.get("cover_edition_key")
                    image_url = None
                    if cover_i:
                        image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
                    elif cover_edition_key:
                        image_url = f"https://covers.openlibrary.org/b/olid/{cover_edition_key}-L.jpg"

                    key_raw = str(work.get("key", "")).replace("/works/", "")
                    ext_id = f"openlibrary-{key_raw}"

                    if ext_id not in seen_keys:
                        seen_keys.add(ext_id)
                        seen_titles.add(norm)
                        results.append(SearchResultItem(
                            external_id=ext_id,
                            title=title,
                            image_url=image_url,
                            description=desc,
                            item_type="book",
                            release_date=str(first_pub) if first_pub else None
                        ))

                    if len(results) >= 24:
                        break
        except Exception as e:
            logger.warning(f"Open Library trending daily error: {e}")

        if results:
            cls._trending_cache[cache_key] = (now_ts, results)

        return results

    @classmethod
    def get_new_books(cls) -> List[SearchResultItem]:
        cache_key = "ol_new_books_releases_v5"
        now_ts = time.time()
        if cache_key in cls._new_books_cache:
            ts, data = cls._new_books_cache[cache_key]
            if now_ts - ts < 14400: # 4 hours cache
                return data

        current_year = datetime.datetime.now().year
        results: List[SearchResultItem] = []
        seen_keys: Set[str] = set()
        seen_titles: Set[str] = set()

        def is_suitable_book_release(t_raw: str) -> bool:
            t = t_raw.lower()
            blocked_terms = [
                "question bank", "class 10", "class 11", "class 12", "class 9",
                "exam", "ncert", "cbse", "curriculum", "textbook", "sample paper",
                "test bank", "anthropic test", "study guide for", "hackquire"
            ]
            return not any(b in t for b in blocked_terms)

        try:
            # Query current year (e.g. 2026) first releases sorted by reader anticipation / demand
            params = urllib.parse.urlencode({
                "q": f"first_publish_year:{current_year}",
                "sort": "want_to_read",
                "fields": "key,title,author_name,first_publish_year,cover_i",
                "limit": 45
            })
            url = f"https://openlibrary.org/search.json?{params}"
            data = cls._ol_request(url, timeout=8)
            if data and isinstance(data, dict):
                for doc in data.get("docs", []):
                    title = doc.get("title") or "Untitled Book"
                    pub_year = doc.get("first_publish_year")
                    cover_i = doc.get("cover_i")

                    # Must have valid cover artwork and match current year
                    if not cover_i or not pub_year:
                        continue
                    try:
                        if int(pub_year) != current_year:
                            continue
                    except (ValueError, TypeError):
                        continue

                    if not is_suitable_book_release(title):
                        continue

                    key_raw = str(doc.get("key", "")).replace("/works/", "").strip()
                    if not key_raw:
                        continue
                    ext_id = f"openlibrary-{key_raw}"

                    norm = normalize_title(title)
                    if ext_id in seen_keys or (norm and norm in seen_titles):
                        continue

                    authors = doc.get("author_name") or []
                    author_str = f"Author: {authors[0]}." if authors else ""
                    pub_str = f" First published: {pub_year}."
                    desc = f"{author_str}{pub_str}".strip()

                    if not is_safe_media_item(title, desc):
                        continue

                    seen_keys.add(ext_id)
                    if norm:
                        seen_titles.add(norm)

                    image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"

                    results.append(SearchResultItem(
                        external_id=ext_id,
                        title=title,
                        image_url=image_url,
                        description=desc,
                        item_type="book",
                        release_date=str(pub_year)
                    ))

                    if len(results) >= 24:
                        break
        except Exception as e:
            logger.warning(f"Open Library new books error: {e}")

        # If current year has fewer than 16 items (e.g. at the beginning of the year), backfill with prior year
        if len(results) < 16:
            try:
                params = urllib.parse.urlencode({
                    "q": f"first_publish_year:{current_year - 1}",
                    "sort": "want_to_read",
                    "fields": "key,title,author_name,first_publish_year,cover_i",
                    "limit": 25
                })
                url = f"https://openlibrary.org/search.json?{params}"
                data = cls._ol_request(url, timeout=7)
                if data and isinstance(data, dict):
                    for doc in data.get("docs", []):
                            title = doc.get("title") or "Untitled Book"
                            pub_year = doc.get("first_publish_year")
                            cover_i = doc.get("cover_i")

                            if not cover_i or not pub_year or not is_suitable_book_release(title):
                                continue

                            key_raw = str(doc.get("key", "")).replace("/works/", "").strip()
                            if not key_raw:
                                continue
                            ext_id = f"openlibrary-{key_raw}"

                            norm = normalize_title(title)
                            if ext_id in seen_keys or (norm and norm in seen_titles):
                                continue

                            authors = doc.get("author_name") or []
                            author_str = f"Author: {authors[0]}." if authors else ""
                            pub_str = f" First published: {pub_year}."
                            desc = f"{author_str}{pub_str}".strip()

                            if not is_safe_media_item(title, desc):
                                continue

                            seen_keys.add(ext_id)
                            if norm:
                                seen_titles.add(norm)

                            image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"

                            results.append(SearchResultItem(
                                external_id=ext_id,
                                title=title,
                                image_url=image_url,
                                description=desc,
                                item_type="book",
                                release_date=str(pub_year)
                            ))

                            if len(results) >= 24:
                                break
            except Exception as e:
                logger.warning(f"Open Library new books backfill error: {e}")

        # Curated recent bestsellers (current year 2026) fallback to ensure high quality in case of complete API outage
        if len(results) < 8:
            curated_recent = [
                ("openlibrary-OL42393185W", "King of Gluttony", "15207442", "Author: Ana Huang. First published: 2026.", "2026"),
                ("openlibrary-OL43158021W", "Tempting Venom", "15248444", "Author: Rina Kent. First published: 2026.", "2026"),
                ("openlibrary-OL43591244W", "Dear Debbie", "15163694", "Author: Freida McFadden. First published: 2026.", "2026"),
                ("openlibrary-OL43280192W", "Threshing Day", "15260919", "Author: Rebecca Yarros. First published: 2026.", "2026"),
                ("openlibrary-OL43178201W", "My Husband's Wife", "15248921", "Author: Alice Feeney. First published: 2026.", "2026"),
                ("openlibrary-OL43160293W", "Starside", "15248355", "Author: Alex Aster. First published: 2026.", "2026"),
                ("openlibrary-OL43589210W", "Half His Age", "15166163", "Author: Jennette McCurdy. First published: 2026.", "2026"),
                ("openlibrary-OL43019284W", "When I Kill You", "15125665", "Author: B.A. Paris. First published: 2026.", "2026"),
                ("openlibrary-OL43581290W", "Woman Down", "15162122", "Author: Colleen Hoover. First published: 2026.", "2026"),
                ("openlibrary-OL43201948W", "Love Song", "15210477", "Author: Elle Kennedy. First published: 2026.", "2026"),
                ("openlibrary-OL43192048W", "Game On", "15235861", "Author: Navessa Allen. First published: 2026.", "2026"),
                ("openlibrary-OL43519284W", "Cuando vi a la muerte prestar su sombrero", "15152509", "Author: Rodrigo Unda. First published: 2026.", "2026"),
            ]
            for ext_id, title, cov, desc, pub_year in curated_recent:
                if ext_id not in seen_keys:
                    seen_keys.add(ext_id)
                    results.append(SearchResultItem(
                        external_id=ext_id,
                        title=title,
                        image_url=f"https://covers.openlibrary.org/b/id/{cov}-L.jpg",
                        description=desc,
                        item_type="book",
                        release_date=pub_year
                    ))

        if results:
            cls._new_books_cache[cache_key] = (now_ts, results)

        return results

    @classmethod
    def fetch_books(cls, query: str) -> List[Tuple[SearchResultItem, List[str]]]:
        items = cls.search_books(query)
        return [(item, [item.title]) for item in items]

    @classmethod
    def fetch_google_books(cls, query: str, order_by: str = None) -> List[Tuple[SearchResultItem, List[str]]]:
        return cls.fetch_books(query)

# Backward compatibility alias for any remaining legacy imports
GoogleBooksService = BookSearchService
