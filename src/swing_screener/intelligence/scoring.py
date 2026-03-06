from __future__ import annotations

import math
from dataclasses import dataclass

from swing_screener.intelligence.config import CalendarConfig, OpportunityConfig, ScoringV2Config
from swing_screener.intelligence.evidence import evidence_quality_flag
from swing_screener.intelligence.models import (
    CatalystFeatureVector,
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

# Validate weights sum to 1.0
_WEIGHT_SUM = (
    WEIGHT_REACTION + WEIGHT_ATR + WEIGHT_PEER + 
    WEIGHT_RECENCY + WEIGHT_THEME + WEIGHT_CREDIBILITY
)
assert abs(_WEIGHT_SUM - 1.0) < 1e-9, (
    f"Catalyst scoring weights must sum to 1.0, got {_WEIGHT_SUM}"
)


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
    proximity_score: float = 0.0
    materiality_score: float = 0.0
    source_quality_score: float = 0.0
    confirmation_score: float = 0.0
    filing_impact_score: float = 0.0
    uncertainty_penalty: float = 0.0
    calendar_risk_score: float = 0.0


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


def build_catalyst_score_map_v2(
    *,
    signals: list[CatalystSignal],
    events: list[Event] | None = None,
    themes: list[ThemeCluster] | None = None,
    feature_vectors: dict[str, CatalystFeatureVector] | None = None,
    scoring_cfg: ScoringV2Config | None = None,
    recency_half_life_hours: float = 36.0,
) -> dict[str, CatalystScoreBreakdown]:
    if not scoring_cfg or not scoring_cfg.enabled:
        return build_catalyst_score_map(
            signals=signals,
            events=events,
            themes=themes,
            recency_half_life_hours=recency_half_life_hours,
        )

    event_credibility_by_id = {
        event.event_id: _clamp01(event.credibility) for event in (events or [])
    }
    theme_by_symbol = _theme_strength_by_symbol(themes or [])
    vectors = feature_vectors or {}
    weights = scoring_cfg.weights

    out: dict[str, CatalystScoreBreakdown] = {}
    for signal in signals:
        symbol = signal.symbol.strip().upper()
        theme_strength = theme_by_symbol.get(symbol, 0.0)
        credibility = event_credibility_by_id.get(signal.event_id, 0.6)
        vector = vectors.get(symbol)

        reaction_score = _norm(max(0.0, signal.return_z), 3.0)
        atr_score = _norm(max(0.0, signal.atr_shock), 2.0)
        peer_score = _norm(max(0.0, float(signal.peer_confirmation_count)), 3.0)
        half_life = max(1e-6, recency_half_life_hours)
        recency_score = _clamp01(
            math.exp(math.log(0.5) * max(0.0, signal.recency_hours) / half_life)
        )

        proximity_score = _clamp01(getattr(vector, "proximity_score", 0.0))
        materiality_score = _clamp01(getattr(vector, "materiality_score", 0.0))
        source_quality_score = _clamp01(getattr(vector, "source_quality_score", 0.0))
        confirmation_score = _clamp01(getattr(vector, "confirmation_score", 0.0))
        filing_impact_score = _clamp01(getattr(vector, "filing_impact_score", 0.0))
        uncertainty_penalty = _clamp01(getattr(vector, "uncertainty_penalty", 0.0))
        calendar_risk_score = _clamp01(getattr(vector, "calendar_risk_score", 0.0))

        base_score = (
            weights.reaction_z_component * reaction_score
            + weights.atr_shock_component * atr_score
            + weights.recency_component * recency_score
            + weights.proximity_component * proximity_score
            + weights.materiality_component * materiality_score
            + weights.source_quality_component * source_quality_score
            + weights.confirmation_component * confirmation_score
            + weights.filing_impact_component * filing_impact_score
            - weights.uncertainty_penalty_component * uncertainty_penalty
        )
        if signal.is_false_catalyst:
            base_score = 0.0
        score = round(_clamp01(base_score), 6)

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
            proximity_score=round(proximity_score, 6),
            materiality_score=round(materiality_score, 6),
            source_quality_score=round(source_quality_score, 6),
            confirmation_score=round(confirmation_score, 6),
            filing_impact_score=round(filing_impact_score, 6),
            uncertainty_penalty=round(uncertainty_penalty, 6),
            calendar_risk_score=round(calendar_risk_score, 6),
        )
        best = out.get(symbol)
        if best is None or breakdown.score > best.score:
            out[symbol] = breakdown

    return out


def _empty_breakdown(symbol: str) -> CatalystScoreBreakdown:
    return CatalystScoreBreakdown(
        symbol=symbol,
        score=0.0,
        event_id=None,
        reaction_score=0.0,
        atr_score=0.0,
        peer_score=0.0,
        recency_score=0.0,
        theme_score=0.0,
        credibility_score=0.0,
    )


def build_opportunities(
    *,
    technical_readiness: dict[str, float],
    catalyst_scores: dict[str, CatalystScoreBreakdown],
    symbol_states: dict[str, SymbolState],
    cfg: OpportunityConfig,
    feature_vectors: dict[str, CatalystFeatureVector] | None = None,
    scoring_cfg: ScoringV2Config | None = None,
    calendar_cfg: CalendarConfig | None = None,
    max_daily: int | None = None,
) -> list[Opportunity]:
    state_map = {symbol.upper(): state for symbol, state in symbol_states.items()}
    symbols = set()
    symbols.update(s.upper() for s in technical_readiness.keys())
    symbols.update(catalyst_scores.keys())
    symbols.update(state_map.keys())

    vectors = feature_vectors or {}
    scoring_config = scoring_cfg or ScoringV2Config()
    calendar_config = calendar_cfg or CalendarConfig()
    opportunities: list[Opportunity] = []
    for symbol in symbols:
        technical = _clamp01(technical_readiness.get(symbol, 0.0))
        breakdown = catalyst_scores.get(symbol, _empty_breakdown(symbol))
        catalyst = _clamp01(breakdown.score)
        vector = vectors.get(symbol)

        score = _clamp01(cfg.technical_weight * technical + cfg.catalyst_weight * catalyst)
        min_threshold = float(cfg.min_opportunity_score)
        if vector is not None and scoring_config.enabled:
            if (
                vector.calendar_risk_score >= 0.5
                and vector.materiality_score >= calendar_config.binary_event_min_materiality
                and vector.proximity_score >= (1.0 - (calendar_config.binary_event_window_days / 30.0))
            ):
                min_threshold = _clamp01(min_threshold + calendar_config.binary_event_min_threshold_boost)
            if (
                vector.confirmation_score < scoring_config.low_evidence_confirmation_threshold
                and vector.source_quality_score < scoring_config.low_evidence_source_quality_threshold
            ):
                min_threshold = _clamp01(min_threshold + calendar_config.low_evidence_min_threshold_boost)

            stale_hours = max(1, int(scoring_config.stale_event_decay_hours))
            decay_factor = math.exp(-max(0.0, breakdown.recency_score) / float(stale_hours))
            score = _clamp01(score * max(0.6, min(1.0, 0.9 + 0.1 * decay_factor)))

        if score < min_threshold:
            continue

        state = state_map.get(symbol)
        lifecycle = state.state if state is not None else "QUIET"
        explanations = [
            f"technical={technical:.2f}",
            f"catalyst={catalyst:.2f}",
            f"blend={score:.2f}",
        ]
        score_breakdown = {
            "technical": round(technical, 6),
            "catalyst": round(catalyst, 6),
            "reaction_z_component": round(breakdown.reaction_score, 6),
            "atr_shock_component": round(breakdown.atr_score, 6),
            "recency_component": round(breakdown.recency_score, 6),
            "proximity_component": round(breakdown.proximity_score, 6),
            "materiality_component": round(breakdown.materiality_score, 6),
            "source_quality_component": round(breakdown.source_quality_score, 6),
            "confirmation_component": round(breakdown.confirmation_score, 6),
            "filing_impact_component": round(breakdown.filing_impact_score, 6),
            "uncertainty_penalty_component": round(breakdown.uncertainty_penalty, 6),
            "calendar_risk_score": round(breakdown.calendar_risk_score, 6),
            "opportunity": round(score, 6),
        }
        top_catalysts = vector.top_catalysts if vector is not None else []
        quality_flag = evidence_quality_flag(vector) if vector is not None else "medium"
        opportunities.append(
            Opportunity(
                symbol=symbol,
                technical_readiness=round(technical, 6),
                catalyst_strength=round(catalyst, 6),
                opportunity_score=round(score, 6),
                state=lifecycle,
                explanations=explanations,
                score_breakdown_v2=score_breakdown,
                top_catalysts=top_catalysts,
                evidence_quality_flag=quality_flag,  # type: ignore[arg-type]
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
