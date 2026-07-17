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
    def search_movies(cls, query: str) -> List[SearchResultItem]:
        if not query or not cls.API_KEY:
            return []
            
        encoded_query = urllib.parse.quote(query)
        url = f"http://www.omdbapi.com/?s={encoded_query}&type=movie&apikey={cls.API_KEY}"
        
        results = []
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    
                    if data.get("Response") == "True":
                        for item in data.get("Search", []):
                            imdb_id = item.get("imdbID")
                            
                            # Try to get HD poster from Fanart.tv, otherwise use OMDb's poster
                            poster = cls.get_fanart_poster(imdb_id)
                            if not poster:
                                omdb_poster = item.get("Poster")
                                poster = omdb_poster if omdb_poster != "N/A" else None
                            
                            release_date = item.get("Year")
                            
                            results.append(
                                SearchResultItem(
                                    external_id=f"omdb_{imdb_id}",
                                    title=item.get("Title"),
                                    image_url=poster,
                                    description="", # OMDb search endpoint doesn't return plot. Would need detailed lookup.
                                    item_type="movie",
                                    release_date=release_date,
                                    imdb_id=imdb_id
                                )
                            )
        except Exception as e:
            print(f"OMDb Search API Error: {e}")
            
        return results
