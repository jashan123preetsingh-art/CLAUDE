"""Provider factory — maps the ``DATA_PROVIDER`` setting to an implementation.

This is the single seam through which providers are swapped. Real broker
providers require credentials; if they fail to construct we log and fall back
to the synthetic provider so the app always starts.
"""
from __future__ import annotations

from app.config import Settings, get_settings
from app.data.base import MarketDataProvider
from app.data.providers.synthetic import SyntheticProvider
from app.logging_config import get_logger

log = get_logger(__name__)


def build_provider(settings: Settings | None = None) -> MarketDataProvider:
    settings = settings or get_settings()
    name = settings.data_provider

    if name == "synthetic":
        return SyntheticProvider()

    try:
        if name == "upstox":
            from app.data.providers.upstox import UpstoxProvider

            return UpstoxProvider(settings)
        if name == "dhan":
            from app.data.providers.dhan import DhanProvider

            return DhanProvider(settings)
        if name == "angelone":
            from app.data.providers.angelone import AngelOneProvider

            return AngelOneProvider(settings)
        if name == "shoonya":
            from app.data.providers.shoonya import ShoonyaProvider

            return ShoonyaProvider(settings)
    except Exception as exc:  # missing creds / import error → safe fallback
        log.warning("provider '%s' unavailable (%s); using synthetic", name, exc)
        return SyntheticProvider()

    log.warning("unknown provider '%s'; using synthetic", name)
    return SyntheticProvider()
