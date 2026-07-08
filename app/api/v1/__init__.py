from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.lists import router as lists_router
from app.api.v1.search import router as search_router
from app.api.v1.users import router as users_router
from app.api.v1.library import router as library_router
from app.api.v1.social import router as social_router
from app.api.v1.reviews import router as reviews_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(lists_router, prefix="/lists", tags=["lists"])
api_router.include_router(search_router, prefix="/search", tags=["search"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(library_router, prefix="/library", tags=["library"])
api_router.include_router(social_router, prefix="/social", tags=["social"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["reviews"])

