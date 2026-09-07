import json
import urllib.request
import urllib.parse
import re
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem
from app.core.sfw_filter import is_safe_media_item

class ComicVineService:
    @staticmethod
    def search_comics(query: str) -> List[SearchResultItem]:
        if not query:
            return []
        
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return [
                SearchResultItem(
                    external_id="warning-no-key",
                    title="[Configuracion Requerida] Comic Vine API Key Faltante",
                    image_url=None,
                    description="Agrega tu COMIC_VINE_API_KEY en el archivo .env para habilitar busquedas reales de Comics occidentales.",
                    item_type="comic"
                )
            ]
        
        # Clean the query: replace '#' with a space and remove duplicate spaces
        cleaned_query = query.replace('#', ' ')
        cleaned_query = " ".join(cleaned_query.split())
        
        issue_results = []
        global_results = []

        # Load blocked franchises/volumes from DB
        blocked_vol_ids = set()
        blocked_names = []
        try:
            from app.core.database import SessionLocal
            from app.models.social import BlockedFranchise
            with SessionLocal() as db:
                bfs = db.query(BlockedFranchise).all()
                for bf in bfs:
                    raw_id = bf.target_id.replace("cv_volume_", "").replace("cv_publisher_", "").replace("cv_", "")
                    if raw_id.isdigit():
                        blocked_vol_ids.add(int(raw_id))
                    if bf.name:
                        blocked_names.append(bf.name.lower())
        except Exception as e:
            print(f"Notice loading blocked franchises: {e}")

        try:
            # 1. Detect if the query ends with an issue number (e.g. "The New Teen Titans 39" or "Justice League of America 9")
            issue_number_match = re.search(r'^(.*?)\s*#?\s*(\d+)$', cleaned_query)
            if issue_number_match:
                series_name = issue_number_match.group(1).strip()
                issue_number = issue_number_match.group(2).strip()
                
                if series_name:
                    encoded_series = urllib.parse.quote(series_name)
                    matching_volume_ids = []

                    # Method A: Query the volumes endpoint directly filtering by name (highly precise)
                    volumes_url = f"https://comicvine.gamespot.com/api/volumes/?api_key={api_key}&format=json&filter=name:{encoded_series}"
                    req_volumes = urllib.request.Request(
                        volumes_url,
                        headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
                    )
                    try:
                        with urllib.request.urlopen(req_volumes, timeout=5) as response:
                            if response.status == 200:
                                v_data = json.loads(response.read().decode())
                                for v_item in v_data.get("results", []):
                                    v_id = v_item.get("id")
                                    if v_id and v_id not in blocked_vol_ids:
                                        matching_volume_ids.append(v_id)
                    except Exception as e:
                        print(f"Comic Vine Volume Filter Error: {e}")

                    # Fallback Method B: Query search endpoint for volumes if Method A returned nothing
                    if not matching_volume_ids:
                        volume_search_url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume&query={encoded_series}"
                        req_volumes_search = urllib.request.Request(
                            volume_search_url,
                            headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
                        )
                        try:
                            with urllib.request.urlopen(req_volumes_search, timeout=5) as response:
                                if response.status == 200:
                                    v_data = json.loads(response.read().decode())
                                    for v_item in v_data.get("results", [])[:5]:
                                        v_id = v_item.get("id")
                                        if v_id and v_id not in blocked_vol_ids and v_id not in matching_volume_ids:
                                            matching_volume_ids.append(v_id)
                        except Exception as e:
                            print(f"Comic Vine Volume Search Fallback Error: {e}")

                    # Step C: Query issues for all matched volume IDs
                    for vol_id in matching_volume_ids[:4]: # Limit to top 4 volume matches to prevent slow requests
                        issues_url = f"https://comicvine.gamespot.com/api/issues/?api_key={api_key}&format=json&filter=volume:{vol_id},issue_number:{issue_number}"
                        req_issues = urllib.request.Request(
                            issues_url,
                            headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
                        )
                        try:
                            with urllib.request.urlopen(req_issues, timeout=5) as response:
                                if response.status == 200:
                                    data = json.loads(response.read().decode())
                                    for item in data.get("results", []):
                                        vol_data = item.get("volume", {})
                                        if vol_data.get("id") and vol_data.get("id") in blocked_vol_ids:
                                            continue

                                        image_data = item.get("image", {})
                                        image_url = image_data.get("super_url") or image_data.get("medium_url") or image_data.get("thumb_url")
                                        vol_name = vol_data.get("name") or "Unknown Volume"
                                        issue_num = item.get("issue_number") or ""
                                        issue_name = item.get("name")
                                        title_parts = f"{vol_name} #{issue_num}"
                                        if issue_name:
                                            title_parts += f" ({issue_name})"
                                        desc = item.get("description") or ""

                                        if any(bn in title_parts.lower() for bn in blocked_names):
                                            continue

                                        if not is_safe_media_item(title_parts, desc):
                                            continue

                                        issue_id_str = str(item.get("id"))
                                        ext_id = f"cv_issue_{issue_id_str}" if not issue_id_str.startswith("cv_") else issue_id_str

                                        issue_results.append(
                                            SearchResultItem(
                                                external_id=ext_id,
                                                title=title_parts,
                                                image_url=image_url,
                                                description=desc,
                                                item_type=item_type_val,
                                                release_date=item.get("cover_date") or (str(item.get("start_year")) if item.get("start_year") else None),
                                                page_count=item.get("count_of_pages") or item.get("count_of_issues"),
                                                badge=f"#{issue_num}" if issue_num else "Issue"
                                            )
                                        )
                        except Exception as e:
                            print(f"Comic Vine Issues Lookup Error for vol {vol_id}: {e}")

            # 2. Perform standard global search (fallback/broad match)
            encoded_query = urllib.parse.quote(cleaned_query)
            url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume,issue&query={encoded_query}"
            
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"}
            )
            
            try:
                with urllib.request.urlopen(req, timeout=8) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        for item in data.get("results", []):
                            resource_type = item.get("resource_type")
                            vol_data = item.get("volume", {}) if resource_type == "issue" else item
                            vol_id = vol_data.get("id") if resource_type == "issue" else item.get("id")
                            
                            if vol_id and vol_id in blocked_vol_ids:
                                continue

                            image_data = item.get("image", {})
                            image_url = image_data.get("super_url") or image_data.get("medium_url") or image_data.get("thumb_url")
                            
                            raw_id = str(item.get("id"))
                            if resource_type == "issue":
                                vol_name = item.get("volume", {}).get("name") or "Unknown Volume"
                                issue_num = item.get("issue_number") or ""
                                issue_name = item.get("name")
                                title_parts = f"{vol_name} #{issue_num}"
                                if issue_name:
                                    title_parts += f" ({issue_name})"
                                title = title_parts
                                ext_id = f"cv_issue_{raw_id}" if not raw_id.startswith("cv_") else raw_id
                                badge_val = f"#{issue_num}" if issue_num else "Issue"
                            else:
                                vol_name = item.get("name") or "Untitled Volume"
                                start_year = item.get("start_year")
                                issue_count = item.get("count_of_issues")
                                title = f"{vol_name} ({start_year})" if start_year else vol_name
                                ext_id = f"cv_vol_{raw_id}" if not raw_id.startswith("cv_") else raw_id
                                badge_val = f"{issue_count} Números" if issue_count else "Volumen"

                            if any(bn in title.lower() for bn in blocked_names):
                                continue

                            desc = item.get("description") or ""
                            if not is_safe_media_item(title, desc):
                                continue

                            item_type_val = "comic"

                            global_results.append(
                                SearchResultItem(
                                    external_id=ext_id,
                                    title=title,
                                    image_url=image_url,
                                    description=desc,
                                    item_type=item_type_val,
                                    release_date=item.get("cover_date") or (str(item.get("start_year")) if item.get("start_year") else None),
                                    page_count=item.get("count_of_pages") or item.get("count_of_issues"),
                                    badge=badge_val
                                )
                            )
            except Exception as e:
                print(f"Comic Vine Global Search API Error: {e}")

            # Merge results without duplicates (prioritize issues endpoint first)
            seen_ids = set()
            merged_results = []
            
            for item in issue_results:
                if item.external_id not in seen_ids:
                    seen_ids.add(item.external_id)
                    merged_results.append(item)
                    
            for item in global_results:
                if item.external_id not in seen_ids:
                    seen_ids.add(item.external_id)
                    merged_results.append(item)

            # Sort merged results using relevance scoring based on the query
            def get_relevance_score(title_str: str) -> float:
                t_lower = title_str.lower()
                q_lower = query.lower()
                
                # Perfect exact match
                if t_lower == q_lower:
                    return 100.0
                
                # Prefix match (starts with the query name)
                if t_lower.startswith(q_lower):
                    # Prioritize issue numbers sequence
                    rem = t_lower[len(q_lower):].strip()
                    if rem.startswith('#') or (rem and rem[0].isdigit()):
                        return 80.0
                    return 70.0
                    
                # Substring match
                if q_lower in t_lower:
                    return 40.0
                    
                return 0.0

            merged_results.sort(key=lambda x: get_relevance_score(x.title), reverse=True)
            return merged_results
        except Exception as e:
            print(f"Comic Vine API Error: {e}")
            return []

    @staticmethod
    def get_comic_volume_detail(vol_id: str) -> dict:
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return None
        
        raw_id = str(vol_id).replace("cv_vol_", "").replace("cv_volume_", "").replace("cv_", "")
        if not raw_id.isdigit():
            return None

        url = f"https://comicvine.gamespot.com/api/volume/4050-{raw_id}/?api_key={api_key}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    v = data.get("results", {})
                    if not v:
                        return None
                    
                    vol_name = v.get("name") or "Untitled Volume"
                    start_yr = v.get("start_year")
                    count_issues = v.get("count_of_issues") or 0
                    img_data = v.get("image", {})
                    img_url = img_data.get("super_url") or img_data.get("medium_url") or img_data.get("thumb_url")
                    
                    desc = v.get("description") or v.get("deck") or ""
                    import re
                    desc = re.sub('<[^<]+?>', '', desc)
                    
                    publisher_name = v.get("publisher", {}).get("name") if v.get("publisher") else None

                    # Format seasons array: Volume 1 as the primary season containing the issues
                    seasons = [{
                        "id": int(raw_id),
                        "season_number": 1,
                        "episode_count": count_issues,
                        "name": f"Volumen ({start_yr})" if start_yr else "Volumen"
                    }]

                    return {
                        "id": f"cv_vol_{raw_id}",
                        "name": f"{vol_name} ({start_yr})" if start_yr else vol_name,
                        "volume_name": vol_name,
                        "start_year": start_yr,
                        "publisher": publisher_name,
                        "number_of_seasons": 1,
                        "seasons": seasons,
                        "overview": desc,
                        "first_air_date": str(start_yr) if start_yr else None,
                        "image_url": img_url,
                        "count_of_issues": count_issues
                    }
        except Exception as e:
            print(f"Comic Vine get_comic_volume_detail error: {e}")
        return None

    @staticmethod
    def get_comic_volume_issues(vol_id: str) -> List[dict]:
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return []
        
        raw_id = str(vol_id).replace("cv_vol_", "").replace("cv_volume_", "").replace("cv_", "")
        if not raw_id.isdigit():
            return []

        # Query all issues for this volume, sorted by issue_number ascending
        url = f"https://comicvine.gamespot.com/api/issues/?api_key={api_key}&format=json&filter=volume:{raw_id}&sort=cover_date:asc&limit=100"
        req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    raw_issues = data.get("results", [])
                    episodes = []
                    
                    # Sort numerically by issue_number where possible
                    def parse_issue_num(num_val):
                        if num_val is None:
                            return 999999
                        try:
                            return float(str(num_val).strip())
                        except Exception:
                            # Extract first number
                            import re
                            m = re.search(r'\d+', str(num_val))
                            return float(m.group(0)) if m else 999999

                    sorted_issues = sorted(raw_issues, key=lambda x: parse_issue_num(x.get("issue_number")))

                    for idx, itm in enumerate(sorted_issues, start=1):
                        i_id = str(itm.get("id"))
                        issue_num_str = itm.get("issue_number") or str(idx)
                        i_name = itm.get("name")
                        title_str = f"#{issue_num_str}"
                        if i_name:
                            title_str += f" - {i_name}"
                        
                        img_data = itm.get("image", {})
                        img_url = img_data.get("super_url") or img_data.get("medium_url") or img_data.get("thumb_url")
                        
                        desc = itm.get("description") or itm.get("deck") or ""
                        import re
                        desc = re.sub('<[^<]+?>', '', desc)

                        episodes.append({
                            "id": i_id,
                            "name": title_str,
                            "episode_number": int(parse_issue_num(issue_num_str)) if parse_issue_num(issue_num_str) < 999999 else idx,
                            "season_number": 1,
                            "still_path": img_url,
                            "image_url": img_url,
                            "overview": desc,
                            "air_date": itm.get("cover_date") or itm.get("store_date")
                        })
                    return episodes
        except Exception as e:
            print(f"Comic Vine get_comic_volume_issues error: {e}")
        return []

    @staticmethod
    def get_comic_issue_detail(issue_id: str) -> dict:
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return None
        
        raw_id = str(issue_id).replace("cv_issue_", "").replace("cv_", "")
        if not raw_id.isdigit():
            return None

        url = f"https://comicvine.gamespot.com/api/issue/4000-{raw_id}/?api_key={api_key}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    itm = data.get("results", {})
                    if not itm:
                        return None
                    
                    vol_data = itm.get("volume", {})
                    vol_id = vol_data.get("id")
                    vol_name = vol_data.get("name") or "Unknown Volume"
                    issue_num = itm.get("issue_number") or ""
                    issue_name = itm.get("name")
                    
                    full_title = f"{vol_name} #{issue_num}"
                    if issue_name:
                        full_title += f" ({issue_name})"
                    
                    img_data = itm.get("image", {})
                    img_url = img_data.get("super_url") or img_data.get("medium_url") or img_data.get("thumb_url")
                    
                    desc = itm.get("description") or itm.get("deck") or ""
                    import re
                    desc = re.sub('<[^<]+?>', '', desc)

                    parent_series = None
                    if vol_id:
                        parent_series = {
                            "external_id": f"cv_vol_{vol_id}",
                            "title": vol_name,
                            "item_type": "comic"
                        }

                    return {
                        "id": f"cv_issue_{raw_id}",
                        "title": full_title,
                        "name": full_title,
                        "issue_number": issue_num,
                        "volume_id": f"cv_vol_{vol_id}" if vol_id else None,
                        "volume_name": vol_name,
                        "overview": desc,
                        "description": desc,
                        "image_url": img_url,
                        "release_date": itm.get("cover_date") or itm.get("store_date"),
                        "parent_series": parent_series
                    }
        except Exception as e:
            print(f"Comic Vine get_comic_issue_detail error: {e}")
        return None

    @staticmethod
    def get_new_comics() -> List[SearchResultItem]:
        api_key = settings.COMIC_VINE_API_KEY
        if not api_key:
            return []
        
        # Fetch latest published comic issues from Comic Vine with full dates
        try:
            url = f"https://comicvine.gamespot.com/api/issues/?api_key={api_key}&format=json&sort=cover_date:desc&limit=50"
            req = urllib.request.Request(url, headers={"User-Agent": "Pathd/1.0 (contact@pathd.app)"})
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    results = []
                    
                    # Keywords to identify manga magazines/anthologies in Comic Vine
                    manga_keywords = [
                        "shonen jump", "v jump", "shueisha", "kodansha", "manga", "kirara",
                        "yuri hime", "champion red", "action pizazz", "office you", "dengeki",
                        "young jump", "weekly shonen", "monthly shonen", "tankobon", "jump giga"
                    ]

                    # Query blocked franchises/volumes from DB
                    blocked_vol_ids = set()
                    try:
                        from app.core.database import SessionLocal
                        from app.models.social import BlockedFranchise
                        with SessionLocal() as db:
                            bfs = db.query(BlockedFranchise).all()
                            for bf in bfs:
                                # extract numeric raw id e.g. cv_volume_88907 -> 88907
                                raw_id = bf.target_id.replace("cv_volume_", "").replace("cv_publisher_", "").replace("cv_", "")
                                if raw_id.isdigit():
                                    blocked_vol_ids.add(int(raw_id))
                                if bf.name:
                                    manga_keywords.append(bf.name.lower())
                    except Exception as e:
                        print(f"Notice loading blocked franchises: {e}")

                    for item in data.get("results", []):
                        vol_obj = item.get("volume") or {}
                        vol_id = vol_obj.get("id")
                        vol_name = (vol_obj.get("name") or "").strip()
                        
                        if vol_id and vol_id in blocked_vol_ids:
                            continue

                        issue_num = item.get("issue_number")
                        raw_title = item.get("name") or ""
                        
                        full_name_check = f"{vol_name} {raw_title}".lower()
                        if any(k in full_name_check for k in manga_keywords):
                            continue

                        if not is_safe_media_item(f"{vol_name} #{issue_num} {raw_title}", item.get("deck") or item.get("description") or ""):
                            continue

                        image_obj = item.get("image", {})
                        image_url = image_obj.get("super_url") or image_obj.get("medium_url") or image_obj.get("small_url")
                        
                        if not raw_title:
                            title = f"{vol_name} #{issue_num}" if (vol_name and issue_num) else (vol_name or "Untitled Comic")
                        elif vol_name and issue_num and vol_name not in raw_title:
                            title = f"{vol_name} #{issue_num}: {raw_title}"
                        else:
                            title = raw_title
                            
                        pub_date = item.get("store_date") or item.get("cover_date") or (item.get("date_added")[:10] if item.get("date_added") else None)
                        
                        results.append(SearchResultItem(
                            external_id=f"cv_issue_{item.get('id')}",
                            title=title,
                            image_url=image_url,
                            description=item.get("deck") or item.get("description") or "",
                            item_type="comic",
                            release_date=pub_date
                        ))
                    if results:
                        return results[:25]
        except Exception as e:
            print(f"Comic Vine New Comics error: {e}")

        # Fallback to volumes query
        from datetime import datetime
        current_year = datetime.now().year
        return ComicVineService.search_comics(f"Batman {current_year}")[:15]

    @staticmethod
    def get_trending_comics() -> List[SearchResultItem]:
        import random
        queries = ["Spider-Man", "X-Men", "Batman", "Superman", "Wolverine", "Avengers"]
        return ComicVineService.search_comics(random.choice(queries))[:15]
