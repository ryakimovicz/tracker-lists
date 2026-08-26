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
        self.category = category # 'anime', 'comic', 'game', 'series', 'movie'
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
    # Common movie franchise keywords that shouldn't be labeled as anime
    MOVIE_FRANCHISES = [
        "star wars", "lord of the rings", "harry potter", "indiana jones",
        "pirates of the caribbean", "jurassic park", "godfather", "matrix",
        "terminator", "alien", "predator", "back to the future", "james bond",
        "avatar", "hunger games", "twilight", "marvel cinematic universe"
    ]

    @classmethod
    def _detect_category(cls, name: str, origin: str, default_cat: str) -> str:
        origin_lower = (origin or "").lower()
        name_lower = name.lower()
        
        for mf in cls.MOVIE_FRANCHISES:
            if mf in origin_lower or mf in name_lower:
                return "movie"
                
        return default_cat

    @staticmethod
    def _clean_query_terms(query: str) -> str:
        cleaned = re.sub(r'^(el|la|los|las|the|un|una)\s+', '', query.strip(), flags=re.IGNORECASE).strip()
        return cleaned if len(cleaned) >= 2 else query.strip()

    @classmethod
    def _search_anilist(cls, query: str) -> List[CharacterSearchResult]:
        if not query:
            return []
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
        payload = json.dumps({
            "query": graphql_query,
            "variables": {"search": query}
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

        results = []
        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    characters = data.get("data", {}).get("Page", {}).get("characters", [])
                    for ch in characters:
                        name_obj = ch.get("name", {})
                        full_name = name_obj.get("full") or name_obj.get("native") or "Unknown Character"
                        img_obj = ch.get("image", {})
                        img_url = img_obj.get("large") or img_obj.get("medium")
                        
                        origin = ""
                        media_nodes = ch.get("media", {}).get("nodes", [])
                        if media_nodes:
                            first_media = media_nodes[0]
                            title_obj = first_media.get("title", {})
                            origin = title_obj.get("english") or title_obj.get("romaji") or ""
                            
                        category = cls._detect_category(full_name, origin, "anime")

                        if img_url and not img_url.endswith("default.jpg"):
                            results.append(CharacterSearchResult(
                                name=full_name,
                                image_url=img_url,
                                category=category,
                                origin=origin
                            ))
        except Exception as e:
            print(f"AniList Character Search Error: {e}")
        return results

    @classmethod
    def _search_comicvine(cls, query: str) -> List[CharacterSearchResult]:
        if not query or not settings.COMIC_VINE_API_KEY:
            return []
        
        encoded_query = urllib.parse.quote(query)
        url = f"https://comicvine.gamespot.com/api/search/?api_key={settings.COMIC_VINE_API_KEY}&format=json&resources=character&query={encoded_query}&limit=12&field_list=id,name,real_name,image,publisher"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
        )

        results = []
        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for ch in data.get("results", []):
                        name = ch.get("name") or "Unknown Character"
                        real_name = ch.get("real_name")
                        
                        display_name = name
                        if real_name and real_name.lower() != name.lower() and len(real_name) < 30:
                            display_name = f"{name} ({real_name})"
                            
                        img_obj = ch.get("image", {}) or {}
                        img_url = img_obj.get("medium_url") or img_obj.get("super_url") or img_obj.get("small_url")
                        publisher = (ch.get("publisher") or {}).get("name") or "Comic"
                        
                        category = cls._detect_category(name, publisher, "comic")

                        if img_url and "default" not in img_url.lower():
                            results.append(CharacterSearchResult(
                                name=display_name,
                                image_url=img_url,
                                category=category,
                                origin=publisher
                            ))
        except Exception as e:
            print(f"Comic Vine Character Search Error: {e}")
        return results

    @staticmethod
    def _search_igdb(query: str) -> List[CharacterSearchResult]:
        if not query or not settings.TWITCH_CLIENT_ID:
            return []
        
        token = IGDBService._get_access_token()
        if not token:
            return []
        
        results = []
        seen_ids = set()

        terms_to_try = [query]
        tokens = query.split()
        if len(tokens) > 1 and len(tokens[0]) >= 3:
            terms_to_try.append(tokens[0])

        for term in terms_to_try:
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
                
            if len(results) >= 4:
                break

        return results

    @staticmethod
    def _search_tvmaze(query: str, raw_query: str = "") -> List[CharacterSearchResult]:
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
                            country = (person.get("country") or {}).get("name") or "TV & Cinema"
                            
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
        """Search Wikipedia / Cinema encyclopedia for movie & film characters."""
        if not query or len(query.strip()) < 2:
            return []
        
        results = []
        encoded = urllib.parse.quote(query + " fictional character")
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch={encoded}&gsrlimit=3&prop=pageimages|extracts&exintro=1&explaintext=1&pithumbsize=600&format=json"
        
        try:
            req = urllib.request.Request(search_url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    pages = data.get("query", {}).get("pages", {})
                    for pid, page in pages.items():
                        title = page.get("title", "")
                        thumb = page.get("thumbnail", {}).get("source")
                        extract = (page.get("extract") or "").lower()
                        
                        if thumb and any(k in extract for k in ["character", "film", "movie", "star wars", "protagonist", "franchise", "novel"]):
                            clean_name = title.split("(")[0].strip()
                            
                            origin = "Movie"
                            if "star wars" in extract:
                                origin = "Star Wars"
                            elif "pirates of the caribbean" in extract:
                                origin = "Pirates of the Caribbean"
                            elif "harry potter" in extract:
                                origin = "Harry Potter"
                            elif "lord of the rings" in extract:
                                origin = "The Lord of the Rings"
                            elif "marvel" in extract or "mcu" in extract:
                                origin = "Marvel Cinema"
                            elif "dc" in extract or "batman" in extract:
                                origin = "DC Cinema"
                                
                            results.append(CharacterSearchResult(
                                name=clean_name,
                                image_url=thumb,
                                category="movie",
                                origin=origin
                            ))
        except Exception as e:
            print(f"Movie Characters Search Error: {e}")
            
        return results

    @classmethod
    def _calculate_relevance(cls, item: CharacterSearchResult, clean_query: str, raw_query: str) -> int:
        score = 0
        name_lower = item.name.lower()
        origin_lower = (item.origin or "").lower()
        
        # 1. Exact string match
        if name_lower == clean_query or name_lower == raw_query:
            return 3000

        # Exact prefix match (e.g. "gordon freema" -> "gordon freeman")
        if name_lower.startswith(clean_query) or name_lower.startswith(raw_query):
            return 2500
            
        clean_tokens = [w for w in re.findall(r'\b[\w\'-]+\b', clean_query) if len(w) > 1]
        name_tokens = re.findall(r'\b[\w\'-]+\b', name_lower)
        origin_tokens = re.findall(r'\b[\w\'-]+\b', origin_lower)

        # 2. Multi-word query matching
        if len(clean_tokens) > 1:
            all_in_name = all(any(nt.startswith(ct) for nt in name_tokens) for ct in clean_tokens)
            if all_in_name:
                score += 2200
                if name_lower.startswith(clean_tokens[0]):
                    score += 300
                return score
                
            all_in_origin = all(any(ot.startswith(ct) for ot in origin_tokens) for ct in clean_tokens)
            if all_in_origin:
                score += 1200
                return score

            matched_name_tokens = sum(1 for ct in clean_tokens if any(nt.startswith(ct) for nt in name_tokens))
            if matched_name_tokens > 0:
                score += int((matched_name_tokens / len(clean_tokens)) * 400)
        else:
            token = clean_tokens[0] if clean_tokens else clean_query
            if token in name_tokens:
                score += 800
            elif any(nt.startswith(token) for nt in name_tokens):
                score += 500
            elif token in name_lower:
                score += 300
                
            if token in origin_tokens:
                score += 400
            elif token in origin_lower:
                score += 200

        return int(score)

    @classmethod
    def get_popular_suggestions(cls) -> List[Dict[str, Any]]:
        popular_searches = [
            ("Goku", "anime"),
            ("Monkey D. Luffy", "anime"),
            ("Naruto Uzumaki", "anime"),
            ("Darth Vader", "movie"),
            ("Jack Sparrow", "movie"),
            ("Spider-Man", "comic"),
            ("Batman", "comic"),
            ("Deadpool", "comic"),
            ("Gordon Freeman", "game"),
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
                elif cat == "movie":
                    f = executor.submit(cls._search_movies, name)
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
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_anilist = executor.submit(cls._search_anilist, search_term)
            future_comicvine = executor.submit(cls._search_comicvine, search_term)
            future_igdb = executor.submit(cls._search_igdb, search_term)
            future_tvmaze = executor.submit(cls._search_tvmaze, search_term, raw_query)
            future_movies = executor.submit(cls._search_movies, search_term)

            for future in (future_anilist, future_comicvine, future_igdb, future_tvmaze, future_movies):
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
