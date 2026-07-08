import urllib.request
import urllib.parse
import json

def test():
    query = "The Hobbit"
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&maxResults=5"
    
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status code: {response.status}")
            data = json.loads(response.read().decode())
            print(f"Total items found: {len(data.get('items', []))}")
            for item in data.get("items", [])[:2]:
                vol = item.get("volumeInfo", {})
                print(f"Title: {vol.get('title')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
