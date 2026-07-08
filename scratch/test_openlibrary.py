import urllib.request
import urllib.parse
import json

def test():
    query = "The Hobbit"
    encoded_query = urllib.parse.quote(query)
    url = f"https://openlibrary.org/search.json?q={encoded_query}&limit=5"
    
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "TrackerLists/1.0 (contact@trackerlists.com)"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"Status code: {response.status}")
            data = json.loads(response.read().decode())
            docs = data.get("docs", [])
            print(f"Total items found: {len(docs)}")
            for item in docs[:3]:
                print(f"Title: {item.get('title')}")
                author = item.get("author_name", ["Unknown"])[0]
                print(f"Author: {author}")
                cover_i = item.get("cover_i")
                if cover_i:
                    print(f"Cover URL: https://covers.openlibrary.org/b/id/{cover_i}-L.jpg")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
