"""Social analysis router."""
from __future__ import annotations

from fastapi import APIRouter

from api.models import SocialAnalysisRequest, SocialAnalysisResponse, SocialRawEvent
from swing_screener.strategy.storage import get_active_strategy
from swing_screener.strategy.config import build_social_overlay_config
from swing_screener.social.analysis import analyze_social_symbol

router = APIRouter()


@router.post("/analyze", response_model=SocialAnalysisResponse)
def analyze(request: SocialAnalysisRequest):
    symbol = str(request.symbol).strip().upper()
    overlay_cfg = build_social_overlay_config(get_active_strategy())

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
