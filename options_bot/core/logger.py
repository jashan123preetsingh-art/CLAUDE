"""Logging setup for the trading bot."""

import os
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


# Create logs directory
LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(exist_ok=True)


class ColorFormatter(logging.Formatter):
    """Colored log formatter for console output."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[41m",  # Red background
    }
    RESET = "\033[0m"
    BOLD = "\033[1m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = (
            f"{color}{self.BOLD}{record.levelname:<8}{self.RESET}"
        )
        record.name = f"\033[35m{record.name}\033[0m"
        return super().format(record)


def setup_logging(level: str = "INFO"):
    """Setup application-wide logging with console and file handlers."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_fmt = ColorFormatter(
        "%(asctime)s %(levelname)s %(name)s │ %(message)s",
        datefmt="%H:%M:%S",
    )
    console_handler.setFormatter(console_fmt)
    root_logger.addHandler(console_handler)

    # File handler for all logs
    date_str = datetime.now().strftime("%Y-%m-%d")
    file_handler = logging.FileHandler(
        LOGS_DIR / f"bot_{date_str}.log", encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_fmt)
    root_logger.addHandler(file_handler)

    # Error-only file handler
    error_handler = logging.FileHandler(
        LOGS_DIR / f"errors_{date_str}.log", encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_fmt)
    root_logger.addHandler(error_handler)

    # Suppress noisy third-party loggers
    for name in ("urllib3", "requests", "werkzeug", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)


def setup_trade_logger() -> logging.Logger:
    """Create a dedicated logger for trade execution logs."""
    trade_logger = logging.getLogger("trades")
    trade_logger.setLevel(logging.INFO)

    if not trade_logger.handlers:
        date_str = datetime.now().strftime("%Y-%m-%d")
        handler = logging.FileHandler(
            LOGS_DIR / f"trades_{date_str}.log", encoding="utf-8"
        )
        handler.setLevel(logging.INFO)
        fmt = logging.Formatter(
            "%(asctime)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(fmt)
        trade_logger.addHandler(handler)

    return trade_logger


def get_logger(name: str) -> logging.Logger:
    """Get a named logger instance."""
    return logging.getLogger(name)
