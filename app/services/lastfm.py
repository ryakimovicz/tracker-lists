import os
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

    @classmethod
    def _generate_signature(cls, params: dict) -> str:
        """Generates Last.fm API signature"""
        # Sort keys alphabetically and concatenate key+value
        sorted_keys = sorted([k for k in params.keys() if k != 'format' and k != 'callback'])
        sig_str = "".join([f"{k}{params[k]}" for k in sorted_keys])
        sig_str += cls.SHARED_SECRET
        return hashlib.md5(sig_str.encode('utf-8')).hexdigest()

    @classmethod
    def get_auth_url(cls, token: str = None) -> str:
        """Returns the URL the user should be redirected to for authorization"""
        return f"http://www.last.fm/api/auth/?api_key={cls.API_KEY}&cb=http://localhost:5173/profile"

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
        """Gets the currently playing or most recently scrobbled track"""
        if not cls.API_KEY or not username:
            return None

        params = {
            "method": "user.getRecentTracks",
            "user": username,
            "api_key": cls.API_KEY,
            "limit": "1",
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    tracks = data.get("recenttracks", {}).get("track", [])
                    if tracks:
                        track = tracks[0]
                        # Check if it's currently playing
                        is_playing = track.get("@attr", {}).get("nowplaying", "false") == "true"
                        
                        image = ""
                        for img in track.get("image", []):
                            if img.get("size") == "extralarge" or img.get("size") == "large":
                                image = img.get("#text")
                        
                        return {
                            "name": track.get("name"),
                            "artist": track.get("artist", {}).get("#text"),
                            "album": track.get("album", {}).get("#text"),
                            "image": image,
                            "is_playing": is_playing,
                            "url": track.get("url")
                        }
        except Exception as e:
            print(f"LastFM NowPlaying Error: {e}")
        return None

    @classmethod
    def get_top_albums(cls, username: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Gets the user's top albums for the last 7 days"""
        if not cls.API_KEY or not username:
            return []

        params = {
            "method": "user.getTopAlbums",
            "user": username,
            "api_key": cls.API_KEY,
            "period": "7day",
            "limit": str(limit),
            "format": "json"
        }
        
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        
        albums = []
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
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
        except Exception as e:
            print(f"LastFM TopAlbums Error: {e}")
        return albums
