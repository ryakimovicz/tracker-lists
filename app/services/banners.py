import json
import urllib.request
import urllib.parse
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService
from app.services.trakt import TraktService

import re
import time
import threading

class BannerSearchResult:
    def __init__(self, title: str, image_url: str, category: str, origin: str = "", score: int = 0, kind: str = ""):
        self.title = title
        self.image_url = image_url
        self.category = category # 'game', 'anime', 'movie', 'series'
        self.origin = origin
        self.score = score
        self.kind = kind # 'wallpaper', 'banner', 'screenshot', 'artwork', etc.

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "image_url": self.image_url,
            "category": self.category,
            "origin": self.origin
        }

class BannerService:
    _cache: Dict[str, Any] = {}
    _cache_lock = threading.Lock()
    _CACHE_TTL = 3600  # 1 hour
    _popular_cache: Dict[str, Any] = {}
    @staticmethod
    def _normalize_text(text: str) -> str:
        if not text:
            return ""
        return re.sub(r'[^a-z0-9]', '', text.lower())

    @staticmethod
    def _clean_query_terms(query: str) -> str:
        cleaned = re.sub(r'^(el|la|los|las|the|un|una)\s+', '', query.strip(), flags=re.IGNORECASE).strip()
        return cleaned if len(cleaned) >= 2 else query.strip()

    @classmethod
    def _generate_query_variants(cls, query: str) -> List[str]:
        q_raw = query.strip()
        variants = [q_raw]
        cleaned = cls._clean_query_terms(q_raw)
        if cleaned != q_raw:
            variants.append(cleaned)

        # Hyphens / Spaces
        if "-" in q_raw:
            variants.append(q_raw.replace("-", " "))
        if " " in q_raw:
            variants.append(q_raw.replace(" ", "-"))

        # Singular / Plural logic
        q_lower = q_raw.lower()
        if q_lower.endswith('s') and len(q_lower) > 3:
            variants.append(q_raw[:-1])
        elif not q_lower.endswith('s') and len(q_lower) >= 3:
            variants.append(q_raw + 's')

        # Gaming franchise common expansions
        if q_lower == "half":
            variants.extend(["half-life", "half life"])
        elif "half" in q_lower and "life" in q_lower:
            variants.extend(["half-life", "half life"])
        elif q_lower == "hollow":
            variants.extend(["hollow knight", "silksong"])

        # Deduplicate preserving order
        return list(dict.fromkeys([v for v in variants if len(v.strip()) >= 2]))

    @classmethod
    def _search_igdb(cls, query: str) -> List[BannerSearchResult]:
        if not query or not settings.TWITCH_CLIENT_ID:
            return []
        
        token = IGDBService._get_access_token()
        if not token:
            return []
        
        results = []
        seen_images = set()
        variants = cls._generate_query_variants(query)[:2]

        for term in variants:
            safe_query = term.replace('"', '\\"')
            # Search games with 1080p screenshots and artworks
            body = f'search "{safe_query}"; fields id, name, artworks.image_id, screenshots.image_id; limit 15;'
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
                            
                            # Artworks in 1080p (up to 3 per game)
                            for art in g.get("artworks", [])[:3]:
                                img_id = art.get("image_id")
                                if img_id:
                                    url = f"https://images.igdb.com/igdb/image/upload/t_1080p/{img_id}.jpg"
                                    if url not in seen_images:
                                        seen_images.add(url)
                                        results.append(BannerSearchResult(
                                            title=gname,
                                            image_url=url,
                                            category="game",
                                            origin=gname,
                                            kind="artwork"
                                        ))
                            
                            # Screenshots in 1080p (up to 3 per game)
                            for sc in g.get("screenshots", [])[:3]:
                                img_id = sc.get("image_id")
                                if img_id:
                                    url = f"https://images.igdb.com/igdb/image/upload/t_1080p/{img_id}.jpg"
                                    if url not in seen_images:
                                        seen_images.add(url)
                                        results.append(BannerSearchResult(
                                            title=gname,
                                            image_url=url,
                                            category="game",
                                            origin=gname,
                                            kind="screenshot"
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
        variants = cls._generate_query_variants(query)[:2]
        url = "https://graphql.anilist.co"

        graphql_banner = """
        query ($search: String) {
          Page(page: 1, perPage: 15) {
            media(search: $search, sort: POPULARITY_DESC, isAdult: false) {
              type
              isAdult
              genres
              title { english romaji }
              bannerImage
            }
          }
        }
        """

        for term in variants:
            payload = json.dumps({"query": graphql_banner, "variables": {"search": term}}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Origin": "https://anilist.co",
                    "Referer": "https://anilist.co/"
                }
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        for m in data.get("data", {}).get("Page", {}).get("media", []):
                            if m.get("isAdult") or "Hentai" in m.get("genres", []) or "Ecchi" in m.get("genres", []):
                                continue
                            b_url = m.get("bannerImage")
                            m_type = (m.get("type") or "ANIME").lower()
                            cat = "manga" if m_type == "manga" else "anime"
                            t = m.get("title", {}).get("english") or m.get("title", {}).get("romaji") or ("Manga" if cat == "manga" else "Anime")
                            if b_url and b_url not in seen_images:
                                seen_images.add(b_url)
                                results.append(BannerSearchResult(
                                    title=t,
                                    image_url=b_url,
                                    category=cat,
                                    origin=t
                                ))
            except Exception as e:
                print(f"AniList Banner Search Error: {e}")
            
        return results

    @classmethod
    def _search_fanart_movies(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
            
        results = []
        seen_images = set()
        variants = cls._generate_query_variants(query)[:2]
        
        for term in variants:
            banners = TraktService.search_movie_banners(term)
            for b in banners:
                img_url = b.get("image_url")
                if img_url and img_url not in seen_images:
                    seen_images.add(img_url)
                    results.append(BannerSearchResult(
                        title=b.get("title", ""),
                        image_url=img_url,
                        category="movie",
                        origin=b.get("origin", ""),
                        kind=b.get("kind", "wallpaper")
                    ))

        return results

    @classmethod
    def _search_tvmaze(cls, query: str, raw_query: str = "") -> List[BannerSearchResult]:
        if not query and not raw_query:
            return []
            
        results = []
        seen_images = set()
        search_terms = cls._generate_query_variants(raw_query or query)[:2]

        shows_to_process = []
        seen_show_ids = set()

        for term in search_terms:
            encoded = urllib.parse.quote(term)
            url = f"https://api.tvmaze.com/search/shows?q={encoded}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": settings.USER_AGENT})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    if resp.status == 200:
                        shows = json.loads(resp.read().decode())
                        for s in shows[:4]:
                            show = s.get("show", {}) or {}
                            show_id = show.get("id")
                            if show_id and show_id not in seen_show_ids:
                                seen_show_ids.add(show_id)
                                sname = show.get("name") or "Series"
                                externals = show.get("externals", {}) or {}
                                thetvdb_id = externals.get("thetvdb")
                                imdb_id = externals.get("imdb")
                                shows_to_process.append((show_id, sname, thetvdb_id, imdb_id))
            except Exception:
                pass

        def process_show_images(show_tuple):
            show_id, sname, thetvdb_id, imdb_id = show_tuple
            show_res = []

            # 1. Fanart.tv Series Backgrounds
            if settings.FANART_API_KEY and (thetvdb_id or imdb_id):
                lookup_id = thetvdb_id or imdb_id
                fan_url = f"https://webservice.fanart.tv/v3/tv/{lookup_id}?api_key={settings.FANART_API_KEY}"
                try:
                    req_fan = urllib.request.Request(fan_url, headers={"User-Agent": settings.USER_AGENT})
                    with urllib.request.urlopen(req_fan, timeout=1.8) as r_fan:
                        if r_fan.status == 200:
                            fan_data = json.loads(r_fan.read().decode())
                            for bg in (fan_data.get("showbackground") or [])[:3]:
                                bg_url = bg.get("url")
                                if bg_url:
                                    show_res.append(BannerSearchResult(
                                        title=sname,
                                        image_url=bg_url,
                                        category="series",
                                        origin=sname,
                                        kind="wallpaper"
                                    ))
                            for tb in (fan_data.get("tvthumb") or [])[:2]:
                                tb_url = tb.get("url")
                                if tb_url:
                                    show_res.append(BannerSearchResult(
                                        title=sname,
                                        image_url=tb_url,
                                        category="series",
                                        origin=sname,
                                        kind="banner"
                                    ))
                except Exception:
                    pass

            # 2. TVMaze Images
            if show_id:
                img_url = f"https://api.tvmaze.com/shows/{show_id}/images"
                req_img = urllib.request.Request(img_url, headers={"User-Agent": settings.USER_AGENT})
                try:
                    with urllib.request.urlopen(req_img, timeout=1.8) as r_img:
                        if r_img.status == 200:
                            images_data = json.loads(r_img.read().decode())
                            for im in images_data:
                                im_type = im.get("type")
                                if im_type in ("background", "banner"):
                                    resolutions = im.get("resolutions", {})
                                    orig = resolutions.get("original", {}).get("url")
                                    if orig:
                                        show_res.append(BannerSearchResult(
                                            title=sname,
                                            image_url=orig,
                                            category="series",
                                            origin=sname,
                                            kind="banner" if im_type == "banner" else "wallpaper"
                                        ))
                except Exception:
                    pass

            return show_res

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as tv_executor:
            future_to_show = {tv_executor.submit(process_show_images, sh): sh for sh in shows_to_process[:5]}
            for future in concurrent.futures.as_completed(future_to_show):
                try:
                    for r in future.result():
                        if r.image_url not in seen_images:
                            seen_images.add(r.image_url)
                            results.append(r)
                except Exception:
                    pass
                
        return results

    @classmethod
    def _search_comicvine(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
        from app.services.metron import _metron_request
        
        results = []
        seen_images = set()
        variants = cls._generate_query_variants(query)[:2]

        for term in variants:
            try:
                data = _metron_request("issue/", {"series_name": term, "number": "1", "limit": 8})
                if data and data.get("results"):
                    for iss in data["results"]:
                        img_url = iss.get("image")
                        s_name = iss.get("series", {}).get("name") or iss.get("issue") or "Comic"
                        if img_url and img_url not in seen_images:
                            seen_images.add(img_url)
                            results.append(BannerSearchResult(
                                title=s_name,
                                image_url=img_url,
                                category="comic",
                                origin=s_name,
                                kind="comic"
                            ))
            except Exception as e:
                print(f"Metron Banner Search Error: {e}")

            if len(results) >= 8:
                break

        return results

    @classmethod
    def _search_books(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
        
        results = []
        seen_images = set()
        try:
            from app.services.books import BookSearchService
            books_data = BookSearchService.search_books(query)
            for b in books_data[:8]:
                if b.image_url and b.image_url not in seen_images:
                    seen_images.add(b.image_url)
                    results.append(BannerSearchResult(
                        title=b.title,
                        image_url=b.image_url,
                        category="book",
                        origin=b.title,
                        kind="book"
                    ))
        except Exception as e:
            print(f"Book Banner Search Error: {e}")

        return results

    @classmethod
    def _search_music(cls, query: str, target_type: str = "banner") -> List[BannerSearchResult]:
        if not query or not settings.FANART_API_KEY or not settings.LASTFM_API_KEY:
            return []

        results = []
        seen_images = set()

        try:
            # 1. Query Last.fm for artist info and MBID
            clean_q = urllib.parse.quote(query.strip())
            lfm_url = f"https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={clean_q}&api_key={settings.LASTFM_API_KEY}&format=json"
            req_lfm = urllib.request.Request(lfm_url, headers={"User-Agent": settings.USER_AGENT})
            with urllib.request.urlopen(req_lfm, timeout=3.5) as lfm_resp:
                if lfm_resp.status == 200:
                    lfm_data = json.loads(lfm_resp.read().decode('utf-8', errors='replace'))
                    art_obj = lfm_data.get("artist", {})
                    mbid = art_obj.get("mbid")
                    art_name = art_obj.get("name") or query

                    if mbid:
                        # 2. Query Fanart.tv for widescreen music banners and artist wallpapers
                        fan_url = f"https://webservice.fanart.tv/v3/music/{mbid}?api_key={settings.FANART_API_KEY}"
                        try:
                            req_fan = urllib.request.Request(fan_url, headers={"User-Agent": settings.USER_AGENT})
                            with urllib.request.urlopen(req_fan, timeout=3.0) as fan_resp:
                                if fan_resp.status == 200:
                                    fan_data = json.loads(fan_resp.read().decode('utf-8', errors='replace'))
                                    
                                    # Horizontal banners (for banner modal)
                                    if target_type == "banner":
                                        for b in fan_data.get("musicbanner", [])[:3]:
                                            b_url = b.get("url")
                                            if b_url and b_url not in seen_images:
                                                seen_images.add(b_url)
                                                results.append(BannerSearchResult(
                                                    title=art_name,
                                                    image_url=b_url,
                                                    category="music",
                                                    origin=f"Artista • {art_name}",
                                                    kind="banner"
                                                ))
                                        # Also include wallpapers as banner options
                                        for bg in fan_data.get("artistbackground", [])[:3]:
                                            bg_url = bg.get("url")
                                            if bg_url and bg_url not in seen_images:
                                                seen_images.add(bg_url)
                                                results.append(BannerSearchResult(
                                                    title=art_name,
                                                    image_url=bg_url,
                                                    category="music",
                                                    origin=f"Artista • {art_name}",
                                                    kind="wallpaper"
                                                ))
                                    else:
                                        # Full widescreen 1920x1080 wallpapers (for background modal)
                                        for bg in fan_data.get("artistbackground", [])[:4]:
                                            bg_url = bg.get("url")
                                            if bg_url and bg_url not in seen_images:
                                                seen_images.add(bg_url)
                                                results.append(BannerSearchResult(
                                                    title=art_name,
                                                    image_url=bg_url,
                                                    category="music",
                                                    origin=f"Artista • {art_name}",
                                                    kind="wallpaper"
                                                ))
                        except Exception:
                            pass
        except Exception as e:
            pass

        return results

    @classmethod
    def _calculate_relevance(cls, item: BannerSearchResult, clean_query: str, raw_query: str, target_type: str = "banner") -> int:
        score = 0
        name_norm = cls._normalize_text(item.title)
        origin_norm = cls._normalize_text(item.origin)
        
        query_norm_clean = cls._normalize_text(clean_query)
        query_norm_raw = cls._normalize_text(raw_query)

        # Level 1: Absolute exact match on origin or title (e.g. searched 'half' and origin is 'Half')
        if origin_norm == query_norm_raw or origin_norm == query_norm_clean:
            score += 10000 + max(0, 50 - len(origin_norm))
        elif name_norm == query_norm_raw or name_norm == query_norm_clean:
            score += 9500 + max(0, 50 - len(name_norm))

        # Level 2: Starts with exact word/prefix (e.g. searched 'half' and origin is 'Half-Life')
        elif origin_norm.startswith(query_norm_raw) or origin_norm.startswith(query_norm_clean):
            score += 7500 + max(0, 50 - len(origin_norm))
        elif name_norm.startswith(query_norm_raw) or name_norm.startswith(query_norm_clean):
            score += 7000 + max(0, 50 - len(name_norm))

        # Level 3: Singular / Plural match
        else:
            variants = [cls._normalize_text(v) for v in cls._generate_query_variants(raw_query)]
            matched_var = False
            for v in variants:
                if v == origin_norm:
                    score += 6500
                    matched_var = True
                    break
                if origin_norm.startswith(v):
                    score += 6000
                    matched_var = True
                    break

            # Level 4: Contains query phrase anywhere inside
            if not matched_var:
                if query_norm_raw in origin_norm or query_norm_clean in origin_norm:
                    score += 4500 + max(0, 30 - len(origin_norm))
                elif query_norm_raw in name_norm or query_norm_clean in name_norm:
                    score += 4000 + max(0, 30 - len(name_norm))

        # Level 5: Token overlaps
        tokens = [cls._normalize_text(w) for w in f"{clean_query} {raw_query}".split() if len(w) >= 2]
        matches = 0
        for t in tokens:
            if t in name_norm or t in origin_norm:
                matches += 1

        if matches > 0:
            score += (matches * 300)

        # Contextual boost: Banner vs Background priority
        kind = getattr(item, 'kind', '')
        if target_type == "background":
            if kind in ("wallpaper", "screenshot"):
                score += 800
            elif kind == "artwork":
                score += 400
        else:
            # Banner mode
            if kind in ("banner", "header"):
                score += 800
            elif kind in ("artwork", "wallpaper"):
                score += 400
            
        return score

    @classmethod
    def get_popular_suggestions(cls) -> List[Dict[str, Any]]:
        now = time.time()
        with cls._cache_lock:
            cached = cls._popular_cache.get("data")
            cached_time = cls._popular_cache.get("time", 0)
            if cached and (now - cached_time) < cls._CACHE_TTL:
                return cached

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
            ("The Flash", "series"),
            ("Stranger Things", "series"),
            ("Coldplay", "music"),
            ("Queen", "music"),
            ("Daft Punk", "music")
        ]
        
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=9) as executor:
            future_map = {}
            for term, cat in popular_terms:
                if cat == "game":
                    f = executor.submit(cls._search_igdb, term)
                elif cat == "anime":
                    f = executor.submit(cls._search_anilist, term)
                elif cat == "movie":
                    f = executor.submit(cls._search_fanart_movies, term)
                elif cat == "music":
                    f = executor.submit(cls._search_music, term, "banner")
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

        final_res = deduped[:50]
        with cls._cache_lock:
            cls._popular_cache = {"data": final_res, "time": now}
        return final_res

    @classmethod
    def search_all(cls, query: str, target_type: str = "banner") -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return cls.get_popular_suggestions()

        raw_query = query.strip().lower()
        clean_query = cls._clean_query_terms(query).lower()
        search_term = clean_query if len(clean_query) >= 2 else raw_query

        cache_key = f"{target_type}:{raw_query}"
        now = time.time()
        with cls._cache_lock:
            if cache_key in cls._cache:
                entry = cls._cache[cache_key]
                if (now - entry["time"]) < cls._CACHE_TTL:
                    return entry["data"]

        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
            f_igdb = executor.submit(cls._search_igdb, search_term)
            f_ani = executor.submit(cls._search_anilist, search_term)
            f_movies = executor.submit(cls._search_fanart_movies, search_term)
            f_tv = executor.submit(cls._search_tvmaze, clean_query, raw_query)
            f_books = executor.submit(cls._search_books, search_term)
            f_comic = executor.submit(cls._search_comicvine, search_term)
            f_music = executor.submit(cls._search_music, search_term, target_type)

            for future in (f_igdb, f_ani, f_movies, f_tv, f_books, f_comic, f_music):
                try:
                    res = future.result()
                    all_results.extend(res)
                except Exception:
                    pass

        # Compute relevance scores
        for item in all_results:
            item.score = cls._calculate_relevance(item, clean_query, raw_query, target_type=target_type)

        # Sort by relevance score descending
        all_results.sort(key=lambda x: x.score, reverse=True)

        seen_urls = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_urls:
                seen_urls.add(r.image_url)
                deduped.append(r.to_dict())

        final_data = deduped[:60]
        with cls._cache_lock:
            cls._cache[cache_key] = {"data": final_data, "time": now}
            # Limit cache size to 500 items
            if len(cls._cache) > 500:
                oldest_key = min(cls._cache.keys(), key=lambda k: cls._cache[k]["time"])
                cls._cache.pop(oldest_key, None)

        return final_data
