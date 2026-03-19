from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import yfinance as yf

from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
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


def _statement_frequency(attr_name: str | None) -> str:
    text = str(attr_name or "").strip().lower()
    if text.startswith("quarterly_"):
        return "quarterly"
    if text:
        return "annual"
    return "unknown"


def _merge_source_names(*names: str | None) -> str | None:
    unique: list[str] = []
    for name in names:
        text = str(name or "").strip()
        if not text or text in unique:
            continue
        unique.append(text)
    if not unique:
        return None
    return " + ".join(unique)


def _latest_period_for_frequency(
    series_map: dict[str, FundamentalMetricSeries],
    frequency: str,
) -> str | None:
    latest: str | None = None
    for series in series_map.values():
        if series.frequency != frequency:
            continue
        for point in series.points:
            if latest is None or point.period_end > latest:
                latest = point.period_end
    return latest


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
    frequency: str,
    row_candidates: list[str],
    label: str,
    unit: str,
    limit: int = 5,
) -> FundamentalMetricSeries | None:
    if frame is None:
        return None
    row_label = _find_row_label(frame, row_candidates)
    if row_label is None:
        return None
    try:
        row = frame.loc[row_label]
    except Exception:
        return None
    points = _series_points_from_row(row, limit=limit)
    if not points:
        return None
    return FundamentalMetricSeries(
        label=label,
        unit=unit,
        frequency=frequency,
        source=source_name,
        derived_from=[source_name],
        points=points,
    )


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

    merged_frequency = (
        numerator.frequency if numerator.frequency == denominator.frequency else "unknown"
    )
    derived_from = [
        item
        for item in (
            list(numerator.derived_from or ([numerator.source] if numerator.source else []))
            + list(denominator.derived_from or ([denominator.source] if denominator.source else []))
        )
        if item
    ]

    return FundamentalMetricSeries(
        label=label,
        unit=unit,
        frequency=merged_frequency,
        source=_merge_source_names(numerator.source, denominator.source),
        derived_from=list(dict.fromkeys(derived_from)),
        points=points,
    )


class YfinanceFundamentalsProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        instrument_type = str(
            info.get("quoteType") or info.get("instrumentType") or "unknown"
        ).strip().lower()

        metric_sources: dict[str, str] = {}
        historical_series: dict[str, FundamentalMetricSeries] = {}
        metric_context: dict[str, FundamentalMetricContext] = {}

        def _info_source(field_name: str) -> str:
            return f"{self.name}.info.{field_name}"

        def _capture(
            metric_name: str,
            field_name: str,
            value: Any,
            *,
            cadence: str = "snapshot",
            period_end: str | None = None,
        ) -> float | None:
            normalized = _safe_float(value)
            if normalized is None:
                return None
            source = _info_source(field_name)
            metric_sources[metric_name] = source
            metric_context[metric_name] = FundamentalMetricContext(
                source=source,
                cadence=cadence,
                derived=False,
                derived_from=[],
                period_end=period_end,
            )
            return normalized

        income_frame, income_source = _get_statement_frame(
            ticker,
            ["quarterly_income_stmt", "quarterly_financials", "income_stmt", "financials"],
        )
        income_frequency = _statement_frequency(income_source)
        cashflow_frame, cashflow_source = _get_statement_frame(
            ticker,
            ["quarterly_cashflow", "cashflow"],
        )
        cashflow_frequency = _statement_frequency(cashflow_source)
        balance_frame, balance_source = _get_statement_frame(
            ticker,
            ["quarterly_balance_sheet", "balance_sheet"],
        )
        balance_frequency = _statement_frequency(balance_source)

        revenue_series = _series_from_frame(
            income_frame,
            source_name=f"{self.name}.{income_source}" if income_source else self.name,
            frequency=income_frequency,
            row_candidates=["Total Revenue", "Operating Revenue", "Revenue"],
            label="Revenue",
            unit="currency",
        )
        if revenue_series is not None:
            historical_series["revenue"] = revenue_series
            if revenue_series.source:
                metric_sources["revenue_history"] = revenue_series.source

        operating_income_series = _series_from_frame(
            income_frame,
            source_name=f"{self.name}.{income_source}" if income_source else self.name,
            frequency=income_frequency,
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
            if operating_margin_series.source:
                metric_sources["operating_margin_history"] = operating_margin_series.source

        free_cash_flow_series = _series_from_frame(
            cashflow_frame,
            source_name=f"{self.name}.{cashflow_source}" if cashflow_source else self.name,
            frequency=cashflow_frequency,
            row_candidates=["Free Cash Flow"],
            label="Free cash flow",
            unit="currency",
        )
        if free_cash_flow_series is not None:
            historical_series["free_cash_flow"] = free_cash_flow_series
            if free_cash_flow_series.source:
                metric_sources["free_cash_flow_history"] = free_cash_flow_series.source

        free_cash_flow_margin_series = _combine_series(
            free_cash_flow_series,
            revenue_series,
            label="FCF margin",
            unit="percent",
        )
        if free_cash_flow_margin_series is not None:
            historical_series["free_cash_flow_margin"] = free_cash_flow_margin_series
            if free_cash_flow_margin_series.source:
                metric_sources["free_cash_flow_margin_history"] = free_cash_flow_margin_series.source

        total_equity_series = _series_from_frame(
            balance_frame,
            source_name=f"{self.name}.{balance_source}" if balance_source else self.name,
            frequency=balance_frequency,
            row_candidates=[
                "Stockholders Equity",
                "Stockholders' Equity",
                "Total Stockholder Equity",
                "Common Stock Equity",
                "Total Equity Gross Minority Interest",
                "Total Equity",
            ],
            label="Total equity",
            unit="currency",
        )
        total_equity = None
        if total_equity_series is not None and total_equity_series.points:
            latest_total_equity = total_equity_series.points[-1]
            total_equity = latest_total_equity.value
            if total_equity_series.source:
                metric_sources["total_equity"] = total_equity_series.source
                metric_context["total_equity"] = FundamentalMetricContext(
                    source=total_equity_series.source,
                    cadence=total_equity_series.frequency,
                    derived=False,
                    derived_from=[],
                    period_end=latest_total_equity.period_end,
                )

        most_recent_quarter = _coerce_iso_date(info.get("mostRecentQuarter"))
        if most_recent_quarter:
            metric_sources["most_recent_quarter"] = _info_source("mostRecentQuarter")
        else:
            most_recent_quarter = _latest_period_for_frequency(historical_series, "quarterly")
            quarterly_history_source = _merge_source_names(
                *[
                    series.source
                    for series in historical_series.values()
                    if series.frequency == "quarterly" and series.source
                ]
            )
            if most_recent_quarter and quarterly_history_source:
                metric_sources["most_recent_quarter"] = quarterly_history_source

        total_revenue = _capture(
            "total_revenue",
            "totalRevenue",
            info.get("totalRevenue"),
            period_end=most_recent_quarter,
        )
        free_cash_flow = _capture(
            "free_cash_flow",
            "freeCashflow",
            info.get("freeCashflow"),
            period_end=most_recent_quarter,
        )
        free_cash_flow_margin = None
        if free_cash_flow is not None and total_revenue not in (None, 0):
            free_cash_flow_margin = free_cash_flow / total_revenue
            source = _merge_source_names(metric_sources.get("free_cash_flow"), metric_sources.get("total_revenue"))
            metric_sources["free_cash_flow_margin"] = source or _info_source("freeCashflow")
            metric_context["free_cash_flow_margin"] = FundamentalMetricContext(
                source=source,
                cadence="snapshot",
                derived=True,
                derived_from=[
                    item
                    for item in [metric_sources.get("free_cash_flow"), metric_sources.get("total_revenue")]
                    if item
                ],
                period_end=most_recent_quarter,
            )

        revenue_growth = _capture(
            "revenue_growth_yoy",
            "revenueGrowth",
            info.get("revenueGrowth"),
            period_end=most_recent_quarter,
        )
        earnings_growth = _capture(
            "earnings_growth_yoy",
            "earningsGrowth",
            info.get("earningsGrowth"),
            period_end=most_recent_quarter,
        )
        gross_margin = _capture(
            "gross_margin",
            "grossMargins",
            info.get("grossMargins"),
            period_end=most_recent_quarter,
        )
        operating_margin = _capture(
            "operating_margin",
            "operatingMargins",
            info.get("operatingMargins"),
            period_end=most_recent_quarter,
        )
        debt_to_equity = _capture(
            "debt_to_equity",
            "debtToEquity",
            info.get("debtToEquity"),
            period_end=most_recent_quarter,
        )
        current_ratio = _capture(
            "current_ratio",
            "currentRatio",
            info.get("currentRatio"),
            period_end=most_recent_quarter,
        )
        return_on_equity = _capture(
            "return_on_equity",
            "returnOnEquity",
            info.get("returnOnEquity"),
            period_end=most_recent_quarter,
        )
        trailing_pe = _capture("trailing_pe", "trailingPE", info.get("trailingPE"))
        price_to_sales = _capture(
            "price_to_sales",
            "priceToSalesTrailing12Months",
            info.get("priceToSalesTrailing12Months"),
        )
        shares_outstanding = _capture("shares_outstanding", "sharesOutstanding", info.get("sharesOutstanding"))
        book_value_per_share = _capture("book_value_per_share", "bookValue", info.get("bookValue"))
        price_to_book = _capture("price_to_book", "priceToBook", info.get("priceToBook"))
        market_cap = _capture("market_cap", "marketCap", info.get("marketCap"))

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
            shares_outstanding=shares_outstanding,
            total_equity=total_equity,
            book_value_per_share=book_value_per_share,
            price_to_book=price_to_book,
            historical_series=historical_series,
            metric_context=metric_context,
            metric_sources={key: value for key, value in metric_sources.items() if value},
        )
