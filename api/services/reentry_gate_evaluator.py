"""Evaluates re-entry gate rules for screener candidates with prior trade history."""
from __future__ import annotations

from api.models.screener import ReentryCheckResult, ReentryGateResult, ScreenerCandidate

_SUPPRESS_KEYS = {"thesis_valid", "reward_sufficient", "market_context_clean"}

_STRUCTURAL_KEYS = {"new_setup_present", "stop_defined", "position_size_reset", "timeframe_fits"}


class ReentryGateEvaluator:
    """
    Evaluates 7 re-entry rules for candidates that have prior_trades attached.
    Candidates without prior_trades are left untouched (no gate applied).

    Rules that can cause suppression:
      - thesis_valid: recommendation.verdict == "RECOMMENDED"
      - reward_sufficient: candidate.rr >= rr_threshold
      - market_context_clean: ticker not in upcoming_earnings_tickers

    Structural rules (always pass — included for display only):
      - new_setup_present, stop_defined, position_size_reset, timeframe_fits
    """

    def __init__(
        self,
        *,
        rr_threshold: float = 2.0,
        upcoming_earnings_tickers: set[str] | None = None,
    ) -> None:
        self._rr_threshold = rr_threshold
        self._upcoming_earnings: set[str] = {t.upper() for t in (upcoming_earnings_tickers or set())}

    def evaluate(self, candidates: list[ScreenerCandidate]) -> list[ScreenerCandidate]:
        for candidate in candidates:
            if candidate.prior_trades is None:
                continue
            checks = self._run_checks(candidate)
            suppressed = any(
                not checks[key].passed for key in _SUPPRESS_KEYS if key in checks
            )
            candidate.reentry_gate = ReentryGateResult(suppressed=suppressed, checks=checks)
        return candidates

    def _run_checks(self, candidate: ScreenerCandidate) -> dict[str, ReentryCheckResult]:
        checks: dict[str, ReentryCheckResult] = {}

        # Structural — always pass
        for key in _STRUCTURAL_KEYS:
            checks[key] = ReentryCheckResult(passed=True, reason="Structural guarantee.")

        # thesis_valid
        rec = candidate.recommendation
        if rec is not None and rec.verdict == "RECOMMENDED":
            checks["thesis_valid"] = ReentryCheckResult(
                passed=True, reason="Recommendation verdict is RECOMMENDED."
            )
        else:
            verdict = rec.verdict if rec else "missing"
            checks["thesis_valid"] = ReentryCheckResult(
                passed=False,
                reason=f"Recommendation verdict is '{verdict}', not RECOMMENDED.",
            )

        # reward_sufficient
        rr = candidate.rr
        if rr is not None and rr >= self._rr_threshold:
            checks["reward_sufficient"] = ReentryCheckResult(
                passed=True,
                reason=f"R/R {rr:.2f} >= threshold {self._rr_threshold:.2f}.",
            )
        else:
            actual = f"{rr:.2f}" if rr is not None else "unknown"
            checks["reward_sufficient"] = ReentryCheckResult(
                passed=False,
                reason=f"R/R {actual} is below threshold {self._rr_threshold:.2f}.",
            )

        # market_context_clean
        if candidate.ticker.upper() in self._upcoming_earnings:
            checks["market_context_clean"] = ReentryCheckResult(
                passed=False,
                reason="Earnings within 5 calendar days — market context is not clean.",
            )
        else:
            checks["market_context_clean"] = ReentryCheckResult(
                passed=True, reason="No upcoming earnings detected."
            )

        return checks
