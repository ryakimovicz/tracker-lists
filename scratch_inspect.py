import json
import urllib.request
from app.services.igdb import IGDBService
from app.core.config import settings

token = IGDBService._get_access_token()
body = 'fields id, name, category, game_type, parent_game, version_parent; where id = (501, 112659, 26041, 21704, 27862, 19563, 11133);'
req = urllib.request.Request(
    "https://api.igdb.com/v4/games",
    data=body.encode("utf-8"),
    headers={
        "Client-ID": settings.TWITCH_CLIENT_ID,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    for d in data:
        print(f"ID: {d.get('id')} | game_type: {d.get('game_type')} | Name: {d.get('name')}")
