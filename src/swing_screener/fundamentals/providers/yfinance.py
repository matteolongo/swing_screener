from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import yfinance as yf

from swing_screener.fundamentals.models import ProviderFundamentalsRecord


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc).date().isoformat()
        except Exception:
            return None
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        return text.split("T", 1)[0]
    return text


class YfinanceFundamentalsProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        instrument_type = str(
            info.get("quoteType") or info.get("instrumentType") or "unknown"
        ).strip().lower()
        total_revenue = _safe_float(info.get("totalRevenue"))
        free_cash_flow = _safe_float(info.get("freeCashflow"))
        free_cash_flow_margin = None
        if free_cash_flow is not None and total_revenue not in (None, 0):
            free_cash_flow_margin = free_cash_flow / total_revenue

        metric_sources: dict[str, str] = {}

        def _capture(name: str, value: Any) -> float | None:
            normalized = _safe_float(value)
            if normalized is not None:
                metric_sources[name] = self.name
            return normalized

        revenue_growth = _capture("revenue_growth_yoy", info.get("revenueGrowth"))
        earnings_growth = _capture("earnings_growth_yoy", info.get("earningsGrowth"))
        gross_margin = _capture("gross_margin", info.get("grossMargins"))
        operating_margin = _capture("operating_margin", info.get("operatingMargins"))
        debt_to_equity = _capture("debt_to_equity", info.get("debtToEquity"))
        current_ratio = _capture("current_ratio", info.get("currentRatio"))
        return_on_equity = _capture("return_on_equity", info.get("returnOnEquity"))
        trailing_pe = _capture("trailing_pe", info.get("trailingPE"))
        price_to_sales = _capture("price_to_sales", info.get("priceToSalesTrailing12Months"))
        market_cap = _capture("market_cap", info.get("marketCap"))
        if free_cash_flow is not None:
            metric_sources["free_cash_flow"] = self.name
        if free_cash_flow_margin is not None:
            metric_sources["free_cash_flow_margin"] = self.name

        most_recent_quarter = _coerce_iso_date(
            info.get("mostRecentQuarter") or info.get("lastFiscalYearEnd")
        )
        if most_recent_quarter:
            metric_sources["most_recent_quarter"] = self.name

        company_name = info.get("longName") or info.get("shortName")
        sector = info.get("sector")
        currency = info.get("currency")

        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date=date.today().isoformat(),
            provider=self.name,
            instrument_type=instrument_type,
            company_name=str(company_name).strip() if company_name else None,
            sector=str(sector).strip() if sector else None,
            currency=str(currency).strip().upper() if currency else None,
            most_recent_quarter=most_recent_quarter,
            market_cap=market_cap,
            revenue_growth_yoy=revenue_growth,
            earnings_growth_yoy=earnings_growth,
            gross_margin=gross_margin,
            operating_margin=operating_margin,
            free_cash_flow=free_cash_flow,
            free_cash_flow_margin=free_cash_flow_margin,
            debt_to_equity=debt_to_equity,
            current_ratio=current_ratio,
            return_on_equity=return_on_equity,
            trailing_pe=trailing_pe,
            price_to_sales=price_to_sales,
            metric_sources=metric_sources,
        )
