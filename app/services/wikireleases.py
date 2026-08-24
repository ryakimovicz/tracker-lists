import urllib.request
import json
import re
import time
from typing import List, Tuple, Optional

class WikiReleasesService:
    _cached_releases: Optional[Tuple[float, List[Tuple[str, str]]]] = None
    CACHE_TTL = 3600 * 12  # 12 hours cache (1 search shared for all users)

    @classmethod
    def get_upcoming_and_recent_films(cls, days_back: int = 45, days_forward: int = 30) -> List[Tuple[str, str]]:
        """
        Fetches the official release schedule for 2026 films from Wikipedia.
        Returns a list of (title, release_date) within the requested date window,
        sorted descending by release_date.
        """
        now = time.time()
        if cls._cached_releases:
            timestamp, items = cls._cached_releases
            if now - timestamp < cls.CACHE_TTL:
                return items

        current_year = "2026"
        url = f"https://en.wikipedia.org/w/api.php?action=parse&page=List_of_American_films_of_{current_year}&prop=wikitext&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "TrackerLists/1.0 (contact@pathd.app)"})
        
        parsed_items: List[Tuple[str, str]] = []
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    text = data.get("parse", {}).get("wikitext", {}).get("*", "")
                    lines = text.split("\n")
                    
                    months_map = {
                        "JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04",
                        "MAY": "05", "JUNE": "06", "JULY": "07", "AUGUST": "08",
                        "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12"
                    }
                    
                    current_month = ""
                    current_day = ""
                    
                    for line in lines:
                        for m, m_num in months_map.items():
                            if f'aria-label="{m.capitalize()}"' in line or f'data-sort-value="{m_num}"' in line:
                                current_month = m_num
                                
                        day_match = re.search(r'\|\s*(?:rowspan="\d+"\s*style="[^"]*"\s*\|\s*)?\'\'\'(\d{1,2})\'\'\'', line)
                        if day_match:
                            current_day = f"{int(day_match.group(1)):02d}"
                            
                        title_match = re.search(r'\|\s*\'\'\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]\'\'', line)
                        if title_match and current_month and current_day:
                            raw_page_title = title_match.group(1)
                            title = title_match.group(2) or raw_page_title
                            title = re.sub(r'\s*\([^)]*\)', '', title).strip()
                            rel_date = f"{current_year}-{current_month}-{current_day}"
                            
                            # Extract crew / cast text from the table columns
                            cols = line.split("||")
                            crew_desc = ""
                            if len(cols) >= 3:
                                clean_crew = re.sub(r'\[\[(?:[^\]\|]+\|)?([^\]]+)\]\]', r'\1', cols[2])
                                clean_crew = re.sub(r'<ref[^>]*>.*?</ref>', '', clean_crew)
                                clean_crew = re.sub(r'<[^>]+>', '', clean_crew).strip()
                                if clean_crew:
                                    crew_desc = clean_crew
                                    
                            parsed_items.append((title, rel_date, raw_page_title, crew_desc))
        except Exception as e:
            print(f"Wikipedia release schedule error: {e}")

        # Filter to recent past and upcoming future relative to today
        from datetime import datetime, timedelta
        today = datetime.now().date()
        min_date = (today - timedelta(days=days_back)).strftime("%Y-%m-%d")
        max_date = (today + timedelta(days=days_forward)).strftime("%Y-%m-%d")

        filtered = [item for item in parsed_items if min_date <= item[1] <= max_date]
        # Sort descending (upcoming premiering in next days first, then latest releases)
        sorted_list = sorted(filtered or parsed_items, key=lambda x: x[1], reverse=True)

        if sorted_list:
            cls._cached_releases = (now, sorted_list)

        return sorted_list
