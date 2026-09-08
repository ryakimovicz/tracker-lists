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
                ("auth_provider", "VARCHAR(20) DEFAULT 'local'"),
                ("category_order", "VARCHAR(200)"),
            ]
            for col_name, col_type in columns_to_add:
                if col_name not in existing_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                        logger.info(f"Auto-migration: Added column '{col_name}' to users table.")
                    except Exception as e:
                        logger.warning(f"Auto-migration: Failed to add column '{col_name}': {e}")
        
        if "user_library_items" in inspector.get_table_names():
            existing_lib_cols = {col["name"] for col in inspector.get_columns("user_library_items")}
            lib_cols_to_add = [
                ("custom_badge", "VARCHAR(50)"),
                ("last_seen_episode", "VARCHAR(250)"),
                ("pages_read", "INTEGER DEFAULT 0"),
                ("total_pages", "INTEGER"),
                ("tracking_list_id", "INTEGER"),
                ("is_hundred_percent", "BOOLEAN DEFAULT FALSE"),
            ]
            for col_name, col_type in lib_cols_to_add:
                if col_name not in existing_lib_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE user_library_items ADD COLUMN {col_name} {col_type};"))
                        logger.info(f"Auto-migration: Added column '{col_name}' to user_library_items table.")
                    except Exception as e:
                        logger.warning(f"Auto-migration: Failed to add column '{col_name}' to user_library_items: {e}")

        if "consumption_history" in inspector.get_table_names():
            existing_cons_cols = {col["name"] for col in inspector.get_columns("consumption_history")}
            if "is_hundred_percent" not in existing_cons_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE consumption_history ADD COLUMN is_hundred_percent BOOLEAN DEFAULT FALSE;"))
                    logger.info("Auto-migration: Added column 'is_hundred_percent' to consumption_history table.")
                except Exception as e:
                    logger.warning(f"Auto-migration: Failed to add column 'is_hundred_percent' to consumption_history: {e}")

        if "media_reviews" in inspector.get_table_names():
            existing_rev_cols = {col["name"] for col in inspector.get_columns("media_reviews")}
            if "parent_id" not in existing_rev_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE media_reviews ADD COLUMN parent_id INTEGER REFERENCES media_reviews(id) ON DELETE CASCADE;"))
                    logger.info("Auto-migration: Added column 'parent_id' to media_reviews table.")
                except Exception as e:
                    logger.warning(f"Auto-migration: Failed to add column 'parent_id' to media_reviews: {e}")
            if "is_edited" not in existing_rev_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE media_reviews ADD COLUMN is_edited DATETIME;"))
                    logger.info("Auto-migration: Added column 'is_edited' to media_reviews table.")
                except Exception as e:
                    logger.warning(f"Auto-migration: Failed to add column 'is_edited' to media_reviews: {e}")
            try:
                with engine.begin() as conn:
                    table_sql_res = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='media_reviews';")).fetchone()
                    if table_sql_res and "uq_user_item_review" in table_sql_res[0]:
                        conn.execute(text("PRAGMA foreign_keys=off;"))
                        conn.execute(text("""
                            CREATE TABLE media_reviews_new (
                                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                user_id INTEGER NOT NULL,
                                item_type VARCHAR(50) NOT NULL,
                                external_id VARCHAR(100) NOT NULL,
                                rating INTEGER,
                                content TEXT,
                                created_at DATETIME NOT NULL,
                                parent_id INTEGER REFERENCES media_reviews_new(id) ON DELETE CASCADE,
                                FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
                            );
                        """))
                        conn.execute(text("""
                            INSERT INTO media_reviews_new (id, user_id, item_type, external_id, rating, content, created_at, parent_id)
                            SELECT id, user_id, item_type, external_id, rating, content, created_at, parent_id FROM media_reviews;
                        """))
                        conn.execute(text("DROP TABLE media_reviews;"))
                        conn.execute(text("ALTER TABLE media_reviews_new RENAME TO media_reviews;"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_media_reviews_id ON media_reviews (id);"))
                        conn.execute(text("PRAGMA foreign_keys=on;"))
                        logger.info("Auto-migration: Rebuilt media_reviews table to drop uq_user_item_review constraint.")
            except Exception as e:
                logger.warning(f"Auto-migration: Note on dropping constraint: {e}")
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

