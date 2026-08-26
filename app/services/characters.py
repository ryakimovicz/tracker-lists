import json
import urllib.request
import urllib.parse
import re
import concurrent.futures
from typing import List, Dict, Any
from app.core.config import settings
from app.services.igdb import IGDBService

class CharacterSearchResult:
    def __init__(self, name: str, image_url: str, category: str, origin: str = "", score: int = 0):
        self.name = name
        self.image_url = image_url
        self.category = category # 'anime', 'comic', 'game', 'series'
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
        
        # 1. First add primary tokens and aliases so providers query individual components
        # e.g. "gman half-life" -> ["gman", "g-man", "half-life", "half life"]
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

        # 2. Add full query and hyphen/space normalized variants
        variants.append(query.strip())
        if "-" in query:
            variants.append(query.replace("-", " "))
            variants.append(query.replace("-", ""))
        if " " in query:
            variants.append(query.replace(" ", "-"))

        # 3. Specific common aliases on full string
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

        return list(dict.fromkeys([v for v in variants if len(v.strip()) >= 2]))

    @classmethod
    def _search_anilist(cls, query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
        
        variants = cls._generate_query_variants(query)
        results = []
        seen_names = set()

        url = "https://graphql.anilist.co"
        graphql_query = """
        query ($search: String) {
          Page(page: 1, perPage: 12) {
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

        for term in variants[:4]:
            payload = json.dumps({
                "query": graphql_query,
                "variables": {"search": term}
            }).encode("utf-8")

            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Pathd/1.0"
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=5) as response:
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
                
            if len(results) >= 8:
                break

        return results

    @classmethod
    def _search_comicvine(cls, query: str) -> List[CharacterSearchResult]:
        if not query or not settings.COMIC_VINE_API_KEY:
            return []
        
        variants = cls._generate_query_variants(query)
        results = []
        seen_names = set()

        for term in variants[:4]:
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

        # 1. Direct character search across all query variants (including aliases like g-man)
        for term in variants[:6]:
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

        # 2. Search game titles to discover full cast of characters (e.g. searching "half-life" or "the witcher")
        game_terms = [v for v in variants if len(v) >= 3][:3]
        all_game_ids = []
        for term in game_terms:
            safe_game_query = term.replace('"', '\\"')
            body_game = f'search "{safe_game_query}"; fields id, name; limit 8;'
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
                            if 'id' in g:
                                all_game_ids.append(str(g['id']))
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
            
            # 1. Search TV shows to get main cast characters
            shows_url = f"https://api.tvmaze.com/search/shows?q={encoded_query}"
            try:
                req_shows = urllib.request.Request(shows_url, headers={"User-Agent": "Pathd/1.0"})
                with urllib.request.urlopen(req_shows, timeout=5) as response:
                    if response.status == 200:
                        shows_data = json.loads(response.read().decode())
                        for s_item in shows_data[:2]:
                            show = s_item.get("show", {}) or {}
                            show_id = show.get("id")
                            show_name = show.get("name") or "Series"
                            
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

            # 2. Search people/actors in TVMaze
            people_url = f"https://api.tvmaze.com/search/people?q={encoded_query}"
            try:
                req_people = urllib.request.Request(people_url, headers={"User-Agent": "Pathd/1.0"})
                with urllib.request.urlopen(req_people, timeout=5) as p_resp:
                    if p_resp.status == 200:
                        people_data = json.loads(p_resp.read().decode())
                        for p_item in people_data[:5]:
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
    def _calculate_relevance(cls, item: CharacterSearchResult, clean_query: str, raw_query: str) -> int:
        score = 0
        name_norm = cls._normalize_text(item.name)
        origin_norm = cls._normalize_text(item.origin)
        
        query_norm_clean = cls._normalize_text(clean_query)
        query_norm_raw = cls._normalize_text(raw_query)

        # 1. Exact normalized match (e.g. "gman" == "gman" for "G-Man")
        if name_norm == query_norm_clean or name_norm == query_norm_raw:
            return 5000
        if name_norm.startswith(query_norm_clean) or name_norm.startswith(query_norm_raw):
            return 4200

        # Exact franchise/game origin match (e.g. searched "half life 2" or "half-life")
        if origin_norm == query_norm_clean or origin_norm == query_norm_raw or origin_norm.startswith(query_norm_clean):
            return 3800

        # Extract normalized tokens from search query
        clean_q_spaces = f"{clean_query} {raw_query}".replace("-", " ")
        tokens = list(dict.fromkeys([cls._normalize_text(w) for w in re.findall(r'\b[\w\'-]+\b', clean_q_spaces) if len(w) >= 2]))
        
        # Add compound tokens if present
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
        # e.g. "gman half-life", "half-life gman", "half life gman"
        if name_matches > 0 and origin_matches > 0:
            score += 4800 + (name_matches * 300) + (origin_matches * 200)
        elif total_matched := (name_matches + origin_matches) >= len(tokens) and len(tokens) > 1:
            score += 3000
        elif name_matches > 0:
            score += 2000 + (name_matches * 200)
        elif origin_matches > 0:
            score += 3200 + (origin_matches * 200)
            
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
            ("Kratos", "game"),
            ("Geralt of Rivia", "game"),
            ("Walter White", "series"),
            ("Patrick Jane", "series"),
            ("Thomas Shelby", "series"),
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

        return deduped[:36]

    @classmethod
    def search_all(cls, query: str) -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return cls.get_popular_suggestions()

        raw_query = query.strip().lower()
        clean_query = cls._clean_query_terms(query).lower()

        search_term = clean_query if len(clean_query) >= 2 else raw_query

        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_anilist = executor.submit(cls._search_anilist, search_term)
            future_comicvine = executor.submit(cls._search_comicvine, search_term)
            future_igdb = executor.submit(cls._search_igdb, search_term)
            future_tvmaze = executor.submit(cls._search_tvmaze, search_term, raw_query)

            for future in (future_anilist, future_comicvine, future_igdb, future_tvmaze):
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

        return deduped[:36]
