import os
import time
import hashlib
import json
import urllib.request
import urllib.parse
import re
import unicodedata
import concurrent.futures
from typing import Optional, Dict, Any, List
from app.core.config import settings

class LastFMMeta(type):
    @property
    def API_KEY(cls) -> str:
        return os.getenv("LASTFM_API_KEY") or settings.LASTFM_API_KEY or ""

    @property
    def SHARED_SECRET(cls) -> str:
        return os.getenv("LASTFM_SHARED_SECRET") or settings.LASTFM_SHARED_SECRET or ""

class LastFMService(metaclass=LastFMMeta):
    BASE_URL = "https://ws.audioscrobbler.com/2.0/"

    @classmethod
    def get_api_key(cls) -> str:
        return os.getenv("LASTFM_API_KEY") or settings.LASTFM_API_KEY or ""

    @classmethod
    def get_shared_secret(cls) -> str:
        return os.getenv("LASTFM_SHARED_SECRET") or settings.LASTFM_SHARED_SECRET or ""

    # In-memory fast cache
    _cache_now_playing: Dict[str, tuple] = {}  # key -> (timestamp, data)
    _cache_top_albums: Dict[str, tuple] = {}   # key -> (timestamp, data)
    _cache_top_artists: Dict[str, tuple] = {}  # key -> (timestamp, data)
    _cache_top_tracks: Dict[str, tuple] = {}   # key -> (timestamp, data)

    NOW_PLAYING_TTL = 15   # 15 seconds cache for live scrobbles
    TOP_MUSIC_TTL = 300    # 5 minutes cache for top stats

    @classmethod
    def _generate_signature(cls, params: dict) -> str:
        """Generates Last.fm API signature"""
        sorted_keys = sorted([k for k in params.keys() if k != 'format' and k != 'callback'])
        sig_str = "".join([f"{k}{params[k]}" for k in sorted_keys])
        sig_str += cls.get_shared_secret()
        return hashlib.md5(sig_str.encode('utf-8')).hexdigest()

    @classmethod
    def get_auth_url(cls, token: str = None) -> str:
        """Returns the URL the user should be redirected to for authorization"""
        return f"https://www.last.fm/api/auth/?api_key={cls.get_api_key()}&cb=http://localhost:5173/profile"

    @classmethod
    def get_session(cls, token: str) -> Optional[Dict[str, Any]]:
        """Exchanges an authorized request token for a Last.fm Web Services session key"""
        api_key = cls.get_api_key()
        shared_secret = cls.get_shared_secret()
        if not api_key or not shared_secret:
            return None

        params = {
            "method": "auth.getSession",
            "api_key": api_key,
            "token": token
        }
        params["api_sig"] = cls._generate_signature(params)
        params["format"] = "json"

        query_string = urllib.parse.urlencode(params)
        url = f"{cls.BASE_URL}?{query_string}"

        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    if "session" in data:
                        return {
                            "name": data["session"]["name"],
                            "key": data["session"]["key"]
                        }
        except Exception as e:
            print(f"LastFM Auth Error: {e}")
        return None

    @classmethod
    def get_now_playing(cls, username: str) -> Optional[Dict[str, Any]]:
        """Gets the currently playing or most recently scrobbled track with caching"""
        if not cls.API_KEY or not username:
            return None

        cache_key = username.strip().lower()
        now = time.time()
        if cache_key in cls._cache_now_playing:
            cached_time, cached_data = cls._cache_now_playing[cache_key]
            if now - cached_time < cls.NOW_PLAYING_TTL:
                return cached_data

        params = {
            "method": "user.getRecentTracks",
            "user": username,
            "api_key": cls.API_KEY,
            "limit": "1",
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    tracks = data.get("recenttracks", {}).get("track", [])
                    if isinstance(tracks, dict):
                        tracks = [tracks]
                    elif not isinstance(tracks, list):
                        tracks = []

                    if tracks:
                        track = tracks[0]
                        is_playing = track.get("@attr", {}).get("nowplaying", "false") == "true"
                        
                        image = ""
                        for img in track.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        result = {
                            "name": track.get("name"),
                            "artist": track.get("artist", {}).get("#text") if isinstance(track.get("artist"), dict) else str(track.get("artist") or ""),
                            "album": track.get("album", {}).get("#text") if isinstance(track.get("album"), dict) else str(track.get("album") or ""),
                            "image": image,
                            "is_playing": is_playing,
                            "url": track.get("url")
                        }
                        cls._cache_now_playing[cache_key] = (now, result)
                        return result
        except Exception as e:
            print(f"LastFM NowPlaying Error for {username}: {e}")
            if cache_key in cls._cache_now_playing:
                return cls._cache_now_playing[cache_key][1]
        return None

    # Image enrichment cache: query -> image_url
    _cache_artist_images: Dict[str, str] = {}
    _cache_track_images: Dict[str, str] = {}
    _cache_album_images: Dict[str, str] = {}

    @classmethod
    def _is_placeholder_or_empty(cls, img_url: Optional[str]) -> bool:
        """Returns True if the image URL is empty or LastFM/Deezer's generic placeholder star/asset"""
        if not img_url or not isinstance(img_url, str) or not img_url.strip():
            return True
        # Known Last.fm placeholder hash & Deezer empty MD5 placeholder & generic defaults
        if ("2a96cbd8b46e442fc41c2b86b821562f" in img_url or 
            "d41d8cd98f00b204e9800998ecf8427e" in img_url or 
            "default_album" in img_url or 
            "default_artist" in img_url):
            return True
        return False

    _cache_artist_deezer: Dict[str, tuple] = {} # artist_clean -> (timestamp, deezer_artist_dict)
    _cache_lfm_artist_tracks: Dict[str, tuple] = {} # artist_clean -> (timestamp, list_of_tracks)

    @classmethod
    def _get_lastfm_artist_top_tracks(cls, artist_name: str) -> List[str]:
        """Fetches top tracks from Last.fm to cross-reference against Deezer candidates with caching and accent fallback"""
        if not cls.API_KEY or not artist_name:
            return []
        key = artist_name.strip().lower()
        now = time.time()
        if key in cls._cache_lfm_artist_tracks:
            ts, data = cls._cache_lfm_artist_tracks[key]
            if now - ts < cls.DISCO_TTL:
                return data

        tracks = []
        clean_target = artist_name.strip()
        names_to_try = [clean_target]
        unacc = cls._strip_acc(clean_target)
        if unacc and unacc != clean_target:
            names_to_try.append(unacc)

        for name_candidate in names_to_try:
            try:
                params = {
                    "method": "artist.getTopTracks",
                    "artist": name_candidate,
                    "api_key": cls.API_KEY,
                    "limit": "8",
                    "format": "json",
                    "autocorrect": "1"
                }
                url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
                headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=4.5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode('utf-8', errors='replace'))
                        raw_tracks = data.get("toptracks", {}).get("track", [])
                        tracks = [t.get("name") for t in raw_tracks if t.get("name")]
                        if tracks:
                            break
            except Exception:
                pass

        cls._cache_lfm_artist_tracks[key] = (now, tracks)
        return tracks

    @classmethod
    def _fetch_itunes_artwork(cls, artist_name: str, item_name: str = "") -> str:
        """Fetches high-res artwork from iTunes API as fallback"""
        try:
            import re
            import unicodedata
            def strip_acc(s):
                return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")
            norm_target = re.sub(r'[^a-zA-Z0-9]', '', strip_acc(artist_name)).lower()

            search_terms = []
            if item_name:
                search_terms.append(f"{artist_name} {item_name}")
            else:
                lfm_tracks = cls._get_lastfm_artist_top_tracks(artist_name)
                for trk in lfm_tracks[:3]:
                    clean_t = re.sub(r'\(.*?\)', '', trk).strip()
                    search_terms.append(f"{artist_name} {clean_t}")
                search_terms.append(artist_name)

            for term in search_terms:
                q = urllib.parse.quote(term)
                req = urllib.request.Request(f"https://itunes.apple.com/search?term={q}&entity=song&limit=5", headers={"User-Agent": "PathdApp/1.0"})
                with urllib.request.urlopen(req, timeout=3.5) as res:
                    if res.status == 200:
                        data = json.loads(res.read().decode('utf-8', errors='replace'))
                        for s in data.get("results", []):
                            cand_art = re.sub(r'[^a-zA-Z0-9]', '', strip_acc(s.get("artistName", ""))).lower()
                            if cand_art == norm_target or (len(norm_target) >= 4 and (norm_target in cand_art or cand_art in norm_target)):
                                artwork = s.get("artworkUrl100", "")
                                if artwork:
                                    return artwork.replace("100x100bb", "600x600bb")
        except Exception:
            pass
        return ""

    @classmethod
    def _resolve_deezer_artist(cls, artist_name: str) -> Optional[Dict[str, Any]]:
        """Resolves the exact Deezer artist by comparing Deezer catalog tracks/albums against Last.fm top tracks"""
        if not artist_name:
            return None
        key = artist_name.strip().lower()
        now = time.time()
        if key in cls._cache_artist_deezer:
            ts, cached_artist = cls._cache_artist_deezer[key]
            if now - ts < cls.DISCO_TTL:
                return cached_artist

        try:
            import re
            import unicodedata
            def strip_acc(s):
                return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")

            clean_name = artist_name.strip()
            norm_clean = strip_acc(clean_name).strip()
            norm_target = re.sub(r'[^a-zA-Z0-9]', '', norm_clean).lower()
            q = urllib.parse.quote(clean_name)
            url = f"https://api.deezer.com/search/artist?q={q}&limit=15"
            headers = {"User-Agent": "PathdApp/1.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3.5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    raw_candidates = data.get("data", [])

                    lfm_tracks = cls._get_lastfm_artist_top_tracks(artist_name)
                    def clean_trk(t):
                        t_no_paren = re.sub(r'\(.*?\)', '', t or '')
                        return re.sub(r'[^a-zA-Z0-9]', '', strip_acc(t_no_paren)).lower()
                    lfm_tracks_norm = [clean_trk(t) for t in lfm_tracks if clean_trk(t)]

                    # Also query tracks with top tracks to uncover hidden artist IDs in Deezer
                    if lfm_tracks:
                        for trk_title in lfm_tracks[:3]:
                            clean_t_title = re.sub(r'\(.*?\)', '', trk_title).strip()
                            tq = urllib.parse.quote(f"{clean_name} {clean_t_title}")
                            try:
                                treq = urllib.request.Request(f"https://api.deezer.com/search/track?q={tq}&limit=5", headers={"User-Agent": "PathdApp/1.0"})
                                with urllib.request.urlopen(treq, timeout=2.5) as tres:
                                    if tres.status == 200:
                                        tdata = json.loads(tres.read().decode('utf-8', errors='replace'))
                                        for t_item in tdata.get("data", []):
                                            if t_item.get("artist"):
                                                raw_candidates.append(t_item["artist"])
                            except Exception:
                                pass

                    if not raw_candidates:
                        return None

                    # Deduplicate candidates by ID, preserving nb_fan / nb_album / pictures
                    candidates_dict: Dict[int, Dict[str, Any]] = {}
                    for c in raw_candidates:
                        cid = c.get("id")
                        if not cid:
                            continue
                        if cid not in candidates_dict:
                            candidates_dict[cid] = dict(c)
                        else:
                            for field in ["nb_fan", "nb_album", "picture_xl", "picture_big", "picture_medium"]:
                                if c.get(field) and not candidates_dict[cid].get(field):
                                    candidates_dict[cid][field] = c[field]

                    candidates = list(candidates_dict.values())

                    # Filter candidates whose name without accents is exact match or exact word match
                    viable = []
                    for c in candidates:
                        c_clean = strip_acc(c.get("name", "")).strip()
                        c_norm = re.sub(r'[^a-zA-Z0-9]', '', c_clean).lower()
                        if c_clean.lower() == norm_clean.lower() or c_norm == norm_target:
                            viable.append(c)
                        elif len(norm_target) >= 4 and (c_clean.lower().startswith(norm_clean.lower()) or norm_clean.lower().startswith(c_clean.lower())):
                            viable.append(c)

                    if not viable:
                        viable = [c for c in candidates if re.sub(r'[^a-zA-Z0-9]', '', strip_acc(c.get("name", ""))).lower() == norm_target]

                    if not viable and raw_candidates:
                        viable = raw_candidates[:5]

                    if not viable:
                        return None

                    # Parallel check for candidate tracks and complete metadata
                    def evaluate_candidate(cand):
                        cand_id = cand.get("id")
                        cand_name = cand.get("name", "")
                        cand_clean = strip_acc(cand_name).strip()
                        cand_name_norm = re.sub(r'[^a-zA-Z0-9]', '', cand_clean).lower()
                        is_exact = 1 if (cand_clean.lower() == norm_clean.lower() or cand_name_norm == norm_target) else 0
                        has_exact_accents = 1 if cand_name.strip() == clean_name else 0

                        overlap = 0
                        full_artist_info = dict(cand)
                        if cand_id:
                            # 1. Check top track overlap against Last.fm top tracks
                            if lfm_tracks_norm:
                                try:
                                    treq = urllib.request.Request(f"https://api.deezer.com/artist/{cand_id}/top?limit=15", headers={"User-Agent": "PathdApp/1.0"})
                                    with urllib.request.urlopen(treq, timeout=2.5) as tres:
                                        td = json.loads(tres.read().decode('utf-8', errors='replace'))
                                        deezer_tracks = [clean_trk(t.get("title", "")) for t in td.get("data", [])]
                                        for lt in lfm_tracks_norm:
                                            if any(lt == dt or (len(lt) >= 4 and (lt in dt or dt in lt)) for dt in deezer_tracks if dt):
                                                overlap += 1
                                except Exception:
                                    pass

                            # 2. Fetch full artist info if nb_fan or high-res pictures are missing
                            if full_artist_info.get("nb_fan") is None or not full_artist_info.get("picture_xl"):
                                try:
                                    areq = urllib.request.Request(f"https://api.deezer.com/artist/{cand_id}", headers={"User-Agent": "PathdApp/1.0"})
                                    with urllib.request.urlopen(areq, timeout=2.5) as ares:
                                        ad = json.loads(ares.read().decode('utf-8', errors='replace'))
                                        for k, v in ad.items():
                                            if v is not None:
                                                full_artist_info[k] = v
                                except Exception:
                                    pass

                        fans = full_artist_info.get("nb_fan") or cand.get("nb_fan") or 0
                        nb_albums = full_artist_info.get("nb_album") or cand.get("nb_album") or 0
                        return (overlap, has_exact_accents, is_exact, fans, nb_albums, full_artist_info)

                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                        scored = list(pool.map(evaluate_candidate, viable[:8]))

                    scored.sort(key=lambda x: (x[0], x[1], x[2], x[3], x[4]), reverse=True)
                    winner = scored[0][5]
                    cls._cache_artist_deezer[key] = (now, winner)
                    return winner
        except Exception:
            pass
        return None

    @classmethod
    def _fetch_artist_image(cls, artist_name: str) -> str:
        """Fetches artist picture from Deezer API with song/album cross-referencing and popularity verification, falling back to iTunes"""
        if not artist_name:
            return ""
        key = artist_name.strip().lower()
        if key in cls._cache_artist_images:
            return cls._cache_artist_images[key]

        matched_artist = cls._resolve_deezer_artist(artist_name)
        if matched_artist:
            img = matched_artist.get("picture_xl") or matched_artist.get("picture_big") or matched_artist.get("picture_medium") or ""
            if not cls._is_placeholder_or_empty(img):
                cls._cache_artist_images[key] = img
                return img

        # Fallback to iTunes artwork
        itunes_img = cls._fetch_itunes_artwork(artist_name)
        if itunes_img and not cls._is_placeholder_or_empty(itunes_img):
            cls._cache_artist_images[key] = itunes_img
            return itunes_img

        cls._cache_artist_images[key] = ""
        return ""

    @classmethod
    def _fetch_track_image(cls, track_name: str, artist_name: str) -> str:
        """Fetches track cover artwork (from its album) via Deezer API with multi-candidate artist matching and iTunes fallback"""
        if not track_name:
            return ""
        query_str = f"{artist_name} {track_name}".strip() if artist_name else track_name.strip()
        key = query_str.lower()
        if key in cls._cache_track_images:
            return cls._cache_track_images[key]
        try:
            import re
            norm_artist = re.sub(r'[^a-zA-Z0-9]', '', artist_name).lower() if artist_name else ""
            norm_track = re.sub(r'[^a-zA-Z0-9]', '', track_name).lower()

            q = urllib.parse.quote(query_str)
            url = f"https://api.deezer.com/search/track?q={q}&limit=5"
            headers = {"User-Agent": "PathdApp/1.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3.5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    tracks = data.get("data", [])
                    if tracks:
                        matched_track = None
                        if norm_artist:
                            for trk in tracks:
                                cand_art = re.sub(r'[^a-zA-Z0-9]', '', trk.get("artist", {}).get("name", "")).lower()
                                if cand_art == norm_artist or norm_artist in cand_art or cand_art in norm_artist:
                                    matched_track = trk
                                    break
                        if not matched_track:
                            matched_track = tracks[0]

                        album = matched_track.get("album", {})
                        img = album.get("cover_xl") or album.get("cover_big") or album.get("cover_medium") or ""
                        if img and not cls._is_placeholder_or_empty(img):
                            cls._cache_track_images[key] = img
                            return img
        except Exception:
            pass

        # Fallback to iTunes artwork
        itunes_img = cls._fetch_itunes_artwork(artist_name, track_name)
        if itunes_img and not cls._is_placeholder_or_empty(itunes_img):
            cls._cache_track_images[key] = itunes_img
            return itunes_img

        cls._cache_track_images[key] = ""
        return ""

    @classmethod
    def _fetch_album_image(cls, album_name: str, artist_name: str) -> str:
        """Fetches album cover artwork from Deezer API with multi-candidate artist matching and iTunes fallback"""
        if not album_name:
            return ""
        query_str = f"{artist_name} {album_name}".strip() if artist_name else album_name.strip()
        key = query_str.lower()
        if key in cls._cache_album_images:
            return cls._cache_album_images[key]
        try:
            import re
            norm_artist = re.sub(r'[^a-zA-Z0-9]', '', artist_name).lower() if artist_name else ""
            norm_album = re.sub(r'[^a-zA-Z0-9]', '', album_name).lower()

            q = urllib.parse.quote(query_str)
            url = f"https://api.deezer.com/search/album?q={q}&limit=5"
            headers = {"User-Agent": "PathdApp/1.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3.5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    albums = data.get("data", [])
                    if albums:
                        matched_album = None
                        if norm_artist:
                            for alb in albums:
                                cand_art = re.sub(r'[^a-zA-Z0-9]', '', alb.get("artist", {}).get("name", "")).lower()
                                if cand_art == norm_artist or norm_artist in cand_art or cand_art in norm_artist:
                                    matched_album = alb
                                    break
                        if not matched_album:
                            matched_album = albums[0]

                        img = matched_album.get("cover_xl") or matched_album.get("cover_big") or matched_album.get("cover_medium") or ""
                        if img and not cls._is_placeholder_or_empty(img):
                            cls._cache_album_images[key] = img
                            return img
        except Exception:
            pass

        # Fallback to iTunes artwork
        itunes_img = cls._fetch_itunes_artwork(artist_name, album_name)
        if itunes_img and not cls._is_placeholder_or_empty(itunes_img):
            cls._cache_album_images[key] = itunes_img
            return itunes_img

        cls._cache_album_images[key] = ""
        return ""

    @classmethod
    def get_top_albums(cls, username: str, period: str = "7day", limit: int = 10, enrich_images: bool = True) -> List[Dict[str, Any]]:
        """Gets the user's top albums for a given period (7day, 1month, overall)"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}_{enrich_images}"
        now = time.time()
        if cache_key in cls._cache_top_albums:
            cached_time, cached_data = cls._cache_top_albums[cache_key]
            if now - cached_time < cls.TOP_MUSIC_TTL:
                return cached_data

        params = {
            "method": "user.getTopAlbums",
            "user": username,
            "api_key": cls.API_KEY,
            "period": period_clean,
            "limit": str(limit),
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        
        albums = []
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    raw_albums = data.get("topalbums", {}).get("album", [])
                    if isinstance(raw_albums, dict):
                        raw_albums = [raw_albums]
                    elif not isinstance(raw_albums, list):
                        raw_albums = []

                    def enrich_one_album(album):
                        image = ""
                        for img in album.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        if cls._is_placeholder_or_empty(image):
                            image = ""

                        album_name = album.get("name", "")
                        artist_name = album.get("artist", {}).get("name", "") if isinstance(album.get("artist"), dict) else str(album.get("artist") or "")
                        if enrich_images and not image and album_name:
                            try:
                                enriched_img = cls._fetch_album_image(album_name, artist_name)
                                if enriched_img and not cls._is_placeholder_or_empty(enriched_img):
                                    image = enriched_img
                            except Exception:
                                pass

                        return {
                            "name": album_name,
                            "artist": artist_name,
                            "playcount": album.get("playcount"),
                            "image": image if not cls._is_placeholder_or_empty(image) else "",
                            "url": album.get("url")
                        }

                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                        albums = list(pool.map(enrich_one_album, raw_albums[:limit]))

                    cls._cache_top_albums[cache_key] = (now, albums)
                    return albums
        except Exception as e:
            print(f"LastFM TopAlbums Error for {username}: {e}")
            if cache_key in cls._cache_top_albums:
                return cls._cache_top_albums[cache_key][1]
        return albums

    @classmethod
    def get_top_artists(cls, username: str, period: str = "7day", limit: int = 10, enrich_images: bool = True) -> List[Dict[str, Any]]:
        """Gets the user's top artists for a given period (7day, 1month, overall) with fallback image enrichment"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}_{enrich_images}"
        now = time.time()
        if cache_key in cls._cache_top_artists:
            cached_time, cached_data = cls._cache_top_artists[cache_key]
            if now - cached_time < cls.TOP_MUSIC_TTL:
                return cached_data

        params = {
            "method": "user.getTopArtists",
            "user": username,
            "api_key": cls.API_KEY,
            "period": period_clean,
            "limit": str(limit),
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        
        artists = []
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    raw_artists = data.get("topartists", {}).get("artist", [])
                    if isinstance(raw_artists, dict):
                        raw_artists = [raw_artists]
                    elif not isinstance(raw_artists, list):
                        raw_artists = []

                    def enrich_one_artist(artist):
                        image = ""
                        for img in artist.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        if cls._is_placeholder_or_empty(image):
                            image = ""

                        artist_name = artist.get("name", "")
                        if enrich_images and not image and artist_name:
                            try:
                                enriched_img = cls._fetch_artist_image(artist_name)
                                if enriched_img and not cls._is_placeholder_or_empty(enriched_img):
                                    image = enriched_img
                            except Exception:
                                pass

                        return {
                            "name": artist_name,
                            "playcount": artist.get("playcount"),
                            "image": image if not cls._is_placeholder_or_empty(image) else "",
                            "url": artist.get("url")
                        }

                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                        artists = list(pool.map(enrich_one_artist, raw_artists[:limit]))

                    cls._cache_top_artists[cache_key] = (now, artists)
                    return artists
        except Exception as e:
            print(f"LastFM TopArtists Error for {username}: {e}")
            if cache_key in cls._cache_top_artists:
                return cls._cache_top_artists[cache_key][1]
        return artists

    @classmethod
    def get_top_tracks(cls, username: str, period: str = "7day", limit: int = 10, enrich_images: bool = True) -> List[Dict[str, Any]]:
        """Gets the user's top tracks for a given period (7day, 1month, overall) with fallback image enrichment"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}_{enrich_images}"
        now = time.time()
        if cache_key in cls._cache_top_tracks:
            cached_time, cached_data = cls._cache_top_tracks[cache_key]
            if now - cached_time < cls.TOP_MUSIC_TTL:
                return cached_data

        params = {
            "method": "user.getTopTracks",
            "user": username,
            "api_key": cls.API_KEY,
            "period": period_clean,
            "limit": str(limit),
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        
        tracks = []
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    raw_tracks = data.get("toptracks", {}).get("track", [])
                    if isinstance(raw_tracks, dict):
                        raw_tracks = [raw_tracks]
                    elif not isinstance(raw_tracks, list):
                        raw_tracks = []

                    def enrich_one_track(track):
                        image = ""
                        for img in track.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        if cls._is_placeholder_or_empty(image):
                            image = ""

                        track_name = track.get("name", "")
                        artist_name = track.get("artist", {}).get("name", "") if isinstance(track.get("artist"), dict) else str(track.get("artist") or "")

                        if enrich_images and not image and track_name:
                            try:
                                enriched_img = cls._fetch_track_image(track_name, artist_name)
                                if enriched_img and not cls._is_placeholder_or_empty(enriched_img):
                                    image = enriched_img
                            except Exception:
                                pass

                        return {
                            "name": track_name,
                            "artist": artist_name,
                            "playcount": track.get("playcount"),
                            "image": image if not cls._is_placeholder_or_empty(image) else "",
                            "url": track.get("url")
                        }

                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                        tracks = list(pool.map(enrich_one_track, raw_tracks[:limit]))

                    cls._cache_top_tracks[cache_key] = (now, tracks)
                    return tracks
        except Exception as e:
            print(f"LastFM TopTracks Error for {username}: {e}")
            if cache_key in cls._cache_top_tracks:
                return cls._cache_top_tracks[cache_key][1]
        return tracks

    _cache_music_details: Dict[str, tuple] = {} # key -> (timestamp, data)
    DETAILS_TTL = 3600 # 1 hour cache

    @staticmethod
    def _strip_acc(text: str) -> str:
        if not text:
            return ""
        return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').strip()

    @staticmethod
    def _clean_album_title(title: str) -> str:
        if not title:
            return ""
        cleaned = re.sub(r'[\(\[\{].*?(remaster|deluxe|edition|anniversary|expanded|bonus|live|version|special|re-issue|explicit|clean).*?[\)\]\}]', '', title, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned or title

    @classmethod
    def _clean_wiki(cls, text: Optional[str]) -> str:
        if not text:
            return ""
        import re
        # Remove HTML tags and trailing Last.fm links like <a href="...">Read more on Last.fm</a>
        cleaned = re.sub(r'<a\s+[^>]*>.*?</a>', '', text, flags=re.IGNORECASE)
        cleaned = re.sub(r'<[^>]+>', '', cleaned)
        return cleaned.strip()

    @classmethod
    def _get_wikipedia_summary(cls, artist_name: str) -> str:
        """Fetches artist bio summary from Wikipedia if Last.fm bio is empty or generic"""
        if not artist_name:
            return ""
        for lang in ["es", "en"]:
            for cand in [artist_name, f"{artist_name} (rapero)", f"{artist_name} (cantante)", f"{artist_name} (músico)", f"{artist_name} (banda)"]:
                try:
                    q = urllib.parse.quote(cand)
                    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{q}"
                    req = urllib.request.Request(url, headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                    with urllib.request.urlopen(req, timeout=3) as res:
                        if res.status == 200:
                            d = json.loads(res.read().decode('utf-8', errors='replace'))
                            extract = d.get("extract")
                            if extract and len(extract) > 40:
                                return extract.strip()
                except Exception:
                    pass
            # Search via API
            try:
                q = urllib.parse.quote(artist_name)
                url = f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json"
                req = urllib.request.Request(url, headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                with urllib.request.urlopen(req, timeout=3) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode('utf-8', errors='replace'))
                        results = d.get("query", {}).get("search", [])
                        for r in results[:3]:
                            title = r.get("title")
                            if not title:
                                continue
                            t_q = urllib.parse.quote(title)
                            s_url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{t_q}"
                            s_req = urllib.request.Request(s_url, headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                            try:
                                with urllib.request.urlopen(s_req, timeout=3) as s_res:
                                    if s_res.status == 200:
                                        s_d = json.loads(s_res.read().decode('utf-8', errors='replace'))
                                        extract = s_d.get("extract")
                                        if extract and any(k in extract.lower() for k in ["rapero", "cantante", "músic", "álbum", "disco", "cancion", "band", "artist", "singer", "rapper", "mc"]):
                                            return extract.strip()
                            except Exception:
                                pass
            except Exception:
                pass
        return ""

    @classmethod
    def _get_lastfm_top_albums_discography(cls, artist_name: str) -> List[Dict[str, Any]]:
        """Fetches top albums from Last.fm as discography fallback"""
        if not cls.API_KEY or not artist_name:
            return []
        try:
            params = {
                "method": "artist.getTopAlbums",
                "artist": artist_name.strip(),
                "api_key": cls.API_KEY,
                "format": "json",
                "limit": "50"
            }
            url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
            headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as res:
                if res.status == 200:
                    d = json.loads(res.read().decode('utf-8', errors='replace'))
                    albums = d.get("topalbums", {}).get("album", [])
                    results = []
                    seen = set()
                    for alb in albums:
                        title = alb.get("name", "").strip()
                        if not title or title.lower() in seen or title.lower() == "(null)":
                            continue
                        seen.add(title.lower())
                        img = ""
                        for i in alb.get("image", []):
                            if i.get("size") in ("extralarge", "large"):
                                img = i.get("#text")
                        if cls._is_placeholder_or_empty(img):
                            img = ""
                        if not img:
                            try:
                                enriched_img = cls._fetch_album_image(title, artist_name)
                                if enriched_img and not cls._is_placeholder_or_empty(enriched_img):
                                    img = enriched_img
                            except Exception:
                                pass
                        results.append({
                            "title": title,
                            "record_type": "album",
                            "release_date": "",
                            "year": "",
                            "cover": img if not cls._is_placeholder_or_empty(img) else ""
                        })
                    return results
        except Exception:
            pass
        return []

    _cache_discography: Dict[str, tuple] = {} # key -> (timestamp, list)
    DISCO_TTL = 3600 # 1 hour

    @classmethod
    def get_artist_discography(cls, artist_name: str) -> List[Dict[str, Any]]:
        """Fetches full discography (albums, singles, eps, compilations) for an artist, sorted with newest first"""
        if not artist_name:
            return []
        cache_key = artist_name.strip().lower()
        now = time.time()
        if cache_key in cls._cache_discography:
            ts, data = cls._cache_discography[cache_key]
            if now - ts < cls.DISCO_TTL:
                return data

        results = []
        try:
            matched_artist = cls._resolve_deezer_artist(artist_name)
            if matched_artist and matched_artist.get("id"):
                artist_id = matched_artist["id"]
                req_alb = urllib.request.Request(f"https://api.deezer.com/artist/{artist_id}/albums?limit=100", headers={"User-Agent": "PathdApp/1.0"})
                with urllib.request.urlopen(req_alb, timeout=5) as a_res:
                    if a_res.status == 200:
                        alb_data = json.loads(a_res.read().decode('utf-8', errors='replace'))
                        raw_albums = alb_data.get("data", [])
                        seen_titles = set()
                        for a in raw_albums:
                            title = a.get("title", "").strip()
                            title_norm = title.lower()
                            if title_norm in seen_titles:
                                continue
                            seen_titles.add(title_norm)

                            rec_type = a.get("record_type", "album")
                            cover = a.get("cover_xl") or a.get("cover_big") or a.get("cover_medium") or ""
                            if cls._is_placeholder_or_empty(cover):
                                cover = ""
                            release_date = a.get("release_date") or ""
                            year = release_date.split("-")[0] if release_date else ""

                            results.append({
                                "title": title,
                                "record_type": rec_type,
                                "release_date": release_date,
                                "year": year,
                                "cover": cover
                            })

                        # Sort newest first by release_date
                        results.sort(key=lambda x: x["release_date"] or "", reverse=True)
        except Exception as e:
            print(f"Error fetching Deezer discography for {artist_name}: {e}")

        # If Deezer returned no albums (or Deezer artist catalog is empty), fallback to Last.fm top albums
        if not results:
            results = cls._get_lastfm_top_albums_discography(artist_name)

        # Cross-reference with iTunes catalog to correct re-issue/upload dates (e.g. 2016 Deezer re-upload -> 2006 true release)
        itunes_date_map = {}
        try:
            q = urllib.parse.quote(artist_name)
            req = urllib.request.Request(f"https://itunes.apple.com/search?term={q}&entity=album&limit=100", headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
            with urllib.request.urlopen(req, timeout=3) as res:
                if res.status == 200:
                    d = json.loads(res.read().decode('utf-8'))
                    for item in d.get("results", []):
                        raw_col = (item.get("collectionName") or "").strip()
                        clean_col = cls._clean_album_title(raw_col)
                        r_date = (item.get("releaseDate") or "")[:10]
                        if r_date:
                            if raw_col:
                                itunes_date_map[cls._strip_acc(raw_col.lower())] = r_date
                            if clean_col:
                                itunes_date_map[cls._strip_acc(clean_col.lower())] = r_date
        except Exception:
            pass

        for alb in results:
            t_raw = cls._strip_acc(alb["title"].strip().lower())
            t_clean = cls._strip_acc(cls._clean_album_title(alb["title"]).strip().lower())
            
            matched_date = ""
            if t_raw in itunes_date_map:
                matched_date = itunes_date_map[t_raw]
            elif t_clean in itunes_date_map:
                matched_date = itunes_date_map[t_clean]
            else:
                for k, v in itunes_date_map.items():
                    if t_clean and (t_clean in k or k in t_clean):
                        matched_date = v
                        break

            if matched_date:
                if not alb["release_date"] or matched_date < alb["release_date"]:
                    alb["release_date"] = matched_date
                    alb["year"] = matched_date.split("-")[0]

        # Multi-source concurrent deep resolution for accurate historical dates
        def _resolve_item_date(alb_dict):
            try:
                info = cls.get_album_release_info(artist_name, alb_dict["title"])
                if info.get("year") and info.get("release_date"):
                    if not alb_dict.get("release_date") or info["release_date"] < alb_dict["release_date"]:
                        alb_dict["release_date"] = info["release_date"]
                        alb_dict["year"] = info["year"]
            except Exception:
                pass

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
                list(ex.map(_resolve_item_date, results))
        except Exception:
            pass

        # Re-sort newest first by corrected release_date
        results.sort(key=lambda x: x["release_date"] or "", reverse=True)

        cls._cache_discography[cache_key] = (now, results)
        return results

    _cache_album_release_info: Dict[str, Dict[str, str]] = {}
    _cache_album_years: Dict[str, str] = {}

    @classmethod
    def get_album_release_info(cls, artist_name: str, album_name: str) -> Dict[str, str]:
        """Fetches accurate original release year and date prioritizing authentic historical release dates across MusicBrainz, iTunes and Deezer"""
        if not album_name:
            return {"year": "", "release_date": ""}
        cache_key = f"{artist_name.strip().lower()}_{album_name.strip().lower()}"
        if cache_key in cls._cache_album_release_info:
            return cls._cache_album_release_info[cache_key]

        clean_alb = cls._clean_album_title(album_name)
        norm_clean = cls._strip_acc(clean_alb.lower())
        norm_orig = cls._strip_acc(album_name.lower())

        def _fetch_itunes() -> Optional[str]:
            try:
                q = urllib.parse.quote(f"{artist_name} {clean_alb}".strip())
                req = urllib.request.Request(f"https://itunes.apple.com/search?term={q}&entity=album&limit=10", headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                with urllib.request.urlopen(req, timeout=2.5) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode('utf-8'))
                        for item in d.get("results", []):
                            col = cls._strip_acc(cls._clean_album_title(item.get("collectionName") or "").lower())
                            if norm_clean == col or norm_clean in col or col in norm_clean:
                                r_date = (item.get("releaseDate") or "")[:10]
                                if r_date:
                                    return r_date
            except Exception:
                pass
            return None

        def _fetch_musicbrainz() -> Optional[str]:
            try:
                q = urllib.parse.quote(f'artist:"{artist_name}" AND (releasegroup:"{clean_alb}" OR release:"{clean_alb}")')
                url = f'https://musicbrainz.org/ws/2/release-group?query={q}&fmt=json&limit=5'
                req = urllib.request.Request(url, headers={'User-Agent': 'PathdApp/1.0 (contact@pathd.net)'})
                with urllib.request.urlopen(req, timeout=2.5) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode('utf-8'))
                        for rg in d.get('release-groups', []):
                            rg_t = cls._strip_acc(cls._clean_album_title(rg.get('title', '')).lower())
                            if norm_clean == rg_t or norm_clean in rg_t or rg_t in norm_clean:
                                d_str = rg.get('first-release-date')
                                if d_str:
                                    return d_str
            except Exception:
                pass
            return None

        def _fetch_deezer() -> Optional[str]:
            try:
                q = urllib.parse.quote(f"{artist_name} {album_name}".strip())
                req = urllib.request.Request(f"https://api.deezer.com/search/album?q={q}&limit=5", headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                with urllib.request.urlopen(req, timeout=2.5) as res:
                    if res.status == 200:
                        d = json.loads(res.read().decode('utf-8'))
                        for itm in d.get("data", []):
                            t_norm = cls._strip_acc(cls._clean_album_title(itm.get("title", "")).lower())
                            if norm_clean == t_norm or norm_clean in t_norm or t_norm in norm_clean or norm_orig in t_norm:
                                alb_id = itm.get("id")
                                if alb_id:
                                    req2 = urllib.request.Request(f"https://api.deezer.com/album/{alb_id}", headers={"User-Agent": "PathdApp/1.0 (contact@pathd.net)"})
                                    with urllib.request.urlopen(req2, timeout=2.5) as res2:
                                        d2 = json.loads(res2.read().decode('utf-8'))
                                        rel_date = (d2.get("release_date") or "")[:10]
                                        if rel_date and rel_date != "0000-00-00":
                                            return rel_date
                                break
            except Exception:
                pass
            return None

        found_dates = []
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                f_itunes = executor.submit(_fetch_itunes)
                f_mb = executor.submit(_fetch_musicbrainz)
                f_deezer = executor.submit(_fetch_deezer)

                for f in [f_itunes, f_mb, f_deezer]:
                    try:
                        res = f.result(timeout=3.0)
                        if res:
                            found_dates.append(res)
                    except Exception:
                        pass
        except Exception:
            pass

        # Parse valid dates and extract the earliest historical release
        valid_dates = []
        for d in found_dates:
            m = re.match(r'^(19\d\d|20\d\d)(?:-(\d{2}))?(?:-(\d{2}))?', d)
            if m:
                yr = int(m.group(1))
                if 1920 <= yr <= 2030:
                    valid_dates.append((yr, d))

        if not valid_dates:
            cls._cache_album_release_info[cache_key] = {"year": "", "release_date": ""}
            return {"year": "", "release_date": ""}

        # Sort chronologically to pick the earliest authentic master release date
        valid_dates.sort(key=lambda x: x[1])
        earliest = valid_dates[0]
        yr_str = str(earliest[0])
        raw_date = earliest[1]

        if len(raw_date) == 4:
            full_date = f"{yr_str}-01-01"
        elif len(raw_date) == 7:
            full_date = f"{raw_date}-01"
        else:
            full_date = raw_date

        info = {"year": yr_str, "release_date": full_date}
        cls._cache_album_release_info[cache_key] = info
        return info

    @classmethod
    def get_album_release_year(cls, artist_name: str, album_name: str) -> str:
        return cls.get_album_release_info(artist_name, album_name).get("year", "")

    @classmethod
    def get_artist_details(cls, artist_name: str) -> Optional[Dict[str, Any]]:
        if not cls.API_KEY or not artist_name:
            return None
        cache_key = f"artist_{artist_name.strip().lower()}"
        now = time.time()
        if cache_key in cls._cache_music_details:
            ts, data = cls._cache_music_details[cache_key]
            if now - ts < cls.DETAILS_TTL:
                return data

        params = {
            "method": "artist.getInfo",
            "artist": artist_name.strip(),
            "api_key": cls.API_KEY,
            "format": "json",
            "autocorrect": "1"
        }
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    artist = data.get("artist", {})
                    if artist:
                        name = artist.get("name", artist_name)
                        image = ""
                        for img in artist.get("image", []):
                            if img.get("size") in ("mega", "extralarge", "large"):
                                image = img.get("#text")
                        if cls._is_placeholder_or_empty(image):
                            image = cls._fetch_artist_image(name)

                        bio_obj = artist.get("bio", {})
                        bio = cls._clean_wiki(bio_obj.get("content") or bio_obj.get("summary"))
                        # If Last.fm bio is empty or generic placeholder, try Wikipedia
                        if not bio or len(bio) < 10 or "Read more on Last.fm" in bio:
                            wiki_bio = cls._get_wikipedia_summary(name)
                            if wiki_bio:
                                bio = wiki_bio

                        tags = [t.get("name") for t in artist.get("tags", {}).get("tag", []) if t.get("name")]
                        stats = artist.get("stats", {})

                        # Fetch artist releases with corrected original release dates
                        discography = cls.get_artist_discography(name)

                        result = {
                            "type": "artist",
                            "name": name,
                            "artist": name,
                            "image": image,
                            "bio": bio,
                            "tags": tags,
                            "listeners": stats.get("listeners"),
                            "playcount": stats.get("playcount"),
                            "discography": discography
                        }
                        cls._cache_music_details[cache_key] = (now, result)
                        return result
        except Exception as e:
            print(f"Error fetching artist details for {artist_name}: {e}")
        return None

    @classmethod
    def get_album_details(cls, artist_name: str, album_name: str) -> Optional[Dict[str, Any]]:
        if not cls.API_KEY or not album_name:
            return None
        cache_key = f"album_{artist_name.strip().lower()}_{album_name.strip().lower()}"
        now = time.time()
        if cache_key in cls._cache_music_details:
            ts, data = cls._cache_music_details[cache_key]
            if now - ts < cls.DETAILS_TTL:
                return data

        params = {
            "method": "album.getInfo",
            "artist": artist_name.strip() if artist_name else "",
            "album": album_name.strip(),
            "api_key": cls.API_KEY,
            "format": "json",
            "autocorrect": "1"
        }
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    album = data.get("album", {})
                    if album:
                        name = album.get("name", album_name)
                        artist = album.get("artist", artist_name)
                        image = ""
                        for img in album.get("image", []):
                            if img.get("size") in ("mega", "extralarge", "large"):
                                image = img.get("#text")
                        if cls._is_placeholder_or_empty(image):
                            image = cls._fetch_album_image(name, artist)

                        wiki = cls._clean_wiki(album.get("wiki", {}).get("summary"))
                        tags = [t.get("name") for t in album.get("tags", {}).get("tag", []) if t.get("name")]
                        raw_tracks = album.get("tracks", {}).get("track", [])
                        if isinstance(raw_tracks, dict):
                            raw_tracks = [raw_tracks]
                        tracks = []
                        for trk in raw_tracks:
                            tracks.append({
                                "name": trk.get("name"),
                                "duration": trk.get("duration"),
                                "rank": trk.get("@attr", {}).get("rank")
                            })

                        # Release year and release date resolution
                        rel_info = cls.get_album_release_info(artist, name)
                        year = rel_info.get("year", "")
                        release_date = rel_info.get("release_date", "")

                        if not release_date and album.get("wiki", {}).get("published"):
                            release_date = album.get("wiki", {}).get("published")
                        if not year and release_date:
                            import re
                            m = re.search(r'\b(19\d\d|20\d\d)\b', release_date)
                            if m:
                                year = m.group(1)

                        result = {
                            "type": "album",
                            "name": name,
                            "artist": artist,
                            "image": image,
                            "bio": wiki,
                            "tags": tags,
                            "release_date": release_date,
                            "year": year,
                            "listeners": album.get("listeners"),
                            "playcount": album.get("playcount"),
                            "tracks": tracks
                        }
                        cls._cache_music_details[cache_key] = (now, result)
                        return result
        except Exception as e:
            print(f"Error fetching album details for {album_name}: {e}")
        return None

    @classmethod
    def get_track_details(cls, artist_name: str, track_name: str) -> Optional[Dict[str, Any]]:
        if not cls.API_KEY or not track_name:
            return None
        cache_key = f"track_{artist_name.strip().lower()}_{track_name.strip().lower()}"
        now = time.time()
        if cache_key in cls._cache_music_details:
            ts, data = cls._cache_music_details[cache_key]
            if now - ts < cls.DETAILS_TTL:
                return data

        params = {
            "method": "track.getInfo",
            "artist": artist_name.strip() if artist_name else "",
            "track": track_name.strip(),
            "api_key": cls.API_KEY,
            "format": "json",
            "autocorrect": "1"
        }
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    track = data.get("track", {})
                    if track:
                        name = track.get("name", track_name)
                        artist = track.get("artist", {}).get("name", artist_name)
                        album_obj = track.get("album", {})
                        album_title = album_obj.get("title")
                        image = ""
                        for img in album_obj.get("image", []):
                            if img.get("size") in ("mega", "extralarge", "large"):
                                image = img.get("#text")
                        if cls._is_placeholder_or_empty(image):
                            image = cls._fetch_track_image(name, artist)

                        wiki = cls._clean_wiki(track.get("wiki", {}).get("summary"))
                        tags = [t.get("name") for t in track.get("toptags", {}).get("tag", []) if t.get("name")]

                        result = {
                            "type": "track",
                            "name": name,
                            "artist": artist,
                            "album": album_title,
                            "image": image,
                            "bio": wiki,
                            "tags": tags,
                            "duration": track.get("duration"),
                            "listeners": track.get("listeners"),
                            "playcount": track.get("playcount")
                        }
                        cls._cache_music_details[cache_key] = (now, result)
                        return result
        except Exception as e:
            print(f"Error fetching track details for {track_name}: {e}")
        return None

    _cache_user_playcount: Dict[str, tuple] = {} # key -> (timestamp, playcount)
    USER_PLAYCOUNT_TTL = 300 # 5 minutes cache

    @classmethod
    def get_user_item_playcount(cls, lastfm_username: str, item_type: str, artist_name: str, item_name: str = "") -> int:
        """Gets the exact playcount of a user for a specific artist, album, or track"""
        if not cls.API_KEY or not lastfm_username:
            return 0
        cache_key = f"pc_{lastfm_username.lower()}_{item_type}_{artist_name.lower()}_{item_name.lower()}"
        now = time.time()
        if cache_key in cls._cache_user_playcount:
            ts, pc = cls._cache_user_playcount[cache_key]
            if now - ts < cls.USER_PLAYCOUNT_TTL:
                return pc

        params: Dict[str, str] = {
            "api_key": cls.API_KEY,
            "format": "json",
            "autocorrect": "1",
            "username": lastfm_username.strip()
        }

        if item_type == "artist":
            params["method"] = "artist.getInfo"
            params["artist"] = artist_name.strip()
        elif item_type == "album":
            params["method"] = "album.getInfo"
            params["artist"] = artist_name.strip()
            params["album"] = item_name.strip()
        elif item_type == "track":
            params["method"] = "track.getInfo"
            params["artist"] = artist_name.strip()
            params["track"] = item_name.strip()
        else:
            return 0

        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": "PathdApp/1.0 (https://pathd.net)"}
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8', errors='replace'))
                    count_val = 0
                    if item_type == "artist":
                        count_val = int(data.get("artist", {}).get("stats", {}).get("userplaycount") or 0)
                    elif item_type == "album":
                        count_val = int(data.get("album", {}).get("userplaycount") or 0)
                    elif item_type == "track":
                        count_val = int(data.get("track", {}).get("userplaycount") or 0)
                    cls._cache_user_playcount[cache_key] = (now, count_val)
                    return count_val
        except Exception:
            pass
        return 0
