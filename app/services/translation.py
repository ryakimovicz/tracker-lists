import hashlib
from sqlalchemy.orm import Session
from deep_translator import GoogleTranslator
from app.models.translation import TranslationCache

def get_text_hash(text: str) -> str:
    """Generate a SHA-256 hash of the input text for caching."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def get_or_create_translation(db: Session, text: str, target_lang: str = 'es') -> str:
    """
    Translates text to the target language. Uses database caching to avoid redundant translation calls.
    """
    if not text or not text.strip():
        return text

    text_hash = get_text_hash(text)
    
    # Check cache first
    cached = db.query(TranslationCache).filter(
        TranslationCache.text_hash == text_hash,
        TranslationCache.target_language == target_lang
    ).first()
    
    if cached and cached.translated_text and cached.translated_text.strip() != text.strip():
        return cached.translated_text
        
    translated = ""

    # Strategy 1: clients5.google.com (Fast, reliable, doesn't hit 429)
    try:
        import urllib.request
        import urllib.parse
        import json
        clean_text = text[:4500]
        url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl={urllib.parse.quote(target_lang)}&q={urllib.parse.quote(clean_text)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=5) as res:
            if res.status == 200:
                data = json.loads(res.read().decode('utf-8'))
                if isinstance(data, list):
                    if len(data) > 0 and isinstance(data[0], list) and len(data[0]) > 0:
                        translated = data[0][0]
                    elif len(data) > 0 and isinstance(data[0], str):
                        translated = data[0]
    except Exception as e:
        pass

    # Strategy 2: deep-translator
    if not translated or translated.strip() == text.strip():
        try:
            translator = GoogleTranslator(source='auto', target=target_lang)
            translated = translator.translate(text[:4500])
        except Exception:
            pass

    # Strategy 3: translate.googleapis.com (gtx)
    if not translated or translated.strip() == text.strip():
        try:
            import urllib.request
            import urllib.parse
            import json
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={urllib.parse.quote(target_lang)}&dt=t&q={urllib.parse.quote(text[:4500])}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=5) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8'))
                    if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                        translated = "".join([part[0] for part in data[0] if part and isinstance(part, list) and len(part) > 0 and part[0]])
        except Exception:
            pass

    if not translated or translated.strip() == text.strip():
        return text

    # Save valid translation to cache (or update existing)
    try:
        if cached:
            cached.translated_text = translated
        else:
            new_cache = TranslationCache(
                text_hash=text_hash,
                translated_text=translated,
                target_language=target_lang
            )
            db.add(new_cache)
        db.commit()
    except Exception:
        db.rollback()
        
    return translated
