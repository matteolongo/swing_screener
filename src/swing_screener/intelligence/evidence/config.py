from __future__ import annotations

from dataclasses import dataclass

from swing_screener.settings import get_settings_manager


@dataclass(frozen=True)
class EvidenceConfig:
    enabled_sources: tuple[str, ...] = ("sec_edgar_catalysts",)
    recency_window_days: int = 30
    max_items_per_symbol: int = 8
    sec_forms: tuple[str, ...] = ("8-K", "6-K", "SC 13D", "SC 13G", "424B", "DEF 14A")
    user_agent: str = "swing-screener-intelligence-bot/1.0"
    connect_timeout_seconds: float = 5.0
    read_timeout_seconds: float = 20.0


def load_evidence_config() -> EvidenceConfig:
    try:
        doc = get_settings_manager().load_intelligence_document()
        cfg = doc.get("config", {}).get("evidence", {}) or {}
    except Exception:  # missing/unreadable config -> defaults
        cfg = {}
    http = cfg.get("http", {}) or {}
    return EvidenceConfig(
        enabled_sources=tuple(cfg.get("enabled_sources") or EvidenceConfig.enabled_sources),
        recency_window_days=int(cfg.get("recency_window_days", 30)),
        max_items_per_symbol=int(cfg.get("max_items_per_symbol", 8)),
        sec_forms=tuple(cfg.get("sec_forms") or EvidenceConfig.sec_forms),
        user_agent=str(http.get("user_agent", EvidenceConfig.user_agent)),
        connect_timeout_seconds=float(http.get("connect_timeout_seconds", 5.0)),
        read_timeout_seconds=float(http.get("read_timeout_seconds", 20.0)),
    )
