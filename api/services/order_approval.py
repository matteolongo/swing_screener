"""Pure, deterministic entry-order approval policy."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal

from api.models.portfolio import PortfolioApprovalGate, PortfolioOrderApproval
from api.services.order_approval_token import VerifiedApprovalToken
from api.services.order_exposure import ExposureSnapshot, country_from_ticker


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
    decision_pass = (
        context.setup_status == "PASS"
        and context.trigger_status == "PASS"
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
