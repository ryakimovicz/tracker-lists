import re
import unicodedata

def normalize_text(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize('NFKD', text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()

# Explicit Hardcore Acts, Commercial Adult Services & Pornographic Products.
# (Checked on Title, Description, and Categories)
HARDCORE_EXPLICIT_PATTERNS = [
    # 1. Hardcore Acts & Explicit Tags
    re.compile(r'(?<!magna\s)(?<!summa\s)\b(cum|cumming|cums|cumshot|cumshots|creampie|creampies|blowjob|blowjobs|handjob|handjobs|deepthroat|bukkake|gangbang)\b(?!\s*laude)', re.IGNORECASE),
    re.compile(r'\b(anal\s*sex|buttsex|interracial\s*porn|hardcore\s*porn)\b', re.IGNORECASE),
    re.compile(r'\b(uncensored\s*(hentai|porn|sex|patch|version)|waifu\s*sex|hentai\s*waifu)\b', re.IGNORECASE),
    
    # 2. Commercial Adult Platforms & Products
    re.compile(r'\b(onlyfans|fansly|camgirls?|sex\s*toy[s]?|sex\s*game[s]?|sex\s*simulator)\b', re.IGNORECASE),
    re.compile(r'\b(porn\s*(video|movie|star|site|tube|hub|game)|porno\s*(video|film|game|estrella|sitio))\b', re.IGNORECASE),
    re.compile(r'\b(playboy\s*channel|playboy\s*tv|playboy\s*mansion|penthouse\s*magazine|penthouse\s*tv|hustler\s*club|hustler\s*tv)\b', re.IGNORECASE),
    
    # 3. Adult Video Game / Manga Subgenres & Hentai Terms
    re.compile(r'\b(hentai|eroge|eromanga|ero-manga|doujinshi|ahegao|netorare|oppai|nakadashi|fakku)\b', re.IGNORECASE),
    re.compile(r'\b(xxx|xxxx|x-rated|nsfw)\b', re.IGNORECASE),
]

# Strict Commercial Genre Markers (Applied to Titles / User Queries / Metadata Categories)
STRICT_GENRE_PATTERNS = [
    re.compile(r'\b(pornography|pornographic|smut|lewd)\b', re.IGNORECASE),
    re.compile(r'\b(adults?\s*only|\+18|18\+\s*(adult|only|content)|explicit\s*content)\b', re.IGNORECASE),
]

def is_safe_text(text: str, is_description: bool = False) -> bool:
    """
    Returns True if the text is free of explicit adult/pornographic content.
    If is_description is True, allows descriptive words (like mentioning 'pornography') 
    while strictly filtering actual hardcore acts and adult products.
    """
    if not text:
        return True
    
    norm = normalize_text(text)
    for pattern in HARDCORE_EXPLICIT_PATTERNS:
        if pattern.search(norm):
            return False
            
    if not is_description:
        for pattern in STRICT_GENRE_PATTERNS:
            if pattern.search(norm):
                return False
            
    return True

def is_safe_media_item(title: str = "", description: str = "", categories: list = None) -> bool:
    """
    Structural verification for media items:
    Checks title, description, and API category metadata.
    """
    if not is_safe_text(title, is_description=False):
        return False
    if description and not is_safe_text(description, is_description=True):
        return False
    if categories:
        for cat in categories:
            cat_lower = str(cat).lower()
            if any(term in cat_lower for term in ("hentai", "pornography", "hardcore", "doujinshi")):
                return False
    return True
