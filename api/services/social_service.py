"""Social analysis service."""
from __future__ import annotations

from api.models.social import SocialAnalysisRequest, SocialAnalysisResponse, SocialRawEvent
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.strategy.config import build_social_overlay_config
from swing_screener.social.analysis import analyze_social_symbol


class SocialService:
    def __init__(self, strategy_repo: StrategyRepository) -> None:
        self._strategy_repo = strategy_repo

    def analyze(self, request: SocialAnalysisRequest) -> SocialAnalysisResponse:
        symbol = str(request.symbol).strip().upper()
        overlay_cfg = build_social_overlay_config(self._strategy_repo.get_active_strategy())

        lookback_hours = request.lookback_hours or overlay_cfg.lookback_hours
        provider = request.provider or "reddit"
        max_events = request.max_events or 100

        result = analyze_social_symbol(
            symbol,
            lookback_hours=lookback_hours,
            min_sample_size=overlay_cfg.min_sample_size,
            provider_name=provider,
            max_events=max_events,
        )

        raw_events = [
            SocialRawEvent(
                source=ev.source,
                symbol=ev.symbol,
                timestamp=ev.timestamp.isoformat(),
                text=ev.text,
                author_id_hash=ev.author_id_hash,
                upvotes=ev.upvotes,
                url=ev.url,
                metadata=ev.metadata,
            )
            for ev in result.get("raw_events", [])
        ]

        return SocialAnalysisResponse(
            status=result.get("status", "error"),
            symbol=result.get("symbol", symbol),
            provider=result.get("provider", provider),
            lookback_hours=int(result.get("lookback_hours", lookback_hours)),
            last_execution_at=result.get("last_execution_at"),
            sample_size=int(result.get("sample_size", 0)),
            sentiment_score=result.get("sentiment_score"),
            sentiment_confidence=result.get("sentiment_confidence"),
            attention_score=float(result.get("attention_score", 0.0)),
            attention_z=result.get("attention_z"),
            hype_score=result.get("hype_score"),
            reasons=result.get("reasons", []),
            raw_events=raw_events,
            error=result.get("error"),
        )
