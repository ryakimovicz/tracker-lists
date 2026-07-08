from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/search", response_model=List[UserResponse])
def search_users(
    q: str = Query(..., min_length=1, description="Username search query"),
    db: Session = Depends(get_db)
):
    # Perform case-insensitive search using lower() and LIKE
    search_pattern = f"%{q.lower()}%"
    users = db.query(User).filter(
        User.username.like(search_pattern)
    ).all()
    return users
