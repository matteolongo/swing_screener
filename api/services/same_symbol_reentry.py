"""Portfolio-aware same-symbol re-entry evaluation."""
from __future__ import annotations

import math
from typing import Optional

from api.models.recommendation import Recommendation, RecommendationRisk
from api.models.screener import SameSymbolCandidateContext, ScreenerCandidate

MAX_ADD_ONS_PER_POSITION = 1


def _safe_round(value: Optional[float], digits: int = 4) -> Optional[float]:
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)


def _count_add_ons_for_position(orders: list[object], position_id: Optional[str]) -> int:
    if not position_id:
        return 0
    filled_entries = [
        order
        for order in orders
        if getattr(order, "status", None) == "filled"
        and getattr(order, "position_id", None) == position_id
        and getattr(order, "order_kind", None) == "entry"
    ]
    return max(0, len(filled_entries) - 1)


def _has_pending_entry_for_ticker(orders: list[object], ticker: str) -> bool:
    normalized = ticker.upper()
    return any(
        getattr(order, "status", None) == "pending"
        and getattr(order, "ticker", "").upper() == normalized
        and getattr(order, "order_kind", None) == "entry"
        for order in orders
    )


def _position_market_value(position: object, fallback_price: Optional[float]) -> float:
    current_value = getattr(position, "current_value", None)
    if current_value is not None and math.isfinite(current_value):
        return float(current_value)
    current_price = getattr(position, "current_price", None)
    if current_price is not None and math.isfinite(current_price):
        return float(current_price) * float(getattr(position, "shares", 0))
    if fallback_price is not None and math.isfinite(fallback_price):
        return float(fallback_price) * float(getattr(position, "shares", 0))
    return float(getattr(position, "entry_price", 0.0)) * float(getattr(position, "shares", 0))


def _current_position_risk(position: object) -> float:
    entry_price = float(getattr(position, "entry_price", 0.0))
    stop_price = float(getattr(position, "stop_price", 0.0))
    shares = float(getattr(position, "shares", 0))
    return max(0.0, entry_price - stop_price) * shares


def _copy_recommendation_with_adjusted_risk(
    recommendation: Recommendation,
    *,
    execution_stop: float,
    shares: int,
    account_size: float,
) -> Recommendation:
    risk = recommendation.risk
    risk_per_share = max(0.0, float(risk.entry) - execution_stop)
    target = risk.target
    rr = risk.rr
    if target is not None and risk_per_share > 0:
        rr = (float(target) - float(risk.entry)) / risk_per_share
    risk_amount = risk_per_share * shares
    risk_pct = (risk_amount / account_size) if account_size > 0 else 0.0
    position_size = float(risk.entry) * shares
    adjusted_risk = RecommendationRisk(
        entry=risk.entry,
        stop=execution_stop,
        target=target,
        rr=_safe_round(rr),
        risk_amount=_safe_round(risk_amount) or 0.0,
        risk_pct=_safe_round(risk_pct, 6) or 0.0,
        position_size=_safe_round(position_size) or 0.0,
        shares=int(shares),
        invalidation_level=execution_stop,
    )
    payload = recommendation.model_dump()
    payload["risk"] = adjusted_risk.model_dump()
    return Recommendation.model_validate(payload)


class SameSymbolReentryEvaluator:
    def __init__(self, portfolio_service) -> None:
        self._portfolio_service = portfolio_service
        self._stop_action_cache: dict[str, str] = {}

    def _stop_action_for_position(self, position_id: Optional[str]) -> Optional[str]:
        if not position_id:
            return None
        if position_id in self._stop_action_cache:
            return self._stop_action_cache[position_id]
        suggestion = self._portfolio_service.suggest_position_stop(position_id)
        self._stop_action_cache[position_id] = suggestion.action
        return suggestion.action

    def evaluate(
        self,
        candidate: ScreenerCandidate,
        *,
        positions: list[object],
        orders: list[object],
        account_size: float,
        risk_pct_target: float,
        max_position_pct: float,
        min_shares: int,
    ) -> tuple[Optional[ScreenerCandidate], SameSymbolCandidateContext]:
        matching_position = next(
            (
                position
                for position in positions
                if getattr(position, "status", None) == "open"
                and getattr(position, "ticker", "").upper() == candidate.ticker.upper()
            ),
            None,
        )
        fresh_setup_stop = _safe_round(candidate.stop)
        if matching_position is None:
            context = SameSymbolCandidateContext(
                mode="NEW_ENTRY",
                fresh_setup_stop=fresh_setup_stop,
                execution_stop=fresh_setup_stop,
                reason="No open position exists for this ticker.",
            )
            candidate.same_symbol = context
            return candidate, context

        position_id = getattr(matching_position, "position_id", None)
        current_stop = float(getattr(matching_position, "stop_price", 0.0))
        current_entry = float(getattr(matching_position, "entry_price", 0.0))
        pending_entry_exists = _has_pending_entry_for_ticker(orders, candidate.ticker)
        add_on_count = _count_add_ons_for_position(orders, position_id)
        context = SameSymbolCandidateContext(
            mode="MANAGE_ONLY",
            position_id=position_id,
            current_position_entry=_safe_round(current_entry),
            current_position_stop=_safe_round(current_stop),
            fresh_setup_stop=fresh_setup_stop,
            execution_stop=_safe_round(current_stop),
            pending_entry_exists=pending_entry_exists,
            add_on_count=add_on_count,
            max_add_ons=MAX_ADD_ONS_PER_POSITION,
            reason="Existing position requires management-only handling.",
        )

        recommendation = candidate.recommendation
        entry_price = candidate.entry or (recommendation.risk.entry if recommendation else None)
        if recommendation is None or recommendation.verdict != "RECOMMENDED":
            context.reason = "Fresh setup is not recommended, so no same-symbol add-on is allowed."
            return None, context
        if entry_price is None or entry_price <= 0:
            context.reason = "Fresh setup entry is missing, so no add-on can be evaluated."
            return None, context
        if current_stop >= entry_price:
            context.reason = "Current live stop is not below the new entry, so add-on risk is invalid."
            return None, context
        if pending_entry_exists:
            context.reason = "A pending same-symbol entry already exists."
            return None, context
        if add_on_count >= MAX_ADD_ONS_PER_POSITION:
            context.reason = "Maximum add-on count reached for this position."
            return None, context

        try:
            stop_action = self._stop_action_for_position(position_id)
        except Exception as exc:  # pragma: no cover - defensive service wrapper
            context.reason = f"Could not evaluate live stop action: {exc}"
            return None, context

        if stop_action not in {"NO_ACTION", "MOVE_STOP_UP", None}:
            context.reason = "Position is in a close state, so add-on is not allowed."
            return None, context

        risk_per_share = float(entry_price) - current_stop
        remaining_risk_budget = (account_size * risk_pct_target) - _current_position_risk(matching_position)
        current_position_value = _position_market_value(matching_position, candidate.close)
        remaining_value_capacity = (account_size * max_position_pct) - current_position_value
        shares_by_risk = math.floor(remaining_risk_budget / risk_per_share) if risk_per_share > 0 else 0
        shares_by_value = math.floor(remaining_value_capacity / float(entry_price)) if entry_price > 0 else 0
        candidate_share_cap = candidate.shares or recommendation.risk.shares
        add_on_shares = max(0, min(int(candidate_share_cap), int(shares_by_risk), int(shares_by_value)))

        if add_on_shares < max(1, min_shares):
            context.reason = "Remaining risk or position capacity does not support a valid add-on size."
            return None, context

        adjusted_recommendation = _copy_recommendation_with_adjusted_risk(
            recommendation,
            execution_stop=current_stop,
            shares=add_on_shares,
            account_size=account_size,
        )
        candidate.recommendation = adjusted_recommendation
        candidate.stop = _safe_round(current_stop)
        candidate.rr = adjusted_recommendation.risk.rr
        candidate.risk_usd = adjusted_recommendation.risk.risk_amount
        candidate.risk_pct = adjusted_recommendation.risk.risk_pct
        candidate.position_size_usd = adjusted_recommendation.risk.position_size
        candidate.shares = adjusted_recommendation.risk.shares
        context.mode = "ADD_ON"
        context.reason = "One portfolio-aware add-on is allowed using the current live stop."
        candidate.same_symbol = context
        note_prefix = (
            f"Add-on for open position. Live stop {current_stop:.2f} is used for execution; "
            f"fresh setup stop {fresh_setup_stop:.2f} is reference only."
            if fresh_setup_stop is not None
            else f"Add-on for open position. Live stop {current_stop:.2f} is used for execution."
        )
        candidate.execution_note = (
            f"{note_prefix} {candidate.execution_note}".strip()
            if candidate.execution_note
            else note_prefix
        )
        return candidate, context
