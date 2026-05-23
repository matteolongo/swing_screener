# Intelligence Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `SymbolAnalyzer` to return upcoming events, catalyst urgency, and position signals; add a per-symbol daily cache; add GET /latest and POST /sweep API endpoints; wire the Intelligence tab to auto-load cached results; add a sweep button to the Today page.

**Architecture:** Backend — extend existing `models.py`, add `cache.py`, extend `symbol_analyzer.py` prompt, extend `intelligence.py` router. Frontend — extend types/api/hooks, update `IntelligenceCard`, update `SymbolAnalysisContent` tab, add sweep button to `Today.tsx`. Cache is `data/intelligence/sweep_YYYY-MM-DD.json` keyed by ticker, consistent with existing date-partitioned intelligence files.

**Tech Stack:** Python/FastAPI, Pydantic v2, OpenAI Responses API, React 18, React Query, Vitest/MSW.

---

## File Map

**Create:**
- `src/swing_screener/intelligence/cache.py`
- `tests/intelligence/test_cache.py`
- `tests/api/test_intelligence_api.py`

**Modify:**
- `src/swing_screener/intelligence/models.py`
- `src/swing_screener/intelligence/symbol_analyzer.py`
- `api/routers/intelligence.py`
- `tests/intelligence/test_symbol_analyzer.py`
- `web-ui/src/features/intelligence/types.ts`
- `web-ui/src/features/intelligence/api.ts`
- `web-ui/src/features/intelligence/hooks.ts`
- `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`
- `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- `web-ui/src/lib/api.ts`
- `web-ui/src/i18n/messages.en.ts`
- `web-ui/src/pages/Today.tsx`

---

### Task 1: Extend backend models

**Files:**
- Modify: `src/swing_screener/intelligence/models.py`
- Test: `tests/intelligence/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/intelligence/test_models.py  (add to existing file)
from swing_screener.intelligence.models import (
    IntelligenceEvent, IntelligenceEventDirection, IntelligenceEventType,
    PositionSignal, PositionSignalAction, SymbolIntelligence, SymbolIntelligenceRequest,
)

def test_request_accepts_position_context():
    req = SymbolIntelligenceRequest(
        close=50.0, signal="breakout",
        entry_price=48.0, r_now=1.5, days_open=7,
    )
    assert req.entry_price == 48.0
    assert req.r_now == 1.5
    assert req.days_open == 7

def test_request_position_context_optional():
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    assert req.entry_price is None
    assert req.r_now is None
    assert req.days_open is None

def test_symbol_intelligence_has_new_fields():
    intel = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW", conviction="high",
        catalyst_urgency="high",
        summary_line="Strong breakout.",
        narrative="## Why\nText.",
        upcoming_events=[
            IntelligenceEvent(
                type=IntelligenceEventType.earnings,
                date="2026-05-28",
                direction=IntelligenceEventDirection.bullish,
                summary="Q2 earnings expected to beat consensus.",
            )
        ],
        position_signal=PositionSignal(action=PositionSignalAction.HOLD, reason="Thesis intact."),
        sources=[],
    )
    assert intel.catalyst_urgency == "high"
    assert len(intel.upcoming_events) == 1
    assert intel.upcoming_events[0].type == "earnings"
    assert intel.position_signal is not None
    assert intel.position_signal.action == "HOLD"

def test_symbol_intelligence_defaults():
    intel = SymbolIntelligence(
        symbol="X", generated_at="2026-05-24T10:00:00Z",
        action="WATCH", conviction="low",
        catalyst_urgency="none",
        summary_line="Flat.", narrative="Text.", sources=[],
    )
    assert intel.upcoming_events == []
    assert intel.position_signal is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/intelligence/test_models.py -q
```
Expected: FAIL — `IntelligenceEvent`, `PositionSignal`, etc. not yet defined.

- [ ] **Step 3: Replace `src/swing_screener/intelligence/models.py`**

```python
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel

from swing_screener.recommendation.models import DecisionAction, DecisionConviction


class IntelligenceEventType(str, Enum):
    earnings = "earnings"
    macro = "macro"
    dividend = "dividend"
    product_launch = "product_launch"
    regulatory = "regulatory"
    other = "other"


class IntelligenceEventDirection(str, Enum):
    bullish = "bullish"
    bearish = "bearish"
    neutral = "neutral"


class IntelligenceEvent(BaseModel):
    type: IntelligenceEventType
    date: str | None = None
    direction: IntelligenceEventDirection
    summary: str


class PositionSignalAction(str, Enum):
    HOLD = "HOLD"
    TRIM = "TRIM"
    EXIT = "EXIT"


class PositionSignal(BaseModel):
    action: PositionSignalAction
    reason: str


class SymbolIntelligenceRequest(BaseModel):
    close: float
    signal: str
    entry: float | None = None
    stop: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    momentum_6m: float | None = None
    momentum_12m: float | None = None
    sector: str | None = None
    currency: str = "USD"
    entry_price: float | None = None
    r_now: float | None = None
    days_open: int | None = None


class SymbolIntelligence(BaseModel):
    symbol: str
    generated_at: str
    action: DecisionAction
    conviction: DecisionConviction
    catalyst_urgency: Literal["high", "medium", "low", "none"] = "none"
    summary_line: str
    narrative: str
    upcoming_events: list[IntelligenceEvent] = []
    position_signal: PositionSignal | None = None
    sources: list[str] = []
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/intelligence/test_models.py -q
```
Expected: all PASS.

- [ ] **Step 5: Also verify existing symbol analyzer tests still pass**

```bash
pytest tests/intelligence/ -q
```
Expected: all PASS (the `test_symbol_analyzer.py` tests use the old fake JSON — they will fail validation because the fake JSON is missing `catalyst_urgency`; fix by adding `"catalyst_urgency": "none", "upcoming_events": []` to `_FAKE_RESPONSE_JSON` in `tests/intelligence/test_symbol_analyzer.py`).

Updated `_FAKE_RESPONSE_JSON` in `tests/intelligence/test_symbol_analyzer.py`:
```python
_FAKE_RESPONSE_JSON = {
    "action": "BUY_NOW",
    "conviction": "high",
    "catalyst_urgency": "medium",
    "summary_line": "Cyclical recovery with strong EBITDA momentum.",
    "narrative": "## Why it's moving\nAperam Q1 2026 beat on EBITDA.",
    "upcoming_events": [],
    "position_signal": None,
    "sources": ["https://aperam.com/q1-2026"],
}
```

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/intelligence/models.py tests/intelligence/test_models.py tests/intelligence/test_symbol_analyzer.py
git commit -m "feat(intelligence): extend models with events, catalyst_urgency, position_signal"
```

---

### Task 2: Add cache module

**Files:**
- Create: `src/swing_screener/intelligence/cache.py`
- Create: `tests/intelligence/test_cache.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/intelligence/test_cache.py
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from swing_screener.intelligence.cache import read_from_cache, write_to_cache
from swing_screener.intelligence.models import SymbolIntelligence


def _make_intel(symbol: str = "AAPL") -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol=symbol,
        generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW",
        conviction="high",
        catalyst_urgency="medium",
        summary_line="Strong setup.",
        narrative="## Why\nText.",
        upcoming_events=[],
        position_signal=None,
        sources=[],
    )


def test_write_and_read_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    intel = _make_intel("AAPL")
    write_to_cache("AAPL", intel, for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None
    assert result.symbol == "AAPL"
    assert result.action == "BUY_NOW"
    assert result.catalyst_urgency == "medium"


def test_read_returns_none_for_missing_ticker(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel("AAPL"), for_date=d)
    result = read_from_cache("MSFT", for_date=d)
    assert result is None


def test_read_returns_none_for_different_date(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    write_to_cache("AAPL", _make_intel(), for_date=date(2026, 5, 23))
    result = read_from_cache("AAPL", for_date=date(2026, 5, 24))
    assert result is None


def test_write_is_case_insensitive(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("aapl", _make_intel("AAPL"), for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None


def test_write_updates_existing_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel(), for_date=d)
    updated = _make_intel()
    updated = updated.model_copy(update={"summary_line": "Updated summary."})
    write_to_cache("AAPL", updated, for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None
    assert result.summary_line == "Updated summary."


def test_multiple_tickers_in_same_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel("AAPL"), for_date=d)
    write_to_cache("MSFT", _make_intel("MSFT"), for_date=d)
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    data = json.loads(cache_file.read_text())
    assert "AAPL" in data
    assert "MSFT" in data
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/intelligence/test_cache.py -q
```
Expected: FAIL — `cache` module not found.

- [ ] **Step 3: Create `src/swing_screener/intelligence/cache.py`**

```python
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path

from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.settings.paths import data_dir


def _cache_path(for_date: date) -> Path:
    return data_dir() / "intelligence" / f"sweep_{for_date.isoformat()}.json"


def write_to_cache(ticker: str, result: SymbolIntelligence, for_date: date | None = None) -> None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            existing = {}
    existing[ticker.upper()] = json.loads(result.model_dump_json())
    path.write_text(json.dumps(existing, indent=2))


def read_from_cache(ticker: str, for_date: date | None = None) -> SymbolIntelligence | None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        entry = data.get(ticker.upper())
        if entry is None:
            return None
        return SymbolIntelligence.model_validate(entry)
    except (json.JSONDecodeError, OSError, ValueError):
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/intelligence/test_cache.py -q
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/cache.py tests/intelligence/test_cache.py
git commit -m "feat(intelligence): add per-symbol daily cache module"
```

---

### Task 3: Extend prompt and write to cache

**Files:**
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py`
- Modify: `tests/intelligence/test_symbol_analyzer.py`

- [ ] **Step 1: Write the failing tests (add to `tests/intelligence/test_symbol_analyzer.py`)**

```python
# Add these tests to the bottom of tests/intelligence/test_symbol_analyzer.py

from swing_screener.intelligence.symbol_analyzer import _build_user_prompt


def test_prompt_omits_position_section_without_context():
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req)
    assert "Position context" not in prompt
    assert "position_signal" not in prompt


def test_prompt_includes_position_section_with_context():
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    req = SymbolIntelligenceRequest(
        close=50.0, signal="breakout",
        entry_price=48.0, r_now=1.5, days_open=7,
    )
    prompt = _build_user_prompt("AAPL", req)
    assert "Position context" in prompt
    assert "48.00" in prompt
    assert "1.50" in prompt
    assert "7 days" in prompt
    assert "position_signal" in prompt


def test_analyze_writes_to_cache(tmp_path, monkeypatch):
    import json
    from unittest.mock import MagicMock, patch
    from swing_screener.intelligence.models import SymbolIntelligenceRequest

    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))

    fake_json = {
        "action": "BUY_NOW", "conviction": "high",
        "catalyst_urgency": "medium",
        "summary_line": "Strong setup.",
        "narrative": "## Why\nText.",
        "upcoming_events": [],
        "position_signal": None,
        "sources": [],
    }
    fake_text = "```json\n" + json.dumps(fake_json) + "\n```"
    resp = MagicMock()
    resp.output_text = fake_text

    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = resp
        analyzer = SymbolAnalyzer()
        analyzer.analyze("AAPL", req)

    cache_files = list((tmp_path / "intelligence").glob("sweep_*.json"))
    assert len(cache_files) == 1
    data = json.loads(cache_files[0].read_text())
    assert "AAPL" in data
    assert data["AAPL"]["action"] == "BUY_NOW"
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/intelligence/test_symbol_analyzer.py -q
```
Expected: FAIL — `_build_user_prompt` not exported / no position section / no cache write.

- [ ] **Step 3: Replace `src/swing_screener/intelligence/symbol_analyzer.py`**

```python
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.cache import write_to_cache
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.settings import get_settings_manager

_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- catalyst_urgency: one of high | medium | low | none
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: full Markdown string with sections ## Why it's moving, ## Key risks, ## Synthetic read
- upcoming_events: array of objects {type, date, direction, summary} for events that could move the price.
  type: earnings | macro | dividend | product_launch | regulatory | other
  date: ISO date string or null if unknown
  direction: bullish | bearish | neutral
  summary: one sentence description
- position_signal: null unless position context is provided — then {action: HOLD | TRIM | EXIT, reason: one sentence}
  HOLD = thesis intact, no change needed
  TRIM = take partial profit or reduce risk, thesis weakening
  EXIT = thesis broken or clearly better use of capital
- sources: list of URLs you cited (may be empty)

Do not include any text outside the JSON block.\
"""


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in LLM response: {text[:300]}")


def _build_user_prompt(ticker: str, req: SymbolIntelligenceRequest) -> str:
    def fmt(v: float | None) -> str:
        return f"{v:.2f}" if v is not None else "N/A"

    lines = [
        f"Symbol: {ticker}",
        f"Signal: {req.signal}",
        f"Close: {fmt(req.close)} {req.currency}",
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}",
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%",
        f"Entry: {fmt(req.entry)} | Stop: {fmt(req.stop)}",
        f"Sector: {req.sector or 'Unknown'}",
    ]

    if req.entry_price is not None and req.r_now is not None and req.days_open is not None:
        lines.append(
            f"Position context: entry={fmt(req.entry_price)}, "
            f"current R={req.r_now:.2f}R, held {req.days_open} days"
        )
        lines.append(
            "Include position_signal (HOLD / TRIM / EXIT) with a one-sentence reason."
        )
    else:
        lines.append("No open position — set position_signal to null.")

    lines.append(
        f"\nSearch for recent news, earnings results, catalysts, and analyst views for {ticker}. "
        "Then produce the structured JSON analysis."
    )
    return "\n".join(lines)


class SymbolAnalyzer:
    def __init__(self) -> None:
        doc = get_settings_manager().load_intelligence_document()
        llm_cfg = doc.get("config", {}).get("llm", {})
        self._model = llm_cfg.get("web_search_model", "gpt-4o")
        self._max_tokens = int(llm_cfg.get("web_search_max_tokens", 2000))
        self._client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def analyze(self, ticker: str, req: SymbolIntelligenceRequest) -> SymbolIntelligence:
        user_prompt = _build_user_prompt(ticker, req)
        response = self._client.responses.create(
            model=self._model,
            tools=[{"type": "web_search_preview"}],
            instructions=_SYSTEM_PROMPT,
            input=user_prompt,
            max_output_tokens=self._max_tokens,
        )
        raw = _extract_json(response.output_text)
        result = SymbolIntelligence(
            symbol=ticker,
            generated_at=datetime.now(timezone.utc).isoformat(),
            action=raw["action"],
            conviction=raw["conviction"],
            catalyst_urgency=raw.get("catalyst_urgency", "none"),
            summary_line=raw["summary_line"],
            narrative=raw["narrative"],
            upcoming_events=raw.get("upcoming_events", []),
            position_signal=raw.get("position_signal"),
            sources=raw.get("sources", []),
        )
        try:
            write_to_cache(ticker, result)
        except Exception:
            pass
        return result
```

- [ ] **Step 4: Run all intelligence tests**

```bash
pytest tests/intelligence/ -q
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/symbol_analyzer.py tests/intelligence/test_symbol_analyzer.py
git commit -m "feat(intelligence): extend prompt with events/urgency/position signal, write to cache"
```

---

### Task 4: Extend API router (GET /latest, POST /sweep)

**Files:**
- Modify: `api/routers/intelligence.py`
- Create: `tests/api/test_intelligence_api.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/api/test_intelligence_api.py
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

_INTEL_PAYLOAD = {
    "action": "BUY_NOW", "conviction": "high",
    "catalyst_urgency": "medium",
    "summary_line": "Strong setup.",
    "narrative": "## Why\nText.",
    "upcoming_events": [],
    "position_signal": None,
    "sources": [],
}


def _write_cache(tmp_path: Path, ticker: str, for_date: date) -> None:
    cache_dir = tmp_path / "intelligence"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"sweep_{for_date.isoformat()}.json"
    data = {ticker.upper(): {**_INTEL_PAYLOAD, "symbol": ticker.upper(), "generated_at": "2026-05-24T10:00:00Z"}}
    cache_file.write_text(json.dumps(data))


def test_latest_returns_404_when_no_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    (tmp_path / "intelligence").mkdir(parents=True, exist_ok=True)
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 404


def test_latest_returns_cached_entry(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    today = datetime.now(timezone.utc).date()
    _write_cache(tmp_path, "AAPL", today)
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["action"] == "BUY_NOW"


def test_sweep_returns_analyzed_and_failed(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    from swing_screener.intelligence.models import SymbolIntelligence
    ok_result = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW", conviction="high", catalyst_urgency="none",
        summary_line="OK", narrative="Text.", sources=[],
    )

    def fake_analyze(ticker, req):
        if ticker == "FAIL":
            raise RuntimeError("API error")
        return ok_result

    with patch("api.routers.intelligence.SymbolAnalyzer") as MockAnalyzer:
        instance = MagicMock()
        instance.analyze.side_effect = fake_analyze
        MockAnalyzer.return_value = instance

        payload = {
            "symbols": [
                {"ticker": "AAPL", "request": {"close": 180.0, "signal": "breakout"}},
                {"ticker": "FAIL", "request": {"close": 10.0, "signal": "pullback"}},
            ]
        }
        response = client.post("/api/intelligence/sweep", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "AAPL" in data["analyzed"]
    assert any(f["ticker"] == "FAIL" for f in data["failed"])


def test_sweep_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    payload = {"symbols": [{"ticker": "AAPL", "request": {"close": 100.0, "signal": "breakout"}}]}
    response = client.post("/api/intelligence/sweep", json=payload)
    assert response.status_code == 503
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/api/test_intelligence_api.py -q
```
Expected: FAIL — `/latest` and `/sweep` endpoints don't exist yet.

- [ ] **Step 3: Replace `api/routers/intelligence.py`**

```python
"""API endpoints for on-demand and batch symbol intelligence analysis."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _require_api_key() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")


@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(ticker: str, request: SymbolIntelligenceRequest) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol."""
    _require_api_key()
    try:
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(ticker.upper(), request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{ticker}/latest", response_model=SymbolIntelligence)
def get_latest(ticker: str) -> SymbolIntelligence:
    """Return today's cached intelligence result for a symbol, or 404."""
    result = read_from_cache(ticker.upper())
    if result is None:
        raise HTTPException(status_code=404, detail=f"No cached analysis for {ticker} today")
    return result


class SweepSymbol(BaseModel):
    ticker: str
    request: SymbolIntelligenceRequest


class SweepRequest(BaseModel):
    symbols: list[SweepSymbol]


class SweepFailure(BaseModel):
    ticker: str
    error: str


class SweepResponse(BaseModel):
    analyzed: list[str]
    failed: list[SweepFailure]


@router.post("/sweep", response_model=SweepResponse)
def sweep(request: SweepRequest) -> SweepResponse:
    """Run intelligence analysis for a batch of symbols, caching each result."""
    _require_api_key()
    analyzer = SymbolAnalyzer()
    analyzed: list[str] = []
    failed: list[SweepFailure] = []
    for item in request.symbols:
        try:
            analyzer.analyze(item.ticker.upper(), item.request)
            analyzed.append(item.ticker.upper())
        except Exception as exc:
            logger.warning("Sweep failed for %s: %s", item.ticker, exc)
            failed.append(SweepFailure(ticker=item.ticker.upper(), error=str(exc)))
    return SweepResponse(analyzed=analyzed, failed=failed)
```

**Important:** The `/sweep` route must be registered before `/{ticker}` in the router to avoid FastAPI matching "sweep" as a ticker. Move `@router.post("/sweep")` before `@router.post("/{ticker}")` — the order above already does this, but double-check after pasting.

- [ ] **Step 4: Run tests**

```bash
pytest tests/api/test_intelligence_api.py -q
```
Expected: all PASS.

- [ ] **Step 5: Run full backend suite**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add api/routers/intelligence.py tests/api/test_intelligence_api.py
git commit -m "feat(intelligence): add GET /latest and POST /sweep endpoints"
```

---

### Task 5: Frontend types, API client, and i18n

**Files:**
- Modify: `web-ui/src/features/intelligence/types.ts`
- Modify: `web-ui/src/features/intelligence/api.ts`
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Test: `web-ui/src/features/intelligence/types.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `web-ui/src/features/intelligence/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transformIntelligence } from './types';
import type { SymbolIntelligenceAPI } from './types';

// existing tests stay; add these:

describe('transformIntelligence with new fields', () => {
  it('maps catalyst_urgency, upcoming_events, position_signal', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'AAPL',
      generated_at: '2026-05-24T10:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      catalyst_urgency: 'high',
      summary_line: 'Strong.',
      narrative: 'Text.',
      upcoming_events: [
        { type: 'earnings', date: '2026-05-28', direction: 'bullish', summary: 'Q2 beat expected.' }
      ],
      position_signal: { action: 'HOLD', reason: 'Thesis intact.' },
      sources: [],
    };
    const result = transformIntelligence(api);
    expect(result.catalystUrgency).toBe('high');
    expect(result.upcomingEvents).toHaveLength(1);
    expect(result.upcomingEvents[0].type).toBe('earnings');
    expect(result.positionSignal).toEqual({ action: 'HOLD', reason: 'Thesis intact.' });
  });

  it('defaults upcoming_events to [] and position_signal to null', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'MSFT',
      generated_at: '2026-05-24T10:00:00Z',
      action: 'WATCH',
      conviction: 'low',
      catalyst_urgency: 'none',
      summary_line: 'Flat.',
      narrative: 'Text.',
      upcoming_events: [],
      position_signal: null,
      sources: [],
    };
    const result = transformIntelligence(api);
    expect(result.upcomingEvents).toEqual([]);
    expect(result.positionSignal).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd web-ui && npx vitest run src/features/intelligence/types.test.ts
```
Expected: FAIL — `catalystUrgency`, `upcomingEvents`, `positionSignal` not yet on the type.

- [ ] **Step 3: Replace `web-ui/src/features/intelligence/types.ts`**

```typescript
import type { DecisionAction, DecisionConviction } from '@/features/screener/types';

export type { DecisionAction, DecisionConviction };

export type CatalystUrgency = 'high' | 'medium' | 'low' | 'none';
export type IntelligenceEventDirection = 'bullish' | 'bearish' | 'neutral';
export type IntelligenceEventType = 'earnings' | 'macro' | 'dividend' | 'product_launch' | 'regulatory' | 'other';
export type PositionSignalAction = 'HOLD' | 'TRIM' | 'EXIT';

export interface IntelligenceEvent {
  type: IntelligenceEventType;
  date: string | null;
  direction: IntelligenceEventDirection;
  summary: string;
}

export interface PositionSignal {
  action: PositionSignalAction;
  reason: string;
}

export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalyst_urgency: CatalystUrgency;
  summary_line: string;
  narrative: string;
  upcoming_events: IntelligenceEvent[];
  position_signal: PositionSignal | null;
  sources: string[];
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalystUrgency: CatalystUrgency;
  summaryLine: string;
  narrative: string;
  upcomingEvents: IntelligenceEvent[];
  positionSignal: PositionSignal | null;
  sources: string[];
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    catalystUrgency: api.catalyst_urgency,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    upcomingEvents: api.upcoming_events ?? [],
    positionSignal: api.position_signal ?? null,
    sources: api.sources ?? [],
  };
}

export interface SweepSymbolPayload {
  ticker: string;
  request: {
    close: number;
    signal: string;
    entry?: number | null;
    stop?: number | null;
    sma_20?: number | null;
    sma_50?: number | null;
    sma_200?: number | null;
    momentum_6m?: number | null;
    momentum_12m?: number | null;
    sector?: string | null;
    currency?: string;
    entry_price?: number | null;
    r_now?: number | null;
    days_open?: number | null;
  };
}

export interface SweepResponseAPI {
  analyzed: string[];
  failed: Array<{ ticker: string; error: string }>;
}
```

- [ ] **Step 4: Add endpoints to `web-ui/src/lib/api.ts`**

Find the `intelligenceAnalyze` line and add after it:

```typescript
intelligenceLatest: (ticker: string) => `/api/intelligence/${encodeURIComponent(ticker)}/latest`,
intelligenceSweep: '/api/intelligence/sweep',
```

- [ ] **Step 5: Add fetch functions to `web-ui/src/features/intelligence/api.ts`**

Add to the bottom of `web-ui/src/features/intelligence/api.ts`:

```typescript
import type { SweepSymbolPayload, SweepResponseAPI } from '@/features/intelligence/types';

export async function getIntelligenceLatest(ticker: string): Promise<SymbolIntelligenceAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceLatest(ticker)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `No cached analysis for ${ticker}`);
  }
  return response.json() as Promise<SymbolIntelligenceAPI>;
}

export async function postIntelligenceSweep(symbols: SweepSymbolPayload[]): Promise<SweepResponseAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSweep), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Intelligence sweep failed');
  }
  return response.json() as Promise<SweepResponseAPI>;
}
```

- [ ] **Step 6: Add i18n keys to `web-ui/src/i18n/messages.en.ts`**

Find the `intelligence:` block inside `workspacePage.panels.analysis` and extend it:

```typescript
intelligence: {
  analyzeAction: 'Analyze with AI',
  analyzingAction: 'Analyzing...',
  emptyState: 'Click "Analyze with AI" to generate a web-search-grounded analysis for this symbol.',
  sources: 'Sources',
  analyzeError: 'Failed to generate analysis',
  refreshAction: 'Refresh',
  lastAnalyzed: 'Last analyzed',
  catalystUrgency: {
    high: 'High urgency',
    medium: 'Medium urgency',
    low: 'Low urgency',
    none: '',
  },
  upcomingEvents: 'Upcoming Events',
  positionSignal: {
    hold: 'Hold',
    trim: 'Trim',
    exit: 'Exit',
  },
},
```

Also add to `todayPage.actionList`:
```typescript
intelligenceSweep: 'Run Intelligence Sweep',
intelligenceSweepRunning: 'Running sweep...',
intelligenceSweepDone: 'Sweep complete — {{analyzed}} analyzed{{failed}}',
intelligenceSweepFailed: ', {{n}} failed',
```

- [ ] **Step 7: Run types test**

```bash
cd web-ui && npx vitest run src/features/intelligence/types.test.ts
```
Expected: all PASS.

- [ ] **Step 8: Typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/features/intelligence/types.ts web-ui/src/features/intelligence/api.ts web-ui/src/lib/api.ts web-ui/src/i18n/messages.en.ts
git commit -m "feat(intelligence): extend frontend types, API client, and i18n for sweep"
```

---

### Task 6: Frontend hooks

**Files:**
- Modify: `web-ui/src/features/intelligence/hooks.ts`

- [ ] **Step 1: Replace `web-ui/src/features/intelligence/hooks.ts`**

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  candidateToPayload,
  getIntelligenceLatest,
  postIntelligenceAnalysis,
  postIntelligenceSweep,
} from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { SymbolIntelligence, SweepResponseAPI, SweepSymbolPayload } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

export function useIntelligenceAnalysisMutation() {
  return useMutation<
    SymbolIntelligence,
    Error,
    { ticker: string; candidate: SymbolAnalysisCandidate | null | undefined }
  >({
    mutationFn: async ({ ticker, candidate }) => {
      const payload = candidateToPayload(candidate);
      if (!payload) throw new Error('No technical context available for this symbol');
      const api = await postIntelligenceAnalysis(ticker, payload);
      return transformIntelligence(api);
    },
  });
}

export function useIntelligenceLatestQuery(ticker: string, enabled: boolean) {
  return useQuery<SymbolIntelligence, Error>({
    queryKey: ['intelligence', 'latest', ticker],
    queryFn: async () => {
      const api = await getIntelligenceLatest(ticker);
      return transformIntelligence(api);
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIntelligenceSweepMutation() {
  return useMutation<SweepResponseAPI, Error, SweepSymbolPayload[]>({
    mutationFn: postIntelligenceSweep,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/features/intelligence/hooks.ts
git commit -m "feat(intelligence): add useIntelligenceLatestQuery and useIntelligenceSweepMutation hooks"
```

---

### Task 7: Update IntelligenceCard UI

**Files:**
- Modify: `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`
- Modify: `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`:

```typescript
import type { IntelligenceEvent, PositionSignal } from '@/features/intelligence/types';

const baseIntelExtended = {
  ...baseIntel,  // use the existing baseIntel fixture
  catalystUrgency: 'high' as const,
  upcomingEvents: [
    {
      type: 'earnings' as const,
      date: '2026-05-28',
      direction: 'bullish' as const,
      summary: 'Q2 earnings expected to beat consensus.',
    },
  ] satisfies IntelligenceEvent[],
  positionSignal: { action: 'HOLD' as const, reason: 'Thesis intact.' } satisfies PositionSignal,
};

it('renders catalyst_urgency badge when high', () => {
  render(<IntelligenceCard intelligence={baseIntelExtended} />);
  expect(screen.getByText('High urgency')).toBeInTheDocument();
});

it('does not render urgency badge when none', () => {
  render(<IntelligenceCard intelligence={{ ...baseIntelExtended, catalystUrgency: 'none' }} />);
  expect(screen.queryByText(/urgency/i)).toBeNull();
});

it('renders upcoming events list', () => {
  render(<IntelligenceCard intelligence={baseIntelExtended} />);
  expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
  expect(screen.getByText('Q2 earnings expected to beat consensus.')).toBeInTheDocument();
});

it('does not render upcoming events section when empty', () => {
  render(<IntelligenceCard intelligence={{ ...baseIntelExtended, upcomingEvents: [] }} />);
  expect(screen.queryByText('Upcoming Events')).toBeNull();
});

it('renders position signal card when present', () => {
  render(<IntelligenceCard intelligence={baseIntelExtended} />);
  expect(screen.getByText('Hold')).toBeInTheDocument();
  expect(screen.getByText('Thesis intact.')).toBeInTheDocument();
});

it('does not render position signal when null', () => {
  render(<IntelligenceCard intelligence={{ ...baseIntelExtended, positionSignal: null }} />);
  expect(screen.queryByText('Hold')).toBeNull();
  expect(screen.queryByText('Trim')).toBeNull();
  expect(screen.queryByText('Exit')).toBeNull();
});
```

Also update `baseIntel` in the test file to include the new required fields:
```typescript
const baseIntel: SymbolIntelligence = {
  symbol: 'APAM',
  generatedAt: '2026-05-23T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'none',
  summaryLine: 'Cyclical recovery with improving EBITDA.',
  narrative: "## Why it's moving\nAperam Q1 2026 beat.",
  upcomingEvents: [],
  positionSignal: null,
  sources: ['https://aperam.com/q1-2026'],
};
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/IntelligenceCard.test.tsx
```
Expected: FAIL — new fields missing from component.

- [ ] **Step 3: Replace `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`**

```typescript
import Badge from '@/components/common/Badge';
import type {
  CatalystUrgency,
  DecisionAction,
  DecisionConviction,
  PositionSignalAction,
  SymbolIntelligence,
} from '@/features/intelligence/types';
import { t } from '@/i18n/t';

function actionLabel(action: DecisionAction): string {
  const map: Record<DecisionAction, string> = {
    BUY_NOW: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
    BUY_ON_PULLBACK: t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'),
    WAIT_FOR_BREAKOUT: t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout'),
    WATCH: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
    TACTICAL_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly'),
    AVOID: t('workspacePage.panels.analysis.decisionSummary.actions.avoid'),
    MANAGE_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly'),
  };
  return map[action];
}

function convictionLabel(conviction: DecisionConviction): string {
  const map: Record<DecisionConviction, string> = {
    high: t('workspacePage.panels.analysis.decisionSummary.conviction.high'),
    medium: t('workspacePage.panels.analysis.decisionSummary.conviction.medium'),
    low: t('workspacePage.panels.analysis.decisionSummary.conviction.low'),
  };
  return map[conviction];
}

function actionVariant(action: DecisionAction): 'primary' | 'success' | 'warning' | 'error' | 'default' {
  if (action === 'BUY_NOW') return 'success';
  if (action === 'AVOID') return 'error';
  if (action === 'BUY_ON_PULLBACK' || action === 'WAIT_FOR_BREAKOUT') return 'primary';
  return 'default';
}

function urgencyBadgeClass(urgency: CatalystUrgency): string {
  switch (urgency) {
    case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return '';
  }
}

function positionSignalClass(action: PositionSignalAction): string {
  switch (action) {
    case 'EXIT': return 'bg-rose-50 border-rose-200 text-rose-800';
    case 'TRIM': return 'bg-amber-50 border-amber-200 text-amber-800';
    default: return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  }
}

function positionSignalLabel(action: PositionSignalAction): string {
  switch (action) {
    case 'HOLD': return t('workspacePage.panels.analysis.intelligence.positionSignal.hold');
    case 'TRIM': return t('workspacePage.panels.analysis.intelligence.positionSignal.trim');
    case 'EXIT': return t('workspacePage.panels.analysis.intelligence.positionSignal.exit');
  }
}

const DIRECTION_ARROW: Record<string, string> = {
  bullish: '↑',
  bearish: '↓',
  neutral: '→',
};

interface IntelligenceCardProps {
  intelligence: SymbolIntelligence;
}

export default function IntelligenceCard({ intelligence }: IntelligenceCardProps) {
  const {
    action, conviction, catalystUrgency, summaryLine,
    narrative, upcomingEvents, positionSignal, sources,
  } = intelligence;

  const urgencyLabel = t(`workspacePage.panels.analysis.intelligence.catalystUrgency.${catalystUrgency}`);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={actionVariant(action)}>{actionLabel(action)}</Badge>
        <Badge variant="default">{convictionLabel(conviction)}</Badge>
        {catalystUrgency !== 'none' && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${urgencyBadgeClass(catalystUrgency)}`}>
            {urgencyLabel}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-700 font-medium">{summaryLine}</p>

      <hr className="border-slate-100" />

      <p className="text-sm text-slate-800 whitespace-pre-wrap">{narrative}</p>

      {positionSignal && (
        <>
          <hr className="border-slate-100" />
          <div className={`rounded-lg border px-3 py-2 ${positionSignalClass(positionSignal.action)}`}>
            <span className="text-xs font-semibold uppercase tracking-wide mr-2">
              {positionSignalLabel(positionSignal.action)}
            </span>
            <span className="text-sm">{positionSignal.reason}</span>
          </div>
        </>
      )}

      {upcomingEvents.length > 0 && (
        <>
          <hr className="border-slate-100" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('workspacePage.panels.analysis.intelligence.upcomingEvents')}
            </p>
            <ul className="space-y-1">
              {upcomingEvents.map((ev, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {ev.type}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    {DIRECTION_ARROW[ev.direction] ?? '→'}
                  </span>
                  <span>{ev.summary}{ev.date ? ` (${ev.date})` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {sources.length > 0 && (
        <>
          <hr className="border-slate-100" />
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
              {t('workspacePage.panels.analysis.intelligence.sources')} ({sources.length})
            </summary>
            <ul className="mt-2 space-y-1 list-none pl-0">
              {sources.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all text-xs"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/IntelligenceCard.test.tsx
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/IntelligenceCard.tsx web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx
git commit -m "feat(intelligence): update IntelligenceCard with urgency, events, position signal"
```

---

### Task 8: Auto-load cache in Intelligence tab

**Files:**
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`

- [ ] **Step 1: Update imports and tab logic in `SymbolAnalysisContent.tsx`**

Add `useIntelligenceLatestQuery` to the import from hooks:

```typescript
import { useIntelligenceAnalysisMutation, useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
```

Add the query inside the component (after `intelligenceMutation`):

```typescript
const intelligenceLatest = useIntelligenceLatestQuery(ticker, activeTab === 'intelligence');
```

Replace the Intelligence tab panel section (the `{activeTab === 'intelligence' && ...}` block) with:

```typescript
{activeTab === 'intelligence' && (
  <div className="space-y-3">
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={intelligenceMutation.isPending}
        onClick={() => {
          intelligenceMutation.mutate(
            { ticker, candidate },
            { onSuccess: (result) => setIntelligenceResult(result) }
          );
        }}
      >
        {intelligenceMutation.isPending
          ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
          : intelligenceResult ?? intelligenceLatest.data
            ? t('workspacePage.panels.analysis.intelligence.refreshAction')
            : t('workspacePage.panels.analysis.intelligence.analyzeAction')}
      </Button>
      {(intelligenceResult ?? intelligenceLatest.data) && !intelligenceMutation.isPending && (
        <span className="text-xs text-gray-400">
          {t('workspacePage.panels.analysis.intelligence.lastAnalyzed')}:{' '}
          {new Date((intelligenceResult ?? intelligenceLatest.data)!.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>

    {intelligenceMutation.isError && (
      <p className="text-sm text-rose-600">
        {intelligenceMutation.error instanceof Error
          ? intelligenceMutation.error.message
          : t('workspacePage.panels.analysis.intelligence.analyzeError')}
      </p>
    )}

    {(() => {
      const displayed = intelligenceResult ?? intelligenceLatest.data ?? null;
      if (displayed) return <IntelligenceCard intelligence={displayed} />;
      if (intelligenceMutation.isPending || intelligenceLatest.isLoading) return null;
      return (
        <p className="text-sm text-gray-500">
          {t('workspacePage.panels.analysis.intelligence.emptyState')}
        </p>
      );
    })()}
  </div>
)}
```

- [ ] **Step 2: Typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Run full frontend test suite**

```bash
cd web-ui && npm test -- --run
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx
git commit -m "feat(intelligence): auto-load cached result when Intelligence tab opens"
```

---

### Task 9: Sweep button in Today page

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`

- [ ] **Step 1: Add imports to `Today.tsx`**

Add at the top with other imports:

```typescript
import Button from '@/components/common/Button';
import { useIntelligenceSweepMutation } from '@/features/intelligence/hooks';
import type { SweepSymbolPayload } from '@/features/intelligence/types';
```

- [ ] **Step 2: Add sweep hook and handler inside the `TodayActionList` component**

Find the `TodayActionList` component. Add the sweep mutation and a `handleSweep` function inside it:

The `TodayActionList` component fetches data via `const { data: review } = useDailyReview(...)` at the top of the function. Add the sweep mutation and handler inside `TodayActionList` using that `review` variable:

```typescript
const sweepMutation = useIntelligenceSweepMutation();

function handleSweep() {
  if (!review) return;
  const symbols: SweepSymbolPayload[] = [];

  // Watchlist symbols near trigger (technical context only)
  for (const item of review.watchlistNearTrigger ?? []) {
    symbols.push({
      ticker: item.ticker,
      request: { close: item.watchPrice ?? 0, signal: 'watchlist' },
    });
  }

  // New candidates
  for (const c of review.newCandidates) {
    symbols.push({
      ticker: c.ticker,
      request: {
        close: c.close, signal: c.signal,
        entry: c.entry, stop: c.stop,
        sma_20: c.sma20 ?? null, sma_50: c.sma50 ?? null, sma_200: c.sma200 ?? null,
        momentum_6m: c.momentum6m ?? null, momentum_12m: c.momentum12m ?? null,
        sector: c.sector ?? null, currency: c.currency ?? 'USD',
      },
    });
  }

  // Positions (with position context — hold, update, close, exit signal)
  const allPositions = [
    ...review.positionsHold,
    ...review.positionsUpdateStop,
    ...review.positionsClose,
    ...review.positionsExitSignal,
  ];
  for (const p of allPositions) {
    symbols.push({
      ticker: p.ticker,
      request: {
        close: p.currentPrice, signal: 'position',
        entry_price: p.entryPrice, r_now: p.rNow, days_open: p.daysOpen,
      },
    });
  }

  if (symbols.length > 0) sweepMutation.mutate(symbols);
}
```

- [ ] **Step 3: Add the sweep button to the `TodayActionList` JSX**

Find the section header area (near the `requiresAction` label or top of the list) and add the button before the list items:

```typescript
<div className="flex items-center justify-between mb-2">
  <Button
    type="button"
    size="sm"
    variant="secondary"
    disabled={sweepMutation.isPending}
    onClick={handleSweep}
  >
    {sweepMutation.isPending
      ? t('todayPage.actionList.intelligenceSweepRunning')
      : t('todayPage.actionList.intelligenceSweep')}
  </Button>
  {sweepMutation.isSuccess && (
    <span className="text-xs text-gray-500">
      {t('todayPage.actionList.intelligenceSweepDone', {
        analyzed: String(sweepMutation.data.analyzed.length),
        failed: sweepMutation.data.failed.length > 0
          ? t('todayPage.actionList.intelligenceSweepFailed', { n: String(sweepMutation.data.failed.length) })
          : '',
      })}
    </span>
  )}
</div>
```

- [ ] **Step 4: Typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors. Fix any type errors from the position union type — `positionsExitSignal` items have `daysOpen` so they work fine.

- [ ] **Step 5: Run full frontend test suite**

```bash
cd web-ui && npm test -- --run
```
Expected: all PASS.

- [ ] **Step 6: Run full backend suite**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/pages/Today.tsx
git commit -m "feat(intelligence): add Run Intelligence Sweep button to Today page"
```

---

## Done

All 9 tasks complete. Verify the full test suite one final time:

```bash
pytest -q && cd web-ui && npm test -- --run && npm run typecheck && npm run lint
```

Compare link for PR:
```
https://github.com/matteolongo/swing_screener/compare/feat/exit-signal-sma20...HEAD?expand=1
```
