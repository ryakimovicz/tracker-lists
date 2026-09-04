import json
import urllib.request
import urllib.parse
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService

import re

class BannerSearchResult:
    def __init__(self, title: str, image_url: str, category: str, origin: str = "", score: int = 0):
        self.title = title
        self.image_url = image_url
        self.category = category # 'game', 'anime', 'movie', 'series'
        self.origin = origin
        self.score = score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "image_url": self.image_url,
            "category": self.category,
            "origin": self.origin
        }

class BannerService:
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

        # Smart prefix expansion (placed high in priority for instant prefix resolution)
        if len(q_raw) >= 2:
            try:
                url = f'https://suggestqueries.google.com/complete/search?client=firefox&q={urllib.parse.quote(q_raw)}'
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                with urllib.request.urlopen(req, timeout=1.2) as res:
                    data = json.loads(res.read().decode())
                    if len(data) > 1 and isinstance(data[1], list):
                        for sug in data[1]:
                            sug_clean = re.sub(r'\s+(reparto|cast|pelicula|trailer|personajes|serie|libros|sin relleno|online|ver|completa|estreno|wallpaper|fondo|portada)$', '', sug.strip(), flags=re.IGNORECASE).strip()
                            if sug_clean and len(sug_clean) >= 2 and sug_clean.lower() not in [x.lower() for x in variants]:
                                variants.append(sug_clean)
                                if len(variants) >= 6:
                                    break
            except Exception:
                pass

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
                                            title=f"{gname} (Artwork)",
                                            image_url=url,
                                            category="game",
                                            origin=gname
                                        ))
                            
                            # Screenshots in 1080p (up to 3 per game)
                            for sc in g.get("screenshots", [])[:3]:
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
                headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"}
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
        if not query or not settings.FANART_API_KEY or not settings.OMDB_API_KEY:
            return []
            
        results = []
        seen_images = set()
        variants = cls._generate_query_variants(query)[:2]
        
        imdb_ids = []
        for term in variants:
            encoded = urllib.parse.quote(term)
            omdb_url = f"http://www.omdbapi.com/?s={encoded}&type=movie&apikey={settings.OMDB_API_KEY}"
            try:
                req_omdb = urllib.request.Request(omdb_url, headers={"User-Agent": "TrackerLists/1.0"})
                with urllib.request.urlopen(req_omdb, timeout=4) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        for item in data.get("Search", [])[:6]:
                            iid = item.get("imdbID")
                            mtitle = item.get("Title")
                            if iid and (iid, mtitle) not in imdb_ids:
                                imdb_ids.append((iid, mtitle))
            except Exception:
                pass

        # Fetch backgrounds for each movie from Fanart.tv
        for iid, mtitle in imdb_ids[:8]:
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
    def _search_tvmaze(cls, query: str, raw_query: str = "") -> List[BannerSearchResult]:
        if not query and not raw_query:
            return []
            
        results = []
        seen_images = set()
        search_terms = cls._generate_query_variants(raw_query or query)[:3]

        for term in search_terms:
            encoded = urllib.parse.quote(term)
            url = f"https://api.tvmaze.com/search/shows?q={encoded}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    if resp.status == 200:
                        shows = json.loads(resp.read().decode())
                        for s in shows[:6]:
                            show = s.get("show", {}) or {}
                            show_id = show.get("id")
                            sname = show.get("name") or "Series"
                            externals = show.get("externals", {}) or {}
                            thetvdb_id = externals.get("thetvdb")
                            imdb_id = externals.get("imdb")

                            # 1. Fanart.tv Series Backgrounds
                            if settings.FANART_API_KEY and (thetvdb_id or imdb_id):
                                lookup_id = thetvdb_id or imdb_id
                                fan_url = f"https://webservice.fanart.tv/v3/tv/{lookup_id}?api_key={settings.FANART_API_KEY}"
                                try:
                                    req_fan = urllib.request.Request(fan_url, headers={"User-Agent": "TrackerLists/1.0"})
                                    with urllib.request.urlopen(req_fan, timeout=3) as r_fan:
                                        if r_fan.status == 200:
                                            fan_data = json.loads(r_fan.read().decode())
                                            for bg in (fan_data.get("showbackground") or [])[:3]:
                                                bg_url = bg.get("url")
                                                if bg_url and bg_url not in seen_images:
                                                    seen_images.add(bg_url)
                                                    results.append(BannerSearchResult(
                                                        title=f"{sname} (Wallpaper)",
                                                        image_url=bg_url,
                                                        category="series",
                                                        origin=sname
                                                    ))
                                            for tb in (fan_data.get("tvthumb") or [])[:2]:
                                                tb_url = tb.get("url")
                                                if tb_url and tb_url not in seen_images:
                                                    seen_images.add(tb_url)
                                                    results.append(BannerSearchResult(
                                                        title=f"{sname} (Banner)",
                                                        image_url=tb_url,
                                                        category="series",
                                                        origin=sname
                                                    ))
                                except Exception:
                                    pass

                            # 2. TVMaze Images
                            if show_id:
                                img_url = f"https://api.tvmaze.com/shows/{show_id}/images"
                                req_img = urllib.request.Request(img_url, headers={"User-Agent": "Pathd/1.0"})
                                try:
                                    with urllib.request.urlopen(req_img, timeout=3) as r_img:
                                        if r_img.status == 200:
                                            images_data = json.loads(r_img.read().decode())
                                            for im in images_data:
                                                im_type = im.get("type")
                                                if im_type in ("background", "banner"):
                                                    resolutions = im.get("resolutions", {})
                                                    orig = resolutions.get("original", {}).get("url")
                                                    if orig and orig not in seen_images:
                                                        seen_images.add(orig)
                                                        results.append(BannerSearchResult(
                                                            title=f"{sname} ({im_type.capitalize()})",
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
    def _search_comicvine(cls, query: str) -> List[BannerSearchResult]:
        if not query or not settings.COMIC_VINE_API_KEY:
            return []
        
        results = []
        seen_images = set()
        variants = cls._generate_query_variants(query)[:2]

        for term in variants:
            encoded = urllib.parse.quote(term)
            url = f"https://comicvine.gamespot.com/api/search/?api_key={settings.COMIC_VINE_API_KEY}&format=json&resources=volume&query={encoded}&limit=8&field_list=id,name,image"
            req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        for v in data.get("results", []):
                            vname = v.get("name") or "Comic"
                            img_obj = v.get("image") or {}
                            img_url = img_obj.get("super_url") or img_obj.get("medium_url") or img_obj.get("original_url")
                            if img_url and img_url not in seen_images:
                                seen_images.add(img_url)
                                results.append(BannerSearchResult(
                                    title=f"{vname} (Comic)",
                                    image_url=img_url,
                                    category="comic",
                                    origin=vname
                                ))
            except Exception as e:
                print(f"ComicVine Banner Search Error: {e}")

        return results

    @classmethod
    def _search_books(cls, query: str) -> List[BannerSearchResult]:
        if not query:
            return []
        
        results = []
        seen_images = set()
        try:
            from app.services.googlebooks import GoogleBooksService
            books_data = GoogleBooksService.fetch_google_books(query)
            for b, _ in books_data[:8]:
                if b.image_url and b.image_url not in seen_images:
                    seen_images.add(b.image_url)
                    results.append(BannerSearchResult(
                        title=f"{b.title} (Book)",
                        image_url=b.image_url,
                        category="book",
                        origin=b.title
                    ))
        except Exception as e:
            print(f"Google Books Banner Search Error: {e}")

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
        title_lower = item.title.lower()
        if target_type == "background":
            if "(wallpaper)" in title_lower or "(background)" in title_lower or "(screenshot)" in title_lower:
                score += 800
            elif "(artwork)" in title_lower:
                score += 400
        else:
            # Banner mode
            if "(banner)" in title_lower or "(header)" in title_lower:
                score += 800
            elif "(artwork)" in title_lower or "(wallpaper)" in title_lower:
                score += 400
            
        return score

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
            ("The Flash", "series"),
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

        return deduped[:50]

    @classmethod
    def search_all(cls, query: str, target_type: str = "banner") -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return cls.get_popular_suggestions()

        raw_query = query.strip().lower()
        clean_query = cls._clean_query_terms(query).lower()
        search_term = clean_query if len(clean_query) >= 2 else raw_query

        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            f_igdb = executor.submit(cls._search_igdb, search_term)
            f_ani = executor.submit(cls._search_anilist, search_term)
            f_movies = executor.submit(cls._search_fanart_movies, search_term)
            f_tv = executor.submit(cls._search_tvmaze, clean_query, raw_query)
            f_comic = executor.submit(cls._search_comicvine, search_term)
            f_books = executor.submit(cls._search_books, search_term)

            for future in (f_igdb, f_ani, f_movies, f_tv, f_comic, f_books):
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

        return deduped[:60]
