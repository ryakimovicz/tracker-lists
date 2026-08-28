from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import engine, Base
from app.core.limiter import limiter
from app.api.v1 import api_router

from sqlalchemy import text
Base.metadata.create_all(bind=engine)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN custom_photo_url VARCHAR(500);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN custom_banner_url VARCHAR(500);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN custom_background_url VARCHAR(500);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT 0;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN pro_expires_at TIMESTAMP;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_suspended BOOLEAN DEFAULT 0;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN suspended_until TIMESTAMP;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN suspension_reason VARCHAR(500);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN admin_warning VARCHAR(500);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN admin_warning_at TIMESTAMP;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE;"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR(250);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN dodo_subscription_id VARCHAR(100);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN dodo_customer_id VARCHAR(100);"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_pro_cancelled BOOLEAN DEFAULT FALSE;"))
        conn.commit()
    except Exception:
        pass





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

