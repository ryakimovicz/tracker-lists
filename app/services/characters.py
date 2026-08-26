import json
import urllib.request
import urllib.parse
import re
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService
from app.services.omdb import OMDbService
from app.services.googlebooks import GoogleBooksService

class CharacterSearchResult:
    def __init__(self, name: str, image_url: str, category: str, origin: str = "", score: int = 0):
        self.name = name
        self.image_url = image_url
        self.category = category # 'anime', 'comic', 'game', 'series', 'movie', 'book', 'manga'
        self.origin = origin
        self.score = score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "image_url": self.image_url,
            "category": self.category,
            "origin": self.origin
        }

class CharacterService:
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
        variants = []
        
        # 1. Primary individual tokens & aliases
        tokens = re.findall(r'\b[\w\'-]+\b', query)
        for t in tokens:
            if len(t) >= 2:
                variants.append(t)
                if t.lower() == "gman":
                    variants.append("g-man")
                if t.lower() == "g-man":
                    variants.append("gman")
                if t.lower() == "spiderman":
                    variants.append("spider-man")

        # 2. Full query and hyphen/space variants
        variants.append(query.strip())
        if "-" in query:
            variants.append(query.replace("-", " "))
            variants.append(query.replace("-", ""))
        if " " in query:
            variants.append(query.replace(" ", "-"))

        # 3. Aliases
        q_lower = query.lower()
        if "gman" in q_lower:
            variants.append(re.sub(r'\bgman\b', 'g-man', query, flags=re.IGNORECASE))
        if "g-man" in q_lower:
            variants.append(re.sub(r'\bg-man\b', 'gman', query, flags=re.IGNORECASE))
        if "spiderman" in q_lower:
            variants.append(re.sub(r'\bspiderman\b', 'spider-man', query, flags=re.IGNORECASE))
        if "pacman" in q_lower:
            variants.append(re.sub(r'\bpacman\b', 'pac-man', query, flags=re.IGNORECASE))

        # Gaming franchise helpers
        if "half" in q_lower and "life" in q_lower:
            variants.extend(["half-life", "half life", "half-life 2", "gordon freeman"])
        if "hollow" in q_lower and "knight" in q_lower:
            variants.extend(["hollow knight", "silksong", "hollow knight silksong"])

        return list(dict.fromkeys([v for v in variants if len(v.strip()) >= 2]))

    @classmethod
    def _search_anilist(cls, query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
        
        variants = cls._generate_query_variants(query)
        results = []
        seen_names = set()

        # 1. Search characters directly
        graphql_char_query = """
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            characters(search: $search, sort: FAVOURITES_DESC) {
              id
              name {
                full
                native
                alternative
              }
              image {
                large
                medium
              }
              media(page: 1, perPage: 1) {
                nodes {
                  title {
                    english
                    romaji
                  }
                  type
                }
              }
            }
          }
        }
        """

        # 2. Search anime/manga titles to extract their main cast and official cover
        graphql_media_query = """
        query ($search: String) {
          Page(page: 1, perPage: 3) {
            media(search: $search, sort: POPULARITY_DESC) {
              id
              title {
                english
                romaji
              }
              coverImage {
                large
              }
              characters(perPage: 8, sort: FAVOURITES_DESC) {
                nodes {
                  name {
                    full
                    native
                  }
                  image {
                    large
                  }
                }
              }
            }
          }
        }
        """

        for term in variants[:3]:
            # Direct character query
            payload_char = json.dumps({
                "query": graphql_char_query,
                "variables": {"search": term}
            }).encode("utf-8")

            req_char = urllib.request.Request(
                url,
                data=payload_char,
                headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"}
            )

            try:
                with urllib.request.urlopen(req_char, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        characters = data.get("data", {}).get("Page", {}).get("characters", [])
                        for ch in characters:
                            name_obj = ch.get("name", {})
                            full_name = name_obj.get("full") or name_obj.get("native") or "Unknown Character"
                            if full_name in seen_names:
                                continue
                            seen_names.add(full_name)

                            img_obj = ch.get("image", {})
                            img_url = img_obj.get("large") or img_obj.get("medium")
                            
                            origin = ""
                            media_nodes = ch.get("media", {}).get("nodes", [])
                            if media_nodes:
                                first_media = media_nodes[0]
                                title_obj = first_media.get("title", {})
                                origin = title_obj.get("english") or title_obj.get("romaji") or ""

                            if img_url and not img_url.endswith("default.jpg"):
                                results.append(CharacterSearchResult(
                                    name=full_name,
                                    image_url=img_url,
                                    category="anime",
                                    origin=origin
                                ))
            except Exception as e:
                print(f"AniList Character Search Error: {e}")

            # Media cast query (when searching anime titles like "Death Note", "Attack on Titan", "Bleach")
            payload_media = json.dumps({
                "query": graphql_media_query,
                "variables": {"search": term}
            }).encode("utf-8")

            req_media = urllib.request.Request(
                url,
                data=payload_media,
                headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"}
            )

            try:
                with urllib.request.urlopen(req_media, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        media_list = data.get("data", {}).get("Page", {}).get("media", [])
                        for m in media_list:
                            m_title = m.get("title", {}).get("english") or m.get("title", {}).get("romaji") or "Anime"
                            cover_url = m.get("coverImage", {}).get("large")
                            if cover_url and m_title not in seen_names:
                                seen_names.add(m_title)
                                results.append(CharacterSearchResult(
                                    name=m_title,
                                    image_url=cover_url,
                                    category="anime",
                                    origin=m_title
                                ))

                            cast_chars = m.get("characters", {}).get("nodes", [])
                            for c in cast_chars:
                                c_name = c.get("name", {}).get("full") or c.get("name", {}).get("native")
                                c_img = c.get("image", {}).get("large")
                                if c_name and c_img and c_name not in seen_names:
                                    seen_names.add(c_name)
                                    results.append(CharacterSearchResult(
                                        name=c_name,
                                        image_url=c_img,
                                        category="anime",
                                        origin=m_title
                                    ))
            except Exception as e:
                print(f"AniList Media Cast Search Error: {e}")
                
            if len(results) >= 12:
                break

        return results


    @classmethod
    def _search_comicvine(cls, query: str) -> List[CharacterSearchResult]:
        if not query or not settings.COMIC_VINE_API_KEY:
            return []
        
        variants = cls._generate_query_variants(query)
        results = []
        seen_names = set()

        for term in variants[:3]:
            encoded_query = urllib.parse.quote(term)
            url = f"https://comicvine.gamespot.com/api/search/?api_key={settings.COMIC_VINE_API_KEY}&format=json&resources=character&query={encoded_query}&limit=12&field_list=id,name,real_name,image,publisher"
            
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
            )

            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        for ch in data.get("results", []):
                            name = ch.get("name") or "Unknown Character"
                            real_name = ch.get("real_name")
                            
                            display_name = name
                            if real_name and real_name.lower() != name.lower() and len(real_name) < 30:
                                display_name = f"{name} ({real_name})"
                                
                            if display_name in seen_names:
                                continue
                            seen_names.add(display_name)

                            img_obj = ch.get("image", {}) or {}
                            img_url = img_obj.get("medium_url") or img_obj.get("super_url") or img_obj.get("small_url")
                            publisher = (ch.get("publisher") or {}).get("name") or "Comic"

                            if img_url and "default" not in img_url.lower():
                                results.append(CharacterSearchResult(
                                    name=display_name,
                                    image_url=img_url,
                                    category="comic",
                                    origin=publisher
                                ))
            except Exception as e:
                print(f"Comic Vine Character Search Error: {e}")
                
            if len(results) >= 8:
                break

        return results

    @classmethod
    def _search_igdb(cls, query: str) -> List[CharacterSearchResult]:
        if not query or not settings.TWITCH_CLIENT_ID:
            return []
        
        token = IGDBService._get_access_token()
        if not token:
            return []
        
        results = []
        seen_ids = set()
        variants = cls._generate_query_variants(query)

        # 1. Direct character search
        for term in variants[:5]:
            safe_query = term.replace('"', '\\"')
            body = f'search "{safe_query}"; fields id, name, mug_shot.image_id, games.name; limit 12;'
            
            req = urllib.request.Request(
                "https://api.igdb.com/v4/characters",
                data=body.encode("utf-8"),
                headers={
                    "Client-ID": settings.TWITCH_CLIENT_ID,
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        for ch in data:
                            ch_id = ch.get("id")
                            if ch_id in seen_ids:
                                continue
                            seen_ids.add(ch_id)

                            name = ch.get("name") or "Unknown Character"
                            mug_shot = ch.get("mug_shot")
                            img_url = None
                            if mug_shot and mug_shot.get("image_id"):
                                img_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{mug_shot['image_id']}.jpg"
                            
                            games = ch.get("games") or []
                            origin = games[0].get("name") if games and isinstance(games[0], dict) else "Video Game"
                            
                            if img_url:
                                results.append(CharacterSearchResult(
                                    name=name,
                                    image_url=img_url,
                                    category="game",
                                    origin=origin
                                ))
            except Exception as e:
                print(f"IGDB Character Search Error: {e}")

        # 2. Search game titles: extract covers, artworks, and game characters
        game_terms = [v for v in variants if len(v) >= 3][:3]
        all_game_ids = []
        for term in game_terms:
            safe_game_query = term.replace('"', '\\"')
            body_game = f'search "{safe_game_query}"; fields id, name, cover.image_id, artworks.image_id; limit 6;'
            req_g = urllib.request.Request(
                "https://api.igdb.com/v4/games",
                data=body_game.encode("utf-8"),
                headers={"Client-ID": settings.TWITCH_CLIENT_ID, "Authorization": f"Bearer {token}", "Accept": "application/json"}
            )
            try:
                with urllib.request.urlopen(req_g, timeout=5) as resp_g:
                    if resp_g.status == 200:
                        games_data = json.loads(resp_g.read().decode())
                        for g in games_data:
                            g_id = g.get('id')
                            if g_id:
                                all_game_ids.append(str(g_id))
                            
                            gname = g.get('name') or "Video Game"
                            cover = g.get('cover')
                            if cover and cover.get('image_id'):
                                c_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"
                                if c_url not in seen_ids:
                                    seen_ids.add(c_url)
                                    results.append(CharacterSearchResult(
                                        name=gname,
                                        image_url=c_url,
                                        category="game",
                                        origin=gname
                                    ))
                            
                            artworks = g.get('artworks') or []
                            for art in artworks[:3]:
                                if art.get('image_id'):
                                    a_url = f"https://images.igdb.com/igdb/image/upload/t_720p/{art['image_id']}.jpg"
                                    if a_url not in seen_ids:
                                        seen_ids.add(a_url)
                                        results.append(CharacterSearchResult(
                                            name=f"{gname} (Art)",
                                            image_url=a_url,
                                            category="game",
                                            origin=gname
                                        ))
            except Exception:
                pass

        if all_game_ids:
            unique_gids = list(dict.fromkeys(all_game_ids))[:15]
            body_gc = f'where games = ({",".join(unique_gids)}); fields id, name, mug_shot.image_id, games.name; limit 20;'
            req_gc = urllib.request.Request(
                "https://api.igdb.com/v4/characters",
                data=body_gc.encode("utf-8"),
                headers={"Client-ID": settings.TWITCH_CLIENT_ID, "Authorization": f"Bearer {token}", "Accept": "application/json"}
            )
            try:
                with urllib.request.urlopen(req_gc, timeout=5) as resp_gc:
                    if resp_gc.status == 200:
                        g_chars = json.loads(resp_gc.read().decode())
                        for ch in g_chars:
                            ch_id = ch.get("id")
                            if ch_id in seen_ids:
                                continue
                            seen_ids.add(ch_id)
                            
                            name = ch.get("name") or "Unknown Character"
                            mug_shot = ch.get("mug_shot")
                            img_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{mug_shot['image_id']}.jpg" if mug_shot and mug_shot.get("image_id") else None
                            games = ch.get("games") or []
                            origin = games[0].get("name") if games and isinstance(games[0], dict) else "Video Game"
                            
                            if img_url:
                                results.append(CharacterSearchResult(
                                    name=name,
                                    image_url=img_url,
                                    category="game",
                                    origin=origin
                                ))
            except Exception as e:
                print(f"IGDB Game Cast Search Error: {e}")

        return results

    @classmethod
    def _search_tvmaze(cls, query: str, raw_query: str = "") -> List[CharacterSearchResult]:
        if not query and not raw_query:
            return []
        
        results = []
        seen_char_keys = set()
        search_terms = list(dict.fromkeys([q for q in [raw_query, query] if q and len(q.strip()) >= 2]))
        
        for term in search_terms:
            encoded_query = urllib.parse.quote(term)
            shows_url = f"https://api.tvmaze.com/search/shows?q={encoded_query}"
            try:
                req_shows = urllib.request.Request(shows_url, headers={"User-Agent": "Pathd/1.0"})
                with urllib.request.urlopen(req_shows, timeout=5) as response:
                    if response.status == 200:
                        shows_data = json.loads(response.read().decode())
                        for s_item in shows_data[:3]:
                            show = s_item.get("show", {}) or {}
                            show_id = show.get("id")
                            show_name = show.get("name") or "Series"
                            
                            # Add show main poster
                            s_img = show.get("image") or {}
                            s_poster = s_img.get("original") or s_img.get("medium")
                            if s_poster and show_name not in seen_char_keys:
                                seen_char_keys.add(show_name)
                                results.append(CharacterSearchResult(
                                    name=show_name,
                                    image_url=s_poster,
                                    category="series",
                                    origin=show_name
                                ))
                            
                            if show_id:
                                cast_url = f"https://api.tvmaze.com/shows/{show_id}/cast"
                                req_cast = urllib.request.Request(cast_url, headers={"User-Agent": "Pathd/1.0"})
                                try:
                                    with urllib.request.urlopen(req_cast, timeout=5) as c_resp:
                                        if c_resp.status == 200:
                                            cast_data = json.loads(c_resp.read().decode())
                                            for member in cast_data[:8]:
                                                char_obj = member.get("character", {}) or {}
                                                char_name = char_obj.get("name")
                                                person_obj = member.get("person", {}) or {}
                                                actor_name = person_obj.get("name")
                                                
                                                img_obj = char_obj.get("image") or person_obj.get("image") or {}
                                                img_url = img_obj.get("medium") or img_obj.get("original")
                                                
                                                display_name = char_name or actor_name or "Character"
                                                if char_name and actor_name and char_name != actor_name:
                                                    display_name = f"{char_name} ({actor_name})"
                                                    
                                                if img_url and display_name not in seen_char_keys:
                                                    seen_char_keys.add(display_name)
                                                    results.append(CharacterSearchResult(
                                                        name=display_name,
                                                        image_url=img_url,
                                                        category="series",
                                                        origin=show_name
                                                    ))
                                except Exception:
                                    pass
            except Exception as e:
                print(f"TVMaze Show Cast Search Error: {e}")

            # 2. Search people/actors
            people_url = f"https://api.tvmaze.com/search/people?q={encoded_query}"
            try:
                req_people = urllib.request.Request(people_url, headers={"User-Agent": "Pathd/1.0"})
                with urllib.request.urlopen(req_people, timeout=5) as p_resp:
                    if p_resp.status == 200:
                        people_data = json.loads(p_resp.read().decode())
                        for p_item in people_data[:4]:
                            person = p_item.get("person", {}) or {}
                            name = person.get("name") or "Actor"
                            img_obj = person.get("image") or {}
                            img_url = img_obj.get("medium") or img_obj.get("original")
                            country = (person.get("country") or {}).get("name") or "TV Series"
                            
                            if img_url and name not in seen_char_keys:
                                seen_char_keys.add(name)
                                results.append(CharacterSearchResult(
                                    name=name,
                                    image_url=img_url,
                                    category="series",
                                    origin=country
                                ))
            except Exception as e:
                print(f"TVMaze People Search Error: {e}")

        return results

    @classmethod
    def _search_movies(cls, query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
        results = []
        try:
            movies = OMDbService.search_movies(query)
            for m in movies[:6]:
                if m.image_url and "unsplash" not in m.image_url and "default" not in m.image_url.lower():
                    results.append(CharacterSearchResult(
                        name=m.title,
                        image_url=m.image_url,
                        category="movie",
                        origin=m.title
                    ))
        except Exception as e:
            print(f"OMDb Movies Search Error: {e}")
        return results

    @classmethod
    def _search_books(cls, query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
        results = []
        try:
            books_data = GoogleBooksService.fetch_google_books(query)
            for b, _ in books_data[:5]:
                if b.image_url:
                    results.append(CharacterSearchResult(
                        name=b.title,
                        image_url=b.image_url,
                        category="book",
                        origin=b.title
                    ))
        except Exception as e:
            print(f"Google Books Search Error: {e}")
        return results

    @classmethod
    def _calculate_relevance(cls, item: CharacterSearchResult, clean_query: str, raw_query: str) -> int:
        score = 0
        name_norm = cls._normalize_text(item.name)
        origin_norm = cls._normalize_text(item.origin)
        
        query_norm_clean = cls._normalize_text(clean_query)
        query_norm_raw = cls._normalize_text(raw_query)

        # 1. Exact normalized match on character / work name
        if name_norm == query_norm_clean or name_norm == query_norm_raw:
            return 5000
        if name_norm.startswith(query_norm_clean) or name_norm.startswith(query_norm_raw):
            return 4300

        # Exact franchise/game/show origin match (characters belonging to this searched work)
        if origin_norm == query_norm_clean or origin_norm == query_norm_raw or origin_norm.startswith(query_norm_clean):
            return 4850

        # Extract normalized tokens from search query
        clean_q_spaces = f"{clean_query} {raw_query}".replace("-", " ")
        tokens = list(dict.fromkeys([cls._normalize_text(w) for w in re.findall(r'\b[\w\'-]+\b', clean_q_spaces) if len(w) >= 2]))
        
        if "half" in tokens and "life" in tokens:
            tokens.append("halflife")
        if "g" in clean_q_spaces.split() or "gman" in clean_q_spaces:
            tokens.append("gman")

        name_matches = 0
        origin_matches = 0
        
        for t in tokens:
            if not t:
                continue
            if t in name_norm or name_norm.startswith(t):
                name_matches += 1
            elif t in origin_norm or origin_norm.startswith(t):
                origin_matches += 1
                
        # 2. Cross match: both character name AND game/series origin match!
        if name_matches > 0 and origin_matches > 0:
            score += 4800 + (name_matches * 300) + (origin_matches * 200)
        elif (name_matches + origin_matches) >= len(tokens) and len(tokens) > 1:
            score += 3000
        elif name_matches > 0:
            score += 2000 + (name_matches * 200)
        elif origin_matches > 0:
            score += 4200 + (origin_matches * 200)
            
        return int(score)


    @classmethod
    def get_popular_suggestions(cls) -> List[Dict[str, Any]]:
        popular_searches = [
            ("Goku", "anime"),
            ("Monkey D. Luffy", "anime"),
            ("Naruto Uzumaki", "anime"),
            ("Spider-Man", "comic"),
            ("Batman", "comic"),
            ("Deadpool", "comic"),
            ("Gordon Freeman", "game"),
            ("G-Man", "game"),
            ("Hollow Knight", "game"),
            ("Kratos", "game"),
            ("Walter White", "series"),
            ("Patrick Jane", "series"),
            ("Inception", "movie"),
            ("Star Wars", "movie"),
            ("Interstellar", "movie"),
            ("Pulp Fiction", "movie"),
            ("Harry Potter", "book"),
        ]
        
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            future_map = {}
            for name, cat in popular_searches:
                if cat == "anime":
                    f = executor.submit(cls._search_anilist, name)
                elif cat == "comic":
                    f = executor.submit(cls._search_comicvine, name)
                elif cat == "game":
                    f = executor.submit(cls._search_igdb, name)
                elif cat == "movie":
                    f = executor.submit(cls._search_movies, name)
                elif cat == "book":
                    f = executor.submit(cls._search_books, name)
                else:
                    f = executor.submit(cls._search_tvmaze, name, name)
                future_map[f] = (name, cat)

            for future in concurrent.futures.as_completed(future_map):
                try:
                    res = future.result()
                    if res:
                        all_results.extend(res[:2])
                except Exception:
                    pass

        seen_images = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_images:
                seen_images.add(r.image_url)
                deduped.append(r.to_dict())

        return deduped[:40]

    @classmethod
    def search_all(cls, query: str) -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return cls.get_popular_suggestions()

        raw_query = query.strip().lower()
        clean_query = cls._clean_query_terms(query).lower()
        search_term = clean_query if len(clean_query) >= 2 else raw_query

        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            f_anilist = executor.submit(cls._search_anilist, search_term)
            f_comicvine = executor.submit(cls._search_comicvine, search_term)
            f_igdb = executor.submit(cls._search_igdb, search_term)
            f_tvmaze = executor.submit(cls._search_tvmaze, search_term, raw_query)
            f_movies = executor.submit(cls._search_movies, search_term)
            f_books = executor.submit(cls._search_books, search_term)

            for future in (f_anilist, f_comicvine, f_igdb, f_tvmaze, f_movies, f_books):
                try:
                    res = future.result()
                    all_results.extend(res)
                except Exception:
                    pass

        # Compute relevance scores
        for item in all_results:
            item.score = cls._calculate_relevance(item, clean_query, raw_query)

        # Sort by relevance score descending
        all_results.sort(key=lambda x: x.score, reverse=True)

        # Deduplicate by image_url and return as dicts
        seen_images = set()
        deduped = []
        for r in all_results:
            if r.image_url and r.image_url not in seen_images:
                seen_images.add(r.image_url)
                deduped.append(r.to_dict())

        return deduped[:40]
