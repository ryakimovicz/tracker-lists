import re
import unicodedata

def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Remove accents and diacritics
    normalized = unicodedata.normalize('NFKD', text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()

# Whitelisted mainstream pop-culture titles containing ambiguous words
SFW_WHITELIST = {
    # Telenovelas and Series
    "sin tetas no hay paraiso",
    "sin senos no hay paraiso",
    "sin senos si hay paraiso",
    "sin tetas si hay paraiso",
    "sex and the city",
    "sex education",
    "the sex lives of college girls",
    "masters of sex",
    "el sexo debil",
    "the naked director",
    "naked and afraid",
    "supervivencia al desnudo",
    
    # Classic Movies & Literature
    "moby dick",
    "dick tracy",
    "philip k. dick",
    "philip k dick",
    "the naked gun",
    "sex, lies, and videotape",
    "sexo, mentiras y video",
    "the sexy brutale",
    "dick figures"
}

ADULT_PATTERNS = [
    # 1. Pornography, explicit media & adult tags
    re.compile(r'\b(porn|porno|pornos|pornography|pornographic|xxx|xxxx|x-rated|nsfw|smut|lewd)\b', re.IGNORECASE),
    re.compile(r'\b(erotic|erotica|erotico|eroticos|eroticas|erotismo|erotique)\b', re.IGNORECASE),
    re.compile(r'\b(nude|nudes|nudity|nudist|desnudo|desnuda|desnudos|desnudas)\b', re.IGNORECASE),
    re.compile(r'\b(adults?\s*only|\+18|18\+\s*(adult|only|content)?|explicit\s*content|uncensored\s*(hentai|porn|sex|patch|version)?)\b', re.IGNORECASE),
    
    # 2. Anime / Manga / Japanese adult genres
    re.compile(r'\b(hentai|eroge|ecchi|doujinshi|ahegao|netorare|ntr|oppai|yaoi|yuri)\b', re.IGNORECASE),
    re.compile(r'\b(waifu\s*sex|hentai\s*waifu|erotic\s*manga|hentai\s*manga)\b', re.IGNORECASE),
    
    # 3. Anatomy & Slang
    re.compile(r'\b(boob|boobs|boobie|boobies|tits|titties|titty|tetas|tetona|tetonas)\b', re.IGNORECASE),
    re.compile(r'\b(penis|pene|penes|vagina|vaginas|clitoris|dildo|dildos|pussy|pussies|cock|cocks|ballsack)\b', re.IGNORECASE),
    re.compile(r'\b(dick|dicks)\b', re.IGNORECASE),
    re.compile(r'\b(buttsex|anal\s*sex|culo\s*grande)\b', re.IGNORECASE),
    
    # 4. Sexual Acts & Practices
    re.compile(r'\b(blowjob|blowjobs|handjob|handjobs|footjob|deepthroat|creampie|cumshot|cumshots|ejaculat(ion|e)?)\b', re.IGNORECASE),
    re.compile(r'\b(masturbat(e|ion|ing|or)?|masturbar(se)?|masturbacion|pajas?)\b', re.IGNORECASE),
    re.compile(r'\b(orgasm|orgasms|orgasmo|orgasmos|fellatio|cunnilingus|bukkake)\b', re.IGNORECASE),
    re.compile(r'\b(gangbang|orgy|orgies|orgia|orgias|threesome|trio\s*sexual|swingers?)\b', re.IGNORECASE),
    re.compile(r'\b(milf|milfs|dilf|dilfs)\b', re.IGNORECASE),
    re.compile(r'\b(incest|incesto|taboo\s*sex)\b', re.IGNORECASE),
    re.compile(r'\b(bdsm|bondage|erotic\s*fetish|femdom|dominatrix)\b', re.IGNORECASE),
    
    # 5. Adult Entertainment & Products
    re.compile(r'\b(playboy|penthouse|hustler|onlyfans|fansly|striptease|strippers?|strip\s*club|camgirls?|sex\s*toy[s]?|sex\s*game[s]?|sex\s*simulator)\b', re.IGNORECASE),
    re.compile(r'\bsex\b', re.IGNORECASE),
]

def is_safe_text(text: str) -> bool:
    """Returns True if the text is clean and Safe For Work, False if it contains adult keywords."""
    if not text:
        return True
    
    norm = normalize_text(text)
    
    # Check whitelist first
    for allowed in SFW_WHITELIST:
        if allowed in norm:
            # If the entire search query or title matches a whitelisted mainstream item, allow it
            if norm == allowed or norm.startswith(allowed) or allowed in norm:
                # Still check if there is an explicit hardcore keyword attached (e.g. "Sex Education hentai")
                has_hardcore = any(
                    p.search(norm) for p in ADULT_PATTERNS[:2] # porn/erotic/hentai patterns
                )
                if not has_hardcore:
                    return True

    for pattern in ADULT_PATTERNS:
        if pattern.search(norm):
            return False
            
    return True

def is_safe_media_item(title: str = "", description: str = "") -> bool:
    """Verifies that both title and description are strictly Safe For Work."""
    if not is_safe_text(title):
        return False
    if description and not is_safe_text(description):
        return False
    return True
