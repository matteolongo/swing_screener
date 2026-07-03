from __future__ import annotations

import datetime as dt
from collections.abc import Callable

from api.models.portfolio import PositionUpdate, PositionWithMetrics
from api.models.position_review import (
    MacroOverlay,
    MoveExplanation,
    PositionReviewRequest,
    PositionReviewResponse,
    ProfitProtection,
    ReviewEvidence,
    StopAdvice,
    SuggestedAction,
    ThesisStatus,
)
from api.services.portfolio_service import PortfolioService
from swing_screener.intelligence.evidence.collect import collect_evidence
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.intelligence.cache import read_from_cache


class MissingPositionReviewContextError(RuntimeError):
    """Raised when a manual review has no position, cached analysis, or evidence."""


class PositionReviewService:
    def __init__(
        self,
        *,
        portfolio_service: PortfolioService,
        read_intelligence_fn: Callable[[str], SymbolIntelligence | None] = read_from_cache,
        collect_evidence_fn: Callable[[str], list[SourceEvidence]] = collect_evidence,
        now_fn: Callable[[], str] | None = None,
    ) -> None:
        self._portfolio_service = portfolio_service
        self._read_intelligence = read_intelligence_fn
        self._collect_evidence = collect_evidence_fn
        self._now = now_fn or (lambda: dt.datetime.now(dt.UTC).isoformat())

    def review_position(
        self,
        position_id: str,
        request: PositionReviewRequest | None = None,
    ) -> PositionReviewResponse:
        req = request or PositionReviewRequest()
        position = self._find_open_position(position_id)
        if position is None:
            raise MissingPositionReviewContextError(f"No open position with id {position_id!r}")

        ticker = position.ticker.upper()
        intelligence = self._read_intelligence(ticker)
        fresh_evidence = self._collect_evidence(ticker) if req.refresh_sources else []
        stop_update = self._safe_stop_update(position_id)
        evidence = self._evidence_from_context(intelligence, fresh_evidence)
        return self._build_response(
            ticker=ticker,
            mode="position",
            position=position,
            intelligence=intelligence,
            fresh_evidence=fresh_evidence,
            evidence=evidence,
            stop_update=stop_update,
        )

    def review_symbol(
        self,
        ticker: str,
        request: PositionReviewRequest | None = None,
    ) -> PositionReviewResponse:
        req = request or PositionReviewRequest()
        upper = ticker.upper()
        intelligence = self._read_intelligence(upper)
        fresh_evidence = self._collect_evidence(upper) if req.refresh_sources else []
        evidence = self._evidence_from_context(intelligence, fresh_evidence)
        if intelligence is None and not evidence:
            raise MissingPositionReviewContextError(
                f"No cached intelligence or refreshed evidence available for {upper}"
            )
        return self._build_response(
            ticker=upper,
            mode="symbol",
            position=None,
            intelligence=intelligence,
            fresh_evidence=fresh_evidence,
            evidence=evidence,
            stop_update=None,
        )

    def _find_open_position(self, position_id: str) -> PositionWithMetrics | None:
        response = self._portfolio_service.list_positions(
            status="open",
            time_stop_days=None,
            time_stop_min_r=None,
        )
        return next((p for p in response.positions if p.position_id == position_id), None)

    def _safe_stop_update(self, position_id: str) -> PositionUpdate | None:
        try:
            return self._portfolio_service.suggest_position_stop(position_id)
        except Exception:
            return None

    def _build_response(
        self,
        *,
        ticker: str,
        mode: str,
        position: PositionWithMetrics | None,
        intelligence: SymbolIntelligence | None,
        fresh_evidence: list[SourceEvidence],
        evidence: list[ReviewEvidence],
        stop_update: PositionUpdate | None,
    ) -> PositionReviewResponse:
        thesis_status = self._thesis_status(intelligence, evidence)
        macro_overlay = self._macro_overlay(intelligence, fresh_evidence, evidence)
        profit_protection = self._profit_protection(position, intelligence, macro_overlay)
        stop_advice = self._stop_advice(position, stop_update)
        suggested_action = self._suggested_action(
            mode=mode,
            thesis_status=thesis_status,
            profit_protection=profit_protection,
            stop_advice=stop_advice,
            macro_overlay=macro_overlay,
        )
        move_explanation = self._move_explanation(
            ticker=ticker,
            position=position,
            intelligence=intelligence,
            evidence=evidence,
            macro_overlay=macro_overlay,
        )
        narrative = self._narrative(
            ticker=ticker,
            suggested_action=suggested_action,
            thesis_status=thesis_status,
            profit_protection=profit_protection,
            stop_advice=stop_advice,
            macro_overlay=macro_overlay,
        )
        return PositionReviewResponse(
            ticker=ticker,
            generated_at=self._now(),
            mode=mode,  # type: ignore[arg-type]
            suggested_action=suggested_action,
            thesis_status=thesis_status,
            move_explanation=move_explanation,
            profit_protection=profit_protection,
            stop_advice=stop_advice,
            macro_overlay=macro_overlay,
            evidence_used=evidence,
            narrative=narrative,
        )

    def _thesis_status(
        self,
        intelligence: SymbolIntelligence | None,
        evidence: list[ReviewEvidence],
    ) -> ThesisStatus:
        if intelligence and intelligence.position_outlook:
            return intelligence.position_outlook.thesis_status
        bearish_count = sum(1 for item in evidence if self._has_any(item, ("miss", "downgrade", "selling", "risk")))
        bullish_count = sum(1 for item in evidence if self._has_any(item, ("beat", "upgrade", "demand", "growth")))
        if bearish_count >= 2 and bearish_count > bullish_count:
            return "weakening"
        if bullish_count > bearish_count:
            return "intact"
        return "unclear"

    def _macro_overlay(
        self,
        intelligence: SymbolIntelligence | None,
        fresh_evidence: list[SourceEvidence],
        evidence: list[ReviewEvidence],
    ) -> MacroOverlay:
        text = " ".join(
            [
                *(self._evidence_text(item) for item in evidence),
                *(str(event.summary) for event in (intelligence.upcoming_events if intelligence else []) if event.type == "macro"),
            ]
        ).lower()
        has_macro = any(
            key in text
            for key in ("macro", "geopolitical", "rates", "inflation", "fed", "war", "tariff", "oil", "recession")
        )
        if has_macro and fresh_evidence:
            return MacroOverlay(
                risk_level="medium",
                technical_reliability="reduced",
                reason="Fresh macro or geopolitical evidence is present; technical follow-through can be less reliable.",
                affected_timeframe="days",
            )
        if has_macro:
            return MacroOverlay(
                risk_level="medium",
                technical_reliability="reduced",
                reason="Cached analysis includes macro-sensitive evidence; size and stop decisions should account for event risk.",
                affected_timeframe="days",
            )
        return MacroOverlay(
            risk_level="low",
            technical_reliability="normal",
            reason="No material macro or geopolitical override was found in the available app context.",
            affected_timeframe="unknown",
        )

    def _profit_protection(
        self,
        position: PositionWithMetrics | None,
        intelligence: SymbolIntelligence | None,
        macro_overlay: MacroOverlay,
    ) -> ProfitProtection:
        if position is None:
            return ProfitProtection(
                current_r=None,
                move_extension="unknown",
                trim_advice="none",
                reason="No held position was supplied, so profit protection is not applicable.",
            )
        current_r = float(position.r_now)
        extension = self._move_extension(position)
        days_to_event = self._nearest_event_days(intelligence)
        if current_r >= 4 or macro_overlay.risk_level == "high":
            trim = "trim_33_percent"
        elif current_r >= 2 and (extension in {"medium", "high"} or days_to_event is not None):
            trim = "trim_25_percent"
        elif current_r <= -0.5:
            trim = "none"
        else:
            trim = "none"
        reason = f"Position is at {current_r:.2f}R with {extension} extension."
        if days_to_event is not None:
            reason += f" Upcoming event risk exists in {days_to_event} days."
        if trim != "none":
            reason += " Protect part of the gain while leaving the thesis room to continue."
        return ProfitProtection(
            current_r=round(current_r, 2),
            move_extension=extension,
            trim_advice=trim,  # type: ignore[arg-type]
            reason=reason,
        )

    def _stop_advice(
        self,
        position: PositionWithMetrics | None,
        stop_update: PositionUpdate | None,
    ) -> StopAdvice:
        if position is None:
            return StopAdvice(
                current_stop=None,
                suggested_stop=None,
                method="manual_review",
                reason="No held position was supplied, so no stop can be computed.",
            )
        if stop_update is not None and stop_update.stop_suggested > stop_update.stop_old:
            method = "trail_sma20" if "sma" in stop_update.reason.lower() else "trail_recent_low"
            return StopAdvice(
                current_stop=round(float(stop_update.stop_old), 2),
                suggested_stop=round(float(stop_update.stop_suggested), 2),
                method=method,  # type: ignore[arg-type]
                reason=stop_update.reason,
            )
        if position.r_now >= 1 and position.stop_price < position.entry_price:
            return StopAdvice(
                current_stop=round(float(position.stop_price), 2),
                suggested_stop=round(float(position.entry_price), 2),
                method="breakeven",
                reason="At or above 1R, breakeven protection is the minimum defensive stop.",
            )
        return StopAdvice(
            current_stop=round(float(position.stop_price), 2),
            suggested_stop=round(float(position.stop_price), 2),
            method="keep",
            reason="Existing stop remains consistent with current available context.",
        )

    def _suggested_action(
        self,
        *,
        mode: str,
        thesis_status: ThesisStatus,
        profit_protection: ProfitProtection,
        stop_advice: StopAdvice,
        macro_overlay: MacroOverlay,
    ) -> SuggestedAction:
        if mode == "symbol":
            return "WATCH"
        if thesis_status == "broken":
            return "EXIT"
        if profit_protection.trim_advice != "none":
            return "TRIM" if stop_advice.method == "keep" else "RAISE_STOP"
        if stop_advice.method in {"breakeven", "trail_sma20", "trail_recent_low"}:
            return "RAISE_STOP"
        if macro_overlay.technical_reliability == "unreliable":
            return "WATCH"
        return "HOLD"

    def _move_explanation(
        self,
        *,
        ticker: str,
        position: PositionWithMetrics | None,
        intelligence: SymbolIntelligence | None,
        evidence: list[ReviewEvidence],
        macro_overlay: MacroOverlay,
    ) -> MoveExplanation:
        catalyst_drivers = [
            item.summary or item.label
            for item in evidence
            if self._has_any(item, ("earnings", "beat", "guidance", "upgrade", "downgrade", "demand"))
        ]
        drivers = catalyst_drivers[:3]
        if position is not None:
            drivers.append(f"Position is currently {position.r_now:.2f}R from entry.")
        if intelligence and intelligence.summary_line:
            drivers.insert(0, intelligence.summary_line)
        summary = drivers[0] if drivers else f"{ticker} review is based on available app context."
        company_weight = 55 if catalyst_drivers or intelligence else 25
        macro_weight = 20 if macro_overlay.technical_reliability == "reduced" else 5
        technical_weight = 30 if position else 15
        sector_weight = max(0, 100 - company_weight - macro_weight - technical_weight)
        return MoveExplanation(
            summary=summary,
            company_catalyst_weight=company_weight,
            sector_weight=sector_weight,
            market_macro_weight=macro_weight,
            technical_weight=technical_weight,
            drivers=drivers,
        )

    def _narrative(
        self,
        *,
        ticker: str,
        suggested_action: SuggestedAction,
        thesis_status: ThesisStatus,
        profit_protection: ProfitProtection,
        stop_advice: StopAdvice,
        macro_overlay: MacroOverlay,
    ) -> str:
        return (
            f"{ticker}: {suggested_action}. Thesis is {thesis_status}. "
            f"{profit_protection.reason} Stop plan: {stop_advice.reason} "
            f"Macro overlay: {macro_overlay.reason}"
        )

    def _evidence_from_context(
        self,
        intelligence: SymbolIntelligence | None,
        fresh_evidence: list[SourceEvidence],
    ) -> list[ReviewEvidence]:
        items: list[ReviewEvidence] = []
        if intelligence is not None:
            for item in intelligence.news:
                items.append(
                    ReviewEvidence(
                        label=item.headline,
                        url=item.url,
                        date=item.date,
                        summary=item.headline,
                        relevance=item.sentiment,
                    )
                )
            for catalyst in intelligence.classified_catalysts:
                items.append(
                    ReviewEvidence(
                        label=catalyst.type.value,
                        url=catalyst.source_url,
                        date=catalyst.date,
                        summary=catalyst.summary,
                        relevance=catalyst.direction.value,
                    )
                )
        for item in fresh_evidence:
            items.append(
                ReviewEvidence(
                    label=item.title,
                    source=item.publisher,
                    url=item.url,
                    date=item.published_at,
                    summary=item.quote_or_summary,
                    relevance=item.relevance,
                )
            )
        return items[:12]

    def _move_extension(self, position: PositionWithMetrics) -> str:
        if position.current_price is None or position.entry_price <= 0:
            return "unknown"
        pct = (float(position.current_price) - float(position.entry_price)) / float(position.entry_price)
        if pct >= 0.25 or position.r_now >= 3:
            return "high"
        if pct >= 0.08 or position.r_now >= 1.5:
            return "medium"
        return "low"

    def _nearest_event_days(self, intelligence: SymbolIntelligence | None) -> int | None:
        if intelligence is None:
            return None
        today = dt.date.today()
        upcoming: list[int] = []
        for event in intelligence.upcoming_events:
            if not event.date:
                continue
            try:
                event_date = dt.date.fromisoformat(event.date)
            except ValueError:
                continue
            delta = (event_date - today).days
            if delta >= 0:
                upcoming.append(delta)
        return min(upcoming) if upcoming else None

    def _has_any(self, item: ReviewEvidence, needles: tuple[str, ...]) -> bool:
        text = self._evidence_text(item).lower()
        return any(needle in text for needle in needles)

    @staticmethod
    def _evidence_text(item: ReviewEvidence) -> str:
        return " ".join(
            str(part)
            for part in (item.label, item.source, item.summary, item.relevance)
            if part is not None
        )
