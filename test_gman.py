import urllib.request, json
from app.services.igdb import IGDBService
from app.core.config import settings

token = IGDBService._get_access_token()

def test_query(endpoint, body):
    req = urllib.request.Request(
        f"https://api.igdb.com/v4/{endpoint}",
        data=body.encode('utf-8'),
        headers={'Client-ID': settings.TWITCH_CLIENT_ID, 'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("1. Find games matching 'half-life':")
games = test_query("games", 'search "half-life"; fields id, name; limit 4;')
game_ids = [str(g['id']) for g in games]
print("Games found:", games)

if game_ids:
    print("\n2. Find characters from those games:")
    body_chars = f'where games = ({",".join(game_ids)}); fields id, name, mug_shot.image_id, games.name; limit 15;'
    chars = test_query("characters", body_chars)
    for c in chars:
        print(f" - {c['name']} (Image: {bool(c.get('mug_shot'))}) - Games: {[g.get('name') for g in c.get('games', [])]}")
