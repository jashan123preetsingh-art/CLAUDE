"""Telegram & email alerting for high-conviction picks.

Both channels are best-effort and no-op when unconfigured, so the app never
fails a scan because alerting isn't set up.
"""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText

import httpx

from app.config import get_settings
from app.logging_config import get_logger
from app.models.schemas import StockResult

log = get_logger(__name__)


def format_alert(r: StockResult) -> str:
    return (
        f"🚀 {r.symbol} ({r.swing_type.value}) | score {r.confidence_score}\n"
        f"{r.name} · {r.sector} · ₹{r.current_price}\n"
        f"Entry {r.risk.entry_low}-{r.risk.entry_high} | SL {r.risk.stop_loss} | "
        f"T1 {r.risk.target1} T2 {r.risk.target2} T3 {r.risk.target3} | RR {r.risk.risk_reward}\n"
        f"Reasons: {', '.join(r.reasons[:4])}"
    )


async def send_telegram(text: str) -> bool:
    s = get_settings()
    if not (s.telegram_bot_token and s.telegram_chat_id):
        return False
    url = f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url, json={"chat_id": s.telegram_chat_id, "text": text}
            )
            resp.raise_for_status()
        return True
    except Exception as exc:  # pragma: no cover - network
        log.warning("telegram alert failed: %s", exc)
        return False


def send_email(subject: str, body: str) -> bool:
    s = get_settings()
    if not (s.smtp_host and s.alert_email_to):
        return False
    try:  # pragma: no cover - network
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = s.smtp_user or "screener@localhost"
        msg["To"] = s.alert_email_to
        with smtplib.SMTP(s.smtp_host, s.smtp_port) as server:
            server.starttls()
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
        return True
    except Exception as exc:  # pragma: no cover
        log.warning("email alert failed: %s", exc)
        return False


async def dispatch_alerts(results: list[StockResult], min_score: float = 85.0) -> int:
    sent = 0
    for r in results:
        if r.confidence_score < min_score:
            continue
        text = format_alert(r)
        if await send_telegram(text):
            sent += 1
        send_email(f"Swing alert: {r.symbol} ({r.confidence_score})", text)
    return sent
