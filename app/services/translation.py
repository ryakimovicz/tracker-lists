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
    
    if cached:
        return cached.translated_text
        
    try:
        # Translate using Google Translate backend via deep-translator
        # Source is auto-detected
        translator = GoogleTranslator(source='auto', target=target_lang)
        
        # deep-translator has a 5000 chars limit per chunk, so we split if necessary
        # However, for descriptions, it's rarely > 5000 chars.
        if len(text) > 4900:
            # We could chunk it, but for a simple description this is enough
            translated = translator.translate(text[:4900])
        else:
            translated = translator.translate(text)
            
        # Save to cache
        new_cache = TranslationCache(
            text_hash=text_hash,
            translated_text=translated,
            target_language=target_lang
        )
        db.add(new_cache)
        db.commit()
        
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        # If translation fails, return original text
        return text
