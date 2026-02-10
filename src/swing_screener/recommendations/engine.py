from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
import math


Verdict = Literal["RECOMMENDED", "NOT_RECOMMENDED"]
ReasonSeverity = Literal["info", "warn", "block"]


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
class RiskPayload:
    entry: float
    stop: Optional[float]
    target: Optional[float]
    rr: Optional[float]
    risk_amount: float
    risk_pct: float
    position_size: float
    shares: int
    invalidation_level: Optional[float]


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
    education: EducationPayload


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
    min_rr: float = 2.0,
    max_fee_risk_pct: float = 0.20,
    commission_pct: float = 0.0,
    slippage_bps: float = 5.0,
    fx_estimate_pct: float = 0.0,
    overlay_status: Optional[str] = None,
    min_shares: int = 1,
) -> RecommendationPayload:
    if entry is None or not math.isfinite(entry) or entry <= 0:
        entry = 0.0
    if stop is None or not math.isfinite(stop):
        stop = None

    signal_active = signal in {"both", "breakout", "pullback"}

    stop_defined = stop is not None and stop < entry
    risk_per_share = (entry - stop) if stop_defined else None

    risk_amount_target = account_size * risk_pct_target
    shares_final = shares if shares is not None else None

    if shares_final is None and risk_per_share and risk_per_share > 0:
        shares_by_risk = math.floor(risk_amount_target / risk_per_share)
        shares_final = max(0, int(shares_by_risk))

    if shares_final is None:
        shares_final = 0

    tradable_size = shares_final >= min_shares

    position_size = entry * shares_final
    risk_amount = (risk_per_share * shares_final) if risk_per_share else 0.0
    risk_pct = (risk_amount / account_size) if account_size > 0 else 0.0

    target = None
    rr = None
    if stop_defined and risk_per_share and risk_per_share > 0:
        target = entry + (rr_target * risk_per_share)
        rr = (target - entry) / risk_per_share if risk_per_share > 0 else None

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
        fee_to_risk_pct=round(fee_to_risk_pct, 4) if fee_to_risk_pct is not None else None,
    )

    rr_ok = rr is not None and rr >= min_rr
    fee_ok = fee_to_risk_pct is not None and fee_to_risk_pct <= max_fee_risk_pct
    risk_ok = risk_pct <= risk_pct_target + 1e-9 if risk_pct_target > 0 else False
    overlay_ok = (overlay_status or "").upper() != "VETO"

    checklist = [
        ChecklistGate(
            gate_name="signal_active",
            passed=signal_active,
            explanation="Signal is active (breakout, pullback, or both)." if signal_active else "No active signal.",
            rule="R5",
        ),
        ChecklistGate(
            gate_name="stop_defined",
            passed=stop_defined,
            explanation="Stop defined below entry." if stop_defined else "Stop is missing or above entry.",
            rule="R2",
        ),
        ChecklistGate(
            gate_name="tradable_size",
            passed=tradable_size,
            explanation="Position size meets minimum shares." if tradable_size else "Position too small to trade.",
            rule="R4",
        ),
        ChecklistGate(
            gate_name="risk_budget",
            passed=risk_ok,
            explanation="Risk within target budget." if risk_ok else "Risk exceeds target budget.",
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
            explanation=f"Fees <= {int(max_fee_risk_pct * 100)}% of risk."
            if fee_ok
            else f"Fees too high vs risk (>{int(max_fee_risk_pct * 100)}%).",
            rule="R4",
        ),
        ChecklistGate(
            gate_name="overlay_veto",
            passed=overlay_ok,
            explanation="No social overlay veto." if overlay_ok else "Social overlay veto.",
            rule="R5",
        ),
    ]

    reasons_detailed: list[Reason] = []
    suggestions: list[str] = []

    if not signal_active:
        reasons_detailed.append(
            Reason(
                code="NO_SIGNAL",
                message="No active signal from the system.",
                severity="block",
                rule="R5",
            )
        )
        suggestions.append("Wait for a breakout or pullback signal.")

    if not stop_defined:
        reasons_detailed.append(
            Reason(
                code="STOP_MISSING",
                message="A stop/invalid level is required before the trade can be considered.",
                severity="block",
                rule="R2",
            )
        )
        suggestions.append("Define a stop below entry using ATR or structure.")

    if stop_defined and not tradable_size:
        reasons_detailed.append(
            Reason(
                code="POSITION_TOO_SMALL",
                message="Position size is too small to meet minimum shares.",
                severity="block",
                rule="R4",
            )
        )
        suggestions.append("Increase account size per trade or avoid low-priced tickers.")

    if stop_defined and not risk_ok:
        reasons_detailed.append(
            Reason(
                code="RISK_TOO_HIGH",
                message="Risk exceeds the configured risk budget.",
                severity="block",
                rule="R2",
                metrics={"risk_pct": round(risk_pct, 4), "risk_pct_target": round(risk_pct_target, 4)},
            )
        )
        suggestions.append("Reduce position size or widen account risk budget.")

    if stop_defined and not rr_ok:
        reasons_detailed.append(
            Reason(
                code="RR_TOO_LOW",
                message="Reward-to-risk is below the minimum threshold.",
                severity="block",
                rule="R3",
                metrics={"rr": round(rr, 4) if rr is not None else 0.0, "min_rr": min_rr},
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

    if not overlay_ok:
        reasons_detailed.append(
            Reason(
                code="OVERLAY_VETO",
                message="Social overlay vetoed this trade.",
                severity="block",
                rule="R5",
            )
        )
        suggestions.append("Skip this setup until overlay conditions normalize.")

    # Add soft warnings
    if overlay_status and overlay_status.upper() == "REVIEW":
        reasons_detailed.append(
            Reason(
                code="OVERLAY_REVIEW",
                message="Social overlay suggests review for elevated attention.",
                severity="warn",
                rule="R5",
            )
        )

    verdict: Verdict = "RECOMMENDED" if all(g.passed for g in checklist) else "NOT_RECOMMENDED"

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
        rr=round(rr, 4) if rr is not None else None,
        risk_amount=round(risk_amount, 4),
        risk_pct=round(risk_pct, 6),
        position_size=round(position_size, 4),
        shares=int(shares_final),
        invalidation_level=round(stop, 4) if stop is not None else None,
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
        education=education,
    )
