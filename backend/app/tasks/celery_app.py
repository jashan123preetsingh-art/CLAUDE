"""Celery app + daily scanner automation.

Start a worker + beat with::

    celery -A app.tasks.celery_app worker --beat --loglevel=info

The daily task runs a full scan and dispatches Telegram/email alerts for
high-conviction picks. Requires ``CELERY_BROKER_URL`` (Redis) to be set.
"""
from __future__ import annotations

import asyncio

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings
from app.logging_config import get_logger
from app.services.alerts import dispatch_alerts
from app.services.scanner import Scanner

log = get_logger(__name__)
settings = get_settings()

broker = settings.celery_broker_url or settings.redis_url or "memory://"
celery_app = Celery("screener", broker=broker, backend=broker)

celery_app.conf.beat_schedule = {
    "daily-swing-scan": {
        # 08:15 IST on weekdays (pre-market prep)
        "task": "app.tasks.celery_app.run_daily_scan",
        "schedule": crontab(hour=8, minute=15, day_of_week="mon-fri"),
    }
}
celery_app.conf.timezone = "Asia/Kolkata"


async def _scan_and_alert() -> dict:
    scanner = Scanner()
    buckets = await scanner.scan()
    all_results = [r for rs in buckets.values() for r in rs]
    sent = await dispatch_alerts(all_results, min_score=85.0)
    await scanner.aclose()
    return {"counts": {k: len(v) for k, v in buckets.items()}, "alerts": sent}


@celery_app.task(name="app.tasks.celery_app.run_daily_scan")
def run_daily_scan() -> dict:
    log.info("celery: running daily scan")
    result = asyncio.run(_scan_and_alert())
    log.info("celery: daily scan done: %s", result)
    return result
