import json
import urllib.request
import urllib.parse
from typing import List, Tuple, Set
import concurrent.futures
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item

class GoogleBooksService:
    @staticmethod
    def fetch_google_books(query: str, order_by: str = None) -> List[Tuple[SearchResultItem, List[str]]]:
        if not query:
            return []
        try:
            from app.core.config import settings
            query_clean = query.strip().replace("-", "").replace(" ", "")
            if query_clean.isdigit() and len(query_clean) in (10, 13):
                search_term = f"isbn:{query_clean}"
            else:
                search_term = query
            encoded_query = urllib.parse.quote(search_term)
            url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&maxResults=15&maxAllowedMaturityRating=not-mature"
            if order_by:
                url += f"&orderBy={order_by}"
            if settings.GOOGLE_BOOKS_API_KEY:
                url += f"&key={settings.GOOGLE_BOOKS_API_KEY}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("items", []):
                        v_info = item.get("volumeInfo", {})
                        
                        title = v_info.get("title") or "Untitled Book"
                        authors = v_info.get("authors", [])
                        author_str = f"Author: {authors[0]}." if authors else ""
                        pub_date = v_info.get("publishedDate") or ""
                        pub_str = f" Published: {pub_date}." if pub_date else ""
                        desc = f"{author_str}{pub_str}"
                        categories = v_info.get("categories") or []
                        if not is_safe_media_item(title, desc, categories=categories):
                            continue

                        isbns = []
                        for ident in v_info.get("industryIdentifiers", []):
                            if ident.get("type") in ("ISBN_13", "ISBN_10"):
                                val = ident.get("identifier", "").strip().replace("-", "").replace(" ", "").lower()
                                if val:
                                    isbns.append(val)
                                    
                        img_links = v_info.get("imageLinks", {})
                        img_url = img_links.get("thumbnail") or img_links.get("smallThumbnail")
                        if img_url and img_url.startswith("http://"):
                            img_url = img_url.replace("http://", "https://")
                            
                        ext_id = f"googlebook-{item.get('id')}"
                        item_type = "book"

                        search_item = SearchResultItem(
                            external_id=ext_id,
                            title=title,
                            image_url=img_url,
                            description=desc,
                            item_type=item_type,
                            release_date=pub_date,
                            page_count=v_info.get("pageCount")
                        )
                        results.append((search_item, isbns))
                    return results

        except Exception as e:
            print(f"Google Books API Error: {e}")
        return []

    @staticmethod
    def fetch_open_library(query: str) -> List[Tuple[SearchResultItem, List[str]]]:
        if not query:
            return []
        try:
            query_clean = query.strip().replace("-", "").replace(" ", "")
            if query_clean.isdigit() and len(query_clean) in (10, 13):
                url = f"https://openlibrary.org/search.json?isbn={query_clean}&limit=15"
            else:
                encoded_query = urllib.parse.quote(query)
                url = f"https://openlibrary.org/search.json?q={encoded_query}&limit=15"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("docs", []):
                        title = item.get("title") or "Untitled Book"
                        author = item.get("author_name", ["Unknown Author"])[0]
                        first_publish = item.get("first_publish_year")
                        desc = f"Author: {author}."
                        if first_publish:
                            desc += f" First published in {first_publish}."
                            
                        if not is_safe_media_item(title, desc):
                            continue

                        isbns = []
                        for isbn_raw in item.get("isbn", []):
                            val = isbn_raw.strip().replace("-", "").replace(" ", "").lower()
                            if val:
                                isbns.append(val)
                                
                        cover_i = item.get("cover_i")
                        image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None
                        ext_id = f"openlibrary-{str(item.get('key', '')).replace('/works/', '')}"
                        
                        item_type = "book"

                        search_item = SearchResultItem(
                            external_id=ext_id,
                            title=title,
                            image_url=image_url,
                            description=desc,
                            item_type=item_type,
                            release_date=str(first_publish) if first_publish else None,
                            page_count=item.get("number_of_pages_median") or item.get("number_of_pages")
                        )
                        results.append((search_item, isbns))
                    return results
        except Exception as e:
            print(f"Open Library API Error: {e}")
        return []

    @staticmethod
    def search_books(query: str, order_by: str = None) -> List[SearchResultItem]:
        if not query:
            return []
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_google = executor.submit(GoogleBooksService.fetch_google_books, query, order_by)
            future_ol = executor.submit(GoogleBooksService.fetch_open_library, query)
            google_results = future_google.result()
            ol_results = future_ol.result()
            
        seen_isbns: Set[str] = set()
        merged_results: List[SearchResultItem] = []
        
        for item, isbns in google_results:
            merged_results.append(item)
            for isbn in isbns:
                seen_isbns.add(isbn)
                
        for item, isbns in ol_results:
            is_duplicate = False
            for isbn in isbns:
                if isbn in seen_isbns:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                merged_results.append(item)
                for isbn in isbns:
                    seen_isbns.add(isbn)
                    
        return merged_results

    _new_books_cache = {}

    @staticmethod
    def get_new_books() -> List[SearchResultItem]:
        from datetime import datetime
        import json, urllib.request, urllib.parse, time
        import concurrent.futures
        from app.core.config import settings

        cache_key = "googlebooks_new_books_v1"
        now_ts = time.time()
        if cache_key in GoogleBooksService._new_books_cache:
            ts, data = GoogleBooksService._new_books_cache[cache_key]
            if now_ts - ts < 1800: # 30 min cache
                return data

        today_str = datetime.now().strftime("%Y-%m-%d")
        current_year = datetime.now().year
        
        search_terms = [
            f"{current_year}",
            f"novel {current_year}",
            f"books {current_year}",
            f"bestseller {current_year}"
        ]
        
        def fetch_term(term):
            try:
                encoded = urllib.parse.quote(term)
                url = f"https://www.googleapis.com/books/v1/volumes?q={encoded}&orderBy=newest&maxResults=40"
                if settings.GOOGLE_BOOKS_API_KEY:
                    url += f"&key={settings.GOOGLE_BOOKS_API_KEY}"
                
                req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        d = json.loads(response.read().decode())
                        return d.get("items", [])
            except Exception:
                pass
            return []

        all_raw_items = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for items in executor.map(fetch_term, search_terms):
                all_raw_items.extend(items)

        all_books: List[SearchResultItem] = []
        seen_ids = set()
        seen_titles = set()

        for item in all_raw_items:
            g_id = item.get("id")
            if not g_id or g_id in seen_ids:
                continue

            v_info = item.get("volumeInfo", {})
            title = v_info.get("title") or "Untitled Book"
            norm_title = "".join(e for e in title.lower() if e.isalnum())
            if norm_title in seen_titles:
                continue

            # Must have a real cover image
            img_links = v_info.get("imageLinks", {})
            img_url = img_links.get("thumbnail") or img_links.get("smallThumbnail")
            if not img_url:
                continue
            if img_url.startswith("http://"):
                img_url = img_url.replace("http://", "https://")

            pub_date = v_info.get("publishedDate") or ""
            # Filter out future dates that haven't been released yet and older years
            if not pub_date or pub_date > today_str:
                continue
            if not (pub_date.startswith(str(current_year)) or pub_date.startswith(str(current_year - 1))):
                continue

            # Filter out technical manuals, test prep, magazines, electrical code, business blueprints, and reference pamphlets
            lower_title = title.lower()
            technical_keywords = [
                "code book", "manual", "handbook", "exam prep", "study guide", 
                "test prep", "magazine", "journal", "periodical", "bulletin",
                "directory", "catalogue", "electrical code", "regulations", "audiobook",
                "business blueprint", "coloring book", "visas 2026", "hustle culture",
                "revista"
            ]
            if any(k in lower_title for k in technical_keywords):
                continue

            # Format release date as YYYY-MM for books
            formatted_date = pub_date[:7] if len(pub_date) >= 7 else pub_date

            authors = v_info.get("authors", [])
            author_str = f"Author: {authors[0]}." if authors else ""
            desc = v_info.get("description") or (author_str + f" Published: {formatted_date}.")

            seen_ids.add(g_id)
            seen_titles.add(norm_title)
            all_books.append(SearchResultItem(
                external_id=f"googlebook-{g_id}",
                title=title,
                image_url=img_url,
                description=desc,
                item_type="book",
                release_date=formatted_date,
                page_count=v_info.get("pageCount")
            ))

        # Sort strictly by release date descending
        all_books.sort(
            key=lambda b: b.release_date or "",
            reverse=True
        )

        final_res = all_books[:40]
        GoogleBooksService._new_books_cache[cache_key] = (now_ts, final_res)
        return final_res

    @staticmethod
    def get_trending_books() -> List[SearchResultItem]:
        import random
        queries = ["Bestseller", "Fantasy", "Sci-Fi", "Mystery", "Thriller", "Stephen King", "Brandon Sanderson"]
        return GoogleBooksService.search_books(random.choice(queries))[:15]
