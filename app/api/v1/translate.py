from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.translation import get_or_create_translation

router = APIRouter()

class TranslationRequest(BaseModel):
    text: str
    target_language: str = "es"

class TranslationResponse(BaseModel):
    translated_text: str

@router.post("/", response_model=TranslationResponse)
def translate_text_endpoint(
    request: TranslationRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not request.text or not request.text.strip():
        return TranslationResponse(translated_text="")
        
    try:
        translated = get_or_create_translation(db, request.text, request.target_language)
        return TranslationResponse(translated_text=translated)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
