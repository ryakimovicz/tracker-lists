from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList
from app.models.saved_list import SavedList
from app.schemas.user import UserResponse, UserDashboardResponse

router = APIRouter()

@router.get("/me", response_model=UserDashboardResponse)
def get_user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch lists created by the user
    created_lists = db.query(ReadingList).filter(
        ReadingList.creator_id == current_user.id
    ).all()
    
    # Fetch lists saved/followed by the user
    saved_lists = db.query(ReadingList).join(
        SavedList, SavedList.list_id == ReadingList.id
    ).filter(
        SavedList.user_id == current_user.id
    ).all()
    
    return UserDashboardResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        created_lists=created_lists,
        saved_lists=saved_lists
    )

@router.get("/search", response_model=List[UserResponse])
def search_users(
    q: str = Query(..., min_length=1, description="Username search query"),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    # Perform case-insensitive search using lower() and LIKE
    search_pattern = f"%{q.lower()}%"
    users = db.query(User).filter(
        User.username.like(search_pattern)
    ).offset(skip).limit(limit).all()
    return users
