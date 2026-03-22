"""DeGiro fundamentals provider.

Fetches company ratios and analyst estimates from DeGiro via get_company_ratios()
and get_estimates_summaries(). Resolves ticker → ISIN via a disk-based map
(populated by the portfolio audit) with yfinance info as fallback.

All degiro_connector imports are lazy. If credentials are missing or the ISIN
cannot be resolved, raises ValueError so the provider chain falls through to
the next provider (yfinance / sec_edgar).
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any, Optional

from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)

logger = logging.getLogger(__name__)

# Disk-based ticker→ISIN map, updated by the portfolio audit endpoint.
_ISIN_MAP_FILENAME = "isin_map.json"


def _isin_map_path() -> Path:
    try:
        from swing_screener.settings import data_dir
        return data_dir() / "degiro" / _ISIN_MAP_FILENAME
    except Exception:
        return Path("data") / "degiro" / _ISIN_MAP_FILENAME


def _load_isin_map() -> dict[str, str]:
    p = _isin_map_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_isin_map(mapping: dict[str, str]) -> None:
    p = _isin_map_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(mapping, indent=2, sort_keys=True), encoding="utf-8")


def update_isin_map_from_audit(records: list[dict[str, Any]]) -> None:
    """Merge audit records into the persisted ISIN map.

    Called automatically when the portfolio audit endpoint completes so that
    all portfolio stocks become available to the fundamentals provider.
    Each record must have 'symbol' and 'isin' keys.
    """
    mapping = _load_isin_map()
    updated = 0
    for r in records:
        symbol = str(r.get("symbol", "") or "").strip()
        isin = str(r.get("isin", "") or "").strip()
        if symbol and isin and mapping.get(symbol) != isin:
            mapping[symbol] = isin
            updated += 1
    if updated:
        _save_isin_map(mapping)
        logger.info("degiro: ISIN map updated with %d entries", updated)


# ---------------------------------------------------------------------------
# Internal helpers for response parsing
# ---------------------------------------------------------------------------

def _current_ratio_value(groups: list[dict], ratio_id: str) -> Optional[float]:
    """Extract a float from currentRatios.ratiosGroups by ratio id."""
    for group in groups:
        for item in group.get("items", []):
            if item.get("id") == ratio_id and item.get("value") is not None:
                try:
                    return float(item["value"])
                except (TypeError, ValueError):
                    pass
    return None


def _forecast_value(ratios: list[dict], ratio_id: str) -> Optional[float]:
    """Extract a float from forecastData.ratios list by id."""
    for r in ratios:
        if r.get("id") == ratio_id and r.get("value") is not None:
            try:
                return float(r["value"])
            except (TypeError, ValueError):
                pass
    return None


def _estimate_item(statements: list[dict], stmt_type: str, code: str) -> Optional[float]:
    """Extract an analyst estimate value from the nested statements structure."""
    for stmt in statements:
        if stmt.get("type") == stmt_type:
            for item in stmt.get("items", []):
                if item.get("code") == code:
                    v = item.get("value")
                    if v is not None:
                        try:
                            return float(v)
                        except (TypeError, ValueError):
                            pass
    return None


def _pct_to_ratio(value: Optional[float]) -> Optional[float]:
    """Convert a percentage value (e.g. 16.2 → 0.162)."""
    return value / 100.0 if value is not None else None


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------

class DegiroFundamentalsProvider:
    """Fundamentals provider backed by DeGiro's company ratios and estimates APIs.

    Intended as a supplemental provider for European equities where SEC Edgar
    has no coverage and yfinance has limited analyst estimate data.

    Provider chain placement: after sec_edgar, before yfinance — so US stocks
    still go through sec_edgar first, while EU stocks get rich DeGiro data
    before falling back to yfinance.
    """

    name = "degiro"

    def __init__(self) -> None:
        self._client: Any = None
        self._isin_cache: dict[str, Optional[str]] = {}

    # ------------------------------------------------------------------
    # ISIN resolution
    # ------------------------------------------------------------------

    def _resolve_isin(self, symbol: str) -> Optional[str]:
        """Resolve a ticker symbol to ISIN.

        Priority:
          1. In-memory cache (fastest)
          2. Disk ISIN map populated by portfolio audit
          3. yfinance ticker.info (fallback, adds latency)
        """
        if symbol in self._isin_cache:
            return self._isin_cache[symbol]

        isin: Optional[str] = None

        # 1. Disk map — try exact symbol, then base symbol (e.g. "RWE" for "RWE.DE")
        isin_map = _load_isin_map()
        isin = isin_map.get(symbol)
        if not isin:
            base = symbol.split(".")[0]
            isin = isin_map.get(base)

        # 2. yfinance info dict
        if not isin:
            try:
                import yfinance as yf  # already a dependency
                info = yf.Ticker(symbol).info
                isin = info.get("isin") or None
            except Exception:
                pass

        self._isin_cache[symbol] = isin
        return isin

    # ------------------------------------------------------------------
    # Client lifecycle
    # ------------------------------------------------------------------

    def _ensure_client(self) -> Any:
        if self._client is not None:
            return self._client
        from swing_screener.integrations.degiro.credentials import load_credentials
        from swing_screener.integrations.degiro.client import DegiroClient
        creds = load_credentials()
        client = DegiroClient(creds)
        client.connect()
        self._client = client
        return client

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.disconnect()
            except Exception:
                pass
            self._client = None

    # ------------------------------------------------------------------
    # Protocol implementation
    # ------------------------------------------------------------------

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        isin = self._resolve_isin(symbol)
        if not isin:
            raise ValueError(f"degiro: cannot resolve ISIN for {symbol!r}")

        client = self._ensure_client()
        api = client.api

        ratios_resp = api.get_company_ratios(product_isin=isin, raw=True) or {}
        estimates_resp = api.get_estimates_summaries(product_isin=isin, raw=True) or {}

        ratios_data = ratios_resp.get("data", {})
        if not ratios_data:
            raise ValueError(f"degiro: no ratios data for ISIN {isin!r} ({symbol!r})")

        ratio_groups: list[dict] = (
            ratios_data.get("currentRatios", {}).get("ratiosGroups", [])
        )
        forecast_ratios: list[dict] = (
            ratios_data.get("forecastData", {}).get("ratios", [])
        )

        def cr(ratio_id: str) -> Optional[float]:
            return _current_ratio_value(ratio_groups, ratio_id)

        def fd(ratio_id: str) -> Optional[float]:
            return _forecast_value(forecast_ratios, ratio_id)

        # ----- Point-in-time metrics -----
        market_cap = cr("MKTCAP")

        shares_out_raw = ratios_data.get("sharesOut")
        shares_outstanding = float(shares_out_raw) if shares_out_raw else None

        trailing_pe = cr("PEEXCLXOR")
        price_to_book = cr("PRICE2BK") or cr("APRICE2BK")
        book_value_per_share = cr("QBVPS") or cr("ABVPS")
        price_to_sales = cr("TTMPR2REV") or cr("APR2REV")
        book_to_price = (1.0 / price_to_book) if price_to_book else None

        gross_margin = _pct_to_ratio(cr("TTMGROSMGN"))
        operating_margin = _pct_to_ratio(cr("TTMOPMGN") or cr("AOPMGNPCT"))
        return_on_equity = _pct_to_ratio(cr("TTMROEPCT") or cr("AROEPCT"))
        current_ratio = cr("QCURRATIO") or cr("ACURRATIO")
        debt_to_equity = cr("QTOTD2EQ") or cr("ATOTD2EQ")
        free_cash_flow = cr("TTMFCF") or cr("A1FCF")

        # Growth: DeGiro returns as %, convert to ratio
        revenue_growth_yoy = _pct_to_ratio(cr("TTMREVCHG"))
        earnings_growth_yoy = _pct_to_ratio(cr("TTMEPSCHG"))

        # Most recent annual date (ISO date prefix)
        la_annual = ratios_data.get("laAnnual", "")
        most_recent_quarter = la_annual[:10] if la_annual else None

        # Data region from ISIN country prefix
        isin_country = isin[:2].upper() if len(isin) >= 2 else ""
        eu_countries = {
            "DE", "FR", "IT", "ES", "NL", "BE", "SE", "NO", "DK", "FI",
            "PT", "AT", "IE", "CH", "PL", "GB",
        }
        data_region = "EU" if isin_country in eu_countries else (
            "US" if isin_country == "US" else None
        )

        # ----- Analyst estimates series -----
        annual_estimates = estimates_resp.get("data", {}).get("annual", [])
        revenue_points: list[FundamentalSeriesPoint] = []
        eps_points: list[FundamentalSeriesPoint] = []

        for period in sorted(annual_estimates, key=lambda p: p.get("year", 0)):
            year = period.get("year")
            if not year:
                continue
            period_end = f"{year}-12-31"
            stmts = period.get("statements", [])
            rev = _estimate_item(stmts, "Income Statement", "SAL")
            eps = _estimate_item(stmts, "Income Statement", "EPS")
            if rev is not None:
                # Estimates are in millions — convert to base currency units
                revenue_points.append(
                    FundamentalSeriesPoint(period_end=period_end, value=rev * 1_000_000)
                )
            if eps is not None:
                eps_points.append(FundamentalSeriesPoint(period_end=period_end, value=eps))

        historical_series: dict[str, FundamentalMetricSeries] = {}
        if revenue_points:
            historical_series["revenue_estimate"] = FundamentalMetricSeries(
                label="Revenue Estimate (Analyst Consensus)",
                unit="currency",
                frequency="annual",
                direction="unknown",
                source="degiro.estimates_summaries.SAL",
                points=revenue_points[-5:],
            )
        if eps_points:
            historical_series["eps_estimate"] = FundamentalMetricSeries(
                label="EPS Estimate (Analyst Consensus)",
                unit="number",
                frequency="annual",
                direction="unknown",
                source="degiro.estimates_summaries.EPS",
                points=eps_points[-5:],
            )

        # ----- Metric provenance -----
        metric_context: dict[str, FundamentalMetricContext] = {}
        metric_sources: dict[str, str] = {}

        def _register(metric: str, source_key: str, cadence: str = "snapshot") -> None:
            src = f"degiro.company_ratios.{source_key}"
            metric_context[metric] = FundamentalMetricContext(source=src, cadence=cadence)
            metric_sources[metric] = src

        if trailing_pe is not None:       _register("trailing_pe", "PEEXCLXOR")
        if price_to_book is not None:     _register("price_to_book", "PRICE2BK")
        if book_to_price is not None:     _register("book_to_price", "PRICE2BK")
        if price_to_sales is not None:    _register("price_to_sales", "TTMPR2REV")
        if gross_margin is not None:      _register("gross_margin", "TTMGROSMGN")
        if operating_margin is not None:  _register("operating_margin", "TTMOPMGN")
        if return_on_equity is not None:  _register("return_on_equity", "TTMROEPCT")
        if revenue_growth_yoy is not None: _register("revenue_growth_yoy", "TTMREVCHG")
        if earnings_growth_yoy is not None: _register("earnings_growth_yoy", "TTMEPSCHG")
        if current_ratio is not None:     _register("current_ratio", "QCURRATIO")
        if debt_to_equity is not None:    _register("debt_to_equity", "QTOTD2EQ")
        if market_cap is not None:        _register("market_cap", "MKTCAP")
        if free_cash_flow is not None:    _register("free_cash_flow", "TTMFCF")
        if book_value_per_share is not None: _register("book_value_per_share", "QBVPS")
        if shares_outstanding is not None: _register("shares_outstanding", "sharesOut")

        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date=date.today().isoformat(),
            provider=self.name,
            instrument_type="equity",
            data_region=data_region,
            company_name=None,   # available via get_company_profile if needed
            sector=None,
            currency=None,       # could infer from ISIN country; left for scoring layer
            most_recent_quarter=most_recent_quarter,
            market_cap=market_cap,
            revenue_growth_yoy=revenue_growth_yoy,
            earnings_growth_yoy=earnings_growth_yoy,
            gross_margin=gross_margin,
            operating_margin=operating_margin,
            free_cash_flow=free_cash_flow,
            debt_to_equity=debt_to_equity,
            current_ratio=current_ratio,
            return_on_equity=return_on_equity,
            trailing_pe=trailing_pe,
            price_to_sales=price_to_sales,
            shares_outstanding=shares_outstanding,
            book_value_per_share=book_value_per_share,
            price_to_book=price_to_book,
            book_to_price=book_to_price,
            historical_series=historical_series,
            metric_context=metric_context,
            metric_sources=metric_sources,
        )
