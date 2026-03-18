from __future__ import annotations

from datetime import datetime

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import (
    FundamentalPillarScore,
    FundamentalSnapshot,
    ProviderFundamentalsRecord,
)


def _score_higher(value: float | None, *, weak: float, strong: float) -> float | None:
    if value is None:
        return None
    if value <= weak:
        return 0.0
    if value >= strong:
        return 1.0
    return round((value - weak) / (strong - weak), 4)


def _score_lower(value: float | None, *, strong: float, weak: float) -> float | None:
    if value is None:
        return None
    if value <= strong:
        return 1.0
    if value >= weak:
        return 0.0
    return round((weak - value) / (weak - strong), 4)


def _blend_scores(*values: float | None) -> float | None:
    available = [float(value) for value in values if value is not None]
    if not available:
        return None
    return round(sum(available) / len(available), 4)


def _status_for_score(score: float | None) -> str:
    if score is None:
        return "unavailable"
    if score >= 0.67:
        return "strong"
    if score >= 0.4:
        return "neutral"
    return "weak"


def _freshness_status(most_recent_quarter: str | None, stale_after_days: int) -> str:
    if not most_recent_quarter:
        return "unknown"
    try:
        age_days = (datetime.utcnow().date() - datetime.fromisoformat(most_recent_quarter).date()).days
    except ValueError:
        return "unknown"
    return "stale" if age_days > stale_after_days else "current"


def _coverage_status(record: ProviderFundamentalsRecord, supported: bool) -> str:
    if not supported:
        return "unsupported"
    available = [
        record.revenue_growth_yoy,
        record.earnings_growth_yoy,
        record.gross_margin,
        record.operating_margin,
        record.free_cash_flow_margin,
        record.debt_to_equity,
        record.current_ratio,
        record.return_on_equity,
        record.trailing_pe,
        record.price_to_sales,
    ]
    count = sum(1 for value in available if value is not None)
    if count >= 7:
        return "supported"
    if count >= 4:
        return "partial"
    return "insufficient"


def _is_supported_equity(instrument_type: str) -> bool:
    normalized = str(instrument_type or "").strip().lower()
    return normalized in {"equity", "stock", "common stock"}


def _build_pillars(record: ProviderFundamentalsRecord) -> dict[str, FundamentalPillarScore]:
    growth_score = _blend_scores(
        _score_higher(record.revenue_growth_yoy, weak=-0.05, strong=0.15),
        _score_higher(record.earnings_growth_yoy, weak=-0.1, strong=0.2),
    )
    profitability_score = _blend_scores(
        _score_higher(record.gross_margin, weak=0.2, strong=0.55),
        _score_higher(record.operating_margin, weak=0.05, strong=0.22),
        _score_higher(record.return_on_equity, weak=0.05, strong=0.2),
    )
    balance_sheet_score = _blend_scores(
        _score_lower(record.debt_to_equity, strong=60.0, weak=220.0),
        _score_higher(record.current_ratio, weak=0.9, strong=1.8),
    )
    cash_flow_score = _blend_scores(
        _score_higher(record.free_cash_flow, weak=0.0, strong=1.0),
        _score_higher(record.free_cash_flow_margin, weak=0.0, strong=0.15),
    )
    valuation_score = _blend_scores(
        _score_lower(record.trailing_pe, strong=12.0, weak=35.0),
        _score_lower(record.price_to_sales, strong=2.0, weak=8.0),
    )

    return {
        "growth": FundamentalPillarScore(
            score=growth_score,
            status=_status_for_score(growth_score),
            summary="Revenue and earnings growth profile.",
        ),
        "profitability": FundamentalPillarScore(
            score=profitability_score,
            status=_status_for_score(profitability_score),
            summary="Margins and returns quality.",
        ),
        "balance_sheet": FundamentalPillarScore(
            score=balance_sheet_score,
            status=_status_for_score(balance_sheet_score),
            summary="Leverage and liquidity resilience.",
        ),
        "cash_flow": FundamentalPillarScore(
            score=cash_flow_score,
            status=_status_for_score(cash_flow_score),
            summary="Cash generation and FCF support.",
        ),
        "valuation": FundamentalPillarScore(
            score=valuation_score,
            status=_status_for_score(valuation_score),
            summary="Current valuation pressure.",
        ),
    }


def _build_red_flags(record: ProviderFundamentalsRecord, freshness_status: str) -> list[str]:
    flags: list[str] = []
    if record.earnings_growth_yoy is not None and record.earnings_growth_yoy < 0:
        flags.append("Earnings growth is negative.")
    if record.free_cash_flow is not None and record.free_cash_flow <= 0:
        flags.append("Free cash flow is negative.")
    if record.operating_margin is not None and record.operating_margin < 0.08:
        flags.append("Operating margin is thin.")
    if record.debt_to_equity is not None and record.debt_to_equity > 150:
        flags.append("Leverage is elevated.")
    if record.current_ratio is not None and record.current_ratio < 1.0:
        flags.append("Current ratio is below 1.0.")
    if freshness_status == "stale":
        flags.append("Latest reported quarter looks stale.")
    if record.provider_error:
        flags.append(record.provider_error)
    return flags


def _build_highlights(
    record: ProviderFundamentalsRecord,
    pillars: dict[str, FundamentalPillarScore],
    coverage_status: str,
) -> list[str]:
    highlights: list[str] = []
    if coverage_status == "unsupported":
        highlights.append("Instrument is not a single-company equity.")
        return highlights
    if coverage_status == "insufficient":
        highlights.append("Coverage is still thin; use the snapshot as a partial research aid.")
    if pillars["growth"].status == "strong":
        highlights.append("Growth metrics are supportive.")
    if pillars["profitability"].status == "strong":
        highlights.append("Profitability profile looks healthy.")
    if pillars["balance_sheet"].status == "weak":
        highlights.append("Balance sheet quality needs caution.")
    if pillars["valuation"].status == "weak":
        highlights.append("Valuation looks demanding versus simple heuristics.")
    if not highlights:
        highlights.append("No strong fundamental edge is visible yet.")
    return highlights[:4]


def build_snapshot(record: ProviderFundamentalsRecord, cfg: FundamentalsConfig) -> FundamentalSnapshot:
    supported = _is_supported_equity(record.instrument_type)
    coverage_status = _coverage_status(record, supported)
    freshness_status = _freshness_status(record.most_recent_quarter, cfg.stale_after_days)
    pillars = _build_pillars(record)
    red_flags = _build_red_flags(record, freshness_status)
    highlights = _build_highlights(record, pillars, coverage_status)

    return FundamentalSnapshot(
        symbol=record.symbol,
        asof_date=record.asof_date,
        provider=record.provider,
        updated_at=datetime.utcnow().replace(microsecond=0).isoformat(),
        instrument_type=record.instrument_type,
        supported=supported,
        coverage_status=coverage_status,
        freshness_status=freshness_status,
        company_name=record.company_name,
        sector=record.sector,
        currency=record.currency,
        market_cap=record.market_cap,
        revenue_growth_yoy=record.revenue_growth_yoy,
        earnings_growth_yoy=record.earnings_growth_yoy,
        gross_margin=record.gross_margin,
        operating_margin=record.operating_margin,
        free_cash_flow=record.free_cash_flow,
        free_cash_flow_margin=record.free_cash_flow_margin,
        debt_to_equity=record.debt_to_equity,
        current_ratio=record.current_ratio,
        return_on_equity=record.return_on_equity,
        trailing_pe=record.trailing_pe,
        price_to_sales=record.price_to_sales,
        most_recent_quarter=record.most_recent_quarter,
        pillars=pillars,
        red_flags=red_flags,
        highlights=highlights,
        metric_sources=record.metric_sources,
        error=record.provider_error,
    )


def build_provider_error_snapshot(symbol: str, provider: str, error: str) -> FundamentalSnapshot:
    return FundamentalSnapshot(
        symbol=symbol,
        asof_date=datetime.utcnow().date().isoformat(),
        provider=provider,
        updated_at=datetime.utcnow().replace(microsecond=0).isoformat(),
        supported=True,
        coverage_status="insufficient",
        freshness_status="unknown",
        pillars={},
        red_flags=[error],
        highlights=["Provider call failed; no fresh fundamental snapshot is available."],
        error=error,
    )
