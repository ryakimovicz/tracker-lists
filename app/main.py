from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import engine, Base
from app.core.limiter import limiter
from app.api.v1 import api_router

from sqlalchemy import inspect, text
import logging

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

def auto_migrate_schema():
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            existing_cols = {col["name"] for col in inspector.get_columns("users")}
            columns_to_add = [
                ("custom_photo_url", "VARCHAR(500)"),
                ("custom_banner_url", "VARCHAR(500)"),
                ("custom_background_url", "VARCHAR(500)"),
                ("is_vip", "BOOLEAN DEFAULT FALSE"),
                ("pro_expires_at", "TIMESTAMP"),
                ("is_suspended", "BOOLEAN DEFAULT FALSE"),
                ("suspended_until", "TIMESTAMP"),
                ("suspension_reason", "VARCHAR(500)"),
                ("admin_warning", "VARCHAR(500)"),
                ("admin_warning_at", "TIMESTAMP"),
                ("is_verified", "BOOLEAN DEFAULT TRUE"),
                ("verification_token", "VARCHAR(250)"),
                ("dodo_subscription_id", "VARCHAR(100)"),
                ("dodo_customer_id", "VARCHAR(100)"),
                ("is_pro_cancelled", "BOOLEAN DEFAULT FALSE"),
            ]
            for col_name, col_type in columns_to_add:
                if col_name not in existing_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                        logger.info(f"Auto-migration: Added column '{col_name}' to users table.")
                    except Exception as e:
                        logger.warning(f"Auto-migration: Failed to add column '{col_name}': {e}")
    except Exception as e:
        logger.error(f"Error during schema inspection migration: {e}")

auto_migrate_schema()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware setup
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.api_route("/", methods=["GET", "HEAD", "POST", "OPTIONS"])
def root():
    return {
        "message": "Welcome to the Tracker Lists API",
        "docs_url": "/docs",
        "project": settings.PROJECT_NAME
    }

@app.api_route("/health", methods=["GET", "HEAD", "POST", "OPTIONS"])
@app.api_route(f"{settings.API_V1_STR}/health", methods=["GET", "HEAD", "POST", "OPTIONS"])
def health_check():
    return {
        "status": "healthy",
        "service": "Pathd API",
        "project": settings.PROJECT_NAME
    }

@app.get("/ping")
def ping_test():
    return {"ping": "pong"}

# Trigger uvicorn hot-reload configuration update (v7)
# Trigger uvicorn reload

