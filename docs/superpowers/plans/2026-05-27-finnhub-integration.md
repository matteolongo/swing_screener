# Finnhub Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Finnhub usage from economic calendar only to: fundamentals gap-filling + analyst signals + earnings/IPO/dividend calendar events.

**Architecture:** A `FinnhubEnrichmentClient` (not a provider) runs after the existing provider chain and fills `None` metric fields plus three new signals (analyst recommendation score, price target, earnings beat streak). Calendar gains Finnhub-backed earnings (with EPS estimates), IPO, and dividend event types. All Finnhub paths are silently skipped when `FINNHUB_API_KEY` is absent.

**Tech Stack:** Python 3.11, `httpx`, `dataclasses.replace`, FastAPI, `pytest` + `unittest.mock`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/swing_screener/fundamentals/models.py` | Modify | Add 4 new optional fields to `ProviderFundamentalsRecord` + `FundamentalSnapshot` + `from_dict` |
| `src/swing_screener/fundamentals/scoring.py` | Modify | Forward new fields in `build_snapshot` return |
| `src/swing_screener/fundamentals/finnhub_client.py` | Create | `FinnhubEnrichmentClient` — all Finnhub fundamentals fetch logic |
| `src/swing_screener/fundamentals/__init__.py` | Modify | Export `FinnhubEnrichmentClient` |
| `src/swing_screener/fundamentals/service.py` | Modify | Accept + call `FinnhubEnrichmentClient` after primary provider |
| `api/dependencies.py` | Modify | Construct `FinnhubEnrichmentClient` from env, inject into `FundamentalsAnalysisService` |
| `api/models/calendar.py` | Modify | Add `eps_estimate`, `eps_actual`; expand `event_type` and `source_tag` literals |
| `api/services/calendar_service.py` | Modify | Switch earnings to Finnhub, add IPO + dividend fetch methods |
| `tests/test_finnhub_client.py` | Create | Unit tests for `FinnhubEnrichmentClient` |
| `tests/test_fundamentals_service.py` | Modify | Add enrichment wiring tests |
| `tests/test_calendar_service.py` | Modify | Add Finnhub calendar tests |

---

## Task 1: Extend models with new optional fields

**Files:**
- Modify: `src/swing_screener/fundamentals/models.py`
- Modify: `src/swing_screener/fundamentals/scoring.py`
- Test: `tests/test_fundamentals_snapshot_roundtrip.py`

- [ ] **Step 1: Write failing tests for new fields**

Add to `tests/test_fundamentals_snapshot_roundtrip.py`:

```python
def test_provider_record_has_new_finnhub_fields():
    from swing_screener.fundamentals.models import ProviderFundamentalsRecord
    record = ProviderFundamentalsRecord(
        symbol="AAPL",
        asof_date="2026-05-27",
        provider="yfinance",
        net_margin=0.22,
        analyst_recommendation_score=15.0,
        analyst_price_target=235.0,
        earnings_beat_streak=4,
    )
    assert record.net_margin == 0.22
    assert record.analyst_recommendation_score == 15.0
    assert record.analyst_price_target == 235.0
    assert record.earnings_beat_streak == 4


def test_snapshot_new_fields_default_to_none():
    from swing_screener.fundamentals.models import ProviderFundamentalsRecord
    record = ProviderFundamentalsRecord(symbol="AAPL", asof_date="2026-05-27", provider="yfinance")
    assert record.net_margin is None
    assert record.analyst_recommendation_score is None
    assert record.analyst_price_target is None
    assert record.earnings_beat_streak is None


def test_snapshot_from_dict_roundtrips_new_fields():
    from swing_screener.fundamentals.models import FundamentalSnapshot
    payload = {
        "symbol": "AAPL",
        "asof_date": "2026-05-27",
        "provider": "yfinance",
        "updated_at": "2026-05-27T10:00:00",
        "net_margin": 0.22,
        "analyst_recommendation_score": 15.0,
        "analyst_price_target": 235.0,
        "earnings_beat_streak": 4,
    }
    snapshot = FundamentalSnapshot.from_dict(payload)
    assert snapshot.net_margin == 0.22
    assert snapshot.analyst_recommendation_score == 15.0
    assert snapshot.analyst_price_target == 235.0
    assert snapshot.earnings_beat_streak == 4


def test_snapshot_from_dict_new_fields_default_to_none_when_absent():
    from swing_screener.fundamentals.models import FundamentalSnapshot
    payload = {
        "symbol": "AAPL",
        "asof_date": "2026-05-27",
        "provider": "yfinance",
        "updated_at": "2026-05-27T10:00:00",
    }
    snapshot = FundamentalSnapshot.from_dict(payload)
    assert snapshot.net_margin is None
    assert snapshot.analyst_recommendation_score is None
    assert snapshot.analyst_price_target is None
    assert snapshot.earnings_beat_streak is None
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pytest tests/test_fundamentals_snapshot_roundtrip.py -k "new_finnhub_fields or new_fields_default or new_fields_roundtrip" -v
```

Expected: FAIL — `ProviderFundamentalsRecord` has no `net_margin` attribute.

- [ ] **Step 3: Add fields to `ProviderFundamentalsRecord`**

In `src/swing_screener/fundamentals/models.py`, after line 127 (`book_to_price: float | None = None`), add:

```python
    net_margin: float | None = None
    analyst_recommendation_score: float | None = None
    analyst_price_target: float | None = None
    earnings_beat_streak: int | None = None
```

- [ ] **Step 4: Add fields to `FundamentalSnapshot`**

In the same file, after line 185 (`valuation_attractiveness: float | None = None`), add:

```python
    # Finnhub enrichment fields
    net_margin: float | None = None
    analyst_recommendation_score: float | None = None
    analyst_price_target: float | None = None
    earnings_beat_streak: int | None = None
```

- [ ] **Step 5: Update `FundamentalSnapshot.from_dict`**

In the `return cls(...)` call (after `error=...`), add:

```python
            net_margin=(float(payload["net_margin"]) if payload.get("net_margin") is not None else None),
            analyst_recommendation_score=(float(payload["analyst_recommendation_score"]) if payload.get("analyst_recommendation_score") is not None else None),
            analyst_price_target=(float(payload["analyst_price_target"]) if payload.get("analyst_price_target") is not None else None),
            earnings_beat_streak=(int(payload["earnings_beat_streak"]) if payload.get("earnings_beat_streak") is not None else None),
```

- [ ] **Step 6: Forward new fields in `build_snapshot`**

In `src/swing_screener/fundamentals/scoring.py`, in the `build_snapshot` function's `return FundamentalSnapshot(...)` call, after `valuation_attractiveness=val_attract,` add:

```python
        net_margin=resolved_record.net_margin,
        analyst_recommendation_score=resolved_record.analyst_recommendation_score,
        analyst_price_target=resolved_record.analyst_price_target,
        earnings_beat_streak=resolved_record.earnings_beat_streak,
```

- [ ] **Step 7: Run tests, confirm they pass**

```bash
pytest tests/test_fundamentals_snapshot_roundtrip.py -v
```

Expected: all PASS (including pre-existing roundtrip tests).

- [ ] **Step 8: Run full test suite to catch regressions**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/swing_screener/fundamentals/models.py src/swing_screener/fundamentals/scoring.py tests/test_fundamentals_snapshot_roundtrip.py
git commit -m "feat(finnhub): add net_margin, analyst_recommendation_score, analyst_price_target, earnings_beat_streak fields to fundamentals models"
```

---

## Task 2: `FinnhubEnrichmentClient` — metric supplement

**Files:**
- Create: `src/swing_screener/fundamentals/finnhub_client.py`
- Create: `tests/test_finnhub_client.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_finnhub_client.py`:

```python
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from swing_screener.fundamentals.models import ProviderFundamentalsRecord


def _make_record(**kwargs) -> ProviderFundamentalsRecord:
    defaults = {"symbol": "AAPL", "asof_date": "2026-05-27", "provider": "yfinance"}
    return ProviderFundamentalsRecord(**{**defaults, **kwargs})


def _mock_metric_response(metrics: dict) -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = {"metric": metrics}
    resp.raise_for_status = MagicMock()
    return resp


def test_fetch_metric_supplement_fills_none_gross_margin():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response({"grossMarginAnnual": 46.56})):
        result = client._fetch_metric_supplement("AAPL")

    assert result.get("gross_margin") == pytest.approx(0.4656, rel=1e-3)


def test_fetch_metric_supplement_does_not_return_fields_with_none_values():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response({"grossMarginAnnual": None})):
        result = client._fetch_metric_supplement("AAPL")

    assert "gross_margin" not in result


def test_fetch_metric_supplement_maps_all_known_keys():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    raw = {
        "grossMarginAnnual": 46.56,
        "netProfitMarginAnnual": 26.31,
        "operatingMarginAnnual": 31.51,
        "revenueGrowthAnnualYoy": 0.04,
        "epsGrowthAnnualYoy": 0.10,
        "roeAnnual": 136.07,
        "currentRatioAnnual": 0.87,
        "totalDebt/totalEquityAnnual": 198.47,
        "peAnnual": 33.09,
        "pbAnnual": 45.85,
    }
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response(raw)):
        result = client._fetch_metric_supplement("AAPL")

    assert set(result.keys()) == {
        "gross_margin", "net_margin", "operating_margin",
        "revenue_growth_yoy", "earnings_growth_yoy",
        "return_on_equity", "current_ratio", "debt_to_equity",
        "trailing_pe", "price_to_book",
    }


def test_fetch_metric_supplement_returns_empty_dict_on_http_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("timeout")):
        result = client._fetch_metric_supplement("AAPL")

    assert result == {}


def test_enrich_fills_none_fields_from_supplement():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record(gross_margin=None, operating_margin=0.25)

    with patch.object(client, "_fetch_metric_supplement",
                      return_value={"gross_margin": 0.46, "operating_margin": 0.30}):
        with patch.object(client, "_fetch_recommendation_score", return_value=None):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched.gross_margin == pytest.approx(0.46)
    assert enriched.operating_margin == 0.25  # not overwritten


def test_enrich_returns_same_record_when_no_updates():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record(gross_margin=0.46)

    with patch.object(client, "_fetch_metric_supplement", return_value={}):
        with patch.object(client, "_fetch_recommendation_score", return_value=None):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched is record
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pytest tests/test_finnhub_client.py -v
```

Expected: FAIL — `swing_screener.fundamentals.finnhub_client` does not exist.

- [ ] **Step 3: Implement `FinnhubEnrichmentClient` with metric supplement**

Create `src/swing_screener/fundamentals/finnhub_client.py`:

```python
from __future__ import annotations

import logging
from dataclasses import replace
from typing import Any

import httpx

from swing_screener.fundamentals.models import ProviderFundamentalsRecord

logger = logging.getLogger(__name__)

_BASE_URL = "https://finnhub.io/api/v1"
_TIMEOUT = 10.0

# Maps Finnhub metric key → (model field name, scale factor to convert to model units).
# Margin/ROE fields: Finnhub returns percent × 100 (e.g. 46.56 → 0.4656).
# Growth/ratio fields: already in model units.
_FINNHUB_METRIC_MAP: dict[str, tuple[str, float]] = {
    "grossMarginAnnual": ("gross_margin", 0.01),
    "netProfitMarginAnnual": ("net_margin", 0.01),
    "operatingMarginAnnual": ("operating_margin", 0.01),
    "revenueGrowthAnnualYoy": ("revenue_growth_yoy", 1.0),
    "epsGrowthAnnualYoy": ("earnings_growth_yoy", 1.0),
    "roeAnnual": ("return_on_equity", 0.01),
    "currentRatioAnnual": ("current_ratio", 1.0),
    "totalDebt/totalEquityAnnual": ("debt_to_equity", 1.0),
    "peAnnual": ("trailing_pe", 1.0),
    "pbAnnual": ("price_to_book", 1.0),
}


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


class FinnhubEnrichmentClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _get(self, path: str, params: dict) -> dict:
        resp = httpx.get(
            f"{_BASE_URL}{path}",
            params={**params, "token": self._api_key},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()

    def _fetch_metric_supplement(self, symbol: str) -> dict[str, float]:
        """Returns mapped model-field → value for non-None Finnhub metrics."""
        try:
            data = self._get("/stock/metric", {"symbol": symbol, "metric": "all"})
            raw_metrics = data.get("metric") or {}
        except Exception as exc:
            logger.debug("Finnhub /stock/metric failed for %s: %s", symbol, exc)
            return {}

        result: dict[str, float] = {}
        for finnhub_key, (model_field, scale) in _FINNHUB_METRIC_MAP.items():
            raw = _safe_float(raw_metrics.get(finnhub_key))
            if raw is not None:
                result[model_field] = raw * scale
        return result

    def _fetch_recommendation_score(self, symbol: str) -> float | None:
        """Net bull count from most recent analyst recommendation period."""
        try:
            items = self._get("/stock/recommendation", {"symbol": symbol})
            if not items:
                return None
            item = items[0]
            return float(
                (item.get("strongBuy") or 0)
                + (item.get("buy") or 0)
                - (item.get("sell") or 0)
                - (item.get("strongSell") or 0)
            )
        except Exception as exc:
            logger.debug("Finnhub /stock/recommendation failed for %s: %s", symbol, exc)
            return None

    def _fetch_price_target(self, symbol: str) -> float | None:
        """Median analyst price target."""
        try:
            data = self._get("/stock/price-target", {"symbol": symbol})
            return _safe_float(data.get("targetMedian"))
        except Exception as exc:
            logger.debug("Finnhub /stock/price-target failed for %s: %s", symbol, exc)
            return None

    def _fetch_beat_streak(self, symbol: str) -> int | None:
        """Consecutive EPS beats from most recent quarter back."""
        try:
            items = self._get("/stock/earnings", {"symbol": symbol, "limit": 8})
            if not items:
                return None
            streak = 0
            for item in items:
                actual = _safe_float(item.get("actual"))
                estimate = _safe_float(item.get("estimate"))
                if actual is None or estimate is None:
                    break
                if actual > estimate:
                    streak += 1
                else:
                    break
            return streak
        except Exception as exc:
            logger.debug("Finnhub /stock/earnings failed for %s: %s", symbol, exc)
            return None

    def enrich(self, record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
        """Fill None fields and add analyst signals. Never raises."""
        updates: dict[str, Any] = {}

        supplement = self._fetch_metric_supplement(record.symbol)
        for field_name, value in supplement.items():
            if value is not None and getattr(record, field_name, None) is None:
                updates[field_name] = value

        score = self._fetch_recommendation_score(record.symbol)
        if score is not None:
            updates["analyst_recommendation_score"] = score

        target = self._fetch_price_target(record.symbol)
        if target is not None:
            updates["analyst_price_target"] = target

        streak = self._fetch_beat_streak(record.symbol)
        if streak is not None:
            updates["earnings_beat_streak"] = streak

        if not updates:
            return record
        return replace(record, **updates)
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
pytest tests/test_finnhub_client.py -v
```

Expected: all PASS.

- [ ] **Step 5: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/fundamentals/finnhub_client.py tests/test_finnhub_client.py
git commit -m "feat(finnhub): add FinnhubEnrichmentClient with metric supplement and analyst signals"
```

---

## Task 3: `FinnhubEnrichmentClient` analyst signal tests

**Files:**
- Modify: `tests/test_finnhub_client.py`

- [ ] **Step 1: Add tests for analyst signals**

Append to `tests/test_finnhub_client.py`:

```python
def test_fetch_recommendation_score_net_bull():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-05-01", "strongBuy": 15, "buy": 20, "hold": 7, "sell": 2, "strongSell": 0}
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        score = client._fetch_recommendation_score("AAPL")

    assert score == pytest.approx(33.0)  # 15 + 20 - 2 - 0


def test_fetch_recommendation_score_returns_none_on_empty():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = []
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        score = client._fetch_recommendation_score("AAPL")

    assert score is None


def test_fetch_recommendation_score_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("network")):
        score = client._fetch_recommendation_score("AAPL")

    assert score is None


def test_fetch_price_target_returns_median():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = {"targetHigh": 300.0, "targetLow": 180.0, "targetMedian": 235.0}
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        target = client._fetch_price_target("AAPL")

    assert target == pytest.approx(235.0)


def test_fetch_price_target_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("timeout")):
        target = client._fetch_price_target("AAPL")

    assert target is None


def test_fetch_beat_streak_counts_consecutive_beats():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-03-31", "actual": 1.65, "estimate": 1.62},
        {"period": "2025-12-31", "actual": 2.40, "estimate": 2.35},
        {"period": "2025-09-30", "actual": 1.50, "estimate": 1.55},  # miss
        {"period": "2025-06-30", "actual": 1.30, "estimate": 1.20},
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        streak = client._fetch_beat_streak("AAPL")

    assert streak == 2  # stops at the miss in Q3 2025


def test_fetch_beat_streak_zero_on_first_miss():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-03-31", "actual": 1.50, "estimate": 1.62},  # miss
        {"period": "2025-12-31", "actual": 2.40, "estimate": 2.35},
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        streak = client._fetch_beat_streak("AAPL")

    assert streak == 0


def test_fetch_beat_streak_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("network")):
        streak = client._fetch_beat_streak("AAPL")

    assert streak is None


def test_enrich_applies_all_signals():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record()

    with patch.object(client, "_fetch_metric_supplement", return_value={"gross_margin": 0.46}):
        with patch.object(client, "_fetch_recommendation_score", return_value=33.0):
            with patch.object(client, "_fetch_price_target", return_value=235.0):
                with patch.object(client, "_fetch_beat_streak", return_value=4):
                    enriched = client.enrich(record)

    assert enriched.gross_margin == pytest.approx(0.46)
    assert enriched.analyst_recommendation_score == pytest.approx(33.0)
    assert enriched.analyst_price_target == pytest.approx(235.0)
    assert enriched.earnings_beat_streak == 4


def test_enrich_one_failed_signal_does_not_block_others():
    """Price target failure must not prevent recommendation score from being applied."""
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record()

    with patch.object(client, "_fetch_metric_supplement", return_value={}):
        with patch.object(client, "_fetch_recommendation_score", return_value=33.0):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched.analyst_recommendation_score == pytest.approx(33.0)
    assert enriched.analyst_price_target is None
```

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_finnhub_client.py -v
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test_finnhub_client.py
git commit -m "test(finnhub): add comprehensive unit tests for FinnhubEnrichmentClient analyst signals"
```

---

## Task 4: Wire `FinnhubEnrichmentClient` into `FundamentalsAnalysisService`

**Files:**
- Modify: `src/swing_screener/fundamentals/service.py`
- Modify: `src/swing_screener/fundamentals/__init__.py`
- Modify: `tests/test_fundamentals_service.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_fundamentals_service.py`:

```python
def test_get_snapshot_calls_enrich_when_client_present(tmp_path):
    from unittest.mock import MagicMock
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.service import FundamentalsAnalysisService
    from swing_screener.fundamentals.storage import FundamentalsStorage

    fake_provider = _FakeQuarterlyProvider()
    mock_client = MagicMock()
    mock_client.enrich.side_effect = lambda record: record  # pass-through

    svc = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "snapshots"),
        yfinance_provider=fake_provider,
        finnhub_client=mock_client,
    )
    cfg = FundamentalsConfig(providers=("yfinance",))
    svc.get_snapshot("AAPL", cfg=cfg)

    mock_client.enrich.assert_called_once()


def test_get_snapshot_skips_enrich_when_no_client(tmp_path):
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.service import FundamentalsAnalysisService
    from swing_screener.fundamentals.storage import FundamentalsStorage

    fake_provider = _FakeQuarterlyProvider()
    svc = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "snapshots"),
        yfinance_provider=fake_provider,
        finnhub_client=None,
    )
    cfg = FundamentalsConfig(providers=("yfinance",))
    snapshot = svc.get_snapshot("AAPL", cfg=cfg)
    # No error = enrich was safely skipped
    assert snapshot.symbol == "AAPL"


def test_enriched_fields_appear_in_snapshot(tmp_path):
    from unittest.mock import MagicMock
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.models import ProviderFundamentalsRecord
    from swing_screener.fundamentals.service import FundamentalsAnalysisService
    from swing_screener.fundamentals.storage import FundamentalsStorage

    fake_provider = _FakeQuarterlyProvider()

    def _enrich(record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
        from dataclasses import replace
        return replace(record, analyst_recommendation_score=25.0, earnings_beat_streak=3)

    mock_client = MagicMock()
    mock_client.enrich.side_effect = _enrich

    svc = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "snapshots"),
        yfinance_provider=fake_provider,
        finnhub_client=mock_client,
    )
    cfg = FundamentalsConfig(providers=("yfinance",))
    snapshot = svc.get_snapshot("AAPL", cfg=cfg)

    assert snapshot.analyst_recommendation_score == 25.0
    assert snapshot.earnings_beat_streak == 3
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pytest tests/test_fundamentals_service.py -k "enrich" -v
```

Expected: FAIL — `FundamentalsAnalysisService` has no `finnhub_client` param.

- [ ] **Step 3: Update `FundamentalsAnalysisService`**

In `src/swing_screener/fundamentals/service.py`:

Replace the imports at the top to add the new import:

```python
from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import TRUST_METADATA_MISSING_FLAG, FundamentalSnapshot
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.fundamentals.providers import (
    DegiroFundamentalsProvider,
    SecEdgarFundamentalsProvider,
    YfinanceFundamentalsProvider,
)
from swing_screener.fundamentals.scoring import build_provider_error_snapshot, build_snapshot
from swing_screener.fundamentals.storage import FundamentalsStorage
```

Replace the `__init__` signature:

```python
    def __init__(
        self,
        *,
        storage: FundamentalsStorage | None = None,
        sec_edgar_provider: SecEdgarFundamentalsProvider | None = None,
        yfinance_provider: YfinanceFundamentalsProvider | None = None,
        degiro_provider: DegiroFundamentalsProvider | None = None,
        finnhub_client: FinnhubEnrichmentClient | None = None,
    ) -> None:
        self._storage = storage or FundamentalsStorage()
        self._sec_edgar_provider = sec_edgar_provider or SecEdgarFundamentalsProvider()
        self._yfinance_provider = yfinance_provider or YfinanceFundamentalsProvider()
        self._degiro_provider = degiro_provider or DegiroFundamentalsProvider()
        self._finnhub_client = finnhub_client
```

In `get_snapshot`, replace the provider fetch block:

```python
        for provider in providers:
            last_provider_name = provider.name
            try:
                record = provider.fetch_record(normalized_symbol)
                if self._finnhub_client is not None:
                    record = self._finnhub_client.enrich(record)
                snapshot = build_snapshot(record, cfg)
                break
            except Exception as exc:
                last_error = exc
                continue
```

- [ ] **Step 4: Export `FinnhubEnrichmentClient` from package**

In `src/swing_screener/fundamentals/__init__.py`, add import and `__all__` entry:

```python
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
```

And add `"FinnhubEnrichmentClient"` to `__all__`.

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_fundamentals_service.py -v
```

Expected: all PASS.

- [ ] **Step 6: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/fundamentals/service.py src/swing_screener/fundamentals/__init__.py tests/test_fundamentals_service.py
git commit -m "feat(finnhub): wire FinnhubEnrichmentClient into FundamentalsAnalysisService"
```

---

## Task 5: Wire Finnhub client into API dependencies

**Files:**
- Modify: `api/dependencies.py`

- [ ] **Step 1: Update `get_fundamentals_service` to inject Finnhub client**

In `api/dependencies.py`, add at the top (after existing imports):

```python
import os
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.fundamentals import FundamentalsAnalysisService

_finnhub_api_key: str | None = os.environ.get("FINNHUB_API_KEY")
_finnhub_client: FinnhubEnrichmentClient | None = (
    FinnhubEnrichmentClient(_finnhub_api_key) if _finnhub_api_key else None
)
```

Replace `get_fundamentals_service`:

```python
def get_fundamentals_service(
    config_repo: FundamentalsConfigRepository = Depends(get_fundamentals_config_repo),
    watchlist_repo: WatchlistRepository = Depends(get_watchlist_repo),
) -> FundamentalsService:
    return FundamentalsService(
        config_repo=config_repo,
        watchlist_repo=watchlist_repo,
        analysis_service=FundamentalsAnalysisService(finnhub_client=_finnhub_client),
    )
```

- [ ] **Step 2: Smoke-test the API starts cleanly**

```bash
python -c "from api.dependencies import get_fundamentals_service; print('OK')"
```

Expected: `OK` — no import errors.

- [ ] **Step 3: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add api/dependencies.py
git commit -m "feat(finnhub): inject FinnhubEnrichmentClient into fundamentals service via dependencies"
```

---

## Task 6: Calendar model — new fields and event types

**Files:**
- Modify: `api/models/calendar.py`
- Modify: `tests/test_calendar_service.py`

- [ ] **Step 1: Write failing test**

Append to `tests/test_calendar_service.py`:

```python
def test_calendar_event_accepts_ipo_event_type(tmp_path):
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-06-05",
        ticker="ACME",
        event_type="ipo",
        title="ACME IPO",
        source_tag="ipo",
    )
    assert event.event_type == "ipo"
    assert event.source_tag == "ipo"


def test_calendar_event_accepts_dividend_event_type(tmp_path):
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-06-01",
        ticker="AAPL",
        event_type="dividend",
        title="AAPL Dividend",
        source_tag="position",
    )
    assert event.event_type == "dividend"


def test_calendar_event_accepts_eps_estimate():
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-07-31",
        ticker="AAPL",
        event_type="earnings",
        title="AAPL Earnings",
        source_tag="position",
        eps_estimate=1.72,
        eps_actual=None,
    )
    assert event.eps_estimate == 1.72
    assert event.eps_actual is None


def test_calendar_event_eps_fields_default_to_none():
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-07-31",
        ticker="AAPL",
        event_type="earnings",
        title="AAPL Earnings",
        source_tag="position",
    )
    assert event.eps_estimate is None
    assert event.eps_actual is None
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pytest tests/test_calendar_service.py -k "ipo_event_type or dividend_event_type or eps_estimate or eps_fields" -v
```

Expected: FAIL — `CalendarEvent` literal does not include `"ipo"`, `"dividend"`, or `eps_estimate`.

- [ ] **Step 3: Update `CalendarEvent` model**

Replace `src/api/models/calendar.py` entirely:

```python
# api/models/calendar.py
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


class CalendarEvent(BaseModel):
    date: str  # YYYY-MM-DD
    ticker: Optional[str] = None
    event_type: Literal["earnings", "economic", "ipo", "dividend"]
    title: str
    source_tag: Literal["position", "screener", "economic", "ipo"]
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]
    days_ahead: int
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_calendar_service.py -v
```

Expected: all PASS including pre-existing tests.

- [ ] **Step 5: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/models/calendar.py tests/test_calendar_service.py
git commit -m "feat(finnhub): extend CalendarEvent with eps_estimate, eps_actual, ipo/dividend event types"
```

---

## Task 7: Calendar service — switch earnings to Finnhub

**Files:**
- Modify: `api/services/calendar_service.py`
- Modify: `tests/test_calendar_service.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_calendar_service.py`:

```python
def test_earnings_from_finnhub_includes_eps_estimate(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(
        positions_repo=repo,
        data_dir=tmp_path,
        finnhub_api_key="test_key",
    )

    fake_date = dt.date.today() + dt.timedelta(days=10)

    resp = MagicMock()
    resp.json.return_value = {
        "earningsCalendar": [
            {
                "symbol": "AAPL",
                "date": fake_date.isoformat(),
                "epsEstimate": 1.72,
                "epsActual": None,
                "dateConfirmed": True,
            }
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30)

    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].eps_estimate == pytest.approx(1.72)
    assert earnings[0].ticker == "AAPL"


def test_earnings_falls_back_to_yfinance_when_no_finnhub_key(tmp_path):
    import datetime as dt
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    fake_date = dt.date.today() + dt.timedelta(days=10)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date) as mock_yf:
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            events = svc.get_events(days_ahead=30)

    mock_yf.assert_called()
    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1


def test_earnings_finnhub_failure_falls_back_to_yfinance(tmp_path):
    import datetime as dt
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(
        positions_repo=repo,
        data_dir=tmp_path,
        finnhub_api_key="test_key",
    )

    fake_date = dt.date.today() + dt.timedelta(days=10)
    with patch("api.services.calendar_service.httpx.get", side_effect=Exception("network")):
        with patch.object(svc, "_fetch_earnings_for", return_value=fake_date) as mock_yf:
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                events = svc.get_events(days_ahead=30)

    mock_yf.assert_called()
```

Add `import pytest` at the top of the test file if not already present.

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pytest tests/test_calendar_service.py -k "finnhub" -v
```

Expected: FAIL — `_fetch_ipo_events`, `_fetch_dividend_events` not found, Finnhub earnings path not implemented.

- [ ] **Step 3: Update `CalendarService`**

Replace `api/services/calendar_service.py`:

```python
# api/services/calendar_service.py
from __future__ import annotations

import datetime as dt
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

import httpx

from api.models.calendar import CalendarEvent
from api.repositories.positions_repo import PositionsRepository

logger = logging.getLogger(__name__)


class CalendarService:
    def __init__(
        self,
        positions_repo: PositionsRepository,
        data_dir: Path,
        finnhub_api_key: Optional[str] = None,
    ):
        self._positions_repo = positions_repo
        self._data_dir = data_dir
        self._finnhub_api_key = finnhub_api_key

    def get_events(self, days_ahead: int = 30) -> list[CalendarEvent]:
        today = dt.date.today()
        end = today + dt.timedelta(days=days_ahead)

        position_tickers = self._get_position_tickers()
        screener_tickers = self._get_screener_tickers()
        all_tickers = position_tickers | screener_tickers

        events: list[CalendarEvent] = []
        events.extend(self._batch_fetch_earnings(all_tickers, position_tickers, today, end))
        events.extend(self._fetch_economic_events(today, end))
        events.extend(self._fetch_ipo_events(today, end))
        events.extend(self._fetch_dividend_events(position_tickers, today, end))

        return sorted(events, key=lambda e: e.date)

    def _get_position_tickers(self) -> set[str]:
        positions, _ = self._positions_repo.list_positions(status="open")
        return {p["ticker"] for p in positions if p.get("ticker")}

    def _get_screener_tickers(self) -> set[str]:
        reviews_dir = self._data_dir / "daily_reviews"
        if not reviews_dir.exists():
            return set()
        files = sorted(reviews_dir.glob("daily_review_*_default.json"))
        if not files:
            return set()
        latest = files[-1]
        try:
            data = json.loads(latest.read_text())
            candidates = data.get("new_candidates", []) + data.get("positions_add_on_candidates", [])
            return {c["ticker"] for c in candidates if c.get("ticker")}
        except Exception as exc:
            logger.debug("Could not read latest daily review: %s", exc)
            return set()

    def _batch_fetch_earnings(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        if self._finnhub_api_key:
            return self._batch_fetch_earnings_finnhub(all_tickers, position_tickers, start, end)
        return self._batch_fetch_earnings_yfinance(all_tickers, position_tickers, start, end)

    def _batch_fetch_earnings_finnhub(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        events: list[CalendarEvent] = []
        try:
            with ThreadPoolExecutor(max_workers=12) as pool:
                futures = {
                    pool.submit(self._fetch_earnings_for_finnhub, t, start, end): t
                    for t in all_tickers
                }
                for future in as_completed(futures):
                    ticker = futures[future]
                    try:
                        result = future.result()
                        if result is None:
                            continue
                        earnings_date, eps_estimate, eps_actual = result
                        source_tag = "position" if ticker in position_tickers else "screener"
                        events.append(CalendarEvent(
                            date=earnings_date.isoformat(),
                            ticker=ticker,
                            event_type="earnings",
                            title=f"{ticker} Earnings",
                            source_tag=source_tag,
                            eps_estimate=eps_estimate,
                            eps_actual=eps_actual,
                        ))
                    except Exception as exc:
                        logger.debug("Finnhub earnings failed for %s: %s", ticker, exc)
        except Exception as exc:
            logger.info("Finnhub earnings batch failed, falling back to yfinance: %s", exc)
            return self._batch_fetch_earnings_yfinance(all_tickers, position_tickers, start, end)
        return events

    def _fetch_earnings_for_finnhub(
        self,
        ticker: str,
        start: dt.date,
        end: dt.date,
    ) -> Optional[tuple[dt.date, Optional[float], Optional[float]]]:
        resp = httpx.get(
            "https://finnhub.io/api/v1/calendar/earnings",
            params={
                "symbol": ticker,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "token": self._finnhub_api_key,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        items = resp.json().get("earningsCalendar", [])
        today = dt.date.today()
        upcoming = [
            item for item in items
            if item.get("date") and _parse_date(item["date"]) is not None
            and _parse_date(item["date"]) >= today
        ]
        if not upcoming:
            return None
        item = upcoming[0]
        earnings_date = _parse_date(item["date"])
        eps_estimate = _safe_float(item.get("epsEstimate"))
        eps_actual = _safe_float(item.get("epsActual"))
        return earnings_date, eps_estimate, eps_actual

    def _batch_fetch_earnings_yfinance(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        events: list[CalendarEvent] = []
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(self._fetch_earnings_for, t): t for t in all_tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    earnings_date = future.result()
                    if earnings_date and start <= earnings_date <= end:
                        source_tag = "position" if ticker in position_tickers else "screener"
                        events.append(CalendarEvent(
                            date=earnings_date.isoformat(),
                            ticker=ticker,
                            event_type="earnings",
                            title=f"{ticker} Earnings",
                            source_tag=source_tag,
                        ))
                except Exception as exc:
                    logger.debug("Earnings fetch failed for %s: %s", ticker, exc)
        return events

    def _fetch_earnings_for(self, ticker: str) -> Optional[dt.date]:
        import yfinance

        today = dt.date.today()
        calendar = yfinance.Ticker(ticker).calendar or {}
        earnings_dates = calendar.get("Earnings Date", [])
        if not isinstance(earnings_dates, list):
            earnings_dates = [earnings_dates]
        upcoming = sorted(
            parsed
            for raw in earnings_dates
            if (parsed := _parse_date(raw)) is not None and parsed >= today
        )
        return upcoming[0] if upcoming else None

    def _fetch_economic_events(self, start: dt.date, end: dt.date) -> list[CalendarEvent]:
        if not self._finnhub_api_key:
            return []
        try:
            resp = httpx.get(
                "https://finnhub.io/api/v1/calendar/economic",
                params={
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "token": self._finnhub_api_key,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            items = resp.json().get("economicCalendar", [])
            return [
                CalendarEvent(
                    date=item["time"][:10],
                    ticker=None,
                    event_type="economic",
                    title=item.get("event", "Economic event"),
                    source_tag="economic",
                )
                for item in items
                if item.get("time") and item.get("impact") == "high"
            ]
        except Exception as exc:
            logger.info("Economic events fetch skipped: %s", exc)
            return []

    def _fetch_ipo_events(self, start: dt.date, end: dt.date) -> list[CalendarEvent]:
        if not self._finnhub_api_key:
            return []
        try:
            resp = httpx.get(
                "https://finnhub.io/api/v1/calendar/ipo",
                params={
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "token": self._finnhub_api_key,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            items = resp.json().get("ipoCalendar", [])
            return [
                CalendarEvent(
                    date=item["date"],
                    ticker=item.get("symbol"),
                    event_type="ipo",
                    title=f"{item.get('name', item.get('symbol', 'IPO'))} IPO",
                    source_tag="ipo",
                )
                for item in items
                if item.get("date") and item.get("status") in {"priced", "filed"}
            ]
        except Exception as exc:
            logger.info("IPO calendar fetch skipped: %s", exc)
            return []

    def _fetch_dividend_events(
        self,
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        if not self._finnhub_api_key or not position_tickers:
            return []
        events: list[CalendarEvent] = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {
                pool.submit(self._fetch_dividends_for, t, start, end): t
                for t in position_tickers
            }
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    events.extend(future.result())
                except Exception as exc:
                    logger.debug("Dividend fetch failed for %s: %s", ticker, exc)
        return events

    def _fetch_dividends_for(
        self,
        ticker: str,
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        resp = httpx.get(
            "https://finnhub.io/api/v1/calendar/dividend",
            params={
                "symbol": ticker,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "token": self._finnhub_api_key,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        items = resp.json().get("dividendCalendar", [])
        return [
            CalendarEvent(
                date=item["date"],
                ticker=ticker,
                event_type="dividend",
                title=f"{ticker} Dividend",
                source_tag="position",
            )
            for item in items
            if item.get("date")
        ]


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_date(raw: object) -> Optional[dt.date]:
    try:
        import pandas as pd

        if isinstance(raw, pd.Timestamp):
            return raw.date()
        if isinstance(raw, dt.date):
            return raw
        return dt.date.fromisoformat(str(raw)[:10])
    except Exception:
        return None
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_calendar_service.py -v
```

Expected: all PASS.

- [ ] **Step 5: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/services/calendar_service.py tests/test_calendar_service.py
git commit -m "feat(finnhub): switch earnings calendar to Finnhub with EPS estimates, keep yfinance fallback"
```

---

## Task 8: Calendar service — IPO and dividend event tests

**Files:**
- Modify: `tests/test_calendar_service.py`

- [ ] **Step 1: Add IPO and dividend tests**

Append to `tests/test_calendar_service.py`:

```python
def test_ipo_events_returned_when_finnhub_key_set(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    ipo_date = (dt.date.today() + dt.timedelta(days=5)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "ipoCalendar": [
            {"date": ipo_date, "symbol": "ACME", "name": "Acme Corp", "status": "priced"}
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30)

    ipos = [e for e in events if e.event_type == "ipo"]
    assert len(ipos) == 1
    assert ipos[0].ticker == "ACME"
    assert ipos[0].source_tag == "ipo"


def test_ipo_events_skipped_when_no_finnhub_key(tmp_path):
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                events = svc.get_events(days_ahead=30)

    assert not any(e.event_type == "ipo" for e in events)


def test_ipo_speculative_status_excluded(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    ipo_date = (dt.date.today() + dt.timedelta(days=5)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "ipoCalendar": [
            {"date": ipo_date, "symbol": "SPEC", "name": "Speculative Co", "status": "expected"}
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30)

    assert not any(e.event_type == "ipo" for e in events)


def test_dividend_events_only_for_position_tickers(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    div_date = (dt.date.today() + dt.timedelta(days=7)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "dividendCalendar": [{"date": div_date, "amount": 0.25}]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                    events = svc.get_events(days_ahead=30)

    divs = [e for e in events if e.event_type == "dividend"]
    assert len(divs) == 1
    assert divs[0].ticker == "AAPL"
    assert divs[0].source_tag == "position"


def test_dividend_events_skipped_when_no_finnhub_key(tmp_path):
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                events = svc.get_events(days_ahead=30)

    assert not any(e.event_type == "dividend" for e in events)
```

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_calendar_service.py -v
```

Expected: all PASS.

- [ ] **Step 3: Run full suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test_calendar_service.py
git commit -m "test(finnhub): add IPO and dividend calendar unit tests"
```

---

## Task 9: Integration tests (optional, requires live key)

**Files:**
- Create: `tests/test_finnhub_integration.py`

- [ ] **Step 1: Create integration test file**

Create `tests/test_finnhub_integration.py`:

```python
"""Live Finnhub integration tests. Require FINNHUB_API_KEY env var. Skipped in CI."""
from __future__ import annotations

import os
import pytest

pytestmark = pytest.mark.integration

AAPL = "AAPL"


@pytest.fixture(scope="module")
def client():
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        pytest.skip("FINNHUB_API_KEY not set")
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    return FinnhubEnrichmentClient(api_key=key)


def test_metric_supplement_gross_margin_in_expected_range(client):
    result = client._fetch_metric_supplement(AAPL)
    gm = result.get("gross_margin")
    assert gm is not None, "gross_margin should be populated for AAPL"
    assert 0.35 <= gm <= 0.60, f"AAPL gross margin should be ~46%, got {gm}"


def test_metric_supplement_scale_factors_yield_decimals(client):
    """All margin/ROE fields must be in [0, 1] range after scale conversion."""
    result = client._fetch_metric_supplement(AAPL)
    for field in ("gross_margin", "net_margin", "operating_margin", "return_on_equity"):
        value = result.get(field)
        if value is not None:
            assert 0 < value < 2, f"{field}={value} looks like it wasn't divided by 100"


def test_recommendation_score_is_numeric(client):
    score = client._fetch_recommendation_score(AAPL)
    assert score is not None
    assert isinstance(score, float)


def test_price_target_is_positive(client):
    target = client._fetch_price_target(AAPL)
    assert target is not None
    assert target > 0


def test_beat_streak_is_non_negative_int(client):
    streak = client._fetch_beat_streak(AAPL)
    assert streak is not None
    assert isinstance(streak, int)
    assert streak >= 0
```

- [ ] **Step 2: Run integration tests (requires key)**

```bash
pytest tests/test_finnhub_integration.py -v -m integration
```

Expected: all PASS. If `gross_margin` scale assertion fails, the `_FINNHUB_METRIC_MAP` scale factors need adjustment in `finnhub_client.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/test_finnhub_integration.py
git commit -m "test(finnhub): add live integration tests for FinnhubEnrichmentClient"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `FinnhubEnrichmentClient` (not a provider) | Task 2 |
| 4 new model fields | Task 1 |
| `_fetch_metric_supplement` fills None fields | Task 2 |
| `_fetch_recommendation_score` | Task 2–3 |
| `_fetch_price_target` | Task 2–3 |
| `_fetch_beat_streak` | Task 2–3 |
| `enrich()` merges via `dataclasses.replace` | Task 2 |
| Per-method failure doesn't block siblings | Task 3 |
| `FundamentalsAnalysisService.finnhub_client` param | Task 4 |
| `enrich()` called after primary provider, before `build_snapshot` | Task 4 |
| Enrichment skipped when key absent | Task 5 |
| `api/dependencies.py` injects client | Task 5 |
| `CalendarEvent` `eps_estimate` + `eps_actual` | Task 6 |
| `event_type` gains `"ipo"` and `"dividend"` | Task 6 |
| Earnings → Finnhub `/calendar/earnings` (with EPS) | Task 7 |
| yfinance fallback when key absent | Task 7 |
| IPO events from `/calendar/ipo`, status filter | Task 8 |
| Dividend events from `/calendar/dividend`, position tickers only | Task 8 |
| Integration tests with scale validation | Task 9 |

All requirements covered.
