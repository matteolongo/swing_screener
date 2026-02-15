from __future__ import annotations

import math
from dataclasses import dataclass

from swing_screener.intelligence.config import OpportunityConfig
from swing_screener.intelligence.models import (
    CatalystSignal,
    Event,
    Opportunity,
    SymbolState,
    ThemeCluster,
)

# Scoring constants for catalyst signal evaluation
REACTION_Z_CEILING = 3.0
ATR_SHOCK_CEILING = 2.0
PEER_CONFIRMATION_CEILING = 3.0

# Weight distribution for catalyst scoring (must sum to 1.0)
WEIGHT_REACTION = 0.30
WEIGHT_ATR = 0.20
WEIGHT_PEER = 0.15
WEIGHT_RECENCY = 0.15
WEIGHT_THEME = 0.10
WEIGHT_CREDIBILITY = 0.10


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _norm(value: float, ceiling: float) -> float:
    if ceiling <= 0:
        return 0.0
    return _clamp01(value / ceiling)


@dataclass(frozen=True)
class CatalystScoreBreakdown:
    symbol: str
    score: float
    event_id: str | None
    reaction_score: float
    atr_score: float
    peer_score: float
    recency_score: float
    theme_score: float
    credibility_score: float


def score_catalyst_signal(
    signal: CatalystSignal,
    *,
    event_credibility: float = 0.6,
    theme_strength: float = 0.0,
    recency_half_life_hours: float = 36.0,
) -> float:
    if signal.is_false_catalyst:
        return 0.0

    reaction_score = _norm(max(0.0, signal.return_z), REACTION_Z_CEILING)
    atr_score = _norm(max(0.0, signal.atr_shock), ATR_SHOCK_CEILING)
    peer_score = _norm(max(0.0, float(signal.peer_confirmation_count)), PEER_CONFIRMATION_CEILING)
    half_life = max(1e-6, recency_half_life_hours)
    recency_score = math.exp(math.log(0.5) * max(0.0, signal.recency_hours) / half_life)
    recency_score = _clamp01(recency_score)
    theme_score = _clamp01(theme_strength)
    credibility_score = _clamp01(event_credibility)

    return round(
        WEIGHT_REACTION * reaction_score
        + WEIGHT_ATR * atr_score
        + WEIGHT_PEER * peer_score
        + WEIGHT_RECENCY * recency_score
        + WEIGHT_THEME * theme_score
        + WEIGHT_CREDIBILITY * credibility_score,
        6,
    )


def _theme_strength_by_symbol(themes: list[ThemeCluster]) -> dict[str, float]:
    out: dict[str, float] = {}
    for cluster in themes:
        strength = _clamp01(cluster.cluster_strength)
        for symbol in cluster.symbols:
            key = str(symbol).strip().upper()
            if not key:
                continue
            out[key] = max(out.get(key, 0.0), strength)
    return out


def build_catalyst_score_map(
    *,
    signals: list[CatalystSignal],
    events: list[Event] | None = None,
    themes: list[ThemeCluster] | None = None,
    recency_half_life_hours: float = 36.0,
) -> dict[str, CatalystScoreBreakdown]:
    event_credibility_by_id = {
        event.event_id: _clamp01(event.credibility) for event in (events or [])
    }
    theme_by_symbol = _theme_strength_by_symbol(themes or [])

    out: dict[str, CatalystScoreBreakdown] = {}
    for signal in signals:
        symbol = signal.symbol.strip().upper()
        theme_strength = theme_by_symbol.get(symbol, 0.0)
        credibility = event_credibility_by_id.get(signal.event_id, 0.6)
        score = score_catalyst_signal(
            signal,
            event_credibility=credibility,
            theme_strength=theme_strength,
            recency_half_life_hours=recency_half_life_hours,
        )

        reaction_score = _norm(max(0.0, signal.return_z), 3.0)
        atr_score = _norm(max(0.0, signal.atr_shock), 2.0)
        peer_score = _norm(max(0.0, float(signal.peer_confirmation_count)), 3.0)
        half_life = max(1e-6, recency_half_life_hours)
        recency_score = _clamp01(
            math.exp(math.log(0.5) * max(0.0, signal.recency_hours) / half_life)
        )

        breakdown = CatalystScoreBreakdown(
            symbol=symbol,
            score=score,
            event_id=signal.event_id,
            reaction_score=round(reaction_score, 6),
            atr_score=round(atr_score, 6),
            peer_score=round(peer_score, 6),
            recency_score=round(recency_score, 6),
            theme_score=round(_clamp01(theme_strength), 6),
            credibility_score=round(_clamp01(credibility), 6),
        )
        best = out.get(symbol)
        if best is None or breakdown.score > best.score:
            out[symbol] = breakdown
    return out


def build_opportunities(
    *,
    technical_readiness: dict[str, float],
    catalyst_scores: dict[str, CatalystScoreBreakdown],
    symbol_states: dict[str, SymbolState],
    cfg: OpportunityConfig,
    max_daily: int | None = None,
) -> list[Opportunity]:
    state_map = {symbol.upper(): state for symbol, state in symbol_states.items()}
    symbols = set()
    symbols.update(s.upper() for s in technical_readiness.keys())
    symbols.update(catalyst_scores.keys())
    symbols.update(state_map.keys())

    opportunities: list[Opportunity] = []
    for symbol in symbols:
        technical = _clamp01(technical_readiness.get(symbol, 0.0))
        catalyst = _clamp01(catalyst_scores.get(symbol, CatalystScoreBreakdown(
            symbol=symbol,
            score=0.0,
            event_id=None,
            reaction_score=0.0,
            atr_score=0.0,
            peer_score=0.0,
            recency_score=0.0,
            theme_score=0.0,
            credibility_score=0.0,
        )).score)

        score = _clamp01(cfg.technical_weight * technical + cfg.catalyst_weight * catalyst)
        if score < cfg.min_opportunity_score:
            continue

        state = state_map.get(symbol)
        lifecycle = state.state if state is not None else "QUIET"
        explanations = [
            f"technical={technical:.2f}",
            f"catalyst={catalyst:.2f}",
            f"blend={score:.2f}",
        ]
        opportunities.append(
            Opportunity(
                symbol=symbol,
                technical_readiness=round(technical, 6),
                catalyst_strength=round(catalyst, 6),
                opportunity_score=round(score, 6),
                state=lifecycle,
                explanations=explanations,
            )
        )

    opportunities.sort(
        key=lambda item: (
            -item.opportunity_score,
            -item.catalyst_strength,
            -item.technical_readiness,
            item.symbol,
        )
    )
    limit = max_daily if max_daily is not None else cfg.max_daily_opportunities
    limit = max(1, int(limit))
    return opportunities[:limit]
