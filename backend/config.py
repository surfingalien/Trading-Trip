from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "FinSight API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "https://surfingalien.github.io,http://localhost:5173"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://finsight:finsight@localhost:5432/finsight"
    DATABASE_SYNC_URL: str = "postgresql://finsight:finsight@localhost:5432/finsight"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_7D: int = 21600      # 6h
    CACHE_TTL_30D: int = 86400     # 24h
    CACHE_TTL_90D: int = 86400     # 24h
    CACHE_TTL_PRICES: int = 60
    CACHE_TTL_REGIME: int = 300

    # Data providers
    FINNHUB_API_KEY: Optional[str] = None
    POLYGON_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_KEY: Optional[str] = None

    # ML
    MODEL_DIR: str = "backend/ml/models"
    MLFLOW_TRACKING_URI: str = "sqlite:///mlflow.db"
    RETRAIN_SCHEDULE: str = "0 2 * * 0"  # weekly Sunday 2am

    # Typesense (optional — falls back to PG if absent)
    TYPESENSE_HOST: Optional[str] = None
    TYPESENSE_PORT: int = 8108
    TYPESENSE_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
