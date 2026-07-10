import json
import urllib.request
import urllib.parse
from typing import List, Tuple, Set
import concurrent.futures
from app.services.base import SearchResultItem

class GoogleBooksService:
    @staticmethod
    def fetch_google_books(query: str) -> List[Tuple[SearchResultItem, List[str]]]:
        if not query:
            return []
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&maxResults=15"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("items", []):
                        v_info = item.get("volumeInfo", {})
                        
                        isbns = []
                        for ident in v_info.get("industryIdentifiers", []):
                            if ident.get("type") in ("ISBN_13", "ISBN_10"):
                                val = ident.get("identifier", "").strip().replace("-", "").replace(" ", "").lower()
                                if val:
                                    isbns.append(val)
                                    
                        title = v_info.get("title") or "Untitled Book"
                        authors = v_info.get("authors", [])
                        author_str = f"Author: {authors[0]}." if authors else ""
                        pub_date = v_info.get("publishedDate") or ""
                        pub_str = f" Published: {pub_date}." if pub_date else ""
                        desc = v_info.get("description") or (author_str + pub_str)
                        
                        img_links = v_info.get("imageLinks", {})
                        img_url = img_links.get("thumbnail") or img_links.get("smallThumbnail")
                        if img_url and img_url.startswith("http://"):
                            img_url = img_url.replace("http://", "https://")
                            
                        ext_id = f"googlebook-{item.get('id')}"
                        
                        search_item = SearchResultItem(
                            external_id=ext_id,
                            title=title,
                            image_url=img_url,
                            description=desc,
                            item_type="book",
                            release_date=pub_date
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
            encoded_query = urllib.parse.quote(query)
            url = f"https://openlibrary.org/search.json?q={encoded_query}&limit=15"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    for item in data.get("docs", []):
                        isbns = []
                        for isbn_raw in item.get("isbn", []):
                            val = isbn_raw.strip().replace("-", "").replace(" ", "").lower()
                            if val:
                                isbns.append(val)
                                
                        cover_i = item.get("cover_i")
                        image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None
                        
                        author = item.get("author_name", ["Unknown Author"])[0]
                        first_publish = item.get("first_publish_year")
                        desc = f"Author: {author}."
                        if first_publish:
                            desc += f" First published in {first_publish}."
                            
                        ext_id = f"openlibrary-{str(item.get('key', '')).replace('/works/', '')}"
                        
                        search_item = SearchResultItem(
                            external_id=ext_id,
                            title=item.get("title") or "Untitled Book",
                            image_url=image_url,
                            description=desc,
                            item_type="book",
                            release_date=str(first_publish) if first_publish else None
                        )
                        results.append((search_item, isbns))
                    return results
        except Exception as e:
            print(f"Open Library API Error: {e}")
        return []

    @staticmethod
    def search_books(query: str) -> List[SearchResultItem]:
        if not query:
            return []
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_google = executor.submit(GoogleBooksService.fetch_google_books, query)
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
