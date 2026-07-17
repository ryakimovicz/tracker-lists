import os
from typing import List, Union
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated

def assemble_cors_origins(v: Union[str, List[str]]) -> Union[List[str], str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        return v
    raise ValueError(v)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )
    
    PROJECT_NAME: str = "Tracker Lists"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./tracker_lists.db"
    
    # Security
    SECRET_KEY: str = "change_this_to_a_very_secure_secret_key_secret_key_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: Annotated[
        List[str], BeforeValidator(assemble_cors_origins)
    ] = []
    
    # External APIs
    COMIC_VINE_API_KEY: str = ""
    TMDB_API_KEY: str = ""
    GOOGLE_BOOKS_API_KEY: str = ""
    TWITCH_CLIENT_ID: str = ""
    TWITCH_CLIENT_SECRET: str = ""
    
    # New Added APIs
    TVMAZE_API_KEY: str = ""
    OMDB_API_KEY: str = ""
    FANART_API_KEY: str = ""
    LASTFM_API_KEY: str = ""
    LASTFM_SHARED_SECRET: str = ""
    
    # SMTP Email Settings
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = ""
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@pathd.app"

settings = Settings()
