from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.lists import router as lists_router
from app.api.v1.search import router as search_router
from app.api.v1.users import router as users_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(lists_router, prefix="/lists", tags=["lists"])
api_router.include_router(search_router, prefix="/search", tags=["search"])
api_router.include_router(users_router, prefix="/users", tags=["users"])

