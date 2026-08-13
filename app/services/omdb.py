import urllib.request
import urllib.parse
import json
import os
from typing import List, Optional
from app.services.base import SearchResultItem
from app.core.config import settings

class OMDbService:
    API_KEY = settings.OMDB_API_KEY
    FANART_API_KEY = settings.FANART_API_KEY
    
    @classmethod
    def get_fanart_poster(cls, imdb_id: str) -> str:
        """
        Attempts to fetch a high quality movie poster from Fanart.tv using the IMDb ID.
        Falls back to None if not found or if there's an error.
        """
        if not cls.FANART_API_KEY or not imdb_id:
            return None
            
        url = f"https://webservice.fanart.tv/v3/movies/{imdb_id}?api_key={cls.FANART_API_KEY}"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
        
        try:
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    posters = data.get("movieposter", [])
                    if posters:
                        # Return the first (usually most popular) poster
                        return posters[0].get("url")
        except Exception:
            pass # Fanart is just a fallback, ignore errors (e.g. 404 Not Found)
        return None

    @classmethod
    def _fetch_movie_details(cls, item: dict) -> SearchResultItem:
        import concurrent.futures
        imdb_id = item.get("imdbID")
        
        def get_fanart():
            return cls.get_fanart_poster(imdb_id)
            
        def get_omdb_plot():
            if not cls.API_KEY or not imdb_id: return "", None
            url = f"http://www.omdbapi.com/?i={imdb_id}&plot=short&apikey={cls.API_KEY}"
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
                        return (plot if plot and plot != "N/A" else ""), runtime_min
            except Exception:
                pass
            return "", None
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            f1 = ex.submit(get_fanart)
            f2 = ex.submit(get_omdb_plot)
            poster = f1.result()
            plot, runtime = f2.result()
            
        if not poster:
            omdb_poster = item.get("Poster")
            poster = omdb_poster if omdb_poster != "N/A" else None
            
        return SearchResultItem(
            external_id=f"omdb_{imdb_id}",
            title=item.get("Title"),
            image_url=poster,
            description=plot,
            item_type="movie",
            release_date=item.get("Year"),
            imdb_id=imdb_id,
            page_count=runtime
        )

    @classmethod
    def search_movies(cls, query: str) -> List[SearchResultItem]:
        if not query or not cls.API_KEY:
            return []
            
        encoded_query = urllib.parse.quote(query)
        url = f"http://www.omdbapi.com/?s={encoded_query}&type=movie&apikey={cls.API_KEY}"
        
        results = []
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data.get("Response") == "True":
                        import concurrent.futures
                        items = data.get("Search", [])
                        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                            results = list(executor.map(cls._fetch_movie_details, items))
        except Exception as e:
            print(f"OMDb Search API Error: {e}")
            
        return results

    @classmethod
    def get_new_movies(cls) -> List[SearchResultItem]:
        # Fallback to searching movies from the current year
        current_year = "2024" # hardcoded for simplicity as omdb lacks better endpoints
        return cls.search_movies(f"movie {current_year}")[:15]

    @classmethod
    def get_trending_movies(cls) -> List[SearchResultItem]:
        # Fallback to popular franchises
        import random
        queries = ["Avengers", "Batman", "Spider-Man", "Star Wars", "Harry Potter", "Lord of the Rings"]
        return cls.search_movies(random.choice(queries))[:15]
