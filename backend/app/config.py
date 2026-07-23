"""Application configuration via environment variables (12-factor).

All tunables live here so the rest of the codebase never reads ``os.environ``
directly. Values are validated once at import time by pydantic-settings.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["synthetic", "upstox", "dhan", "angelone", "shoonya"]


class Settings(BaseSettings):
    """Typed, validated runtime settings.

    Unknown env vars are ignored so the same ``.env`` can be shared with the
    frontend / infra tooling without breaking startup.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- provider selection ---
    data_provider: ProviderName = "synthetic"

    # --- credentials (only the active provider's are required) ---
    upstox_api_key: str = ""
    upstox_api_secret: str = ""
    upstox_access_token: str = ""

    dhan_client_id: str = ""
    dhan_access_token: str = ""

    angelone_api_key: str = ""
    angelone_client_code: str = ""
    angelone_password: str = ""
    angelone_totp_secret: str = ""

    shoonya_user_id: str = ""
    shoonya_password: str = ""
    shoonya_api_key: str = ""
    shoonya_totp_secret: str = ""

    news_api_key: str = ""

    # --- infrastructure ---
    database_url: str = "sqlite+pysqlite:///./screener.db"
    redis_url: str = ""
    celery_broker_url: str = ""

    # --- alerts ---
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""

    # --- scan tuning ---
    universe_limit: int = Field(default=200, ge=0)
    history_days: int = Field(default=400, ge=120)
    max_concurrency: int = Field(default=16, ge=1, le=128)
    cache_ttl_seconds: int = Field(default=900, ge=0)
    log_level: str = "INFO"

    @property
    def redis_enabled(self) -> bool:
        return bool(self.redis_url)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()
