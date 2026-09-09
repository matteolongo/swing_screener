from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
import math

from swing_screener.risk.currency import (
    normalize_account_to_quote_rate,
    normalize_currency_code,
)
from swing_screener.risk.recommendations.workflow import (
    ExecutionNextStep,
    WorkflowStatus,
    derive_execution_workflow,
)

Verdict = Literal["RECOMMENDED", "NOT_RECOMMENDED"]
ReasonSeverity = Literal["info", "warn", "block"]
GateStatus = Literal["PASS", "WAIT", "BLOCK", "UNKNOWN"]

#: Target sources that count as independently validated price structure.
#: Only these sources may produce a validated reward/risk ratio.
INDEPENDENT_TARGET_SOURCES = frozenset({"structural", "manual"})


def resolve_target(
    *,
    entry: Optional[float],
    stop: Optional[float],
    target: Optional[float],
    target_source: str,
) -> tuple[Optional[float], Optional[float], bool]:
    """Resolve a candidate target into its plan values.

    Canonical target-validity rule shared by recommendation gating and trade
    thesis enrichment. Returns `(target, rr, target_is_independent)`:

    - `target_is_independent` reports whether `target_source` is independently
      sourced (`structural`/`manual`). Provenance and validity are separate
      concepts: a non-independent source can still carry a numeric `rr`, but
      that `rr` never validates the plan.
    - When entry/stop cannot define positive per-share risk, the raw `target`
      candidate is echoed with `rr=None` (nothing to measure against).
    - Otherwise a non-finite target, or one at/below entry, normalizes to
      `(None, None)`.
    - Otherwise returns the supplied target with its actual reward/risk ratio.

    `desired_target` (the advisory price implied by `rr_target`) is computed
    separately and never flows through this helper.
    """
    target_is_independent = target_source in INDEPENDENT_TARGET_SOURCES
    if (
        entry is None
        or not math.isfinite(entry)
        or entry <= 0
        or stop is None
        or not math.isfinite(stop)
        or stop <= 0
        or stop >= entry
    ):
        return (target, None, target_is_independent)
    risk_per_share = entry - stop
    if risk_per_share <= 0:
        return (target, None, target_is_independent)
    if target is None or not math.isfinite(target) or target <= entry:
        return (None, None, target_is_independent)
    return (target, (target - entry) / risk_per_share, target_is_independent)


@dataclass(frozen=True)
class Reason:
    code: str
    message: str
    severity: ReasonSeverity
    rule: Optional[str] = None
    metrics: dict[str, float | int | str] = field(default_factory=dict)


@dataclass(frozen=True)
class ChecklistGate:
    gate_name: str
    passed: bool
    explanation: str
    rule: Optional[str] = None


@dataclass(frozen=True)
class DecisionGate:
    status: GateStatus
    explanation: str


@dataclass(frozen=True)
class DecisionGateState:
    """The four independent permissions required before an order is actionable."""

    setup: DecisionGate
    trigger: DecisionGate
    plan: DecisionGate
    portfolio: DecisionGate
    ready_to_order: bool = False


@dataclass(frozen=True)
class RiskPayload:
    entry: float
    stop: Optional[float]
    target: Optional[float]
    desired_target: Optional[float]
    target_source: str
    rr: Optional[float]
    risk_amount: float
    risk_amount_account: float
    risk_pct: float
    position_size: float
    position_size_account: float
    shares: int
    invalidation_level: Optional[float]
    currency: Optional[str] = None
    account_currency: Optional[str] = None
    account_to_quote_rate: Optional[float] = None


@dataclass(frozen=True)
class CostPayload:
    commission_estimate: float
    fx_estimate: float
    slippage_estimate: float
    total_cost: float
    fee_to_risk_pct: Optional[float]


@dataclass(frozen=True)
class EducationPayload:
    common_bias_warning: str
    what_to_learn: str
    what_would_make_valid: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RecommendationPayload:
    verdict: Verdict
    reasons_short: list[str]
    reasons_detailed: list[Reason]
    risk: RiskPayload
    costs: CostPayload
    checklist: list[ChecklistGate]
    decision_gates: DecisionGateState
    workflow_status: WorkflowStatus
    next_step: ExecutionNextStep
    education: EducationPayload
    thesis: Optional[dict] = None  # Trade Thesis (serialized from thesis.TradeThesis)


def _estimate_costs(
    *,
    entry: float,
    shares: int,
    commission_pct: float,
    slippage_bps: float,
    fx_estimate_pct: float,
) -> CostPayload:
    position_size = entry * shares
    commission_est = position_size * commission_pct * 2.0
    slippage_est = position_size * (slippage_bps / 10000.0) * 2.0
    fx_est = position_size * fx_estimate_pct
    total = commission_est + slippage_est + fx_est
    return CostPayload(
        commission_estimate=round(commission_est, 4),
        fx_estimate=round(fx_est, 4),
        slippage_estimate=round(slippage_est, 4),
        total_cost=round(total, 4),
        fee_to_risk_pct=None,
    )


def build_recommendation(
    *,
    signal: Optional[str],
    entry: Optional[float],
    stop: Optional[float],
    shares: Optional[int],
    account_size: float,
    risk_pct_target: float,
    rr_target: float,
    target: Optional[float] = None,
    target_source: str = "risk_multiple",
    data_status: str = "current",
    min_rr: float = 2.0,
    max_fee_risk_pct: float = 0.20,
    commission_pct: float = 0.0,
    slippage_bps: float = 5.0,
    fx_estimate_pct: float = 0.0,
    min_shares: int = 1,
    max_position_pct: float = 1.0,
    currency: Optional[str] = None,
    account_currency: Optional[str] = None,
    account_to_quote_rate: Optional[float] = None,
    thesis: Optional[dict] = None,  # Trade Thesis dictionary
) -> RecommendationPayload:
    if entry is None or not math.isfinite(entry) or entry <= 0:
        entry = 0.0

    stop_invalid = False
    if stop is None:
        stop = None
    elif not math.isfinite(stop) or stop <= 0:
        stop = None
        stop_invalid = True
    elif entry > 0 and stop >= entry:
        stop = None
        stop_invalid = True

    # A setup can be qualified before it is executable. Conditional decision
    # actions never count as an observed market trigger.
    setup_qualified = signal in {
        "both",
        "breakout",
        "pullback",
        "BUY_NOW",
        "BUY_ON_PULLBACK",
        "WAIT_FOR_BREAKOUT",
    }
    entry_triggered = signal in {"both", "breakout", "pullback", "BUY_NOW"}
    conditional_entry = signal in {"BUY_ON_PULLBACK", "WAIT_FOR_BREAKOUT"}

    stop_defined = stop is not None and entry > 0 and stop < entry
    risk_per_share = (entry - stop) if stop_defined else None

    quote_currency = normalize_currency_code(currency)
    account_currency_code = normalize_currency_code(account_currency)
    currency_unknown = quote_currency == "UNKNOWN"
    same_currency = (
        quote_currency is not None
        and account_currency_code is not None
        and quote_currency == account_currency_code
    )
    fx_rate_missing = (
        quote_currency is not None
        and account_currency_code is not None
        and not same_currency
        and account_to_quote_rate is None
    )
    sizing_blocked = currency_unknown or fx_rate_missing

    normalized_rate = (
        1.0
        if account_to_quote_rate is None or same_currency
        else normalize_account_to_quote_rate(account_to_quote_rate)
    )
    risk_amount_target_account = account_size * risk_pct_target
    risk_amount_target = risk_amount_target_account * normalized_rate
    shares_final = 0 if sizing_blocked else shares if shares is not None else None

    if (
        not sizing_blocked
        and shares_final is None
        and risk_per_share
        and risk_per_share > 0
    ):
        shares_by_risk = math.floor(risk_amount_target / risk_per_share)
        shares_final = max(0, int(shares_by_risk))

    # Cap shares by max position size (e.g. 50% of account)
    if not sizing_blocked and entry > 0 and max_position_pct > 0:
        max_position_value = account_size * max_position_pct * normalized_rate
        shares_by_cap = math.floor(max_position_value / entry)
        if shares_final is None:
            shares_final = shares_by_cap
        else:
            shares_final = min(shares_final, shares_by_cap)

    if shares_final is None:
        shares_final = 0

    tradable_size = False if sizing_blocked else shares_final >= min_shares

    position_size = entry * shares_final
    risk_amount = (risk_per_share * shares_final) if risk_per_share else 0.0
    position_size_account = position_size / normalized_rate
    risk_amount_account = risk_amount / normalized_rate
    risk_pct = (risk_amount_account / account_size) if account_size > 0 else 0.0

    desired_target = None
    if stop_defined and risk_per_share and risk_per_share > 0:
        desired_target = entry + (rr_target * risk_per_share)
    target, rr, target_is_independent = resolve_target(
        entry=entry, stop=stop, target=target, target_source=target_source
    )

    costs = _estimate_costs(
        entry=entry,
        shares=shares_final,
        commission_pct=commission_pct,
        slippage_bps=slippage_bps,
        fx_estimate_pct=fx_estimate_pct,
    )

    fee_to_risk_pct = (costs.total_cost / risk_amount) if risk_amount > 0 else None
    costs = CostPayload(
        commission_estimate=costs.commission_estimate,
        fx_estimate=costs.fx_estimate,
        slippage_estimate=costs.slippage_estimate,
        total_cost=costs.total_cost,
        fee_to_risk_pct=(
            round(fee_to_risk_pct, 4) if fee_to_risk_pct is not None else None
        ),
    )

    rr_ok = target_is_independent and rr is not None and rr >= min_rr
    data_current = data_status == "current"
    fee_ok = fee_to_risk_pct is not None and fee_to_risk_pct <= max_fee_risk_pct
    risk_ok = not sizing_blocked and (
        risk_pct <= risk_pct_target + 1e-9 if risk_pct_target > 0 else False
    )

    checklist = [
        ChecklistGate(
            gate_name="setup_qualified",
            passed=setup_qualified,
            explanation=(
                "Setup qualifies for review."
                if setup_qualified
                else "No qualified setup."
            ),
            rule="R5",
        ),
        ChecklistGate(
            gate_name="entry_triggered",
            passed=entry_triggered,
            explanation=(
                "The market entry condition has triggered."
                if entry_triggered
                else (
                    "Entry condition is still waiting for price confirmation."
                    if conditional_entry
                    else "No entry trigger is active."
                )
            ),
            rule="R5",
        ),
        ChecklistGate(
            gate_name="data_current",
            passed=data_current,
            explanation=(
                "Critical market data is current."
                if data_current
                else f"Critical market data is {data_status}; actionable output is blocked."
            ),
            rule="R1",
        ),
        ChecklistGate(
            gate_name="stop_defined",
            passed=stop_defined,
            explanation=(
                "Stop defined below entry."
                if stop_defined
                else (
                    "Stop must be positive and below entry."
                    if stop_invalid
                    else "Stop is missing."
                )
            ),
            rule="R2",
        ),
        ChecklistGate(
            gate_name="tradable_size",
            passed=tradable_size,
            explanation=(
                "Position size meets minimum shares."
                if tradable_size
                else "Position too small to trade."
            ),
            rule="R4",
        ),
        ChecklistGate(
            gate_name="risk_budget",
            passed=risk_ok,
            explanation=(
                "Risk within target budget."
                if risk_ok
                else "Risk exceeds target budget."
            ),
            rule="R2",
        ),
        ChecklistGate(
            gate_name="rr_threshold",
            passed=rr_ok,
            explanation=f"RR >= {min_rr:.1f}." if rr_ok else f"RR below {min_rr:.1f}.",
            rule="R3",
        ),
        ChecklistGate(
            gate_name="fee_to_risk",
            passed=fee_ok,
            explanation=(
                f"Fees <= {int(max_fee_risk_pct * 100)}% of risk."
                if fee_ok
                else f"Fees too high vs risk (>{int(max_fee_risk_pct * 100)}%)."
            ),
            rule="R4",
        ),
    ]

    reasons_detailed: list[Reason] = []
    suggestions: list[str] = []

    if not setup_qualified:
        reasons_detailed.append(
            Reason(
                code="NO_SIGNAL",
                message="No active signal from the system.",
                severity="block",
                rule="R5",
            )
        )
        suggestions.append("Wait for a breakout or pullback signal.")

    if conditional_entry:
        reasons_detailed.append(
            Reason(
                code="ENTRY_NOT_TRIGGERED",
                message="The setup is conditional; its entry trigger has not occurred.",
                severity="block",
                rule="R5",
            )
        )
        suggestions.append(
            "Keep the setup on the watchlist until its price condition triggers."
        )

    if not data_current:
        reasons_detailed.append(
            Reason(
                code="DATA_NOT_CURRENT",
                message=f"Critical market data is {data_status}; refresh before acting.",
                severity="block",
                rule="R1",
            )
        )
        suggestions.append("Refresh market data after the relevant session close.")

    if currency_unknown:
        reasons_detailed.append(
            Reason(
                code="CURRENCY_UNKNOWN",
                message="Quote currency is unknown, so execution sizing is blocked.",
                severity="block",
                rule="R2",
            )
        )
        suggestions.append("Resolve the instrument quote currency before sizing.")

    if fx_rate_missing:
        reasons_detailed.append(
            Reason(
                code="FX_RATE_MISSING",
                message="FX conversion rate is required before cross-currency sizing.",
                severity="block",
                rule="R2",
            )
        )
        suggestions.append("Fetch or provide the account-to-quote FX rate.")

    if not stop_defined and stop_invalid:
        reasons_detailed.append(
            Reason(
                code="STOP_INVALID",
                message="Stop must be a positive value below entry for a long trade.",
                severity="block",
                rule="R2",
            )
        )
        suggestions.append("Use a positive stop below the planned long entry.")
    elif not stop_defined:
        reasons_detailed.append(
            Reason(
                code="STOP_MISSING",
                message="A stop/invalid level is required before the trade can be considered.",
                severity="block",
                rule="R2",
            )
        )
        suggestions.append("Define a stop below entry using ATR or structure.")

    if stop_defined and not tradable_size and not sizing_blocked:
        reasons_detailed.append(
            Reason(
                code="POSITION_TOO_SMALL",
                message="Position size is too small to meet minimum shares.",
                severity="block",
                rule="R4",
            )
        )
        suggestions.append(
            "Increase account size per trade or avoid low-priced tickers."
        )

    if stop_defined and not risk_ok:
        reasons_detailed.append(
            Reason(
                code="RISK_TOO_HIGH",
                message="Risk exceeds the configured risk budget.",
                severity="block",
                rule="R2",
                metrics={
                    "risk_pct": round(risk_pct, 4),
                    "risk_pct_target": round(risk_pct_target, 4),
                },
            )
        )
        suggestions.append("Reduce position size or widen account risk budget.")

    if stop_defined and not target_is_independent:
        reasons_detailed.append(
            Reason(
                code="TARGET_NOT_VALIDATED",
                message="The desired R-multiple target has not been validated against price structure.",
                severity="block",
                rule="R3",
            )
        )
        suggestions.append(
            "Validate a target from resistance, volume zones, or a documented manual level."
        )
    elif stop_defined and not rr_ok:
        reasons_detailed.append(
            Reason(
                code="RR_TOO_LOW",
                message="Reward-to-risk is below the minimum threshold.",
                severity="block",
                rule="R3",
                metrics={
                    "rr": round(rr, 4) if rr is not None else 0.0,
                    "min_rr": min_rr,
                },
            )
        )
        suggestions.append("Tighten the stop or aim for a higher target to reach RR.")

    if stop_defined and not fee_ok:
        reasons_detailed.append(
            Reason(
                code="FEES_TOO_HIGH",
                message="Estimated fees are too high versus planned risk.",
                severity="block",
                rule="R4",
                metrics={"fee_to_risk_pct": round(fee_to_risk_pct or 0.0, 4)},
            )
        )
        suggestions.append("Avoid micro-sized trades where fees dominate risk.")

    verdict: Verdict = (
        "RECOMMENDED" if all(g.passed for g in checklist) else "NOT_RECOMMENDED"
    )

    plan_passed = (
        data_current and stop_defined and tradable_size and risk_ok and rr_ok and fee_ok
    )
    decision_gates = DecisionGateState(
        setup=DecisionGate(
            status="PASS" if setup_qualified else "BLOCK",
            explanation=(
                "Setup qualifies for review."
                if setup_qualified
                else "No qualified setup."
            ),
        ),
        trigger=DecisionGate(
            status=(
                "PASS" if entry_triggered else "WAIT" if conditional_entry else "BLOCK"
            ),
            explanation=(
                "Entry trigger observed."
                if entry_triggered
                else (
                    "Waiting for the configured entry condition."
                    if conditional_entry
                    else "No entry trigger is active."
                )
            ),
        ),
        plan=DecisionGate(
            status=(
                "PASS"
                if plan_passed
                else "UNKNOWN" if not target_is_independent else "BLOCK"
            ),
            explanation=(
                "Trigger, stop, structural target, size, costs, and risk reconcile."
                if plan_passed
                else (
                    "A structural/manual target is required before reward/risk can be validated."
                    if not target_is_independent
                    else "The trade plan fails one or more risk checks."
                )
            ),
        ),
        portfolio=DecisionGate(
            status="UNKNOWN",
            explanation="Portfolio permission is evaluated immediately before order creation.",
        ),
        ready_to_order=False,
    )
    workflow = derive_execution_workflow(
        setup_status=decision_gates.setup.status,
        trigger_status=decision_gates.trigger.status,
        plan_status=decision_gates.plan.status,
        signal=signal,
        trigger_price=entry if entry > 0 else None,
        currency=quote_currency,
        reason_codes=(reason.code for reason in reasons_detailed),
    )

    if verdict == "RECOMMENDED":
        reasons_short = [
            "Signal active with valid stop.",
            f"RR {rr:.2f} meets minimum." if rr is not None else "RR meets minimum.",
            f"Risk {risk_pct * 100:.2f}% of account.",
        ]
        bias_warning = "Avoid taking quick profits while letting losses run."
        what_to_learn = "Focus on asymmetric payoff and strict invalidation levels."
    else:
        short = [r.message for r in reasons_detailed if r.severity == "block"][:3]
        reasons_short = short if short else ["Setup does not meet risk rules."]
        if any(r.code == "RR_TOO_LOW" for r in reasons_detailed):
            bias_warning = "Small wins/large losses tendency."
            what_to_learn = "Require asymmetric payoff before acting."
        elif any(r.code == "FEES_TOO_HIGH" for r in reasons_detailed):
            bias_warning = "Overtrading and fee drag."
            what_to_learn = "Prioritize fewer, higher-quality trades."
        else:
            bias_warning = "Skipping invalid setups protects capital."
            what_to_learn = "Follow the checklist before acting."

    risk_payload = RiskPayload(
        entry=round(entry, 4),
        stop=round(stop, 4) if stop is not None else None,
        target=round(target, 4) if target is not None else None,
        desired_target=round(desired_target, 4) if desired_target is not None else None,
        target_source=(
            target_source if target_is_independent else "unvalidated_r_multiple"
        ),
        rr=round(rr, 4) if rr is not None else None,
        risk_amount=round(risk_amount, 4),
        risk_amount_account=round(risk_amount_account, 4),
        risk_pct=round(risk_pct, 6),
        position_size=round(position_size, 4),
        position_size_account=round(position_size_account, 4),
        shares=int(shares_final),
        invalidation_level=round(stop, 4) if stop is not None else None,
        currency=quote_currency,
        account_currency=account_currency_code,
        account_to_quote_rate=(None if sizing_blocked else round(normalized_rate, 8)),
    )

    education = EducationPayload(
        common_bias_warning=bias_warning,
        what_to_learn=what_to_learn,
        what_would_make_valid=suggestions,
    )

    return RecommendationPayload(
        verdict=verdict,
        reasons_short=reasons_short,
        reasons_detailed=reasons_detailed,
        risk=risk_payload,
        costs=costs,
        checklist=checklist,
        decision_gates=decision_gates,
        workflow_status=workflow.status,
        next_step=workflow.next_step,
        education=education,
        thesis=thesis,
    )
