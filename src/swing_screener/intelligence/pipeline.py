from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Optional

import pandas as pd

from swing_screener.data.providers.factory import get_default_provider
from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.ingestion.service import collect_events
from swing_screener.intelligence.models import CatalystSignal, Event, Opportunity, SymbolState, ThemeCluster
from swing_screener.intelligence.reaction import build_catalyst_signals
from swing_screener.intelligence.relations import (
    apply_peer_confirmation,
    detect_theme_clusters,
    load_curated_peer_map,
)
from swing_screener.intelligence.scoring import build_catalyst_score_map, build_opportunities
from swing_screener.intelligence.state import update_symbol_states
from swing_screener.intelligence.storage import IntelligenceStorage


@dataclass(frozen=True)
class IntelligenceSnapshot:
    asof_date: str
    symbols: tuple[str, ...]
    events: list[Event]
    signals: list[CatalystSignal]
    themes: list[ThemeCluster]
    opportunities: list[Opportunity]
    states: dict[str, SymbolState]


def _normalize_symbols(symbols: list[str] | tuple[str, ...]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        text = str(symbol).strip().upper()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _normalize_technical(
    symbols: list[str],
    technical_readiness: Optional[dict[str, float]],
) -> dict[str, float]:
    if technical_readiness is None:
        return {symbol: 0.5 for symbol in symbols}
    out: dict[str, float] = {}
    for symbol in symbols:
        value = technical_readiness.get(symbol)
        if value is None:
            value = technical_readiness.get(symbol.lower())
        try:
            out[symbol] = max(0.0, min(1.0, float(value if value is not None else 0.5)))
        except (TypeError, ValueError):
            out[symbol] = 0.5
    return out


def _fetch_ohlcv(
    symbols: list[str],
    *,
    start_dt: datetime,
    end_dt: datetime,
    ohlcv: Optional[pd.DataFrame] = None,
):
    if ohlcv is not None:
        return ohlcv
    provider = get_default_provider()
    start_date = (start_dt - timedelta(days=45)).date().isoformat()
    end_date = (end_dt + timedelta(days=1)).date().isoformat()
    return provider.fetch_ohlcv(symbols, start_date=start_date, end_date=end_date)


def run_intelligence_pipeline(
    *,
    symbols: list[str] | tuple[str, ...],
    cfg: IntelligenceConfig,
    technical_readiness: Optional[dict[str, float]] = None,
    asof_dt: Optional[datetime] = None,
    storage: Optional[IntelligenceStorage] = None,
    ohlcv: Optional[pd.DataFrame] = None,
    peer_map: Optional[dict[str, tuple[str, ...]]] = None,
) -> IntelligenceSnapshot:
    if asof_dt is None:
        now = datetime.utcnow()
    elif asof_dt.tzinfo is None:
        now = asof_dt
    else:
        now = asof_dt.astimezone(UTC).replace(tzinfo=None)
    asof_date = now.date().isoformat()
    symbols_clean = _normalize_symbols(list(symbols))
    storage = storage or IntelligenceStorage()

    if not symbols_clean:
        return IntelligenceSnapshot(
            asof_date=asof_date,
            symbols=tuple(),
            events=[],
            signals=[],
            themes=[],
            opportunities=[],
            states=storage.load_symbol_state(),
        )

    start_dt = now - timedelta(hours=cfg.catalyst.lookback_hours)
    events = collect_events(
        symbols=symbols_clean,
        start_dt=start_dt,
        end_dt=now,
        provider_names=list(cfg.providers),
    )

    ohlcv_data = _fetch_ohlcv(symbols_clean, start_dt=start_dt, end_dt=now, ohlcv=ohlcv)
    raw_signals = build_catalyst_signals(events=events, ohlcv=ohlcv_data, cfg=cfg.catalyst, asof_dt=now)

    resolved_peer_map = peer_map if peer_map is not None else load_curated_peer_map(cfg.theme.curated_peer_map_path)
    signals = apply_peer_confirmation(raw_signals, resolved_peer_map, min_return_z=cfg.catalyst.false_catalyst_return_z)
    themes = detect_theme_clusters(
        signals,
        resolved_peer_map,
        cfg=cfg.theme,
        min_return_z=cfg.catalyst.false_catalyst_return_z,
        theme_prefix=f"{asof_date}-theme",
    )

    previous_states = storage.load_symbol_state()
    states = update_symbol_states(previous_states=previous_states, signals=signals, themes=themes, asof_dt=now)
    catalyst_scores = build_catalyst_score_map(
        signals=signals,
        events=events,
        themes=themes,
        recency_half_life_hours=cfg.catalyst.recency_half_life_hours,
    )
    technical = _normalize_technical(symbols_clean, technical_readiness)
    opportunities = build_opportunities(
        technical_readiness=technical,
        catalyst_scores=catalyst_scores,
        symbol_states=states,
        cfg=cfg.opportunity,
    )

    storage.write_events(events, asof_date)
    storage.write_signals(signals, asof_date)
    storage.write_themes(themes, asof_date)
    storage.write_opportunities(opportunities, asof_date)
    storage.write_symbol_state(states.values())

    return IntelligenceSnapshot(
        asof_date=asof_date,
        symbols=tuple(symbols_clean),
        events=events,
        signals=signals,
        themes=themes,
        opportunities=opportunities,
        states=states,
    )
