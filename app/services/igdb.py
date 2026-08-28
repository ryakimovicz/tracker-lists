import urllib.request
import urllib.parse
import json
import re
from datetime import datetime, timedelta
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem


class IGDBService:
    _access_token = None
    _token_expiry = None

    @classmethod
    def _get_access_token(cls) -> str:
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        client_secret = getattr(settings, "TWITCH_CLIENT_SECRET", None)

        if not client_id or not client_secret:
            return None

        # Check if we have a valid token cached
        if cls._access_token and cls._token_expiry and datetime.now() < cls._token_expiry:
            return cls._access_token

        # Fetch new token
        url = f"https://id.twitch.tv/oauth2/token?client_id={client_id}&client_secret={client_secret}&grant_type=client_credentials"
        req = urllib.request.Request(url, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    cls._access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    cls._token_expiry = datetime.now() + timedelta(seconds=expires_in - 300) # 5 min buffer
                    return cls._access_token
        except Exception as e:
            print(f"IGDB Auth Error: {e}")
        return None

    @classmethod
    def search_games(cls, query: str) -> List[SearchResultItem]:
        if not query:
            return []

        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()

        if not client_id or not token:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title="[Configuracion Requerida] Faltan Credenciales de IGDB",
                    image_url=None,
                    description="Agrega TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en tu .env para buscar juegos.",
                    item_type="game"
                )
            ]

        # IGDB Apicalypse query with metadata for smart ranking
        safe_query = query.replace('"', '\\"')
        body = f'search "{safe_query}"; fields id, name, category, parent_game, version_parent, cover.image_id, first_release_date, summary, total_rating, rating_count, hypes, follows, themes, age_ratings.rating; limit 100;'
        
        req = urllib.request.Request(
            "https://api.igdb.com/v4/games",
            data=body.encode("utf-8"),
            headers={
                "Client-ID": client_id,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if not data:
                        return []

                    # Smart sorting: Collections first, then Main Games, then Expansions, then DLCs/Skins
                    import re
                    q_lower = query.lower().strip()
                    dlc_keywords = ["skin", "skins", "pack", "dlc", "soundtrack", "season pass", "costume", "expansion pack", "avatar", "theme", "wallpaper", "challenge", "challenge map", "story pack", "bundle", "booster"]
                    real_bundle_keywords = ["collection", "trilogy", "anthology", "saga", "duology", "compilation", "all-in-one"]

                    def calculate_score(item):
                        name = item.get("name", "")
                        name_lower = name.lower().strip()
                        cat = item.get("category", 0)
                        has_parent = "parent_game" in item
                        
                        is_real_bundle = any(re.search(rf"\b{kw}\b", name_lower) for kw in real_bundle_keywords)
                        is_dlc_like = (has_parent or cat in (1, 5, 14) or any(re.search(rf"\b{kw}\b", name_lower) for kw in dlc_keywords)) and not is_real_bundle
                        
                        # Tier 0: Real Collections and Full Game Bundles
                        if is_real_bundle or (cat == 3 and not is_dlc_like):
                            tier = 0
                        # Tier 1: Main Games / Remakes / Remasters / Standalone Expansions / Editions
                        elif not is_dlc_like and cat in (0, 8, 9, 4, 10, None):
                            tier = 1
                        # Tier 2: Expansions / Ports / Episodes
                        elif not is_dlc_like and cat in (2, 6, 7, 11):
                            tier = 2
                        # Tier 3: DLCs / Skins / Packs / Mods
                        else:
                            tier = 3
                            
                        rating_count = item.get("rating_count") or 0
                        hypes = item.get("hypes") or 0
                        follows = item.get("follows") or 0
                        total_rating = item.get("total_rating") or 0
                        
                        # Exact or prefix match bonus
                        exact_boost = 500 if name_lower == q_lower else (150 if name_lower.startswith(q_lower) else 0)
                        
                        # Cover & release date bonus
                        cover_boost = 100 if item.get("cover") else -200
                        has_date_boost = 50 if item.get("first_release_date") else -50
                        has_summary_boost = 30 if item.get("summary") else 0
                        
                        pop_score = (rating_count * 5) + (hypes * 3) + (follows * 3) + (total_rating / 5.0) + exact_boost + cover_boost + has_date_boost + has_summary_boost
                        return (tier, -pop_score)

                    sorted_items = sorted(data, key=calculate_score)

                    results = []
                    for item in sorted_items:
                        image_url = None
                        cover = item.get("cover")
                        if cover and cover.get("image_id"):
                            image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"

                        # Parse release date
                        release_timestamp = item.get("first_release_date")
                        release_date = None
                        if release_timestamp:
                            release_date = datetime.fromtimestamp(release_timestamp).strftime("%Y-%m-%d")

                        # Normalize rating to 0.0 - 5.0
                        total_rating = item.get("total_rating")
                        pop_val = 0.0
                        if total_rating:
                            pop_val = round(total_rating / 20.0, 1)

                        description_parts = []
                        if pop_val:
                            description_parts.append(f"Rating: {pop_val}/5")
                        if release_date:
                            description_parts.append(f"Released: {release_date}")
                            
                        desc = ". ".join(description_parts) + "."
                        if item.get("summary"):
                            desc += f" {item['summary'][:150]}..."

                        themes = item.get("themes") or []
                        age_ratings = [ar.get("rating") for ar in item.get("age_ratings", []) if isinstance(ar, dict)]
                        is_mature_game = 42 in themes or 5 in age_ratings or 12 in age_ratings
                        game_title = item.get("name") or "Untitled Game"

                        from app.core.sfw_filter import is_safe_media_item
                        if 42 in themes or not is_safe_media_item(game_title, desc):
                            continue

                        # Determine game badge (Collection, DLC, Expansion, Edition, Remake, Remaster)
                        cat = item.get("category", 0)
                        item_name_lower = game_title.lower()
                        has_parent = "parent_game" in item
                        is_real_bundle = any(re.search(rf"\b{kw}\b", item_name_lower) for kw in real_bundle_keywords)
                        is_dlc_like = (has_parent or cat in (1, 5, 14) or any(re.search(rf"\b{kw}\b", item_name_lower) for kw in dlc_keywords)) and not is_real_bundle
                        is_expansion = cat in (2, 4)

                        badge = None
                        if is_real_bundle or (cat == 3 and not is_dlc_like):
                            badge = "collection"
                        elif is_dlc_like:
                            badge = "dlc"
                        elif is_expansion:
                            badge = "expansion"
                        elif cat == 8 or "remake" in item_name_lower:
                            badge = "remake"
                        elif cat == 9 or "remaster" in item_name_lower:
                            badge = "remaster"
                        elif cat == 10 or "edition" in item_name_lower or "goty" in item_name_lower or "version" in item_name_lower:
                            badge = "edition"

                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=game_title,
                                image_url=image_url,
                                description=desc,
                                item_type="game",
                                release_date=release_date,
                                popularity=pop_val,
                                is_nsfw=False,
                                badge=badge
                            )
                        )
                    return results


        except Exception as e:
            print(f"IGDB API Error: {e}")
            return []
        return []

    @classmethod
    def get_game_relations(cls, game_id: str):
        """
        Fetches bidirectional relations for a game:
        - collections/bundles containing this game
        - bundle_games: games included in this bundle (if current item is a bundle/edition)
        - editions: alternative versions (GOTY, remakes, remasters, version_parent)
        - dlcs: expansions, DLCs, standalone expansions
        - parent_game: base game (if current item is a DLC/expansion)
        """
        try:
            gid = int(game_id)
        except (ValueError, TypeError):
            return {}

        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()
        if not client_id or not token:
            return {}

        def format_item(item_data):
            if not item_data or not isinstance(item_data, dict):
                return None
            image_url = None
            cover = item_data.get("cover")
            if cover and isinstance(cover, dict) and cover.get("image_id"):
                image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"
            
            release_date = None
            release_ts = item_data.get("first_release_date")
            if release_ts:
                try:
                    release_date = datetime.fromtimestamp(release_ts).strftime("%Y")
                except Exception:
                    pass

            return {
                "id": str(item_data.get("id")),
                "external_id": str(item_data.get("id")),
                "title": item_data.get("name") or "Untitled Game",
                "image_url": image_url,
                "release_year": release_date,
                "item_type": "game"
            }

        # Query 1: Main relations of this game
        body_main = f'''fields id, name, category,
            bundles.id, bundles.name, bundles.cover.image_id, bundles.first_release_date,
            dlcs.id, dlcs.name, dlcs.cover.image_id, dlcs.first_release_date,
            expansions.id, expansions.name, expansions.cover.image_id, expansions.first_release_date,
            standalone_expansions.id, standalone_expansions.name, standalone_expansions.cover.image_id, standalone_expansions.first_release_date,
            parent_game.id, parent_game.name, parent_game.cover.image_id, parent_game.first_release_date,
            version_parent.id, version_parent.name, version_parent.cover.image_id, version_parent.first_release_date,
            remakes.id, remakes.name, remakes.cover.image_id, remakes.first_release_date,
            remasters.id, remasters.name, remasters.cover.image_id, remasters.first_release_date;
            where id = {gid};'''

        # Query 2: Children/Members if this game is a bundle or has edition variants
        body_children = f'''fields id, name, category, cover.image_id, first_release_date;
            where bundles = ({gid}) | version_parent = ({gid}); limit 50;'''

        relations = {
            "collections": [],
            "bundle_games": [],
            "editions": [],
            "dlcs": [],
            "parent_game": None
        }

        try:
            req1 = urllib.request.Request("https://api.igdb.com/v4/games", data=body_main.encode("utf-8"), headers={"Client-ID": client_id, "Authorization": f"Bearer {token}", "Accept": "application/json"})
            with urllib.request.urlopen(req1, timeout=8) as resp1:
                data_main = json.loads(resp1.read().decode())
                if data_main and len(data_main) > 0:
                    game = data_main[0]

                    # Parent game (if this is a DLC or expansion)
                    if game.get("parent_game"):
                        relations["parent_game"] = format_item(game.get("parent_game"))

                    # Collections/Bundles containing this game
                    seen_coll = set()
                    for b in game.get("bundles", []):
                        item = format_item(b)
                        if item and item["id"] not in seen_coll and item["id"] != str(gid):
                            seen_coll.add(item["id"])
                            relations["collections"].append(item)

                    # DLCs and Expansions
                    seen_dlcs = set()
                    for d in game.get("dlcs", []) + game.get("expansions", []) + game.get("standalone_expansions", []):
                        item = format_item(d)
                        if item and item["id"] not in seen_dlcs and item["id"] != str(gid):
                            seen_dlcs.add(item["id"])
                            relations["dlcs"].append(item)

                    # Editions / Remakes / Remasters
                    seen_editions = set()
                    if game.get("version_parent"):
                        item = format_item(game.get("version_parent"))
                        if item and item["id"] not in seen_editions and item["id"] != str(gid):
                            seen_editions.add(item["id"])
                            relations["editions"].append(item)

                    for e in game.get("remakes", []) + game.get("remasters", []):
                        item = format_item(e)
                        if item and item["id"] not in seen_editions and item["id"] != str(gid):
                            seen_editions.add(item["id"])
                            relations["editions"].append(item)

            req2 = urllib.request.Request("https://api.igdb.com/v4/games", data=body_children.encode("utf-8"), headers={"Client-ID": client_id, "Authorization": f"Bearer {token}", "Accept": "application/json"})
            with urllib.request.urlopen(req2, timeout=8) as resp2:
                data_children = json.loads(resp2.read().decode())
                for child in data_children:
                    item = format_item(child)
                    if not item or item["id"] == str(gid):
                        continue
                    cat = child.get("category", 0)
                    # If this is an edition (GOTY, Special Edition, etc.)
                    if cat in (8, 9, 10) or "version_parent" in child or "edition" in item["title"].lower():
                        if not any(e["id"] == item["id"] for e in relations["editions"]):
                            relations["editions"].append(item)
                    # If this is a DLC or expansion
                    elif cat in (1, 2, 4, 13) or "dlc" in item["title"].lower() or "pack" in item["title"].lower():
                        if not any(d["id"] == item["id"] for d in relations["dlcs"]):
                            relations["dlcs"].append(item)
                    # Otherwise it's a game in this bundle/collection
                    else:
                        if not any(b["id"] == item["id"] for b in relations["bundle_games"]):
                            relations["bundle_games"].append(item)

        except Exception as e:
            print(f"IGDB Relations Error: {e}")

        return relations

    @classmethod
    def _execute_query(cls, body: str) -> List[SearchResultItem]:
        client_id = getattr(settings, "TWITCH_CLIENT_ID", None)
        token = cls._get_access_token()
        if not client_id or not token: return []
        req = urllib.request.Request("https://api.igdb.com/v4/games", data=body.encode("utf-8"), headers={"Client-ID": client_id, "Authorization": f"Bearer {token}", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    dlc_keywords = ["skin", "skins", "pack", "dlc", "soundtrack", "season pass", "costume", "expansion pack", "avatar", "theme", "wallpaper", "challenge", "challenge map", "story pack", "bundle", "booster"]
                    real_bundle_keywords = ["collection", "trilogy", "anthology", "saga", "duology", "compilation", "all-in-one"]

                    for item in data:
                        image_url = None
                        cover = item.get("cover")
                        if cover and cover.get("image_id"):
                            image_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover['image_id']}.jpg"
                        release_timestamp = item.get("first_release_date")
                        release_date = datetime.fromtimestamp(release_timestamp).strftime("%Y-%m-%d") if release_timestamp else None

                        cat = item.get("category", 0)
                        item_name_lower = (item.get("name") or "").lower()
                        has_parent = "parent_game" in item
                        is_real_bundle = any(re.search(rf"\b{kw}\b", item_name_lower) for kw in real_bundle_keywords)
                        is_dlc_like = (has_parent or cat in (1, 5, 14) or any(re.search(rf"\b{kw}\b", item_name_lower) for kw in dlc_keywords)) and not is_real_bundle
                        is_expansion = cat in (2, 4)

                        badge = None
                        if is_real_bundle or (cat == 3 and not is_dlc_like):
                            badge = "collection"
                        elif is_dlc_like:
                            badge = "dlc"
                        elif is_expansion:
                            badge = "expansion"
                        elif cat == 8 or "remake" in item_name_lower:
                            badge = "remake"
                        elif cat == 9 or "remaster" in item_name_lower:
                            badge = "remaster"
                        elif cat == 10 or "edition" in item_name_lower or "goty" in item_name_lower or "version" in item_name_lower:
                            badge = "edition"

                        results.append(SearchResultItem(
                            external_id=str(item.get("id")),
                            title=item.get("name") or "Untitled Game",
                            image_url=image_url,
                            item_type="game",
                            release_date=release_date,
                            badge=badge
                        ))
                    return results
        except Exception as e:
            pass
        return []

    @classmethod
    def get_new_games(cls) -> List[SearchResultItem]:
        import time
        now = int(time.time())
        body = f'fields id, name, category, parent_game, cover.image_id, first_release_date, summary; where first_release_date < {now} & cover != null; sort first_release_date desc; limit 40;'
        return cls._execute_query(body)

    @classmethod
    def get_trending_games(cls) -> List[SearchResultItem]:
        import time
        now = int(time.time())
        six_months_ago = now - (180 * 86400)
        body = f'fields id, name, category, parent_game, cover.image_id, first_release_date, summary, total_rating; where first_release_date > {six_months_ago} & first_release_date < {now} & cover != null & total_rating != null; sort total_rating desc; limit 15;'
        return cls._execute_query(body)


