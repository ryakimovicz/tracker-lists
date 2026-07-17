from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import engine, Base
from app.core.limiter import limiter
from app.api.v1 import api_router

# Create tables automatically for development.
# In production, migrations with Alembic are preferred.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(api_router, prefix=settings.API_V1_STR)


# CORS Middleware setup
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/")
def root():
    return {
        "message": "Welcome to the Tracker Lists API",
        "docs_url": "/docs",
        "project": settings.PROJECT_NAME
    }
# Trigger uvicorn hot-reload configuration update (v7)
# Trigger uvicorn reload

