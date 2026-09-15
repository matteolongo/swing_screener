"""Pure, deterministic entry-order approval policy."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from decimal import Decimal

from api.models.portfolio import PortfolioApprovalGate, PortfolioOrderApproval
from api.models.screener import (
    CanonicalOrderDraftOut,
    ExecutionEligibilityOut,
    ExecutionEligibilityReason,
)
from api.services.order_approval_token import VerifiedApprovalToken
from api.services.order_exposure import ExposureSnapshot, country_from_ticker
from swing_screener.data.currencies import supported_currency_codes


@dataclass(frozen=True)
class EffectiveOrderPolicy:
    account_size: Decimal
    risk_pct: Decimal
    max_position_pct: Decimal
    max_portfolio_heat_pct: Decimal
    min_rr: Decimal
    commission_pct: Decimal
    max_fee_risk_pct: Decimal
    max_concentration_pct: Decimal
    account_currency: str
    version: str = "order-risk-v1"


@dataclass(frozen=True)
class SubmittedPlan:
    ticker: str
    quantity: int
    entry: Decimal
    stop: Decimal
    target: Decimal


def _blocked_execution(
    reason: ExecutionEligibilityReason,
) -> tuple[ExecutionEligibilityOut, None]:
    return ExecutionEligibilityOut(allowed=False, reason=reason), None


def _positive_finite(value: object) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and math.isfinite(float(value))
        and float(value) > 0
    )


def resolve_execution_eligibility(
    candidate: object, *, require_approval: bool = False
) -> tuple[ExecutionEligibilityOut, CanonicalOrderDraftOut | None]:
    """Return the canonical order-review capability and validated draft."""

    order_type = (
        str(getattr(candidate, "suggested_order_type", "") or "").strip().upper()
    )
    if order_type == "SKIP":
        return _blocked_execution("skip_guidance")

    recommendation = getattr(candidate, "recommendation", None)
    workflow_status = getattr(recommendation, "workflow_status", None)
    next_step = getattr(getattr(recommendation, "next_step", None), "code", None)
    if workflow_status == "ready" and next_step == "review_order":
        mode = "ready"
    elif (
        workflow_status == "waiting_trigger"
        and next_step == "wait_pullback"
        and order_type == "BUY_LIMIT"
    ):
        mode = "pending_pullback"
    else:
        return _blocked_execution("workflow_not_actionable")

    approval_token = str(getattr(candidate, "approval_token", "") or "").strip()
    data_asof = getattr(candidate, "data_asof", None)
    if (
        getattr(candidate, "data_status", None) != "current"
        or not isinstance(data_asof, str)
        or not data_asof.strip()
    ):
        return _blocked_execution("data_not_current")

    entry = getattr(candidate, "entry", None)
    stop = getattr(candidate, "stop", None)
    target = getattr(candidate, "target", None)
    shares = getattr(candidate, "shares", None)
    rr = getattr(candidate, "rr", None)
    quote_currency = str(getattr(candidate, "quote_currency", "") or "").strip().upper()
    if any(value is None for value in (entry, stop, target, shares, rr)) or not (
        order_type and quote_currency
    ):
        return _blocked_execution("plan_incomplete")

    valid_numbers = all(_positive_finite(value) for value in (entry, stop, target, rr))
    valid_shares = (
        isinstance(shares, int) and not isinstance(shares, bool) and shares > 0
    )
    if (
        not valid_numbers
        or not valid_shares
        or not float(stop) < float(entry) < float(target)
        or order_type not in {"BUY_LIMIT", "BUY_STOP"}
        or quote_currency not in supported_currency_codes()
    ):
        return _blocked_execution("plan_invalid")

    same_symbol = getattr(candidate, "same_symbol", None)
    same_symbol_mode = getattr(same_symbol, "mode", None)
    held_symbol = same_symbol is not None and (
        bool(getattr(same_symbol, "position_id", None))
        or getattr(same_symbol, "current_position_entry", None) is not None
        or getattr(same_symbol, "current_position_stop", None) is not None
        or same_symbol_mode == "MANAGE_ONLY"
    )
    if held_symbol and same_symbol_mode not in {"ADD_ON", "SCALE_BACK"}:
        return _blocked_execution("held_symbol_not_add_on")
    if require_approval and not approval_token:
        return _blocked_execution("approval_missing")

    eligibility = ExecutionEligibilityOut(allowed=True, mode=mode)
    draft = CanonicalOrderDraftOut(
        order_type=order_type,
        entry=float(entry),
        stop=float(stop),
        target=float(target),
        shares=shares,
        rr=float(rr),
        quote_currency=quote_currency,
        approval_token=approval_token or None,
    )
    return eligibility, draft


def _number(value: Decimal) -> float:
    return round(float(value), 4)


def _gate(
    passed: bool,
    pass_text: str,
    block_text: str,
    *,
    current: Decimal | None = None,
    projected: Decimal | None = None,
    limit: Decimal | None = None,
) -> PortfolioApprovalGate:
    return PortfolioApprovalGate(
        status="PASS" if passed else "BLOCK",
        explanation=pass_text if passed else block_text,
        current=_number(current) if current is not None else None,
        projected=_number(projected) if projected is not None else None,
        limit=_number(limit) if limit is not None else None,
    )


def evaluate_order_approval(
    context: VerifiedApprovalToken,
    submitted: SubmittedPlan,
    snapshot: ExposureSnapshot,
    policy: EffectiveOrderPolicy,
) -> PortfolioOrderApproval:
    proposed = next(line for line in snapshot.lines if line.source == "proposed")
    trigger_pass = context.trigger_status == "PASS" or (
        context.order_type == "BUY_LIMIT"
        and context.trigger_status == "WAIT"
        and context.pullback_wait_authorized
    )
    decision_pass = (
        context.setup_status == "PASS"
        and trigger_pass
        and context.plan_status == "PASS"
        and context.data_status == "current"
        and bool(context.data_asof)
        and context.target_source in {"structural", "manual"}
    )
    decision = _gate(
        decision_pass,
        "Signed decision and freshness permissions pass.",
        "Signed decision or freshness permission does not pass.",
    )

    finite_plan = all(
        value.is_finite()
        for value in (submitted.entry, submitted.stop, submitted.target)
    )
    coherent = (
        finite_plan
        and submitted.quantity > 0
        and submitted.stop > 0
        and submitted.stop < submitted.entry < submitted.target
    )
    coherence = _gate(
        coherent,
        "Submitted entry, stop, and target form a coherent long plan.",
        "Submitted entry, stop, and target do not form a coherent long plan.",
    )
    rr = (
        (submitted.target - submitted.entry) / (submitted.entry - submitted.stop)
        if coherent
        else Decimal("0")
    )
    reward_risk = _gate(
        coherent and rr >= policy.min_rr,
        "Structural reward/risk meets policy.",
        "Structural reward/risk is below policy.",
        projected=rr,
        limit=policy.min_rr,
    )

    fees = proposed.notional_account * policy.commission_pct * Decimal("2")
    planned_risk = proposed.price_risk_account + fees
    trade_risk_limit = policy.account_size * policy.risk_pct
    trade_risk = _gate(
        planned_risk <= trade_risk_limit,
        "Planned trade risk is within policy.",
        "Planned trade risk exceeds policy.",
        projected=planned_risk,
        limit=trade_risk_limit,
    )

    same_symbol_notional = sum(
        (
            line.notional_account
            for line in snapshot.lines
            if line.ticker == submitted.ticker.upper()
        ),
        Decimal("0"),
    )
    position_limit = policy.account_size * policy.max_position_pct
    position = _gate(
        same_symbol_notional <= position_limit,
        "Projected same-symbol position is within policy.",
        "Projected same-symbol position exceeds policy.",
        projected=same_symbol_notional,
        limit=position_limit,
    )
    cash = _gate(
        snapshot.projected_notional <= policy.account_size,
        "Projected notional fits available capital.",
        "Projected notional exceeds available capital.",
        current=snapshot.current_notional,
        projected=snapshot.projected_notional,
        limit=policy.account_size,
    )
    projected_heat = snapshot.projected_price_risk + fees
    heat_limit = policy.account_size * policy.max_portfolio_heat_pct
    heat = _gate(
        projected_heat <= heat_limit,
        "Projected portfolio heat is within policy.",
        "Projected portfolio heat exceeds policy.",
        current=snapshot.current_risk,
        projected=projected_heat,
        limit=heat_limit,
    )
    fee_ratio = (
        fees / proposed.price_risk_account
        if proposed.price_risk_account > 0
        else Decimal("Infinity")
    )
    fee_gate = _gate(
        fee_ratio.is_finite() and fee_ratio <= policy.max_fee_risk_pct,
        "Estimated fees are within the risk budget.",
        "Estimated fees consume too much planned price risk.",
        projected=fee_ratio if fee_ratio.is_finite() else None,
        limit=policy.max_fee_risk_pct,
    )
    event = _gate(
        context.days_to_earnings > 3,
        "Earnings are outside the three-day risk window.",
        "Earnings are inside the three-day risk window.",
    )
    fx = _gate(
        True,
        "All exposure has complete currency context.",
        "Currency context is missing.",
    )

    total_risk = snapshot.projected_price_risk
    proposed_country = country_from_ticker(submitted.ticker)
    country_risk = sum(
        (
            line.price_risk_account
            for line in snapshot.lines
            if line.country == proposed_country
        ),
        Decimal("0"),
    )
    concentration_pct = (
        country_risk / total_risk * Decimal("100") if total_risk > 0 else Decimal("0")
    )
    warn = concentration_pct >= policy.max_concentration_pct
    concentration = PortfolioApprovalGate(
        status="WARN" if warn else "PASS",
        explanation=(
            f"Projected {proposed_country} risk concentration meets or exceeds the warning threshold."
            if warn
            else f"Projected {proposed_country} risk concentration is below the warning threshold."
        ),
        projected=_number(concentration_pct),
        limit=_number(policy.max_concentration_pct),
    )

    hard_gates = (
        decision,
        coherence,
        reward_risk,
        trade_risk,
        position,
        cash,
        heat,
        fee_gate,
        event,
        fx,
    )
    policy_values = {
        key: (_number(value) if isinstance(value, Decimal) else value)
        for key, value in asdict(policy).items()
    }
    return PortfolioOrderApproval(
        approved=all(gate.status != "BLOCK" for gate in hard_gates),
        decision=decision,
        coherence=coherence,
        reward_risk=reward_risk,
        trade_risk=trade_risk,
        position=position,
        cash=cash,
        heat=heat,
        fees=fee_gate,
        fx=fx,
        concentration=concentration,
        event=event,
        projected_risk=_number(planned_risk),
        projected_notional=_number(proposed.notional_account),
        estimated_fees=_number(fees),
        current_exposure={
            "notional": _number(snapshot.current_notional),
            "risk": _number(snapshot.current_risk),
        },
        projected_exposure={
            "notional": _number(snapshot.projected_notional),
            "risk": _number(projected_heat),
        },
        policy_version=policy.version,
        policy_values=policy_values,
        token_id=context.token_id,
        plan_fingerprint=context.plan_fingerprint,
        verified_context=context.model_dump(mode="json"),
    )
