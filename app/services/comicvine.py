import json
import urllib.request
import urllib.parse
import re
from typing import List
from app.core.config import settings
from app.services.base import SearchResultItem

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
                        headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
                    )
                    try:
                        with urllib.request.urlopen(req_volumes, timeout=5) as response:
                            if response.status == 200:
                                v_data = json.loads(response.read().decode())
                                for v_item in v_data.get("results", []):
                                    v_id = v_item.get("id")
                                    if v_id:
                                        matching_volume_ids.append(v_id)
                    except Exception as e:
                        print(f"Comic Vine Volume Filter Error: {e}")

                    # Fallback Method B: Query search endpoint for volumes if Method A returned nothing
                    if not matching_volume_ids:
                        volume_search_url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume&query={encoded_series}"
                        req_volumes_search = urllib.request.Request(
                            volume_search_url,
                            headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
                        )
                        try:
                            with urllib.request.urlopen(req_volumes_search, timeout=5) as response:
                                if response.status == 200:
                                    v_data = json.loads(response.read().decode())
                                    for v_item in v_data.get("results", [])[:5]:
                                        v_id = v_item.get("id")
                                        if v_id and v_id not in matching_volume_ids:
                                            matching_volume_ids.append(v_id)
                        except Exception as e:
                            print(f"Comic Vine Volume Search Fallback Error: {e}")

                    # Step C: Query issues for all matched volume IDs
                    for vol_id in matching_volume_ids[:4]: # Limit to top 4 volume matches to prevent slow requests
                        issues_url = f"https://comicvine.gamespot.com/api/issues/?api_key={api_key}&format=json&filter=volume:{vol_id},issue_number:{issue_number}"
                        req_issues = urllib.request.Request(
                            issues_url,
                            headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
                        )
                        try:
                            with urllib.request.urlopen(req_issues, timeout=5) as response:
                                if response.status == 200:
                                    data = json.loads(response.read().decode())
                                    for item in data.get("results", []):
                                        image_data = item.get("image", {})
                                        image_url = image_data.get("super_url") or image_data.get("medium_url") or image_data.get("thumb_url")
                                        vol_name = item.get("volume", {}).get("name") or "Unknown Volume"
                                        issue_num = item.get("issue_number") or ""
                                        issue_name = item.get("name")
                                        title_parts = f"{vol_name} #{issue_num}"
                                        if issue_name:
                                            title_parts += f" ({issue_name})"
                                        manga_kws = {"manga", "shonen", "shojo", "seinen", "josei", "viz media", "kodansha", "tokyopop", "yen press"}
                                        is_manga = False
                                        publisher_name = item.get("volume", {}).get("publisher", {}).get("name", "").lower() if item.get("volume") and item.get("volume").get("publisher") else ""
                                        title_lower = title_parts.lower()
                                        desc_lower = (item.get("description") or "").lower()
                                        
                                        if any(kw in publisher_name for kw in manga_kws) or any(kw in title_lower for kw in manga_kws) or any(kw in desc_lower for kw in manga_kws):
                                            is_manga = True
                                        
                                        item_type_val = "manga" if is_manga else "comic"

                                        issue_results.append(
                                            SearchResultItem(
                                                external_id=str(item.get("id")),
                                                title=title_parts,
                                                image_url=image_url,
                                                description=item.get("description") or "",
                                                item_type=item_type_val,
                                                release_date=item.get("cover_date") or (str(item.get("start_year")) if item.get("start_year") else None)
                                            )
                                        )
                        except Exception as e:
                            print(f"Comic Vine Issues Lookup Error for vol {vol_id}: {e}")

            # 2. Perform standard global search (fallback/broad match)
            encoded_query = urllib.parse.quote(cleaned_query)
            url = f"https://comicvine.gamespot.com/api/search/?api_key={api_key}&format=json&resources=volume,issue&query={encoded_query}"
            
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"}
            )
            
            try:
                with urllib.request.urlopen(req, timeout=8) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        for item in data.get("results", []):
                            image_data = item.get("image", {})
                            image_url = image_data.get("super_url") or image_data.get("medium_url") or image_data.get("thumb_url")
                            
                            resource_type = item.get("resource_type")
                            if resource_type == "issue":
                                vol_name = item.get("volume", {}).get("name") or "Unknown Volume"
                                issue_num = item.get("issue_number") or ""
                                issue_name = item.get("name")
                                title_parts = f"{vol_name} #{issue_num}"
                                if issue_name:
                                    title_parts += f" ({issue_name})"
                                title = title_parts
                            else:
                                title = item.get("name") or "Untitled Volume"
                            manga_kws = {"manga", "shonen", "shojo", "seinen", "josei", "viz media", "kodansha", "tokyopop", "yen press"}
                            is_manga = False
                            publisher_name = item.get("publisher", {}).get("name", "").lower() if item.get("publisher") else ""
                            if resource_type == "issue" and item.get("volume") and item.get("volume").get("publisher"):
                                publisher_name = item.get("volume", {}).get("publisher", {}).get("name", "").lower()
                                
                            title_lower = title.lower()
                            desc_lower = (item.get("description") or "").lower()
                            
                            if any(kw in publisher_name for kw in manga_kws) or any(kw in title_lower for kw in manga_kws) or any(kw in desc_lower for kw in manga_kws):
                                is_manga = True
                                
                            item_type_val = "manga" if is_manga else "comic"

                            global_results.append(
                                SearchResultItem(
                                    external_id=str(item.get("id")),
                                    title=title,
                                    image_url=image_url,
                                    description=item.get("description") or "",
                                    item_type=item_type_val,
                                    release_date=item.get("cover_date") or (str(item.get("start_year")) if item.get("start_year") else None)
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
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar Comic Vine",
                    image_url=None,
                    description=str(e),
                    item_type="comic"
                )
            ]
