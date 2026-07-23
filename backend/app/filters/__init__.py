"""Filter pipeline: eligibility gates applied before scoring.

Filters return a ``FilterResult`` so the scanner can both exclude a symbol and
explain *why* it was excluded (useful for the dashboard and audits).
"""
from app.filters.eligibility import (  # noqa: F401
    FilterResult,
    delivery_signal,
    passes_eligibility,
    passes_fundamentals,
    passes_news,
)
