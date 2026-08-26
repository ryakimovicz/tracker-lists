import json
import urllib.request
import urllib.parse
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService

class BannerSearchResult:
    def __init__(self, title: str, image_url: str, category: str, origin: str = ""):
        self.title = title
        self.image_url = image_url
        self.category = category # 'game', 'anime', 'movie', 'series'
        self.origin = origin

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "image_url": self.image_url,
            "category": self.category,
            "origin": self.origin
        }

class BannerService:
    @classmethod
    def _search_igdb(cls, query: str) -> List[BannerSearchResult]:
        if not query or not settings.TWITCH_CLIENT_ID:
            return []
        
        token = IGDBService._get_access_token()
        if not token:
            return []
        
        results = []
        seen_images = set()
        safe_query = query.replace('"', '\\"')
        
        # Search games with 1080p screenshots and artworks
        body = f'search "{safe_query}"; fields id, name, artworks.image_id, screenshots.image_id; limit 8;'
        req = urllib.request.Request(
            "https://api.igdb.com/v4/games",
            data=body.encode("utf-8"),
            headers={"Client-ID": settings.TWITCH_CLIENT_ID, "Authorization": f"Bearer {token}", "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    games = json.loads(resp.read().decode())
                    for g in games:
                        gname = g.get("name") or "Video Game"
                        
                        # Artworks in 1080p
                        for art in g.get("artworks", []):
                            img_id = art.get("image_id")
                            if img_id:
                                url = f"https://images.igdb.com/igdb/image/upload/t_1080p/{img_id}.jpg"
                                if url not in seen_images:
                                    seen_images.add(url)
                                    results.append(BannerSearchResult(
                                        title=f"{gname} (Artwork)",
                                        image_url=url,
                                        category="game",
                                        origin=gname
                                    ))
                        
                        # Screenshots in 1080p
                        for sc in g.get("screenshots", []):
                            img_id = sc.get("image_id")
                            if img_id:
                                url = f"https://images.igdb.com/igdb/image/upload/t_1080p/{img_id}.jpg"
                                if url not in seen_images:
                                    seen_images.add(url)
                                    results.append(BannerSearchResult(
                                        title=f"{gname} (Screenshot)",
                                        image_url=url,
                                        category="game",
                                        origin=gname
                                    ))
        except Exception as e:
            print(f"IGDB Banner Search Error: {e}")
            
        return results

    @classmethod
    def _search_anilist(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
        
        results = []
        seen_images = set()
        url = "https://graphql.anilist.co"
        graphql_banner = """
        query ($search: String) {
          Page(page: 1, perPage: 8) {
            media(search: $search, sort: POPULARITY_DESC) {
              title { english romaji }
              bannerImage
            }
          }
        }
        """
        payload = json.dumps({"query": graphql_banner, "variables": {"search": query}}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    for m in data.get("data", {}).get("Page", {}).get("media", []):
                        b_url = m.get("bannerImage")
                        t = m.get("title", {}).get("english") or m.get("title", {}).get("romaji") or "Anime"
                        if b_url and b_url not in seen_images:
                            seen_images.add(b_url)
                            results.append(BannerSearchResult(
                                title=t,
                                image_url=b_url,
                                category="anime",
                                origin=t
                            ))
        except Exception as e:
            print(f"AniList Banner Search Error: {e}")
            
        return results

    @classmethod
    def _search_fanart_movies(cls, query: str) -> List[BannerSearchResult]:
        if not query or not settings.FANART_API_KEY or not settings.OMDB_API_KEY:
            return []
            
        results = []
        seen_images = set()
        
        # 1. Search OMDb to get IMDb IDs of top movies matching query
        encoded = urllib.parse.quote(query)
        omdb_url = f"http://www.omdbapi.com/?s={encoded}&type=movie&apikey={settings.OMDB_API_KEY}"
        imdb_ids = []
        try:
            req_omdb = urllib.request.Request(omdb_url, headers={"User-Agent": "TrackerLists/1.0"})
            with urllib.request.urlopen(req_omdb, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    for item in data.get("Search", [])[:4]:
                        iid = item.get("imdbID")
                        mtitle = item.get("Title")
                        if iid:
                            imdb_ids.append((iid, mtitle))
        except Exception:
            pass

        # 2. Fetch backgrounds for each movie from Fanart.tv
        for iid, mtitle in imdb_ids:
            fan_url = f"https://webservice.fanart.tv/v3/movies/{iid}?api_key={settings.FANART_API_KEY}"
            try:
                req_fan = urllib.request.Request(fan_url, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req_fan, timeout=3) as resp_f:
                    if resp_f.status == 200:
                        fan_data = json.loads(resp_f.read().decode())
                        for bg in fan_data.get("moviebackground", [])[:3]:
                            bg_url = bg.get("url")
                            if bg_url and bg_url not in seen_images:
                                seen_images.add(bg_url)
                                results.append(BannerSearchResult(
                                    title=f"{mtitle} (Wallpaper)",
                                    image_url=bg_url,
                                    category="movie",
                                    origin=mtitle
                                ))
            except Exception:
                pass

        return results

    @classmethod
    def _search_tvmaze(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
            
        results = []
        seen_images = set()
        encoded = urllib.parse.quote(query)
        url = f"https://api.tvmaze.com/search/shows?q={encoded}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    shows = json.loads(resp.read().decode())
                    for s in shows[:3]:
                        show_id = s.get("show", {}).get("id")
                        sname = s.get("show", {}).get("name") or "Series"
                        if show_id:
                            img_url = f"https://api.tvmaze.com/shows/{show_id}/images"
                            req_img = urllib.request.Request(img_url, headers={"User-Agent": "Pathd/1.0"})
                            try:
                                with urllib.request.urlopen(req_img, timeout=3) as r_img:
                                    if r_img.status == 200:
                                        images_data = json.loads(r_img.read().decode())
                                        for im in images_data:
                                            if im.get("type") == "background":
                                                resolutions = im.get("resolutions", {})
                                                orig = resolutions.get("original", {}).get("url")
                                                if orig and orig not in seen_images:
                                                    seen_images.add(orig)
                                                    results.append(BannerSearchResult(
                                                        title=f"{sname} (Background)",
                                                        image_url=orig,
                                                        category="series",
                                                        origin=sname
                                                    ))
                            except Exception:
                                pass
        except Exception as e:
            print(f"TVMaze Banner Search Error: {e}")
            
        return results

    @classmethod
    def get_popular_suggestions(cls) -> List[Dict[str, Any]]:
        popular_terms = [
            ("Cyberpunk 2077", "game"),
            ("The Witcher 3", "game"),
            ("Elden Ring", "game"),
            ("Hollow Knight", "game"),
            ("Attack on Titan", "anime"),
            ("Cowboy Bebop", "anime"),
            ("Neon Genesis Evangelion", "anime"),
            ("Interstellar", "movie"),
            ("Blade Runner 2049", "movie"),
            ("Breaking Bad", "series"),
            ("Stranger Things", "series")
        ]
        
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            future_map = {}
            for term, cat in popular_terms:
                if cat == "game":
                    f = executor.submit(cls._search_igdb, term)
                elif cat == "anime":
                    f = executor.submit(cls._search_anilist, term)
                elif cat == "movie":
                    f = executor.submit(cls._search_fanart_movies, term)
                else:
                    f = executor.submit(cls._search_tvmaze, term)
                future_map[f] = (term, cat)

            for future in concurrent.futures.as_completed(future_map):
                try:
                    res = future.result()
                    if res:
                        all_results.extend(res[:2])
                except Exception:
                    pass

        seen_urls = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_urls:
                seen_urls.add(r.image_url)
                deduped.append(r.to_dict())

        return deduped[:40]

    @classmethod
    def search_all(cls, query: str) -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return cls.get_popular_suggestions()

        search_term = query.strip()
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            f_igdb = executor.submit(cls._search_igdb, search_term)
            f_ani = executor.submit(cls._search_anilist, search_term)
            f_movies = executor.submit(cls._search_fanart_movies, search_term)
            f_tv = executor.submit(cls._search_tvmaze, search_term)

            for future in (f_igdb, f_ani, f_movies, f_tv):
                try:
                    res = future.result()
                    all_results.extend(res)
                except Exception:
                    pass

        seen_urls = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_urls:
                seen_urls.add(r.image_url)
                deduped.append(r.to_dict())

        return deduped[:40]
