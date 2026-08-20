from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Iterable, Literal, Optional

WorkflowStatus = Literal["ready", "waiting_trigger", "needs_review", "no_setup"]
NextStepCode = Literal[
    "review_order",
    "wait_pullback",
    "wait_breakout_close",
    "define_target",
    "refresh_data",
    "fix_stop",
    "inspect_gate_conflict",
    "observe",
]


@dataclass(frozen=True)
class ExecutionNextStep:
    code: NextStepCode
    trigger_price: Optional[float] = None
    currency: Optional[str] = None


@dataclass(frozen=True)
class ExecutionWorkflow:
    status: WorkflowStatus
    next_step: ExecutionNextStep


_STOP_REASONS = {"STOP_MISSING", "STOP_INVALID"}
_TARGET_REASONS = {"TARGET_NOT_VALIDATED", "RR_TOO_LOW"}
_DATA_REASONS = {"DATA_NOT_CURRENT", "CURRENCY_UNKNOWN", "FX_RATE_MISSING"}


def _needs_review_code(reason_codes: set[str]) -> NextStepCode:
    if reason_codes & _STOP_REASONS:
        return "fix_stop"
    if reason_codes & _TARGET_REASONS:
        return "define_target"
    if reason_codes & _DATA_REASONS:
        return "refresh_data"
    return "inspect_gate_conflict"


def derive_execution_workflow(
    *,
    setup_status: str,
    trigger_status: str,
    plan_status: str,
    signal: Optional[str],
    trigger_price: Optional[float],
    currency: Optional[str],
    reason_codes: Iterable[str],
) -> ExecutionWorkflow:
    reasons = set(reason_codes)

    if setup_status == "BLOCK":
        return ExecutionWorkflow("no_setup", ExecutionNextStep("observe"))
    if setup_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep("inspect_gate_conflict")
        )

    if plan_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep(_needs_review_code(reasons))
        )

    if trigger_status == "WAIT":
        code: NextStepCode
        if signal == "BUY_ON_PULLBACK":
            code = "wait_pullback"
        elif signal == "WAIT_FOR_BREAKOUT":
            code = "wait_breakout_close"
        else:
            return ExecutionWorkflow(
                "needs_review", ExecutionNextStep("inspect_gate_conflict")
            )

        normalized_currency = str(currency or "").strip().upper()
        if (
            trigger_price is None
            or not math.isfinite(trigger_price)
            or trigger_price <= 0
            or normalized_currency in {"", "UNKNOWN"}
        ):
            return ExecutionWorkflow("needs_review", ExecutionNextStep("refresh_data"))
        return ExecutionWorkflow(
            "waiting_trigger",
            ExecutionNextStep(
                code,
                trigger_price=round(float(trigger_price), 4),
                currency=normalized_currency,
            ),
        )

    if trigger_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep("inspect_gate_conflict")
        )

    return ExecutionWorkflow("ready", ExecutionNextStep("review_order"))
