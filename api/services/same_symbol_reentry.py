"""Portfolio-aware same-symbol re-entry evaluation."""

from __future__ import annotations

import math
from collections.abc import Callable
from datetime import date, timedelta
from typing import Optional

from api.models.recommendation import (
    ChecklistGate,
    DecisionGateModel,
    ExecutionNextStepModel,
    Recommendation,
    RecommendationCosts,
    RecommendationReason,
    RecommendationRisk,
)
from api.models.screener import SameSymbolCandidateContext, ScreenerCandidate
from swing_screener.risk.currency import normalize_currency_code


def _parse_date(value: object) -> Optional[date]:
    if value is None:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _safe_round(value: Optional[float], digits: int = 4) -> Optional[float]:
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)


def _adjusted_account_to_quote_rate(risk: RecommendationRisk) -> Optional[float]:
    """Return a usable conversion rate without inventing cross-currency FX."""
    quote_currency = normalize_currency_code(risk.currency)
    account_currency = normalize_currency_code(risk.account_currency)
    same_currency = (
        quote_currency is not None
        and account_currency is not None
        and quote_currency == account_currency
    )

    if risk.account_to_quote_rate is None:
        if same_currency or (quote_currency is None and account_currency is None):
            return 1.0
        return None

    try:
        parsed = float(risk.account_to_quote_rate)
    except (TypeError, ValueError):
        return 1.0 if same_currency else None

    if math.isfinite(parsed) and parsed > 0:
        return parsed
    return 1.0 if same_currency else None


def _order_field(order: object, key: str, default=None):
    """Read an order attribute from either a model object or a raw dict."""
    if isinstance(order, dict):
        return order.get(key, default)
    return getattr(order, key, default)


def _count_add_ons_for_position(
    orders: list[object], position_id: Optional[str]
) -> int:
    if not position_id:
        return 0
    filled_entries = [
        order
        for order in orders
        if _order_field(order, "status") == "filled"
        and _order_field(order, "position_id") == position_id
        and _order_field(order, "order_kind") == "entry"
    ]
    return max(0, len(filled_entries) - 1)


def _has_pending_entry_for_ticker(orders: list[object], ticker: str) -> bool:
    normalized = ticker.upper()
    return any(
        _order_field(order, "status") in ("pending", "submitted")
        and str(_order_field(order, "ticker", "") or "").upper() == normalized
        and _order_field(order, "order_kind") == "entry"
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
    return float(getattr(position, "entry_price", 0.0)) * float(
        getattr(position, "shares", 0)
    )


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
    account_to_quote_rate = _adjusted_account_to_quote_rate(risk)
    risk_amount = risk_per_share * shares
    position_size = float(risk.entry) * shares
    if account_to_quote_rate is None:
        risk_amount_account = None
        risk_pct = 0.0
        position_size_account = None
    else:
        risk_amount_account = risk_amount / account_to_quote_rate
        risk_pct = (risk_amount_account / account_size) if account_size > 0 else 0.0
        position_size_account = position_size / account_to_quote_rate
    adjusted_risk = risk.model_copy(
        update={
            "stop": execution_stop,
            "rr": _safe_round(rr),
            "risk_amount": _safe_round(risk_amount) or 0.0,
            "risk_amount_account": _safe_round(risk_amount_account),
            "risk_pct": _safe_round(risk_pct, 6) or 0.0,
            "position_size": _safe_round(position_size) or 0.0,
            "position_size_account": _safe_round(position_size_account),
            "shares": int(shares),
            "invalidation_level": execution_stop,
            "account_to_quote_rate": account_to_quote_rate,
        }
    )
    share_ratio = shares / risk.shares if risk.shares > 0 else 0.0
    commission = round(recommendation.costs.commission_estimate * share_ratio, 4)
    fx = round(recommendation.costs.fx_estimate * share_ratio, 4)
    slippage = round(recommendation.costs.slippage_estimate * share_ratio, 4)
    total_cost = round(commission + fx + slippage, 4)
    fee_to_risk_pct = round(total_cost / risk_amount, 4) if risk_amount > 0 else None
    adjusted_costs = RecommendationCosts(
        commission_estimate=commission,
        fx_estimate=fx,
        slippage_estimate=slippage,
        total_cost=total_cost,
        fee_to_risk_pct=fee_to_risk_pct,
    )
    return recommendation.model_copy(
        update={"risk": adjusted_risk, "costs": adjusted_costs}
    )


def _block_recommendation_for_live_stop(
    recommendation: Recommendation,
    *,
    execution_stop: float,
    account_size: float,
    min_rr: float,
    max_fee_risk_pct: float,
) -> Recommendation:
    adjusted = _copy_recommendation_with_adjusted_risk(
        recommendation,
        execution_stop=execution_stop,
        shares=recommendation.risk.shares,
        account_size=account_size,
    )
    fee_ratio = adjusted.costs.fee_to_risk_pct
    fee_ok = (
        fee_ratio is not None
        and math.isfinite(fee_ratio)
        and fee_ratio <= max_fee_risk_pct
    )
    fee_gate = ChecklistGate(
        gate_name="fee_to_risk",
        passed=fee_ok,
        explanation=(
            f"Fees <= {int(max_fee_risk_pct * 100)}% of risk."
            if fee_ok
            else f"Fees too high vs risk (>{int(max_fee_risk_pct * 100)}%)."
        ),
        rule="R4",
    )
    checklist = [
        fee_gate if gate.gate_name == "fee_to_risk" else gate
        for gate in adjusted.checklist
    ]
    if not any(gate.gate_name == "fee_to_risk" for gate in adjusted.checklist):
        checklist.append(fee_gate)
    adjusted = adjusted.model_copy(update={"checklist": checklist})

    target_is_independent = adjusted.risk.target_source in {"structural", "manual"}
    rr = adjusted.risk.rr
    rr_ok = target_is_independent and rr is not None and rr >= min_rr
    if rr_ok and fee_ok:
        return adjusted

    if not rr_ok:
        code = (
            "RR_TOO_LOW"
            if target_is_independent and rr is not None
            else "TARGET_NOT_VALIDATED"
        )
        explanation = (
            f"Live-stop RR {rr:.2f} is below the configured minimum {min_rr:.2f}."
            if rr is not None and target_is_independent
            else "The live-stop plan does not have an independently validated target."
        )
        next_step = ExecutionNextStepModel(code="define_target")
    else:
        code = "FEES_TOO_HIGH"
        explanation = (
            f"Live-stop fees are {fee_ratio:.1%} of risk, above the configured "
            f"maximum {max_fee_risk_pct:.1%}."
        )
        next_step = ExecutionNextStepModel(code="inspect_gate_conflict")
    plan_gate = DecisionGateModel(status="BLOCK", explanation=explanation)
    decision_gates = adjusted.decision_gates.model_copy(
        update={"plan": plan_gate, "ready_to_order": False}
    )
    reason = RecommendationReason(
        code=code,
        message=explanation,
        severity="block",
        rule="R3" if not rr_ok else "R4",
        metrics=(
            {"min_rr": min_rr, **({"rr": rr} if rr is not None else {})}
            if not rr_ok
            else {
                "max_fee_risk_pct": max_fee_risk_pct,
                **({"fee_to_risk_pct": fee_ratio} if fee_ratio is not None else {}),
            }
        ),
    )
    return adjusted.model_copy(
        update={
            "verdict": "NOT_RECOMMENDED",
            "reasons_short": [*adjusted.reasons_short, explanation],
            "reasons_detailed": [*adjusted.reasons_detailed, reason],
            "decision_gates": decision_gates,
            "workflow_status": "needs_review",
            "next_step": next_step,
        }
    )


class SameSymbolReentryEvaluator:
    def __init__(
        self,
        portfolio_service,
        *,
        stop_action_resolver: Callable[[object], Optional[str]] | None = None,
    ) -> None:
        self._portfolio_service = portfolio_service
        self._stop_action_resolver = stop_action_resolver
        self._stop_action_cache: dict[str, Optional[str]] = {}

    def _stop_action_for_position(self, position: object) -> Optional[str]:
        if isinstance(position, str):
            position_id: Optional[str] = position
            position_obj: object | None = None
        elif isinstance(position, dict):
            position_id = position.get("position_id")
            position_obj = position
        elif position is None:
            return None
        else:
            position_id = getattr(position, "position_id", None)
            position_obj = position
        cache_key = position_id if position_id else None
        if cache_key is None:
            if position_obj is None or self._stop_action_resolver is None:
                return None
            cache_key = f"__obj__{id(position_obj)}"
        if cache_key in self._stop_action_cache:
            return self._stop_action_cache[cache_key]
        if self._stop_action_resolver is not None:
            if position_obj is None:
                return None
            action = self._stop_action_resolver(position_obj)
            self._stop_action_cache[cache_key] = action
            return action
        if not position_id:
            return None
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
        min_rr: float,
        max_fee_risk_pct: float = 0.20,
        closed_positions: list[object] | None = None,
        reentry_lookback_days: int = 30,
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
            # Check for a recently-closed position → RE_ENTRY
            if closed_positions:
                cutoff = date.today() - timedelta(days=reentry_lookback_days)
                recently_closed = next(
                    (
                        pos
                        for pos in closed_positions
                        if getattr(pos, "ticker", "").upper()
                        == candidate.ticker.upper()
                        and _parse_date(getattr(pos, "exit_date", None)) is not None
                        and _parse_date(getattr(pos, "exit_date", None)) >= cutoff
                    ),
                    None,
                )
                if recently_closed is not None:
                    context = SameSymbolCandidateContext(
                        mode="RE_ENTRY",
                        fresh_setup_stop=fresh_setup_stop,
                        execution_stop=fresh_setup_stop,
                        reason=f"Previously closed within last {reentry_lookback_days} days — re-entry candidate.",
                    )
                    candidate.same_symbol = context
                    return candidate, context
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
        has_partial_closes = bool(getattr(matching_position, "partial_closes", None))
        context = SameSymbolCandidateContext(
            mode="MANAGE_ONLY",
            position_id=position_id,
            current_position_entry=_safe_round(current_entry),
            current_position_stop=_safe_round(current_stop),
            fresh_setup_stop=fresh_setup_stop,
            execution_stop=_safe_round(current_stop),
            pending_entry_exists=pending_entry_exists,
            add_on_count=add_on_count,
            reason="Existing position requires management-only handling.",
        )

        recommendation = candidate.recommendation
        entry_price = candidate.entry or (
            recommendation.risk.entry if recommendation else None
        )
        if recommendation is None or recommendation.verdict != "RECOMMENDED":
            context.reason = (
                "Fresh setup is not recommended, so no same-symbol add-on is allowed."
            )
            return None, context
        if entry_price is None or entry_price <= 0:
            context.reason = (
                "Fresh setup entry is missing, so no add-on can be evaluated."
            )
            candidate.same_symbol = context
            return candidate, context
        if current_stop >= entry_price:
            context.reason = "Current live stop is not below the new entry, so add-on risk is invalid."
            candidate.same_symbol = context
            return candidate, context
        if pending_entry_exists:
            context.reason = "A pending same-symbol entry already exists."
            candidate.same_symbol = context
            return candidate, context

        try:
            stop_action = self._stop_action_for_position(matching_position)
        except Exception as exc:  # pragma: no cover - defensive service wrapper
            context.reason = f"Could not evaluate live stop action: {exc}"
            candidate.same_symbol = context
            return candidate, context

        if stop_action not in {"NO_ACTION", "MOVE_STOP_UP", None}:
            context.reason = "Position is in a close state, so add-on is not allowed."
            candidate.same_symbol = context
            return candidate, context

        account_to_quote_rate = _adjusted_account_to_quote_rate(recommendation.risk)
        if account_to_quote_rate is None:
            context.reason = (
                "A valid FX rate is required before same-symbol add-on sizing."
            )
            candidate.same_symbol = context
            return candidate, context

        live_stop_recommendation = _block_recommendation_for_live_stop(
            recommendation,
            execution_stop=current_stop,
            account_size=account_size,
            min_rr=min_rr,
            max_fee_risk_pct=max_fee_risk_pct,
        )
        if live_stop_recommendation.workflow_status != "ready":
            candidate.recommendation = live_stop_recommendation
            candidate.stop = _safe_round(current_stop)
            candidate.rr = live_stop_recommendation.risk.rr
            latest_code = live_stop_recommendation.reasons_detailed[-1].code
            if latest_code == "FEES_TOO_HIGH":
                context.reason = (
                    "Estimated fees are too high relative to live-stop risk."
                )
            elif live_stop_recommendation.risk.target_source in {
                "structural",
                "manual",
            }:
                context.reason = (
                    "The live-stop reward:risk is below the configured minimum."
                )
            else:
                context.reason = "The live-stop plan does not have an independently validated target."
            candidate.same_symbol = context
            return candidate, context

        risk_per_share = float(entry_price) - current_stop
        # Risk and max-position budgets are configured in account currency;
        # same-symbol sizing below compares them to quote-currency exposure.
        risk_budget_quote = account_size * risk_pct_target * account_to_quote_rate
        max_position_value_quote = (
            account_size * max_position_pct * account_to_quote_rate
        )
        remaining_risk_budget = risk_budget_quote - _current_position_risk(
            matching_position
        )
        current_position_value = _position_market_value(
            matching_position, candidate.close
        )
        remaining_value_capacity = max_position_value_quote - current_position_value
        shares_by_risk = (
            math.floor(remaining_risk_budget / risk_per_share)
            if risk_per_share > 0
            else 0
        )
        shares_by_value = (
            math.floor(remaining_value_capacity / float(entry_price))
            if entry_price > 0
            else 0
        )
        candidate_share_cap = candidate.shares or recommendation.risk.shares
        add_on_shares = max(
            0, min(int(candidate_share_cap), int(shares_by_risk), int(shares_by_value))
        )

        if add_on_shares < max(1, min_shares):
            context.reason = "Remaining risk or position capacity does not support a valid add-on size."
            candidate.same_symbol = context
            return candidate, context

        adjusted_recommendation = _copy_recommendation_with_adjusted_risk(
            recommendation,
            execution_stop=current_stop,
            shares=add_on_shares,
            account_size=account_size,
        )
        candidate.recommendation = adjusted_recommendation
        candidate.stop = _safe_round(current_stop)
        candidate.rr = adjusted_recommendation.risk.rr
        candidate.risk_quote = adjusted_recommendation.risk.risk_amount
        candidate.risk_usd = adjusted_recommendation.risk.risk_amount
        candidate.risk_pct = adjusted_recommendation.risk.risk_pct
        candidate.position_size_quote = adjusted_recommendation.risk.position_size
        candidate.position_size_usd = adjusted_recommendation.risk.position_size
        candidate.shares = adjusted_recommendation.risk.shares
        context.mode = "SCALE_BACK" if has_partial_closes else "ADD_ON"
        reason_prefix = (
            "Scale-back after partial trim"
            if has_partial_closes
            else "One portfolio-aware add-on is allowed"
        )
        context.reason = f"{reason_prefix} using the current live stop."
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
