import urllib.request
import urllib.parse
import json
import time
from typing import List, Optional, Tuple, Dict, Any
from app.services.base import SearchResultItem
from app.core.config import settings

class OMDbService:
    API_KEY = settings.OMDB_API_KEY
    FANART_API_KEY = settings.FANART_API_KEY

    # In-memory caches to save API requests
    _details_cache: Dict[str, Tuple[float, SearchResultItem]] = {}
    _search_cache: Dict[str, Tuple[float, List[SearchResultItem]]] = {}
    _fanart_cache: Dict[str, Optional[str]] = {}
    CACHE_TTL_SECONDS = 3600 * 24  # 24 hours
    
    @classmethod
    def get_fanart_poster(cls, imdb_id: str) -> Optional[str]:
        """
        Attempts to fetch a high quality movie poster from Fanart.tv using the IMDb ID.
        Falls back to None if not found or if there's an error.
        Cached in-memory.
        """
        if not cls.FANART_API_KEY or not imdb_id:
            return None

        if imdb_id in cls._fanart_cache:
            return cls._fanart_cache[imdb_id]
            
        url = f"https://webservice.fanart.tv/v3/movies/{imdb_id}?api_key={cls.FANART_API_KEY}"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        
        poster_url = None
        try:
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    posters = data.get("movieposter", [])
                    if posters:
                        poster_url = posters[0].get("url")
        except Exception:
            pass # Fanart is just a fallback, ignore errors (e.g. 404 Not Found)

    @classmethod
    def _is_valid_poster(cls, poster_url: Optional[str]) -> bool:
        """
        Validates that a poster URL exists and is an authentic theatrical/movie poster.
        IMDb headshots and editorial actor portraits have square crops (e.g. 280,280)
        or non-standard poster ratios. Genuine theatrical posters on IMDb have a 
        vertical poster aspect ratio of approximately 1:1.4 to 1:1.6 (standard 562/380 = 1.48).
        """
        if not poster_url or poster_url == "N/A":
            return False
        
        # 1. Reject any square crops or headshot dimensions in URL
        if "CR0,0," in poster_url and ("280,280" in poster_url or "200,200" in poster_url or "150,150" in poster_url or "300,300" in poster_url):
            return False

        # 2. Extract dimensions from Amazon/IMDb image URL parameters if present
        import re
        dim_match = re.search(r'CR\d+,\d+,(\d+),(\d+)', poster_url)
        if dim_match:
            try:
                w, h = float(dim_match.group(1)), float(dim_match.group(2))
                if w > 0:
                    ratio = h / w
                    # Standard vertical movie posters are ~1.40 to ~1.60
                    if ratio < 1.35 or ratio > 1.65:
                        return False
            except Exception:
                pass

        return True

    @classmethod
    def _fetch_movie_details(cls, item: dict) -> SearchResultItem:
        import concurrent.futures
        imdb_id = item.get("imdbID")
        
        # Check in-memory details cache
        if imdb_id and imdb_id in cls._details_cache:
            timestamp, cached_item = cls._details_cache[imdb_id]
            if time.time() - timestamp < cls.CACHE_TTL_SECONDS:
                return cached_item

        def get_fanart():
            return cls.get_fanart_poster(imdb_id)
            
        def get_omdb_details():
            if not cls.API_KEY or not imdb_id: return "", None, item.get("Year")
            url = f"http://www.omdbapi.com/?i={imdb_id}&plot=full&apikey={cls.API_KEY}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req, timeout=3) as res:
                    if res.status == 200:
                        data = json.loads(res.read().decode())
                        plot = data.get("Plot")
                        runtime_str = data.get("Runtime")
                        runtime_min = None
                        if runtime_str and runtime_str != "N/A":
                            try:
                                runtime_min = int(runtime_str.split()[0])
                            except ValueError:
                                pass
                        
                        released_str = data.get("Released")
                        formatted_date = item.get("Year")
                        if released_str and released_str != "N/A":
                            try:
                                from datetime import datetime
                                dt = datetime.strptime(released_str, "%d %b %Y")
                                formatted_date = dt.strftime("%Y-%m-%d")
                            except Exception:
                                pass
                        return (plot if plot and plot != "N/A" else ""), runtime_min, formatted_date
            except Exception:
                pass
            return "", None, item.get("Year")
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            f1 = ex.submit(get_fanart)
            f2 = ex.submit(get_omdb_details)
            poster = f1.result()
            plot, runtime, full_release_date = f2.result()
            
        if not poster:
            omdb_poster = item.get("Poster")
            if cls._is_valid_poster(omdb_poster):
                poster = omdb_poster
            else:
                poster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300"
            
        result = SearchResultItem(
            external_id=f"omdb_{imdb_id}",
            title=item.get("Title"),
            image_url=poster,
            description=plot,
            item_type="movie",
            release_date=full_release_date,
            imdb_id=imdb_id,
            page_count=runtime
        )

        if imdb_id:
            cls._details_cache[imdb_id] = (time.time(), result)

        return result

    @classmethod
    def get_movie_detail(cls, external_id: str) -> Optional[SearchResultItem]:
        if not external_id:
            return None
        imdb_id = external_id.replace("omdb_", "").strip()
        if not imdb_id or not cls.API_KEY:
            return None
        return cls._fetch_movie_details({"imdbID": imdb_id})

    @classmethod
    def search_movies(cls, query: str) -> List[SearchResultItem]:
        if not query or not cls.API_KEY:
            return []

        cache_key = query.strip().lower()
        if cache_key in cls._search_cache:
            timestamp, cached_results = cls._search_cache[cache_key]
            if time.time() - timestamp < cls.CACHE_TTL_SECONDS:
                return cached_results
            
        encoded_query = urllib.parse.quote(query)
        url = f"http://www.omdbapi.com/?s={encoded_query}&type=movie&apikey={cls.API_KEY}"
        
        results = []
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    search_items = data.get("Search", [])
                    
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                        detailed_results = list(executor.map(cls._fetch_movie_details, search_items[:10]))
                    
                    from app.core.sfw_filter import is_safe_media_item
                    results = [m for m in detailed_results if is_safe_media_item(m.title, m.description)]
        except Exception as e:
            print(f"OMDb Search API Error: {e}")

        if results:
            cls._search_cache[cache_key] = (time.time(), results)
            
        return results

    @classmethod
    def get_new_movies(cls) -> List[SearchResultItem]:
        cache_key = "_explore_new_movies_v8"
        if cache_key in cls._search_cache:
            timestamp, cached_results = cls._search_cache[cache_key]
            if time.time() - timestamp < 3600 * 6: # 6 hours shared cache for all users
                return cached_results

        from app.services.wikireleases import WikiReleasesService
        scheduled_films = WikiReleasesService.get_upcoming_and_recent_films(days_back=45, days_forward=21)
        
        results: List[SearchResultItem] = []
        seen_titles = set()

        def fetch_movie_from_schedule(entry):
            if len(entry) == 4:
                title, rel_date, raw_page_title, crew_desc = entry
            else:
                title, rel_date = entry[:2]
                raw_page_title, crew_desc = title, ""

            # 1. Search in OMDb for the exact 2026 movie
            target_year = "2026"
            matched_item = None
            if cls.API_KEY:
                # First try exact title query with y=2026
                try:
                    url_t = f"http://www.omdbapi.com/?t={urllib.parse.quote(title)}&y={target_year}&plot=full&apikey={cls.API_KEY}"
                    req_t = urllib.request.Request(url_t, headers={"User-Agent": "TrackerLists/1.0"})
                    with urllib.request.urlopen(req_t, timeout=3) as res_t:
                        if res_t.status == 200:
                            data_t = json.loads(res_t.read().decode())
                            if data_t.get("Response") == "True":
                                matched_item = cls._fetch_movie_details(data_t)
                except Exception:
                    pass

                # If exact title failed, search with s= and y=2026
                if not matched_item:
                    try:
                        url_s = f"http://www.omdbapi.com/?s={urllib.parse.quote(title)}&y={target_year}&type=movie&apikey={cls.API_KEY}"
                        req_s = urllib.request.Request(url_s, headers={"User-Agent": "TrackerLists/1.0"})
                        with urllib.request.urlopen(req_s, timeout=3) as res_s:
                            if res_s.status == 200:
                                data_s = json.loads(res_s.read().decode())
                                s_list = data_s.get("Search", [])
                                if s_list:
                                    matched_item = cls._fetch_movie_details(s_list[0])
                    except Exception:
                        pass

            if matched_item:
                matched_item.release_date = rel_date or matched_item.release_date
                # If poster is invalid or headshot, ensure stylized placeholder is used
                if not cls._is_valid_poster(matched_item.image_url):
                    matched_item.image_url = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300"
                return matched_item
            else:
                # Fetch Wikipedia summary / article extract (Text only, 100% legal CC0)
                wiki_plot = ""
                try:
                    query_title = raw_page_title or title
                    w_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={urllib.parse.quote(query_title)}&format=json"
                    w_req = urllib.request.Request(w_url, headers={"User-Agent": "TrackerLists/1.0 (contact@pathd.app)"})
                    with urllib.request.urlopen(w_req, timeout=3) as w_res:
                        if w_res.status == 200:
                            w_data = json.loads(w_res.read().decode())
                            pages = w_data.get("query", {}).get("pages", {})
                            for p in pages.values():
                                ext = p.get("extract", "").strip()
                                if ext:
                                    wiki_plot = ext
                                    break
                except Exception:
                    pass

                final_desc = wiki_plot or crew_desc or f"Película estrenada / por estrenar el {rel_date}."

                import hashlib
                ext_id = f"wiki_{hashlib.md5(title.encode('utf-8')).hexdigest()[:10]}"
                return SearchResultItem(
                    external_id=ext_id,
                    title=title,
                    image_url="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300",
                    description=final_desc,
                    item_type="movie",
                    release_date=rel_date
                )

        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            fetched_items = list(executor.map(fetch_movie_from_schedule, scheduled_films[:35]))

        for m in fetched_items:
            norm_title = m.title.lower().strip()
            if norm_title not in seen_titles:
                seen_titles.add(norm_title)
                results.append(m)

        sorted_results = sorted(results, key=lambda x: x.release_date or "", reverse=True)[:25]

        if sorted_results:
            cls._search_cache[cache_key] = (time.time(), sorted_results)

        return sorted_results

    @classmethod
    def get_trending_movies(cls) -> List[SearchResultItem]:
        queries = ["Dune", "Avatar", "Deadpool", "Oppenheimer", "Spider-Man", "Batman", "Star Wars", "Lord of the Rings", "Avengers"]
        import random
        selected = random.sample(queries, min(4, len(queries)))
        results = []
        for q in selected:
            res = cls.search_movies(q)
            results.extend([m for m in res if m.image_url])
            if len(results) >= 15:
                break
        return results[:15]

