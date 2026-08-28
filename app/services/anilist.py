import json
import urllib.request
from typing import List
from app.services.base import SearchResultItem

class AnilistService:
    @staticmethod
    def search_manga(query: str) -> List[SearchResultItem]:
        if not query:
            return []

        url = "https://graphql.anilist.co"
        graphql_query = """
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
              id
              isAdult
              genres
              title {
                romaji
                english
              }
              description
              coverImage {
                large
              }
              startDate {
                year
                month
                day
              }
              averageScore
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

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media_list = data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        genres = item.get("genres", [])
                        if item.get("isAdult") or "Hentai" in genres or "Ecchi" in genres:
                            continue

                        title_obj = item.get("title", {})
                        title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                        cover_obj = item.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        start_date_obj = item.get("startDate", {})
                        year = start_date_obj.get("year")
                        month = start_date_obj.get("month")
                        day = start_date_obj.get("day")
                        release_date = ""
                        if year:
                            release_date = str(year)
                            if month:
                                release_date = f"{year}-{month:02d}"
                                if day:
                                    release_date = f"{year}-{month:02d}-{day:02d}"
                        desc = item.get("description") or ""
                        import re
                        desc = re.sub('<[^<]+?>', '', desc)
                        results.append(
                            SearchResultItem(
                                external_id=str(item.get("id")),
                                title=title,
                                image_url=image_url,
                                description=desc,
                                item_type="manga",
                                release_date=release_date,
                                popularity=float(item.get("averageScore") or 0),
                                is_nsfw=False
                            )
                        )
                    return results

        except Exception as e:
            print(f"AniList API Search Error: {e}")
            return [
                SearchResultItem(
                    external_id="error-api",
                    title="Error al consultar AniList",
                    image_url=None,
                    description=str(e),
                    item_type="manga"
                )
            ]
        return []

    @staticmethod
    def get_trending_manga() -> List[SearchResultItem]:
        url = "https://graphql.anilist.co"
        graphql_query = '''
        query {
          Page(page: 1, perPage: 15) {
            media(type: MANGA, sort: [TRENDING_DESC, POPULARITY_DESC], status: RELEASING, isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
            }
          }
        }
        '''
        import json, urllib.request
        payload = json.dumps({"query": graphql_query}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media_list = data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        title_obj = item.get("title", {})
                        title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                        cover_obj = item.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        start_date_obj = item.get("startDate", {}) or {}
                        year = start_date_obj.get("year") or item.get("seasonYear")
                        month = start_date_obj.get("month")
                        day = start_date_obj.get("day")
                        release_date = ""
                        if year:
                            release_date = str(year)
                            if month:
                                release_date = f"{year}-{month:02d}"
                                if day:
                                    release_date = f"{year}-{month:02d}-{day:02d}"
                        import re
                        desc = item.get("description") or ""
                        desc = re.sub('<[^<]+?>', '', desc)
                        results.append(SearchResultItem(external_id=str(item.get("id")), title=title, image_url=image_url, description=desc, item_type="manga", release_date=release_date or None, popularity=float(item.get("averageScore") or 0)))
                    return results
        except Exception:
            pass
        return []

    @staticmethod
    def get_new_manga() -> List[SearchResultItem]:
        import json, urllib.request, datetime
        url = "https://graphql.anilist.co"
        today_int = int(datetime.date.today().strftime("%Y%m%d"))
        
        graphql_query = """
        query ($end: FuzzyDateInt) {
          Page(page: 1, perPage: 40) {
            media(type: MANGA, sort: [START_DATE_DESC], startDate_greater: 20260101, startDate_lesser: $end, isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
            }
          }
        }
        """
        payload = json.dumps({
            "query": graphql_query,
            "variables": {"end": today_int}
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media_list = data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        title_obj = item.get("title", {})
                        title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Manga"
                        cover_obj = item.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        start_date_obj = item.get("startDate", {}) or {}
                        year = start_date_obj.get("year") or item.get("seasonYear")
                        month = start_date_obj.get("month")
                        day = start_date_obj.get("day")
                        release_date = ""
                        if year:
                            release_date = str(year)
                            if month:
                                release_date = f"{year}-{month:02d}"
                                if day:
                                    release_date = f"{year}-{month:02d}-{day:02d}"
                        import re
                        desc = item.get("description") or ""
                        desc = re.sub('<[^<]+?>', '', desc)
                        results.append(SearchResultItem(external_id=str(item.get("id")), title=title, image_url=image_url, description=desc, item_type="manga", release_date=release_date or None, popularity=float(item.get("averageScore") or 0)))
                    return results
        except Exception:
            pass
        return []

    @staticmethod
    def _parse_season_and_base_title(title: str):
        import re
        m = re.search(r'[\s:,-]+(?:Season|Temporada|Cour|Part|Parte)\s*(\d+)', title, re.IGNORECASE)
        if m:
            season_num = int(m.group(1))
            base_title = title[:m.start()].strip()
            return base_title, season_num

        m2 = re.search(r'[\s:,-]+(\d+)$', title)
        if m2:
            season_num = int(m2.group(1))
            base_title = title[:m2.start()].strip()
            return base_title, season_num

        return title, 1

    @staticmethod
    def get_new_anime() -> List[SearchResultItem]:
        import json, urllib.request, time, datetime, re
        url = "https://graphql.anilist.co"
        now = int(time.time())
        start_day = now - (5 * 86400) # Past 5 days
        end_day = now                 # Exclude future broadcasts (only already aired episodes)

        graphql_query = """
        query ($start: Int, $end: Int) {
          Page(page: 1, perPage: 50) {
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_DESC) {
              id
              airingAt
              episode
              media {
                id
                title {
                  romaji
                  english
                }
                coverImage {
                  large
                }
                description
                averageScore
                popularity
              }
            }
          }
        }
        """
        payload = json.dumps({
            "query": graphql_query,
            "variables": {"start": start_day, "end": end_day}
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "TrackerLists/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    schedules = data.get("data", {}).get("Page", {}).get("airingSchedules", [])
                    
                    results = []
                    seen_ids = set()
                    
                    for item in schedules:
                        media = item.get("media", {})
                        media_id = media.get("id")
                        if not media_id or media_id in seen_ids:
                            continue
                        seen_ids.add(media_id)

                        raw_title = media.get("title", {}).get("english") or media.get("title", {}).get("romaji") or "Untitled Anime"
                        base_title, season_num = AnilistService._parse_season_and_base_title(raw_title)
                        
                        cover_obj = media.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        
                        airdate = datetime.datetime.fromtimestamp(item.get("airingAt")).strftime("%Y-%m-%d")
                        ep_num = item.get("episode")
                        
                        desc = media.get("description") or ""
                        desc = re.sub('<[^<]+?>', '', desc)
                        
                        results.append(SearchResultItem(
                            external_id=f"anime_{media_id}",
                            title=base_title,
                            image_url=image_url,
                            description=desc,
                            item_type="anime",
                            release_date=airdate,
                            latest_season=season_num,
                            latest_episode=ep_num,
                            popularity=float(media.get("averageScore") or 0)
                        ))
                    return results
                    return results
        except Exception:
            pass
        return []

    @staticmethod
    def get_trending_anime() -> List[SearchResultItem]:
        url = "https://graphql.anilist.co"
        graphql_query = '''
        query {
          Page(page: 1, perPage: 15) {
            media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
              id
              title { romaji english }
              description
              coverImage { large }
              startDate { year month day }
              seasonYear
              averageScore
            }
          }
        }
        '''
        import json, urllib.request
        payload = json.dumps({"query": graphql_query}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Pathd/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media_list = data.get("data", {}).get("Page", {}).get("media", [])
                    results = []
                    for item in media_list:
                        title_obj = item.get("title", {})
                        title = title_obj.get("english") or title_obj.get("romaji") or "Untitled Anime"
                        cover_obj = item.get("coverImage", {})
                        image_url = cover_obj.get("large")
                        start_date_obj = item.get("startDate", {}) or {}
                        year = start_date_obj.get("year") or item.get("seasonYear")
                        month = start_date_obj.get("month")
                        day = start_date_obj.get("day")
                        release_date = ""
                        if year:
                            release_date = str(year)
                            if month:
                                release_date = f"{year}-{month:02d}"
                                if day:
                                    release_date = f"{year}-{month:02d}-{day:02d}"
                        import re
                        desc = item.get("description") or ""
                        desc = re.sub('<[^<]+?>', '', desc)
                        results.append(SearchResultItem(
                            external_id=f"anime_{item.get('id')}", 
                            title=title, 
                            image_url=image_url, 
                            description=desc, 
                            item_type="anime", 
                            release_date=release_date or None, 
                            popularity=float(item.get("averageScore") or 0)
                        ))
                    return results
        except Exception:
            pass
        return []

    @staticmethod
    def get_anime_detail(anime_id: str) -> dict:
        real_id = str(anime_id).replace("anime_", "").replace("anime-", "")
        url = "https://graphql.anilist.co"
        graphql_query = """
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
            }
            description
            coverImage {
              extraLarge
              large
            }
            episodes
            duration
            status
            startDate {
              year
              month
              day
            }
            nextAiringEpisode {
              episode
            }
          }
        }
        """
        import json, urllib.request, re
        payload = json.dumps({
            "query": graphql_query,
            "variables": {"id": int(real_id)}
        }).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "TrackerLists/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    media = data.get("data", {}).get("Media", {})
                    if not media:
                        return None
                    
                    raw_title = media.get("title", {}).get("english") or media.get("title", {}).get("romaji") or "Untitled Anime"
                    base_title, current_season = AnilistService._parse_season_and_base_title(raw_title)
                    
                    total_eps = media.get("episodes")
                    next_ep = media.get("nextAiringEpisode", {})
                    if not total_eps and next_ep and next_ep.get("episode"):
                        total_eps = next_ep.get("episode") - 1
                    total_eps = total_eps or 12

                    seasons = []
                    for s_idx in range(1, max(current_season + 1, 2)):
                        seasons.append({
                            "id": s_idx,
                            "season_number": s_idx,
                            "episode_count": total_eps if s_idx == current_season else 12
                        })

                    desc = media.get("description") or ""
                    desc = re.sub('<[^<]+?>', '', desc)

                    s_date = media.get("startDate", {})
                    formatted_date = None
                    if s_date.get("year"):
                        y = s_date.get("year")
                        m = s_date.get("month") or 1
                        d = s_date.get("day") or 1
                        formatted_date = f"{y}-{m:02d}-{d:02d}"

                    return {
                        "id": f"anime_{media.get('id')}",
                        "name": base_title,
                        "number_of_seasons": len(seasons),
                        "seasons": seasons,
                        "overview": desc,
                        "first_air_date": formatted_date,
                        "image_url": media.get("coverImage", {}).get("extraLarge") or media.get("coverImage", {}).get("large")
                    }
        except Exception as e:
            print("AniList get_anime_detail error:", e)
        return None

    @staticmethod
    def get_anime_episodes(anime_id: str) -> List[dict]:
        detail = AnilistService.get_anime_detail(anime_id)
        if not detail:
            return []
        
        seasons = detail.get("seasons", [])
        episodes = []
        
        for s in seasons:
            s_num = s.get("season_number", 1)
            ep_count = s.get("episode_count", 12)
            for i in range(1, ep_count + 1):
                episodes.append({
                    "id": f"{anime_id}_s{s_num}_ep_{i}",
                    "name": f"Episode {i}",
                    "episode_number": i,
                    "season_number": s_num,
                    "still_path": detail.get("image_url"),
                    "overview": f"Episodio {i} - Temporada {s_num} de {detail.get('name')}",
                    "air_date": detail.get("first_air_date")
                })
        return episodes
