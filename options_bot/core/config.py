"""Configuration manager for the trading bot."""

import os
from pathlib import Path
from typing import Any, Optional

import yaml
from dotenv import load_dotenv


class ConfigManager:
    """Singleton configuration manager that loads from YAML and .env files."""

    _instance: Optional["ConfigManager"] = None
    _config: dict = {}

    def __new__(cls, config_path: str = "config.yaml"):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def __init__(self, config_path: str = "config.yaml"):
        if self._loaded:
            return
        self._config_path = config_path
        self._load()
        self._loaded = True

    def _load(self):
        """Load configuration from YAML file and .env."""
        # Load .env file
        env_path = Path(self._config_path).parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)

        # Load YAML config
        config_file = Path(self._config_path)
        if config_file.exists():
            with open(config_file, "r") as f:
                self._config = yaml.safe_load(f) or {}
        else:
            self._config = {}

        # Override with environment variables
        self._apply_env_overrides()

    def _apply_env_overrides(self):
        """Override config values with environment variables."""
        env_mappings = {
            "ZERODHA_API_KEY": "broker.zerodha.api_key",
            "ZERODHA_API_SECRET": "broker.zerodha.api_secret",
            "ZERODHA_ACCESS_TOKEN": "broker.zerodha.access_token",
            "ANGEL_API_KEY": "broker.angel_one.api_key",
            "ANGEL_CLIENT_ID": "broker.angel_one.client_id",
            "ANGEL_PASSWORD": "broker.angel_one.password",
            "ANGEL_TOTP_SECRET": "broker.angel_one.totp_secret",
            "UPSTOX_API_KEY": "broker.upstox.api_key",
            "UPSTOX_API_SECRET": "broker.upstox.api_secret",
            "DATABASE_URL": "data.database_url",
            "DASHBOARD_SECRET_KEY": "dashboard.secret_key",
        }

        for env_var, config_key in env_mappings.items():
            value = os.environ.get(env_var)
            if value:
                self._set_nested(config_key, value)

    def get(self, key: str, default: Any = None) -> Any:
        """Get config value using dot notation.

        Example: config.get("broker.zerodha.api_key")
        """
        keys = key.split(".")
        value = self._config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
            if value is None:
                return default
        return value

    def _set_nested(self, key: str, value: Any):
        """Set a nested config value using dot notation."""
        keys = key.split(".")
        d = self._config
        for k in keys[:-1]:
            if k not in d or not isinstance(d[k], dict):
                d[k] = {}
            d = d[k]
        d[keys[-1]] = value

    def get_section(self, section: str) -> dict:
        """Get an entire config section."""
        return self.get(section, {})

    @property
    def all(self) -> dict:
        """Return full configuration dict."""
        return self._config.copy()

    def reload(self):
        """Reload configuration from files."""
        self._loaded = False
        self._load()
        self._loaded = True

    @classmethod
    def reset(cls):
        """Reset singleton for testing."""
        cls._instance = None

    def validate(self) -> list[str]:
        """Validate required configuration fields. Returns list of errors."""
        errors = []

        required_fields = [
            "app.name",
            "market.exchange",
            "market.indices",
        ]

        for field in required_fields:
            if self.get(field) is None:
                errors.append(f"Missing required config: {field}")

        # Validate trading hours format
        start = self.get("market.trading_hours.start", "")
        end = self.get("market.trading_hours.end", "")
        for time_str, name in [(start, "start"), (end, "end")]:
            if time_str:
                parts = time_str.split(":")
                if len(parts) != 2:
                    errors.append(
                        f"Invalid trading hours {name} format: {time_str}")

        # Validate risk limits
        max_loss = self.get("risk.max_loss_per_trade_pct", 0)
        if max_loss <= 0 or max_loss > 100:
            errors.append(
                f"Invalid max_loss_per_trade_pct: {max_loss}")

        return errors
