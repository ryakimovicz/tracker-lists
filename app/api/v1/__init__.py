from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.lists import router as lists_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(lists_router, prefix="/lists", tags=["lists"])
