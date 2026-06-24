"""Fill a SymbolIntelligenceRequest with fundamentals/Finnhub/earnings before the LLM call.

Auto-fetch, block: missing fields are fetched synchronously. Provider failures degrade
to leaving the field None rather than failing the analysis.
"""
from __future__ import annotations

import logging
from typing import Callable, Protocol

from swing_screener.intelligence.models import SymbolIntelligenceRequest, SourceEvidence

logger = logging.getLogger(__name__)

# Snapshot field name -> request field name. Same name on both sides here.
_SNAPSHOT_FIELDS = (
    "sector",
    "trailing_pe",
    "revenue_growth_yoy",
    "gross_margin",
    "net_margin",
    "return_on_equity",
    "debt_to_equity",
    "insider_net_shares_90d",
    "insider_transaction_count_90d",
    "forward_eps_estimate",
    "analyst_upgrade_downgrade_net_30d",
)


class _FundamentalsLike(Protocol):
    def get_snapshot(self, symbol: str): ...


def enrich_intelligence_request(
    ticker: str,
    request: SymbolIntelligenceRequest,
    *,
    fundamentals: _FundamentalsLike | None = None,
    earnings: Callable[[str], tuple[int | None, str | None]] | None = None,
    evidence: Callable[[str], list[SourceEvidence]] | None = None,
) -> SymbolIntelligenceRequest:
    updates: dict = {}

    if fundamentals is not None:
        try:
            snap = fundamentals.get_snapshot(ticker)
        except Exception as exc:  # degrade, never fail the analysis
            logger.warning("Fundamentals fetch failed for %s: %s", ticker, exc)
            snap = None
        if snap is not None:
            for field in _SNAPSHOT_FIELDS:
                if getattr(request, field, None) is None:
                    value = getattr(snap, field, None)
                    if value is not None:
                        updates[field] = value

    if earnings is not None and request.days_to_earnings is None:
        try:
            days, date = earnings(ticker)
        except Exception as exc:
            logger.warning("Earnings fetch failed for %s: %s", ticker, exc)
            days, date = None, None
        if days is not None:
            updates["days_to_earnings"] = days
        if date is not None and request.next_earnings_date is None:
            updates["next_earnings_date"] = date

    if evidence is not None and not request.catalyst_evidence:
        try:
            items = evidence(ticker)
        except Exception as exc:  # degrade, never fail the analysis
            logger.warning("Evidence collection failed for %s: %s", ticker, exc)
            items = []
        if items:
            updates["catalyst_evidence"] = items

    if not updates:
        return request
    return request.model_copy(update=updates)


def enrich_with_technicals(ticker: str, request: SymbolIntelligenceRequest, ohlcv) -> SymbolIntelligenceRequest:
    """Compute SMAs / momentum / ATR / 52w distance / candle patterns from an OHLCV frame.

    `ohlcv` is the MultiIndex (field, ticker) DataFrame from a provider. Any failure degrades
    to leaving the request untouched. Benchmark-relative fields (rel_strength) are intentionally
    not filled here: they need a benchmark + sector-ETF context this single-symbol path lacks.
    """
    if ohlcv is None or getattr(ohlcv, "empty", True):
        return request

    try:
        import pandas as pd
        from swing_screener.indicators.candles import detect_patterns
        from swing_screener.indicators.momentum import MomentumConfig, compute_returns
        from swing_screener.indicators.setup_quality import compute_setup_quality
        from swing_screener.indicators.trend import compute_trend_features
        from swing_screener.indicators.volatility import compute_volatility_features
        from swing_screener.utils.dataframe_helpers import get_close_matrix

        # Call indicators directly rather than build_feature_table: the latter requires the
        # benchmark ticker in the frame (its momentum step empties the row otherwise), which
        # we don't carry on this single-symbol path.
        trend = compute_trend_features(ohlcv)
        vol = compute_volatility_features(ohlcv)
        setup = compute_setup_quality(ohlcv)
        close = get_close_matrix(ohlcv)
        mcfg = MomentumConfig()
        mom6 = compute_returns(close, mcfg.lookback_6m)
        mom12 = compute_returns(close, mcfg.lookback_12m)
    except Exception as exc:  # degrade, never fail the analysis
        logger.warning("Technical enrichment failed for %s: %s", ticker, exc)
        return request

    def _row(df):
        if df is None or df.empty:
            return None
        if ticker in df.index:
            return df.loc[ticker]
        for idx in df.index:
            if str(idx).upper() == ticker.upper():
                return df.loc[idx]
        return None

    def _num(row, col):
        if row is None or col not in row.index:
            return None
        val = row[col]
        return float(val) if pd.notna(val) else None

    def _series_val(series):
        for key in (ticker, ticker.upper()):
            if key in series.index:
                val = series[key]
                return float(val) if pd.notna(val) else None
        return None

    trow = _row(trend)
    vrow = _row(vol)
    srow = _row(setup)
    updates: dict = {}

    if trow is not None:
        for req_field, col in (("sma_20", "sma20"), ("sma_50", "sma50"), ("sma_200", "sma200")):
            value = _num(trow, col)
            if value is not None and getattr(request, req_field, None) is None:
                updates[req_field] = value

    if vrow is not None and request.atr is None:
        atr_col = next((c for c in vrow.index if str(c).startswith("atr") and c != "atr_pct"), None)
        if atr_col is not None:
            value = _num(vrow, atr_col)
            if value is not None:
                updates["atr"] = value

    if request.momentum_6m is None:
        m6 = _series_val(mom6)
        if m6 is not None:
            updates["momentum_6m"] = m6
    if request.momentum_12m is None:
        m12 = _series_val(mom12)
        if m12 is not None:
            updates["momentum_12m"] = m12

    if srow is not None:
        dist = _num(srow, "dist_52w_high_pct")
        if dist is not None and request.dist_52w_high_pct is None:
            updates["dist_52w_high_pct"] = dist
        if "near_52w_high" in srow.index and pd.notna(srow["near_52w_high"]) and request.near_52w_high is None:
            updates["near_52w_high"] = bool(srow["near_52w_high"])

    if not request.recent_patterns:
        try:
            patterns = detect_patterns(ohlcv, tickers=[ticker])
            plist = patterns.get(ticker) or next(
                (v for k, v in patterns.items() if str(k).upper() == ticker.upper()), None
            )
            if plist:
                updates["recent_patterns"] = [f"{p.name}@{p.context}" for p in plist]
        except Exception:
            logger.warning("Pattern detection failed for %s", ticker, exc_info=True)

    if not updates:
        return request
    return request.model_copy(update=updates)
