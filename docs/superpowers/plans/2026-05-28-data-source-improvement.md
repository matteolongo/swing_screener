# Data Source Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve symbol prediction and evaluation by surfacing data provenance, tightening provider reliability, enriching fundamentals/events, and feeding the improved signals into combined ranking.

**Architecture:** Add a lightweight provider capability and provenance layer that all market, fundamentals, calendar, and intelligence paths can report into. Improve data in small increments: first make source quality visible, then add richer fields, then wire only validated fields into scoring.

**Tech Stack:** Python 3, FastAPI, Pydantic, pytest, existing `swing_screener` provider modules, React/Vite/TypeScript for UI display.

---

## File Structure

- Create `src/swing_screener/data/source_health.py`: shared data-source health/provenance models and helpers.
- Modify `src/swing_screener/data/providers/base.py`: expose optional provider capability metadata.
- Modify `src/swing_screener/data/providers/yfinance_provider.py`, `stooq_provider.py`, `alpaca_provider.py`: return explicit source health metadata.
- Modify `src/swing_screener/fundamentals/config.py`: remove broken DeGiro default unless integration imports are available.
- Modify `src/swing_screener/fundamentals/providers/sec_edgar.py`: add richer filing/fundamental fields.
- Modify `src/swing_screener/fundamentals/models.py`: add source health and richer metric fields.
- Modify `src/swing_screener/fundamentals/scoring.py`: score only validated new fields and expose data confidence.
- Modify `api/models/screener.py`: surface data source summaries per candidate.
- Modify `api/services/screener_service.py`: attach source summaries and use new confidence modifiers.
- Modify `api/services/calendar_service.py`: add provider/source metadata to calendar events and capture event confidence.
- Modify `api/models/calendar.py`: expose calendar provider and confidence fields.
- Modify `web-ui/src/features/screener/types.ts`: mirror new candidate fields.
- Modify `web-ui/src/components/domain/workspace/KeyMetrics.tsx` or `AnalysisDecisionStrip.tsx`: add compact data-source visibility.
- Test files:
  - `tests/data/test_source_health.py`
  - `tests/test_tier1_stack_smoke.py`
  - `tests/test_fundamentals_scoring.py`
  - `tests/api/test_screener_endpoints.py`
  - `tests/test_calendar_service.py`
  - `web-ui/src/features/screener/types.test.ts`

---

### Task 1: Add Shared Source Health And Provenance Models

**Files:**
- Create: `src/swing_screener/data/source_health.py`
- Modify: `src/swing_screener/data/providers/base.py`
- Test: `tests/data/test_source_health.py`

- [ ] **Step 1: Write failing source health tests**

```python
# tests/data/test_source_health.py
from swing_screener.data.source_health import (
    DataSourceHealth,
    DataSourceProvenance,
    merge_source_health,
)


def test_source_health_defaults_are_conservative():
    health = DataSourceHealth(provider="yfinance", domain="market_data")

    assert health.status == "unknown"
    assert health.quality_score == 0.5
    assert health.delay_policy == "unknown"
    assert health.warnings == []


def test_provenance_serializes_provider_domain_and_asof():
    provenance = DataSourceProvenance(
        provider="sec_edgar",
        domain="fundamentals",
        asof_date="2026-05-28",
        fetched_at="2026-05-28T12:00:00+00:00",
        fields=["revenue_growth_yoy", "operating_margin"],
    )

    payload = provenance.to_dict()

    assert payload["provider"] == "sec_edgar"
    assert payload["domain"] == "fundamentals"
    assert payload["fields"] == ["revenue_growth_yoy", "operating_margin"]


def test_merge_source_health_penalizes_warnings_and_failures():
    merged = merge_source_health(
        [
            DataSourceHealth(provider="sec_edgar", domain="fundamentals", status="ok", quality_score=0.9),
            DataSourceHealth(provider="yfinance", domain="metadata", status="degraded", quality_score=0.6, warnings=["unofficial"]),
        ]
    )

    assert merged.provider == "combined"
    assert merged.domain == "aggregate"
    assert 0.6 <= merged.quality_score < 0.9
    assert merged.status == "degraded"
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/data/test_source_health.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'swing_screener.data.source_health'`.

- [ ] **Step 3: Implement source health models**

```python
# src/swing_screener/data/source_health.py
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

SourceDomain = Literal["market_data", "metadata", "fundamentals", "calendar", "intelligence", "aggregate"]
SourceStatus = Literal["ok", "degraded", "failed", "unknown"]


@dataclass(frozen=True)
class DataSourceHealth:
    provider: str
    domain: SourceDomain
    status: SourceStatus = "unknown"
    quality_score: float = 0.5
    delay_policy: str = "unknown"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["quality_score"] = max(0.0, min(1.0, float(self.quality_score)))
        return payload


@dataclass(frozen=True)
class DataSourceProvenance:
    provider: str
    domain: SourceDomain
    asof_date: str | None = None
    fetched_at: str | None = None
    fields: list[str] = field(default_factory=list)
    source_url: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def merge_source_health(items: list[DataSourceHealth]) -> DataSourceHealth:
    if not items:
        return DataSourceHealth(provider="combined", domain="aggregate")

    statuses = {item.status for item in items}
    if "failed" in statuses:
        status: SourceStatus = "failed"
    elif "degraded" in statuses:
        status = "degraded"
    elif statuses == {"ok"}:
        status = "ok"
    else:
        status = "unknown"

    warnings: list[str] = []
    for item in items:
        for warning in item.warnings:
            if warning not in warnings:
                warnings.append(warning)

    base_score = sum(max(0.0, min(1.0, float(item.quality_score))) for item in items) / len(items)
    warning_penalty = min(0.25, 0.05 * len(warnings))
    failure_penalty = 0.35 if status == "failed" else 0.15 if status == "degraded" else 0.0

    return DataSourceHealth(
        provider="combined",
        domain="aggregate",
        status=status,
        quality_score=max(0.0, round(base_score - warning_penalty - failure_penalty, 4)),
        warnings=warnings,
    )
```

- [ ] **Step 4: Add optional provider health API**

```python
# src/swing_screener/data/providers/base.py
from swing_screener.data.source_health import DataSourceHealth

# Add to MarketDataProvider:
def get_source_health(self) -> DataSourceHealth:
    return DataSourceHealth(provider=self.get_provider_name(), domain="market_data")
```

- [ ] **Step 5: Run test**

Run: `pytest tests/data/test_source_health.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/data/source_health.py src/swing_screener/data/providers/base.py tests/data/test_source_health.py
git commit -m "feat: add data source health models"
```

---

### Task 2: Make Market Data Provider Quality Visible

**Files:**
- Modify: `src/swing_screener/data/providers/yfinance_provider.py`
- Modify: `src/swing_screener/data/providers/stooq_provider.py`
- Modify: `src/swing_screener/data/providers/alpaca_provider.py`
- Modify: `api/models/screener.py`
- Modify: `api/services/screener_service.py`
- Test: `tests/api/test_screener_endpoints.py`

- [ ] **Step 1: Write failing API test for candidate source summaries**

```python
# tests/api/test_screener_endpoints.py
def test_screener_response_includes_market_data_source_summary(client, monkeypatch):
    response = client.post(
        "/api/screener",
        json={"tickers": ["AAPL", "MSFT"], "top": 1, "asof_date": "2026-05-01"},
    )

    assert response.status_code == 200
    data = response.json()
    if data["candidates"]:
        source_summary = data["candidates"][0]["data_source_summary"]
        assert source_summary["market_data"]["provider"]
        assert source_summary["market_data"]["status"] in {"ok", "degraded", "failed", "unknown"}
        assert 0 <= source_summary["market_data"]["quality_score"] <= 1
```

- [ ] **Step 2: Run targeted test to verify failure**

Run: `pytest tests/api/test_screener_endpoints.py::test_screener_response_includes_market_data_source_summary -v`

Expected: FAIL because `data_source_summary` is missing.

- [ ] **Step 3: Add provider-specific health**

```python
# yfinance provider
def get_source_health(self) -> DataSourceHealth:
    warnings = ["unofficial_provider"]
    return DataSourceHealth(
        provider="yfinance",
        domain="market_data",
        status="ok",
        quality_score=0.65,
        delay_policy="delayed_or_eod",
        warnings=warnings,
    )

# stooq provider
def get_source_health(self) -> DataSourceHealth:
    return DataSourceHealth(
        provider="stooq",
        domain="market_data",
        status="ok",
        quality_score=0.6,
        delay_policy="daily_eod",
        warnings=["daily_only"],
    )

# alpaca provider
def get_source_health(self) -> DataSourceHealth:
    return DataSourceHealth(
        provider=self.get_provider_name(),
        domain="market_data",
        status="ok",
        quality_score=0.85 if not self.paper else 0.75,
        delay_policy="provider_plan_dependent",
        warnings=[] if not self.paper else ["paper_or_basic_plan_may_be_limited"],
    )
```

- [ ] **Step 4: Extend screener model**

```python
# api/models/screener.py
from typing import Any

# Add this field to the existing ScreenerCandidate class, near the other source/asof fields.
data_source_summary: dict[str, Any] = Field(default_factory=dict)
```

- [ ] **Step 5: Attach market data source summary in screener service**

```python
# api/services/screener_service.py
market_health = self._provider.get_source_health().to_dict()

# When building each ScreenerCandidate:
data_source_summary={
    "market_data": market_health,
}
```

- [ ] **Step 6: Run targeted test**

Run: `pytest tests/api/test_screener_endpoints.py::test_screener_response_includes_market_data_source_summary -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/data/providers api/models/screener.py api/services/screener_service.py tests/api/test_screener_endpoints.py
git commit -m "feat: surface market data source quality"
```

---

### Task 3: Fix Fundamentals Provider Chain And Add Data Confidence

**Files:**
- Modify: `src/swing_screener/fundamentals/config.py`
- Modify: `src/swing_screener/fundamentals/service.py`
- Modify: `src/swing_screener/fundamentals/models.py`
- Modify: `src/swing_screener/fundamentals/scoring.py`
- Test: `tests/test_fundamentals_service.py`
- Test: `tests/test_fundamentals_scoring.py`

- [ ] **Step 1: Write failing test for DeGiro default behavior**

```python
# tests/test_fundamentals_service.py
from swing_screener.fundamentals.config import build_fundamentals_config


def test_default_fundamentals_provider_chain_excludes_unavailable_degiro():
    cfg = build_fundamentals_config({})

    assert cfg.providers == ("sec_edgar", "yfinance")
```

- [ ] **Step 2: Run test to verify failure**

Run: `pytest tests/test_fundamentals_service.py::test_default_fundamentals_provider_chain_excludes_unavailable_degiro -v`

Expected: FAIL while default chain still includes `degiro`.

- [ ] **Step 3: Make DeGiro opt-in unless integration exists**

```python
# src/swing_screener/fundamentals/config.py
BASE_TIER1_PROVIDERS: tuple[str, ...] = ("sec_edgar", "yfinance")


def _degiro_available() -> bool:
    try:
        import swing_screener.integrations.degiro.client  # noqa: F401
        import swing_screener.integrations.degiro.credentials  # noqa: F401
    except ModuleNotFoundError:
        return False
    return True


def default_fundamentals_providers() -> tuple[str, ...]:
    if _degiro_available():
        return ("sec_edgar", "degiro", "yfinance")
    return BASE_TIER1_PROVIDERS


TIER1_PROVIDERS: tuple[str, ...] = default_fundamentals_providers()
```

- [ ] **Step 4: Add fundamentals confidence fields**

```python
# src/swing_screener/fundamentals/models.py
# Add these fields to FundamentalSnapshot after data_quality_flags.
data_confidence_score: float = 0.5
source_health: dict[str, Any] = field(default_factory=dict)
```

- [ ] **Step 5: Score fundamentals confidence**

```python
# src/swing_screener/fundamentals/scoring.py
def _data_confidence_score(coverage_status: str, freshness_status: str, quality_status: str) -> float:
    coverage = {"supported": 0.9, "partial": 0.6, "insufficient": 0.3, "unsupported": 0.1}.get(coverage_status, 0.3)
    freshness = {"current": 1.0, "stale": 0.55, "unknown": 0.45}.get(freshness_status, 0.45)
    quality = {"high": 1.0, "medium": 0.75, "low": 0.45}.get(quality_status, 0.45)
    return round(max(0.0, min(1.0, coverage * freshness * quality)), 4)
```

Then set `data_confidence_score` on `FundamentalSnapshot` inside `build_snapshot`.

- [ ] **Step 6: Add scoring test**

```python
# tests/test_fundamentals_scoring.py
def test_snapshot_data_confidence_penalizes_stale_partial_data(sample_provider_record):
    from dataclasses import replace
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.scoring import build_snapshot

    record = replace(sample_provider_record, most_recent_quarter="2020-01-01")
    snapshot = build_snapshot(record, FundamentalsConfig(stale_after_days=120))

    assert 0 <= snapshot.data_confidence_score <= 1
    assert snapshot.data_confidence_score < 0.8
```

- [ ] **Step 7: Run fundamentals tests**

Run: `pytest tests/test_fundamentals_service.py tests/test_fundamentals_scoring.py -v`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/swing_screener/fundamentals tests/test_fundamentals_service.py tests/test_fundamentals_scoring.py
git commit -m "feat: add fundamentals source confidence"
```

---

### Task 4: Enrich SEC EDGAR Fundamentals With Filing Metadata And More Balance Sheet Fields

**Files:**
- Modify: `src/swing_screener/fundamentals/models.py`
- Modify: `src/swing_screener/fundamentals/providers/sec_edgar.py`
- Modify: `src/swing_screener/fundamentals/scoring.py`
- Test: `tests/test_sec_edgar_fundamentals_provider.py`

- [ ] **Step 1: Write failing SEC provider test**

```python
# tests/test_sec_edgar_fundamentals_provider.py
def test_sec_edgar_record_includes_balance_sheet_and_filing_metadata(mock_sec_companyfacts):
    provider = SecEdgarFundamentalsProvider()
    record = provider.fetch_record("AAPL")

    assert record.total_assets is not None
    assert record.total_liabilities is not None
    assert record.cash_and_equivalents is not None
    assert record.latest_filing_form in {"10-Q", "10-K", "10-Q/A", "10-K/A"}
    assert record.latest_filing_date is not None
```

- [ ] **Step 2: Run test to verify failure**

Run: `pytest tests/test_sec_edgar_fundamentals_provider.py::test_sec_edgar_record_includes_balance_sheet_and_filing_metadata -v`

Expected: FAIL because fields do not exist.

- [ ] **Step 3: Add model fields**

```python
# src/swing_screener/fundamentals/models.py
# Add these fields to ProviderFundamentalsRecord after total_equity.
total_assets: float | None = None
total_liabilities: float | None = None
cash_and_equivalents: float | None = None
latest_filing_form: str | None = None
latest_filing_date: str | None = None

# Add these fields to FundamentalSnapshot after total_equity.
total_assets: float | None = None
total_liabilities: float | None = None
cash_and_equivalents: float | None = None
latest_filing_form: str | None = None
latest_filing_date: str | None = None
```

- [ ] **Step 4: Extract fields from SEC facts**

```python
# src/swing_screener/fundamentals/providers/sec_edgar.py
total_assets, total_assets_period, total_assets_source = _latest_instant_value(
    payload,
    taxonomies=("us-gaap",),
    concepts=("Assets",),
    unit_candidates=("USD",),
)
total_liabilities, total_liabilities_period, total_liabilities_source = _latest_instant_value(
    payload,
    taxonomies=("us-gaap",),
    concepts=("Liabilities",),
    unit_candidates=("USD",),
)
cash_and_equivalents, cash_period, cash_source = _latest_instant_value(
    payload,
    taxonomies=("us-gaap",),
    concepts=("CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"),
    unit_candidates=("USD",),
)
latest_filing_form, latest_filing_date = _latest_filing_metadata(payload)
```

Add helper:

```python
def _latest_filing_metadata(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    latest: tuple[str, str] | None = None
    facts = payload.get("facts")
    if not isinstance(facts, dict):
        return (None, None)
    for taxonomy in facts.values():
        if not isinstance(taxonomy, dict):
            continue
        for node in taxonomy.values():
            if not isinstance(node, dict):
                continue
            for items in (node.get("units") or {}).values():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    form = str(item.get("form", "")).strip()
                    filed = str(item.get("filed", "")).strip()
                    if form in _ALLOWED_FORMS and filed and (latest is None or filed > latest[1]):
                        latest = (form, filed)
    return latest if latest else (None, None)
```

- [ ] **Step 5: Pass fields through snapshot**

Update `build_snapshot` to copy the new fields from `resolved_record`.

- [ ] **Step 6: Run SEC tests**

Run: `pytest tests/test_sec_edgar_fundamentals_provider.py tests/test_fundamentals_scoring.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/fundamentals tests/test_sec_edgar_fundamentals_provider.py
git commit -m "feat: enrich SEC fundamentals metadata"
```

---

### Task 5: Add Calendar Event Provenance And Confidence

**Files:**
- Modify: `api/models/calendar.py`
- Modify: `api/services/calendar_service.py`
- Test: `tests/test_calendar_service.py`

- [ ] **Step 1: Write failing calendar test**

```python
# tests/test_calendar_service.py
def test_calendar_events_include_provider_and_confidence(calendar_service_with_finnhub_key):
    events = calendar_service_with_finnhub_key.get_events(days_ahead=30)

    for event in events:
        assert event.provider in {"finnhub", "yfinance"}
        assert 0 <= event.confidence <= 1
```

- [ ] **Step 2: Run test to verify failure**

Run: `pytest tests/test_calendar_service.py::test_calendar_events_include_provider_and_confidence -v`

Expected: FAIL because fields are missing.

- [ ] **Step 3: Extend calendar event model**

```python
# api/models/calendar.py
# Add these fields to CalendarEvent after source_tag.
provider: Optional[str] = None
confidence: float = 0.5
source_url: Optional[str] = None
```

- [ ] **Step 4: Populate provider metadata**

```python
# Finnhub earnings event
CalendarEvent(
    date=earnings_date.isoformat(),
    ticker=ticker,
    event_type="earnings",
    title=f"{ticker} Earnings",
    source_tag=source_tag,
    eps_estimate=eps_estimate,
    eps_actual=eps_actual,
    provider="finnhub",
    confidence=0.85,
    source_url="https://finnhub.io/api/v1/calendar/earnings",
)

# yfinance fallback event
CalendarEvent(
    date=earnings_date.isoformat(),
    ticker=ticker,
    event_type="earnings",
    title=f"{ticker} Earnings",
    source_tag=source_tag,
    provider="yfinance",
    confidence=0.55,
)
```

- [ ] **Step 5: Run calendar tests**

Run: `pytest tests/test_calendar_service.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/models/calendar.py api/services/calendar_service.py tests/test_calendar_service.py
git commit -m "feat: add calendar event provenance"
```

---

### Task 6: Wire Data Confidence Into Combined Ranking

**Files:**
- Modify: `src/swing_screener/recommendation/priority.py`
- Modify: `api/services/screener_service.py`
- Test: `tests/test_combined_priority.py`

- [ ] **Step 1: Write failing ranking test**

```python
# tests/test_combined_priority.py
def test_combined_priority_penalizes_low_fundamentals_data_confidence(candidate_factory, fundamentals_snapshot_factory):
    high_conf = candidate_factory(
        ticker="HIGH",
        confidence=80,
        fundamentals_snapshot=fundamentals_snapshot_factory(
            business_quality_score=0.8,
            valuation_attractiveness=0.7,
            data_confidence_score=0.95,
        ),
    )
    low_conf = candidate_factory(
        ticker="LOW",
        confidence=80,
        fundamentals_snapshot=fundamentals_snapshot_factory(
            business_quality_score=0.8,
            valuation_attractiveness=0.7,
            data_confidence_score=0.25,
        ),
    )

    ranked = compute_combined_priority([low_conf, high_conf])

    assert ranked[0].ticker == "HIGH"
    assert ranked[0].combined_priority_score > ranked[1].combined_priority_score
```

- [ ] **Step 2: Run test to verify failure**

Run: `pytest tests/test_combined_priority.py::test_combined_priority_penalizes_low_fundamentals_data_confidence -v`

Expected: FAIL because confidence is not considered.

- [ ] **Step 3: Apply data confidence multiplier**

```python
# src/swing_screener/recommendation/priority.py
def _fundamentals_score(candidate: ScreenerCandidate) -> float:
    ds = candidate.decision_summary
    score = _label_score(
        _FUNDAMENTALS_SCORE,
        getattr(ds, "fundamentals_label", None) if ds else None,
    )
    snapshot = getattr(candidate, "fundamentals_snapshot", None)
    if snapshot is None:
        return score

    business_quality = _safe_float(getattr(snapshot, "business_quality_score", None))
    if business_quality is not None:
        score = business_quality

    freshness_penalty = _safe_float(getattr(snapshot, "freshness_penalty", None)) or 0.0
    coverage_penalty = _safe_float(getattr(snapshot, "coverage_penalty", None)) or 0.0
    penalty_multiplier = max(0.0, 1.0 - freshness_penalty - (coverage_penalty * 0.5))
    data_confidence = _safe_float(getattr(snapshot, "data_confidence_score", None))
    if data_confidence is not None:
        score *= max(0.25, min(1.0, data_confidence))
    return max(0.0, score * penalty_multiplier)


def _valuation_score(candidate: ScreenerCandidate) -> float:
    ds = candidate.decision_summary
    score = _label_score(
        _VALUATION_SCORE,
        getattr(ds, "valuation_label", None) if ds else None,
    )
    snapshot = getattr(candidate, "fundamentals_snapshot", None)
    if snapshot is None:
        return score

    valuation = _safe_float(getattr(snapshot, "valuation_attractiveness", None))
    score = valuation if valuation is not None else score
    data_confidence = _safe_float(getattr(snapshot, "data_confidence_score", None))
    if data_confidence is not None:
        return score * max(0.4, min(1.0, data_confidence))
    return score
```

- [ ] **Step 4: Run ranking tests**

Run: `pytest tests/test_combined_priority.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/recommendation/priority.py tests/test_combined_priority.py
git commit -m "feat: weight ranking by data confidence"
```

---

### Task 7: Surface Data Sources In The UI

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/screener/types.test.ts`
- Modify: `web-ui/src/components/domain/workspace/KeyMetrics.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx`
- Test: `web-ui/src/components/domain/workspace/AnalysisDecisionStrip.test.tsx`

- [ ] **Step 1: Write failing type test**

```ts
// web-ui/src/features/screener/types.test.ts
it('maps data source summary from screener candidate payload', () => {
  const candidate = mapScreenerCandidate({
    ticker: 'AAPL',
    close: 100,
    sma_20: 95,
    sma_50: 90,
    sma_200: 80,
    atr: 2,
    momentum_6m: 10,
    momentum_12m: 20,
    rel_strength: 5,
    score: 0.8,
    confidence: 75,
    rank: 1,
    data_source_summary: {
      market_data: { provider: 'yfinance', status: 'ok', quality_score: 0.65 },
      fundamentals: { provider: 'sec_edgar', status: 'ok', quality_score: 0.9 },
    },
  });

  expect(candidate.dataSourceSummary.marketData.provider).toBe('yfinance');
  expect(candidate.dataSourceSummary.fundamentals.provider).toBe('sec_edgar');
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `cd web-ui && npm test -- src/features/screener/types.test.ts --run`

Expected: FAIL because mapping field is missing.

- [ ] **Step 3: Add TypeScript types and mapping**

```ts
// web-ui/src/features/screener/types.ts
export interface DataSourceHealth {
  provider: string;
  status: 'ok' | 'degraded' | 'failed' | 'unknown';
  qualityScore: number;
  delayPolicy?: string;
  warnings: string[];
}

export interface CandidateDataSourceSummary {
  marketData?: DataSourceHealth;
  fundamentals?: DataSourceHealth;
  calendar?: DataSourceHealth;
  intelligence?: DataSourceHealth;
}
```

Add this helper next to the existing candidate mapping helpers:

```ts
const mapDataSourceHealth = (value: unknown): DataSourceHealth | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const payload = value as Record<string, unknown>;
  return {
    provider: String(payload.provider ?? ''),
    status: ['ok', 'degraded', 'failed', 'unknown'].includes(String(payload.status))
      ? (payload.status as DataSourceHealth['status'])
      : 'unknown',
    qualityScore: Number(payload.quality_score ?? payload.qualityScore ?? 0.5),
    delayPolicy: payload.delay_policy ? String(payload.delay_policy) : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
  };
};

const mapDataSourceSummary = (value: unknown): CandidateDataSourceSummary => {
  if (!value || typeof value !== 'object') return {};
  const payload = value as Record<string, unknown>;
  return {
    marketData: mapDataSourceHealth(payload.market_data ?? payload.marketData),
    fundamentals: mapDataSourceHealth(payload.fundamentals),
    calendar: mapDataSourceHealth(payload.calendar),
    intelligence: mapDataSourceHealth(payload.intelligence),
  };
};
```

- [ ] **Step 4: Render compact source chips**

```tsx
// web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx
const sourceItems = [
  ['Market', candidate.dataSourceSummary.marketData],
  ['Fundamentals', candidate.dataSourceSummary.fundamentals],
  ['Events', candidate.dataSourceSummary.calendar],
].filter(([, value]) => Boolean(value));
```

Render the chips inside the existing decision strip metrics area:

```tsx
{sourceItems.map(([label, source]) => (
  <Badge key={label} variant={source?.status === 'ok' ? 'success' : 'warning'}>
    {label}: {source?.provider || 'unknown'} ({source?.status || 'unknown'})
  </Badge>
))}
```

- [ ] **Step 5: Run UI tests**

Run: `cd web-ui && npm test -- src/features/screener/types.test.ts src/components/domain/workspace/AnalysisDecisionStrip.test.tsx --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/screener/types.test.ts web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx web-ui/src/components/domain/workspace/AnalysisDecisionStrip.test.tsx
git commit -m "feat: surface candidate data sources"
```

---

### Task 8: Add Provider Roadmap Switches For EODHD/Twelve Data Without Enabling By Default

**Files:**
- Modify: `docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md`
- Modify: `config/defaults.yaml`
- Modify: `.env.example`
- Create: `src/swing_screener/fundamentals/providers/vendor_placeholder.py`
- Test: `tests/test_fundamentals_service.py`

- [ ] **Step 1: Write provider config validation test**

```python
# tests/test_fundamentals_service.py
def test_paid_vendor_provider_names_are_rejected_until_implemented():
    from swing_screener.fundamentals.config import build_fundamentals_config

    cfg = build_fundamentals_config({"providers": ["eodhd", "sec_edgar"]})

    assert cfg.providers == ("sec_edgar",)
```

- [ ] **Step 2: Run test**

Run: `pytest tests/test_fundamentals_service.py::test_paid_vendor_provider_names_are_rejected_until_implemented -v`

Expected: PASS after current validation keeps unsupported providers out.

- [ ] **Step 3: Document future provider config without activating it**

```yaml
# config/defaults.yaml
data_provider_roadmap:
  eodhd:
    status: planned
    domains:
      - eu_fundamentals
      - global_calendar
      - financial_news
  twelve_data:
    status: planned
    domains:
      - global_fundamentals
      - earnings_calendar
      - dividends_calendar
```

- [ ] **Step 4: Add env documentation**

```bash
# .env.example
# EODHD_API_KEY=
# TWELVE_DATA_API_KEY=
```

- [ ] **Step 5: Update engineering audit**

Add a current-state correction:

```markdown
## Current Code Reality As Of 2026-05-28

- Default fundamentals should be `sec_edgar -> yfinance` unless DeGiro integration modules are installed.
- EODHD/Twelve Data are roadmap providers only; no runtime code should pretend they are available.
- Paid providers must land behind tests and explicit config before contributing to ranking.
```

- [ ] **Step 6: Commit**

```bash
git add docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md config/defaults.yaml .env.example tests/test_fundamentals_service.py
git commit -m "docs: define paid data provider roadmap"
```

---

## Execution Order

1. Task 1 first: all later work depends on shared health/provenance types.
2. Task 2 next: market data is the most-used path and simplest to surface.
3. Task 3 before Task 4: fix the provider chain before adding richer fundamentals.
4. Task 4 then Task 6: richer fundamentals should exist before scoring changes depend on them.
5. Task 5 can run in parallel with Task 4 after Task 1.
6. Task 7 after Tasks 2, 3, and 5: UI needs stable API fields.
7. Task 8 last: documentation and config roadmap should reflect implemented behavior.

## Verification

Run backend targeted tests:

```bash
pytest tests/data/test_source_health.py tests/test_fundamentals_service.py tests/test_fundamentals_scoring.py tests/test_sec_edgar_fundamentals_provider.py tests/test_calendar_service.py tests/test_combined_priority.py tests/api/test_screener_endpoints.py -v
```

Run frontend targeted tests:

```bash
cd web-ui && npm test -- src/features/screener/types.test.ts src/components/domain/workspace/AnalysisDecisionStrip.test.tsx --run
```

Run smoke test:

```bash
pytest tests/test_tier1_stack_smoke.py -v
```

## Self-Review Notes

- The plan starts with source visibility before adding vendors, because invisible source quality makes prediction regressions hard to debug.
- The plan does not implement paid EODHD/Twelve Data providers yet. It adds a clean roadmap gate so runtime behavior stays honest.
- DeGiro is treated as opt-in until its integration package exists in this tree.
- Combined ranking only consumes data-confidence fields after they are tested and surfaced.
