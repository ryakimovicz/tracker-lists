import re
import unicodedata

def normalize_text(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize('NFKD', text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()

# Industry-standard explicit genres, adult entertainment terms, and pornographic tags.
# Common words (like 'dick', 'naked', 'sex', 'boob') are avoided so legitimate cultural works 
# (e.g. 'Moby Dick', 'Sin tetas no hay paraiso', 'Sex Education') work naturally without manual whitelists.
EXPLICIT_ADULT_PATTERNS = [
    # 1. Commercial Pornography & Adult Media Tags
    re.compile(r'\b(porn|porno|pornos|pornography|pornographic|xxx|xxxx|x-rated|nsfw|smut|lewd)\b', re.IGNORECASE),
    re.compile(r'\b(adults?\s*only|\+18|18\+\s*(adult|only|content)|explicit\s*content|uncensored\s*(hentai|porn|sex|patch|version))\b', re.IGNORECASE),
    
    # 2. Anime / Manga Adult Sub-genres & Erotic Terms
    re.compile(r'\b(hentai|eroge|ecchi|doujinshi|ahegao|netorare|oppai)\b', re.IGNORECASE),
    re.compile(r'\b(waifu\s*sex|hentai\s*waifu|erotic\s*manga|hentai\s*manga)\b', re.IGNORECASE),
    
    # 3. Explicit Hardcore Acts & Commercial Adult Brands
    re.compile(r'\b(blowjob|blowjobs|handjob|handjobs|deepthroat|creampie|cumshot|cumshots|bukkake|gangbang)\b', re.IGNORECASE),
    re.compile(r'\b(onlyfans|fansly|striptease|camgirls?|sex\s*toy[s]?|sex\s*game[s]?|sex\s*simulator)\b', re.IGNORECASE),
    re.compile(r'\b(playboy\s*channel|playboy\s*tv|playboy\s*mansion|penthouse\s*magazine|penthouse\s*tv|hustler\s*club|hustler\s*tv)\b', re.IGNORECASE),
    re.compile(r'\b(anal\s*sex|buttsex|interracial\s*porn)\b', re.IGNORECASE),
]

def is_safe_text(text: str) -> bool:
    """
    Returns True if the text is free of explicit adult/pornographic genre markers.
    False if it matches recognized commercial adult entertainment or pornography terms.
    """
    if not text:
        return True
    
    norm = normalize_text(text)
    for pattern in EXPLICIT_ADULT_PATTERNS:
        if pattern.search(norm):
            return False
            
    return True

def is_safe_media_item(title: str = "", description: str = "", categories: list = None) -> bool:
    """
    Structural verification for media items:
    Checks title, description, and API category metadata.
    """
    if not is_safe_text(title):
        return False
    if description and not is_safe_text(description):
        return False
    if categories:
        for cat in categories:
            cat_lower = str(cat).lower()
            if any(term in cat_lower for term in ("erotica", "erotic", "hentai", "porn", "adult")):
                return False
    return True
