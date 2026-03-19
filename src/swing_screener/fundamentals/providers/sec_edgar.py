from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

import httpx

from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)

_ALLOWED_FORMS = {
    "10-Q",
    "10-Q/A",
    "10-K",
    "10-K/A",
    "20-F",
    "20-F/A",
    "40-F",
    "40-F/A",
    "6-K",
    "6-K/A",
}

_QUARTER_MIN_DAYS = 70
_QUARTER_MAX_DAYS = 110
_ANNUAL_MIN_DAYS = 300
_ANNUAL_MAX_DAYS = 390


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text)
        except ValueError:
            return None


def _iso_today() -> str:
    return datetime.now(tz=UTC).date().isoformat()


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


@dataclass(frozen=True)
class _FactSeriesPayload:
    source: str
    series: FundamentalMetricSeries


def _point_days(item: dict[str, Any]) -> int | None:
    start_dt = _coerce_date(item.get("start"))
    end_dt = _coerce_date(item.get("end"))
    if start_dt is None or end_dt is None:
        return None
    return max(0, (end_dt - start_dt).days)


def _infer_frequency(item: dict[str, Any]) -> str:
    fp = str(item.get("fp", "")).strip().upper()
    frame = str(item.get("frame", "")).strip().upper()
    if fp in {"Q1", "Q2", "Q3", "Q4"} or "Q" in frame:
        return "quarterly"
    if fp == "FY":
        return "annual"

    span_days = _point_days(item)
    if span_days is None:
        return "unknown"
    if _QUARTER_MIN_DAYS <= span_days <= _QUARTER_MAX_DAYS:
        return "quarterly"
    if _ANNUAL_MIN_DAYS <= span_days <= _ANNUAL_MAX_DAYS:
        return "annual"
    return "unknown"


def _dedupe_points(items: list[dict[str, Any]], *, frequency: str) -> list[FundamentalSeriesPoint]:
    chosen: dict[str, tuple[str, FundamentalSeriesPoint]] = {}
    for item in items:
        if _infer_frequency(item) != frequency:
            continue
        form = str(item.get("form", "")).strip().upper()
        if form and form not in _ALLOWED_FORMS:
            continue
        period_end = str(item.get("end", "")).strip()
        numeric_value = _safe_float(item.get("val"))
        if not period_end or numeric_value is None:
            continue
        filed_at = str(item.get("filed", "")).strip()
        candidate = FundamentalSeriesPoint(period_end=period_end, value=numeric_value)
        current = chosen.get(period_end)
        if current is None or filed_at >= current[0]:
            chosen[period_end] = (filed_at, candidate)
    ordered = [point for _filed_at, point in chosen.values()]
    ordered.sort(key=lambda point: point.period_end)
    return ordered


def _extract_unit_items(node: dict[str, Any], unit_candidates: tuple[str, ...]) -> list[dict[str, Any]]:
    units = node.get("units")
    if not isinstance(units, dict):
        return []

    for unit in unit_candidates:
        payload = units.get(unit)
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]

    for payload in units.values():
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
    return []


def _find_fact_node(
    payload: dict[str, Any],
    *,
    taxonomies: tuple[str, ...],
    concepts: tuple[str, ...],
) -> tuple[str, str, dict[str, Any]] | None:
    facts = payload.get("facts")
    if not isinstance(facts, dict):
        return None
    for taxonomy in taxonomies:
        section = facts.get(taxonomy)
        if not isinstance(section, dict):
            continue
        for concept in concepts:
            node = section.get(concept)
            if isinstance(node, dict):
                return taxonomy, concept, node
    return None


def _build_series_payload(
    payload: dict[str, Any],
    *,
    taxonomies: tuple[str, ...],
    concepts: tuple[str, ...],
    unit_candidates: tuple[str, ...],
    label: str,
    unit: str,
    preferred_frequency: str = "quarterly",
    limit: int = 5,
) -> _FactSeriesPayload | None:
    node_info = _find_fact_node(payload, taxonomies=taxonomies, concepts=concepts)
    if node_info is None:
        return None
    taxonomy, concept, node = node_info
    source = f"sec_edgar.{taxonomy}.{concept}"
    items = _extract_unit_items(node, unit_candidates)
    if not items:
        return None

    preferred_points = _dedupe_points(items, frequency=preferred_frequency)
    fallback_frequency = "annual" if preferred_frequency == "quarterly" else "quarterly"
    fallback_points = _dedupe_points(items, frequency=fallback_frequency)

    frequency = preferred_frequency if preferred_points else fallback_frequency
    points = preferred_points or fallback_points
    if not points:
        return None

    return _FactSeriesPayload(
        source=source,
        series=FundamentalMetricSeries(
            label=label,
            unit=unit,
            frequency=frequency,
            source=source,
            derived_from=[source],
            points=points[-limit:],
        ),
    )


def _latest_instant_value(
    payload: dict[str, Any],
    *,
    taxonomies: tuple[str, ...],
    concepts: tuple[str, ...],
    unit_candidates: tuple[str, ...],
) -> tuple[float | None, str | None, str | None]:
    node_info = _find_fact_node(payload, taxonomies=taxonomies, concepts=concepts)
    if node_info is None:
        return (None, None, None)
    taxonomy, concept, node = node_info
    source = f"sec_edgar.{taxonomy}.{concept}"
    items = _extract_unit_items(node, unit_candidates)
    best: tuple[str, str, float] | None = None
    for item in items:
        form = str(item.get("form", "")).strip().upper()
        if form and form not in _ALLOWED_FORMS:
            continue
        period_end = str(item.get("end", "")).strip()
        filed_at = str(item.get("filed", "")).strip()
        numeric_value = _safe_float(item.get("val"))
        if not period_end or numeric_value is None:
            continue
        candidate = (period_end, filed_at, numeric_value)
        if best is None or candidate[:2] >= best[:2]:
            best = candidate
    if best is None:
        return (None, None, source)
    return (best[2], best[0], source)


def _latest_series_value(series: FundamentalMetricSeries | None) -> float | None:
    if series is None or not series.points:
        return None
    return float(sorted(series.points, key=lambda point: point.period_end)[-1].value)


def _latest_series_period(series: FundamentalMetricSeries | None) -> str | None:
    if series is None or not series.points:
        return None
    return sorted(series.points, key=lambda point: point.period_end)[-1].period_end


def _ratio_series(
    numerator: FundamentalMetricSeries | None,
    denominator: FundamentalMetricSeries | None,
    *,
    label: str,
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
    source = _merge_source_names(numerator.source, denominator.source)
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
        unit="percent",
        frequency=numerator.frequency if numerator.frequency == denominator.frequency else "unknown",
        source=source,
        derived_from=list(dict.fromkeys(derived_from)),
        points=points,
    )


def _free_cash_flow_series(
    operating_cashflow: FundamentalMetricSeries | None,
    capex: FundamentalMetricSeries | None,
) -> FundamentalMetricSeries | None:
    if operating_cashflow is None or capex is None:
        return None
    capex_points = {point.period_end: point.value for point in capex.points}
    points: list[FundamentalSeriesPoint] = []
    for point in operating_cashflow.points:
        capex_value = capex_points.get(point.period_end)
        if capex_value is None:
            continue
        normalized_capex = capex_value if capex_value < 0 else -capex_value
        points.append(
            FundamentalSeriesPoint(period_end=point.period_end, value=point.value + normalized_capex)
        )
    if not points:
        return None
    source = _merge_source_names(operating_cashflow.source, capex.source)
    derived_from = [
        item
        for item in (
            list(operating_cashflow.derived_from or ([operating_cashflow.source] if operating_cashflow.source else []))
            + list(capex.derived_from or ([capex.source] if capex.source else []))
        )
        if item
    ]
    return FundamentalMetricSeries(
        label="Free cash flow",
        unit="currency",
        frequency=(
            operating_cashflow.frequency
            if operating_cashflow.frequency == capex.frequency
            else "unknown"
        ),
        source=source,
        derived_from=list(dict.fromkeys(derived_from)),
        points=points,
    )


def _year_ago_value(points: list[FundamentalSeriesPoint]) -> float | None:
    if len(points) < 2:
        return None
    latest = points[-1]
    latest_date = _coerce_date(latest.period_end)
    if latest_date is None:
        return None
    candidates: list[tuple[int, float]] = []
    for point in points[:-1]:
        point_date = _coerce_date(point.period_end)
        if point_date is None or point.value == 0:
            continue
        delta_days = (latest_date - point_date).days
        if 280 <= delta_days <= 460:
            candidates.append((abs(delta_days - 365), point.value))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def _growth_from_series(series: FundamentalMetricSeries | None) -> float | None:
    if series is None:
        return None
    points = sorted(series.points, key=lambda point: point.period_end)
    if len(points) < 2:
        return None
    prior_value = _year_ago_value(points)
    latest_value = points[-1].value
    if prior_value in (None, 0):
        return None
    return round((latest_value / prior_value) - 1.0, 4)


def _latest_context(
    *,
    source: str | None,
    cadence: str,
    derived: bool = False,
    derived_from: list[str] | None = None,
    period_end: str | None = None,
) -> FundamentalMetricContext:
    return FundamentalMetricContext(
        source=source,
        cadence=cadence,
        derived=derived,
        derived_from=list(derived_from or []),
        period_end=period_end,
    )


class SecEdgarFundamentalsProvider:
    name = "sec_edgar"

    def __init__(
        self,
        *,
        user_agent: str = "swing-screener/1.0 (fundamentals research)",
        timeout_sec: float = 15.0,
    ) -> None:
        self._user_agent = user_agent
        self._timeout_sec = float(timeout_sec)
        self._ticker_map: dict[str, tuple[str, str | None]] | None = None

    def _client(self) -> httpx.Client:
        return httpx.Client(
            timeout=self._timeout_sec,
            headers={"User-Agent": self._user_agent},
        )

    def _get_json(self, url: str) -> dict[str, Any]:
        with self._client() as client:
            response = client.get(url)
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Unexpected SEC response for {url}")
        return payload

    def _load_ticker_map(self) -> dict[str, tuple[str, str | None]]:
        if self._ticker_map is not None:
            return self._ticker_map
        payload = self._get_json("https://www.sec.gov/files/company_tickers.json")
        out: dict[str, tuple[str, str | None]] = {}
        for item in payload.values():
            if not isinstance(item, dict):
                continue
            ticker = str(item.get("ticker", "")).strip().upper()
            cik = str(item.get("cik_str", "")).strip()
            title = str(item.get("title", "")).strip() or None
            if ticker and cik:
                out[ticker] = (cik.zfill(10), title)
        self._ticker_map = out
        return out

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        normalized_symbol = str(symbol).strip().upper()
        if not normalized_symbol:
            raise ValueError("symbol is required")

        ticker = normalized_symbol.split(".", 1)[0]
        cik_info = self._load_ticker_map().get(ticker)
        if cik_info is None:
            raise ValueError(f"SEC company_tickers.json has no mapping for {normalized_symbol}")

        cik, fallback_name = cik_info
        payload = self._get_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json")

        revenue_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=(
                "RevenueFromContractWithCustomerExcludingAssessedTax",
                "SalesRevenueNet",
                "Revenues",
                "RevenueFromContractWithCustomerIncludingAssessedTax",
            ),
            unit_candidates=("USD",),
            label="Revenue",
            unit="currency",
        )
        net_income_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=("NetIncomeLoss",),
            unit_candidates=("USD",),
            label="Net income",
            unit="currency",
        )
        gross_profit_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=("GrossProfit",),
            unit_candidates=("USD",),
            label="Gross profit",
            unit="currency",
        )
        operating_income_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=("OperatingIncomeLoss",),
            unit_candidates=("USD",),
            label="Operating income",
            unit="currency",
        )
        operating_cashflow_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=(
                "NetCashProvidedByUsedInOperatingActivities",
                "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
            ),
            unit_candidates=("USD",),
            label="Operating cash flow",
            unit="currency",
        )
        capex_payload = _build_series_payload(
            payload,
            taxonomies=("us-gaap",),
            concepts=(
                "PaymentsToAcquirePropertyPlantAndEquipment",
                "PurchaseOfPropertyPlantAndEquipment",
                "CapitalExpendituresIncurredButNotYetPaid",
            ),
            unit_candidates=("USD",),
            label="Capital expenditures",
            unit="currency",
        )

        revenue_series = revenue_payload.series if revenue_payload else None
        net_income_series = net_income_payload.series if net_income_payload else None
        gross_profit_series = gross_profit_payload.series if gross_profit_payload else None
        operating_income_series = operating_income_payload.series if operating_income_payload else None
        operating_cashflow_series = operating_cashflow_payload.series if operating_cashflow_payload else None
        capex_series = capex_payload.series if capex_payload else None

        if revenue_series is None and net_income_series is None and operating_cashflow_series is None:
            raise ValueError(f"SEC companyfacts did not return core fundamentals for {normalized_symbol}")

        gross_margin_series = _ratio_series(gross_profit_series, revenue_series, label="Gross margin")
        operating_margin_series = _ratio_series(
            operating_income_series,
            revenue_series,
            label="Operating margin",
        )
        free_cash_flow_series = _free_cash_flow_series(operating_cashflow_series, capex_series)
        free_cash_flow_margin_series = _ratio_series(
            free_cash_flow_series,
            revenue_series,
            label="FCF margin",
        )

        total_equity, total_equity_period, total_equity_source = _latest_instant_value(
            payload,
            taxonomies=("us-gaap",),
            concepts=("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"),
            unit_candidates=("USD",),
        )
        shares_outstanding, shares_period, shares_source = _latest_instant_value(
            payload,
            taxonomies=("dei", "us-gaap"),
            concepts=("EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"),
            unit_candidates=("shares",),
        )
        current_assets, current_assets_period, current_assets_source = _latest_instant_value(
            payload,
            taxonomies=("us-gaap",),
            concepts=("AssetsCurrent",),
            unit_candidates=("USD",),
        )
        current_liabilities, current_liabilities_period, current_liabilities_source = _latest_instant_value(
            payload,
            taxonomies=("us-gaap",),
            concepts=("LiabilitiesCurrent",),
            unit_candidates=("USD",),
        )

        current_ratio: float | None = None
        current_ratio_context: FundamentalMetricContext | None = None
        if (
            current_assets not in (None, 0)
            and current_liabilities not in (None, 0)
            and current_assets_period == current_liabilities_period
        ):
            current_ratio = float(current_assets) / float(current_liabilities)
            current_ratio_context = _latest_context(
                source=_merge_source_names(current_assets_source, current_liabilities_source),
                cadence="quarterly",
                derived=True,
                derived_from=[
                    item
                    for item in (current_assets_source, current_liabilities_source)
                    if item
                ],
                period_end=current_assets_period,
            )

        metric_sources: dict[str, str] = {}
        metric_context: dict[str, FundamentalMetricContext] = {}
        historical_series: dict[str, FundamentalMetricSeries] = {}

        if revenue_payload is not None:
            historical_series["revenue"] = revenue_payload.series
        if operating_margin_series is not None:
            historical_series["operating_margin"] = operating_margin_series
        if free_cash_flow_series is not None:
            historical_series["free_cash_flow"] = free_cash_flow_series
        if free_cash_flow_margin_series is not None:
            historical_series["free_cash_flow_margin"] = free_cash_flow_margin_series

        revenue_growth_yoy = _growth_from_series(revenue_series)
        if revenue_growth_yoy is not None and revenue_payload is not None:
            metric_sources["revenue_growth_yoy"] = revenue_payload.source
            metric_context["revenue_growth_yoy"] = _latest_context(
                source=revenue_payload.source,
                cadence=revenue_payload.series.frequency,
                derived=True,
                derived_from=[revenue_payload.source],
                period_end=_latest_series_period(revenue_payload.series),
            )

        gross_margin = _latest_series_value(gross_margin_series)
        if gross_margin is not None and gross_margin_series is not None:
            metric_sources["gross_margin"] = str(gross_margin_series.source or "")
            metric_context["gross_margin"] = _latest_context(
                source=gross_margin_series.source,
                cadence=gross_margin_series.frequency,
                derived=True,
                derived_from=list(gross_margin_series.derived_from),
                period_end=_latest_series_period(gross_margin_series),
            )

        operating_margin = _latest_series_value(operating_margin_series)
        if operating_margin is not None and operating_margin_series is not None:
            metric_sources["operating_margin"] = str(operating_margin_series.source or "")
            metric_context["operating_margin"] = _latest_context(
                source=operating_margin_series.source,
                cadence=operating_margin_series.frequency,
                derived=True,
                derived_from=list(operating_margin_series.derived_from),
                period_end=_latest_series_period(operating_margin_series),
            )

        free_cash_flow = _latest_series_value(free_cash_flow_series)
        if free_cash_flow is not None and free_cash_flow_series is not None:
            metric_sources["free_cash_flow"] = str(free_cash_flow_series.source or "")
            metric_context["free_cash_flow"] = _latest_context(
                source=free_cash_flow_series.source,
                cadence=free_cash_flow_series.frequency,
                derived=True,
                derived_from=list(free_cash_flow_series.derived_from),
                period_end=_latest_series_period(free_cash_flow_series),
            )

        free_cash_flow_margin = _latest_series_value(free_cash_flow_margin_series)
        if free_cash_flow_margin is not None and free_cash_flow_margin_series is not None:
            metric_sources["free_cash_flow_margin"] = str(free_cash_flow_margin_series.source or "")
            metric_context["free_cash_flow_margin"] = _latest_context(
                source=free_cash_flow_margin_series.source,
                cadence=free_cash_flow_margin_series.frequency,
                derived=True,
                derived_from=list(free_cash_flow_margin_series.derived_from),
                period_end=_latest_series_period(free_cash_flow_margin_series),
            )

        earnings_growth_yoy = _growth_from_series(net_income_series)
        if earnings_growth_yoy is not None and net_income_payload is not None:
            metric_sources["earnings_growth_yoy"] = net_income_payload.source
            metric_context["earnings_growth_yoy"] = _latest_context(
                source=net_income_payload.source,
                cadence=net_income_payload.series.frequency,
                derived=True,
                derived_from=[net_income_payload.source],
                period_end=_latest_series_period(net_income_payload.series),
            )

        if total_equity is not None and total_equity_source:
            metric_sources["total_equity"] = total_equity_source
            metric_context["total_equity"] = _latest_context(
                source=total_equity_source,
                cadence="quarterly",
                period_end=total_equity_period,
            )
        if shares_outstanding is not None and shares_source:
            metric_sources["shares_outstanding"] = shares_source
            metric_context["shares_outstanding"] = _latest_context(
                source=shares_source,
                cadence="quarterly",
                period_end=shares_period,
            )
        if current_ratio is not None and current_ratio_context is not None:
            metric_sources["current_ratio"] = str(current_ratio_context.source or "")
            metric_context["current_ratio"] = current_ratio_context

        company_name = str(payload.get("entityName", "")).strip() or fallback_name
        most_recent_quarter = None
        for series in historical_series.values():
            if series.frequency != "quarterly":
                continue
            period_end = _latest_series_period(series)
            if period_end and (most_recent_quarter is None or period_end > most_recent_quarter):
                most_recent_quarter = period_end

        return ProviderFundamentalsRecord(
            symbol=normalized_symbol,
            asof_date=_iso_today(),
            provider=self.name,
            instrument_type="equity",
            company_name=company_name,
            currency="USD",
            most_recent_quarter=most_recent_quarter,
            revenue_growth_yoy=revenue_growth_yoy,
            earnings_growth_yoy=earnings_growth_yoy,
            gross_margin=gross_margin,
            operating_margin=operating_margin,
            free_cash_flow=free_cash_flow,
            free_cash_flow_margin=free_cash_flow_margin,
            current_ratio=current_ratio,
            shares_outstanding=shares_outstanding,
            total_equity=total_equity,
            historical_series=historical_series,
            metric_context=metric_context,
            metric_sources={key: value for key, value in metric_sources.items() if value},
        )
