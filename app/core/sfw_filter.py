import re

ADULT_PATTERNS = [
    re.compile(r'\bhentai\b', re.IGNORECASE),
    re.compile(r'\beroge\b', re.IGNORECASE),
    re.compile(r'\bporn(o|ography|ographic)?\b', re.IGNORECASE),
    re.compile(r'\bxxx\b', re.IGNORECASE),
    re.compile(r'\bnude[s]?\b', re.IGNORECASE),
    re.compile(r'\bnudity\b', re.IGNORECASE),
    re.compile(r'\berotic[a]?\b', re.IGNORECASE),
    re.compile(r'\bdoujinshi\b', re.IGNORECASE),
    re.compile(r'\blewd\b', re.IGNORECASE),
    re.compile(r'\bnsfw\b', re.IGNORECASE),
    re.compile(r'\bsex\b', re.IGNORECASE),
    re.compile(r'\bwaifu\s*sex\b', re.IGNORECASE),
    re.compile(r'\byaoi\b', re.IGNORECASE),
    re.compile(r'\becchi\b', re.IGNORECASE),
    re.compile(r'\badult\s*(game|content|video|film|movie|manga|comic|visual\s*novel|scene)[s]?\b', re.IGNORECASE),
    re.compile(r'\b18\+\s*(adult|content|only)?\b', re.IGNORECASE),
    re.compile(r'\bboobs\b', re.IGNORECASE),
    re.compile(r'\bmilf\b', re.IGNORECASE),
    re.compile(r'\bblowjob\b', re.IGNORECASE),
    re.compile(r'\bgangbang\b', re.IGNORECASE),
    re.compile(r'\buncensored\s*(hentai|porn|sex|adult|patch)?\b', re.IGNORECASE),
]

def is_safe_text(text: str) -> bool:
    """Returns True if the text is clean and Safe For Work, False if it contains adult keywords."""
    if not text:
        return True
    for pattern in ADULT_PATTERNS:
        if pattern.search(text):
            return False
    return True

def is_safe_media_item(title: str = "", description: str = "") -> bool:
    """Verifies that both title and description are strictly Safe For Work."""
    if not is_safe_text(title):
        return False
    if description and not is_safe_text(description):
        return False
    return True
