from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from swing_screener.intelligence.models import CatalystSignal, SymbolState, ThemeCluster

ACTIVE_STATES = {"CATALYST_ACTIVE", "TRENDING"}


@dataclass(frozen=True)
class StateMachinePolicy:
    watch_threshold: float = 0.35
    trending_threshold: float = 0.55
    activation_threshold: float = 0.72
    fresh_signal_hours: int = 48
    watch_expiry_hours: int = 72
    active_to_trending_hours: int = 24
    trending_to_cooling_hours: int = 120
    cooling_to_quiet_hours: int = 72


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _parse_dt(value: str | datetime) -> datetime | None:
    if isinstance(value, datetime):
        return _to_utc_naive(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return _to_utc_naive(datetime.fromisoformat(text.replace("Z", "+00:00")))
    except ValueError:
        return None


def _hours_between(start: str | datetime, end: datetime) -> float:
    start_dt = _parse_dt(start)
    if start_dt is None:
        return 0.0
    return max(0.0, (_to_utc_naive(end) - start_dt).total_seconds() / 3600.0)


def _signal_strength(signal: CatalystSignal) -> float:
    z_score = min(1.0, max(0.0, signal.return_z) / 3.0)
    atr_score = min(1.0, max(0.0, signal.atr_shock) / 2.0)
    peer_score = min(1.0, max(0.0, float(signal.peer_confirmation_count)) / 3.0)
    return round(0.5 * z_score + 0.3 * atr_score + 0.2 * peer_score, 6)


def _build_state(
    *,
    symbol: str,
    state: str,
    score: float,
    asof_dt: datetime,
    last_event_id: str | None,
) -> SymbolState:
    return SymbolState(
        symbol=symbol,
        state=state,  # type: ignore[arg-type]
        last_transition_at=asof_dt.isoformat(),
        state_score=max(0.0, min(1.0, score)),
        last_event_id=last_event_id,
    )


def transition_symbol_state(
    *,
    symbol: str,
    previous: SymbolState | None,
    signal: CatalystSignal | None,
    asof_dt: datetime,
    themed_symbols: set[str],
    policy: StateMachinePolicy = StateMachinePolicy(),
) -> SymbolState:
    now = _to_utc_naive(asof_dt)
    prev = previous or SymbolState.new(symbol)
    prev_state = prev.state
    age_hours = _hours_between(prev.last_transition_at, now)

    if signal is None:
        if prev_state == "WATCH" and age_hours >= policy.watch_expiry_hours:
            return _build_state(symbol=symbol, state="QUIET", score=0.0, asof_dt=now, last_event_id=prev.last_event_id)
        if prev_state == "CATALYST_ACTIVE" and age_hours >= policy.active_to_trending_hours:
            return _build_state(symbol=symbol, state="TRENDING", score=prev.state_score * 0.9, asof_dt=now, last_event_id=prev.last_event_id)
        if prev_state == "TRENDING" and age_hours >= policy.trending_to_cooling_hours:
            return _build_state(symbol=symbol, state="COOLING_OFF", score=prev.state_score * 0.7, asof_dt=now, last_event_id=prev.last_event_id)
        if prev_state == "COOLING_OFF" and age_hours >= policy.cooling_to_quiet_hours:
            return _build_state(symbol=symbol, state="QUIET", score=0.0, asof_dt=now, last_event_id=prev.last_event_id)
        return prev

    if signal.is_false_catalyst:
        next_state = "COOLING_OFF" if prev_state in ACTIVE_STATES else "QUIET"
        next_score = prev.state_score * 0.6 if prev_state in ACTIVE_STATES else 0.0
        if next_state == prev_state:
            return SymbolState(
                symbol=prev.symbol,
                state=prev.state,
                last_transition_at=prev.last_transition_at,
                state_score=max(0.0, min(1.0, next_score)),
                last_event_id=signal.event_id,
            )
        return _build_state(
            symbol=symbol,
            state=next_state,
            score=next_score,
            asof_dt=now,
            last_event_id=signal.event_id,
        )

    strength = _signal_strength(signal)
    is_fresh = signal.recency_hours <= policy.fresh_signal_hours
    in_theme = symbol in themed_symbols

    if strength >= policy.activation_threshold and is_fresh:
        next_state = "CATALYST_ACTIVE"
    elif (
        strength >= policy.trending_threshold
        and (in_theme or prev_state in ACTIVE_STATES)
    ) or (
        prev_state in ACTIVE_STATES and strength >= policy.watch_threshold
    ):
        next_state = "TRENDING"
    elif strength >= policy.watch_threshold:
        next_state = "WATCH"
    else:
        next_state = "COOLING_OFF" if prev_state in ACTIVE_STATES else "WATCH"

    if next_state == prev_state:
        return SymbolState(
            symbol=prev.symbol,
            state=prev.state,
            last_transition_at=prev.last_transition_at,
            state_score=max(prev.state_score, strength),
            last_event_id=signal.event_id,
        )

    return _build_state(
        symbol=symbol,
        state=next_state,
        score=strength,
        asof_dt=now,
        last_event_id=signal.event_id,
    )


def update_symbol_states(
    *,
    previous_states: dict[str, SymbolState],
    signals: list[CatalystSignal],
    themes: list[ThemeCluster],
    asof_dt: datetime,
    policy: StateMachinePolicy = StateMachinePolicy(),
) -> dict[str, SymbolState]:
    normalized_prev = {symbol.upper(): state for symbol, state in previous_states.items()}
    signal_map = {signal.symbol.upper(): signal for signal in signals}
    themed_symbols = {
        symbol.upper()
        for cluster in themes
        for symbol in cluster.symbols
    }
    all_symbols = set(normalized_prev.keys()).union(signal_map.keys())

    next_states: dict[str, SymbolState] = {}
    for symbol in sorted(all_symbols):
        next_states[symbol] = transition_symbol_state(
            symbol=symbol,
            previous=normalized_prev.get(symbol),
            signal=signal_map.get(symbol),
            asof_dt=asof_dt,
            themed_symbols=themed_symbols,
            policy=policy,
        )
    return next_states
