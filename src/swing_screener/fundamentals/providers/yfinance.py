from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import yfinance as yf

from swing_screener.fundamentals.models import (
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)


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


def _frame_has_data(frame: Any) -> bool:
    if frame is None:
        return False
    if hasattr(frame, "empty"):
        try:
            return not bool(frame.empty)
        except Exception:
            return False
    return bool(getattr(frame, "index", None)) and bool(getattr(frame, "columns", None))


def _get_statement_frame(ticker: Any, attr_names: list[str]) -> tuple[Any | None, str | None]:
    for attr_name in attr_names:
        try:
            frame = getattr(ticker, attr_name, None)
        except Exception:
            continue
        if _frame_has_data(frame):
            return frame, attr_name
    return None, None


def _find_row_label(frame: Any, candidates: list[str]) -> Any | None:
    index = getattr(frame, "index", None)
    if index is None:
        return None
    normalized = {str(value).strip().lower(): value for value in index}
    for candidate in candidates:
        label = normalized.get(candidate.strip().lower())
        if label is not None:
            return label
    return None


def _series_points_from_row(row: Any, *, limit: int = 5) -> list[FundamentalSeriesPoint]:
    items = row.items() if hasattr(row, "items") else []
    points: list[FundamentalSeriesPoint] = []
    for raw_period, raw_value in items:
        period_end = _coerce_iso_date(raw_period)
        numeric_value = _safe_float(raw_value)
        if not period_end or numeric_value is None:
            continue
        points.append(FundamentalSeriesPoint(period_end=period_end, value=numeric_value))
    points.sort(key=lambda item: item.period_end)
    return points[-limit:]


def _series_from_frame(
    frame: Any,
    *,
    source_name: str,
    row_candidates: list[str],
    label: str,
    unit: str,
    limit: int = 5,
) -> tuple[FundamentalMetricSeries | None, str | None]:
    if frame is None:
        return None, None
    row_label = _find_row_label(frame, row_candidates)
    if row_label is None:
        return None, None
    try:
        row = frame.loc[row_label]
    except Exception:
        return None, None
    points = _series_points_from_row(row, limit=limit)
    if not points:
        return None, None
    return FundamentalMetricSeries(label=label, unit=unit, points=points), source_name


def _combine_series(
    numerator: FundamentalMetricSeries | None,
    denominator: FundamentalMetricSeries | None,
    *,
    label: str,
    unit: str,
) -> FundamentalMetricSeries | None:
    if numerator is None or denominator is None:
        return None
    denominator_points = {point.period_end: point.value for point in denominator.points}
    points: list[FundamentalSeriesPoint] = []
    for point in numerator.points:
        base = denominator_points.get(point.period_end)
        if base in (None, 0):
            continue
        points.append(FundamentalSeriesPoint(period_end=point.period_end, value=point.value / base))
    if not points:
        return None
    return FundamentalMetricSeries(label=label, unit=unit, points=points)


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
        historical_series: dict[str, FundamentalMetricSeries] = {}

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

        income_frame, income_source = _get_statement_frame(
            ticker,
            ["quarterly_income_stmt", "quarterly_financials", "income_stmt", "financials"],
        )
        cashflow_frame, cashflow_source = _get_statement_frame(
            ticker,
            ["quarterly_cashflow", "cashflow"],
        )

        revenue_series, revenue_series_source = _series_from_frame(
            income_frame,
            source_name=f"{self.name}.{income_source}" if income_source else self.name,
            row_candidates=["Total Revenue", "Operating Revenue", "Revenue"],
            label="Revenue",
            unit="currency",
        )
        if revenue_series is not None and revenue_series_source is not None:
            historical_series["revenue"] = revenue_series
            metric_sources["revenue_history"] = revenue_series_source

        operating_income_series, operating_income_source = _series_from_frame(
            income_frame,
            source_name=f"{self.name}.{income_source}" if income_source else self.name,
            row_candidates=["Operating Income", "EBIT"],
            label="Operating income",
            unit="currency",
        )
        operating_margin_series = _combine_series(
            operating_income_series,
            revenue_series,
            label="Operating margin",
            unit="percent",
        )
        if operating_margin_series is not None:
            historical_series["operating_margin"] = operating_margin_series
            metric_sources["operating_margin_history"] = (
                operating_income_source or revenue_series_source or self.name
            )

        free_cash_flow_series, free_cash_flow_source = _series_from_frame(
            cashflow_frame,
            source_name=f"{self.name}.{cashflow_source}" if cashflow_source else self.name,
            row_candidates=["Free Cash Flow"],
            label="Free cash flow",
            unit="currency",
        )
        if free_cash_flow_series is not None and free_cash_flow_source is not None:
            historical_series["free_cash_flow"] = free_cash_flow_series
            metric_sources["free_cash_flow_history"] = free_cash_flow_source

        free_cash_flow_margin_series = _combine_series(
            free_cash_flow_series,
            revenue_series,
            label="FCF margin",
            unit="percent",
        )
        if free_cash_flow_margin_series is not None:
            historical_series["free_cash_flow_margin"] = free_cash_flow_margin_series
            metric_sources["free_cash_flow_margin_history"] = (
                free_cash_flow_source or revenue_series_source or self.name
            )

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
            historical_series=historical_series,
            metric_sources=metric_sources,
        )
