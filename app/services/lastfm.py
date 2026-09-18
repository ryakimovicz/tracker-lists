import os
import time
import hashlib
import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List
from app.core.config import settings

class LastFMService:
    API_KEY = settings.LASTFM_API_KEY
    SHARED_SECRET = settings.LASTFM_SHARED_SECRET
    BASE_URL = "http://ws.audioscrobbler.com/2.0/"

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
        sig_str += cls.SHARED_SECRET
        return hashlib.md5(sig_str.encode('utf-8')).hexdigest()

    @classmethod
    def get_auth_url(cls, token: str = None) -> str:
        """Returns the URL the user should be redirected to for authorization"""
        return f"https://www.last.fm/api/auth/?api_key={cls.API_KEY}&cb=http://localhost:5173/profile"

    @classmethod
    def get_session(cls, token: str) -> Optional[Dict[str, str]]:
        """Exchanges an auth token for a session key"""
        params = {
            "method": "auth.getSession",
            "api_key": cls.API_KEY,
            "token": token
        }
        params["api_sig"] = cls._generate_signature(params)
        params["format"] = "json"

        query_string = urllib.parse.urlencode(params)
        url = f"{cls.BASE_URL}?{query_string}"

        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
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
                    data = json.loads(response.read().decode())
                    tracks = data.get("recenttracks", {}).get("track", [])
                    if tracks:
                        track = tracks[0]
                        is_playing = track.get("@attr", {}).get("nowplaying", "false") == "true"
                        
                        image = ""
                        for img in track.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        result = {
                            "name": track.get("name"),
                            "artist": track.get("artist", {}).get("#text"),
                            "album": track.get("album", {}).get("#text"),
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

    @classmethod
    def get_top_albums(cls, username: str, period: str = "7day", limit: int = 10) -> List[Dict[str, Any]]:
        """Gets the user's top albums for a given period (7day, 1month, overall)"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}"
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
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    top_albums = data.get("topalbums", {}).get("album", [])
                    for album in top_albums:
                        image = ""
                        for img in album.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        albums.append({
                            "name": album.get("name"),
                            "artist": album.get("artist", {}).get("name"),
                            "playcount": album.get("playcount"),
                            "image": image,
                            "url": album.get("url")
                        })
                    cls._cache_top_albums[cache_key] = (now, albums)
                    return albums
        except Exception as e:
            print(f"LastFM TopAlbums Error for {username}: {e}")
            if cache_key in cls._cache_top_albums:
                return cls._cache_top_albums[cache_key][1]
        return albums

    # Image enrichment cache: query -> image_url
    _cache_artist_images: Dict[str, str] = {}
    _cache_track_images: Dict[str, str] = {}

    @classmethod
    def _fetch_artist_image(cls, artist_name: str) -> str:
        """Fetches artist picture from Deezer API as fallback"""
        if not artist_name:
            return ""
        key = artist_name.strip().lower()
        if key in cls._cache_artist_images:
            return cls._cache_artist_images[key]
        try:
            q = urllib.parse.quote(artist_name.strip())
            url = f"https://api.deezer.com/search/artist?q={q}&limit=1"
            headers = {"User-Agent": "PathdApp/1.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    artists = data.get("data", [])
                    if artists:
                        img = artists[0].get("picture_xl") or artists[0].get("picture_big") or artists[0].get("picture_medium") or ""
                        cls._cache_artist_images[key] = img
                        return img
        except Exception:
            pass
        cls._cache_artist_images[key] = ""
        return ""

    @classmethod
    def _fetch_track_image(cls, track_name: str, artist_name: str) -> str:
        """Fetches track cover artwork from Deezer API as fallback"""
        if not track_name:
            return ""
        query_str = f"{artist_name} {track_name}".strip() if artist_name else track_name.strip()
        key = query_str.lower()
        if key in cls._cache_track_images:
            return cls._cache_track_images[key]
        try:
            q = urllib.parse.quote(query_str)
            url = f"https://api.deezer.com/search/track?q={q}&limit=1"
            headers = {"User-Agent": "PathdApp/1.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    tracks = data.get("data", [])
                    if tracks:
                        album = tracks[0].get("album", {})
                        img = album.get("cover_xl") or album.get("cover_big") or album.get("cover_medium") or ""
                        cls._cache_track_images[key] = img
                        return img
        except Exception:
            pass
        cls._cache_track_images[key] = ""
        return ""

    @classmethod
    def get_top_artists(cls, username: str, period: str = "7day", limit: int = 10) -> List[Dict[str, Any]]:
        """Gets the user's top artists for a given period (7day, 1month, overall) with fallback image enrichment"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}"
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
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    top_artists = data.get("topartists", {}).get("artist", [])
                    for artist in top_artists:
                        image = ""
                        for img in artist.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        artist_name = artist.get("name", "")
                        # Enrich image if LastFM provided empty image
                        if not image and artist_name:
                            image = cls._fetch_artist_image(artist_name)

                        artists.append({
                            "name": artist_name,
                            "playcount": artist.get("playcount"),
                            "image": image,
                            "url": artist.get("url")
                        })
                    cls._cache_top_artists[cache_key] = (now, artists)
                    return artists
        except Exception as e:
            print(f"LastFM TopArtists Error for {username}: {e}")
            if cache_key in cls._cache_top_artists:
                return cls._cache_top_artists[cache_key][1]
        return artists

    @classmethod
    def get_top_tracks(cls, username: str, period: str = "7day", limit: int = 10) -> List[Dict[str, Any]]:
        """Gets the user's top tracks for a given period (7day, 1month, overall) with fallback image enrichment"""
        if not cls.API_KEY or not username:
            return []

        valid_periods = {"7day", "1month", "overall"}
        period_clean = period if period in valid_periods else "7day"
        cache_key = f"{username.strip().lower()}_{period_clean}_{limit}"
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
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    top_tracks = data.get("toptracks", {}).get("track", [])
                    for track in top_tracks:
                        image = ""
                        for img in track.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        track_name = track.get("name", "")
                        artist_name = track.get("artist", {}).get("name", "")

                        # Enrich image if LastFM provided empty image
                        if not image and track_name:
                            image = cls._fetch_track_image(track_name, artist_name)

                        tracks.append({
                            "name": track_name,
                            "artist": artist_name,
                            "playcount": track.get("playcount"),
                            "image": image,
                            "url": track.get("url")
                        })
                    cls._cache_top_tracks[cache_key] = (now, tracks)
                    return tracks
        except Exception as e:
            print(f"LastFM TopTracks Error for {username}: {e}")
            if cache_key in cls._cache_top_tracks:
                return cls._cache_top_tracks[cache_key][1]
        return tracks
