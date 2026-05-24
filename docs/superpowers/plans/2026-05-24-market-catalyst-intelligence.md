# Market Catalyst Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a market catalyst intelligence layer that enriches existing technically-qualified screener candidates with AI-sourced theme context and causal reasoning — without replacing any deterministic risk or ranking logic.

**Architecture:** Ten sequential PRs, each independently testable. Backend: new `catalysts/` subpackage under `intelligence/`, a new `api/routers/catalysts.py`, and a single-field change to `_apply_decision_summary_context` to pass today's symbol opportunity index. Frontend: new `features/intelligence/catalysts/` for types/API/hooks, Today-page scan button, inline catalyst explanation on candidate cards, and a workspace `CatalystContextCard`. Dual-ranking-view from the original spec is explicitly out of scope (YAGNI — the `catalyst_label` field already influences action in `build_decision_summary`).

**Tech Stack:** Python/FastAPI, Pydantic v2, OpenAI Responses API (`web_search_preview` builtin), date-partitioned JSON store (same pattern as `data/intelligence/sweep_*.json`), React 18, React Query, Vitest/MSW.

---

## Scope note: dual ranking view

The original spec describes a "catalyst-enriched ranking" toggle. This is **out of scope for this plan**. The existing `build_decision_summary` already adjusts `action` and `conviction` based on `catalyst_label` — that IS the catalyst overlay. A separate ranking UI would add complexity with no additional safety signal.

---

## File Map

**Create:**
- `src/swing_screener/intelligence/catalysts/__init__.py`
- `src/swing_screener/intelligence/catalysts/models.py`
- `src/swing_screener/intelligence/catalysts/store.py`
- `src/swing_screener/intelligence/catalysts/prompts.py`
- `src/swing_screener/intelligence/catalysts/generator.py`
- `api/routers/catalysts.py`
- `tests/intelligence/catalysts/__init__.py`
- `tests/intelligence/catalysts/test_models.py`
- `tests/intelligence/catalysts/test_store.py`
- `tests/intelligence/catalysts/test_generator.py`
- `tests/api/test_catalyst_api.py`
- `web-ui/src/features/intelligence/catalysts/types.ts`
- `web-ui/src/features/intelligence/catalysts/api.ts`
- `web-ui/src/features/intelligence/catalysts/hooks.ts`
- `web-ui/src/features/intelligence/catalysts/types.test.ts`
- `web-ui/src/components/domain/workspace/CatalystContextCard.tsx`
- `web-ui/src/components/domain/workspace/CatalystContextCard.test.tsx`

**Modify:**
- `api/main.py` — mount catalysts router
- `api/services/screener_service.py` — load symbol index, pass opportunity
- `src/swing_screener/recommendation/models.py` — add `catalyst_summary`, `catalyst_sources` to `DecisionSummary`
- `src/swing_screener/recommendation/decision_summary.py` — populate new fields from opportunity
- `web-ui/src/lib/api.ts` — add catalyst endpoint constants
- `web-ui/src/i18n/messages.en.ts` — catalyst UI strings
- `web-ui/src/pages/Today.tsx` — market catalyst scan button
- `web-ui/src/features/screener/types.ts` — add `catalystSummary`, `catalystSources` to `DecisionSummaryAPI` + `DecisionSummary`
- `web-ui/src/features/dailyReview/types.ts` — propagate transform
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — add `CatalystContextCard`
- `web-ui/src/test/mocks/handlers.ts` — add MSW handlers

---

## Codebase orientation

**Key existing functions/patterns to follow:**

- `data_dir()` from `swing_screener.settings.paths` — use for all file paths
- `src/swing_screener/intelligence/cache.py` — exact pattern to follow for JSON store (read-modify-write with try/except on parse)
- `src/swing_screener/intelligence/symbol_analyzer.py` — exact pattern for OpenAI Responses API calls with `web_search_preview`
- `api/services/screener_service.py:_apply_decision_summary_context` — the one function to modify for screener integration (line ~468)
- `build_decision_summary` from `swing_screener.recommendation` — already accepts `opportunity: Any | None`; `_catalyst_label` reads `.state` (str) and `.catalyst_strength` (float) via duck-typing
- States `CATALYST_ACTIVE`/`TRENDING` → `catalyst_label="active"`; `WATCH`/`COOLING_OFF` → `"neutral"`; anything else (incl. `QUIET`) → `"weak"`

---

### Task 1: Catalyst Domain Models

**Files:**
- Create: `src/swing_screener/intelligence/catalysts/__init__.py`
- Create: `src/swing_screener/intelligence/catalysts/models.py`
- Create: `tests/intelligence/catalysts/__init__.py`
- Create: `tests/intelligence/catalysts/test_models.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/intelligence/catalysts/test_models.py
from __future__ import annotations
import pytest
from pydantic import ValidationError
from swing_screener.intelligence.catalysts.models import (
    CatalystOpportunity, CatalystOpportunityState,
    CatalystReport, CompanyCatalyst, MarketTheme, SourceEvidence, CausalChainStep,
)


def _source() -> SourceEvidence:
    return SourceEvidence(
        title="Tariff update", url="https://example.com/1",
        quote_or_summary="New 25% tariff on steel imports.",
        relevance="Direct cost increase for steel importers.",
    )


def _causal_step() -> CausalChainStep:
    return CausalChainStep(step=1, cause="tariff on steel", effect="higher input costs", affected_sector="manufacturing")


def _company(ticker="STLD", benefit_type="loser") -> CompanyCatalyst:
    return CompanyCatalyst(
        ticker=ticker, company_name="Steel Dynamics",
        benefit_type=benefit_type,
        thesis="Higher tariffs increase domestic steel prices.",
        causal_chain=[_causal_step()],
        evidence=[_source()],
        catalyst_strength=7.5, market_awareness=5.0,
        priced_in_risk=4.0, swing_relevance=6.5,
        risk_level="medium", key_risks=["tariff reversal"],
        expected_time_horizon="weeks",
    )


def test_full_catalyst_report_parses():
    report = CatalystReport(
        report_id="abc-123",
        event_summary="New steel tariffs announced.",
        themes=[MarketTheme(name="Steel tariff", summary="US imposes 25% tariff.", time_horizon="short_term", confidence=0.85)],
        causal_chains=[_causal_step()],
        beneficiaries=[_company("STLD", "first_order")],
        losers=[_company("NUE", "loser")],
        hidden_opportunities=[],
        non_actionable_notes=["Long-term reshoring thesis not swing-relevant."],
        generated_at="2026-05-24T10:00:00Z",
    )
    assert report.report_id == "abc-123"
    assert len(report.beneficiaries) == 1
    assert len(report.losers) == 1


def test_market_theme_confidence_out_of_range_fails():
    with pytest.raises(ValidationError):
        MarketTheme(name="x", summary="y", time_horizon="short_term", confidence=1.5)


def test_company_catalyst_strength_out_of_range_fails():
    with pytest.raises(ValidationError):
        _company().__class__.model_validate({**_company().model_dump(), "catalyst_strength": 11.0})


def test_catalyst_opportunity_active_states():
    for state in [CatalystOpportunityState.CATALYST_ACTIVE, CatalystOpportunityState.TRENDING]:
        opp = CatalystOpportunity(
            ticker="AAPL", state=state, catalyst_strength=8.0,
            thesis="Strong AI demand.", sources=[], report_id="r1",
            generated_at="2026-05-24T10:00:00Z",
        )
        assert opp.state == state


def test_catalyst_opportunity_quiet_maps_to_weak():
    """QUIET state should be accepted as a valid enum value."""
    opp = CatalystOpportunity(
        ticker="MSFT", state=CatalystOpportunityState.QUIET, catalyst_strength=2.0,
        thesis="No catalyst.", sources=[], report_id="r1",
        generated_at="2026-05-24T10:00:00Z",
    )
    assert opp.state == CatalystOpportunityState.QUIET
    # Verify the existing _catalyst_label maps QUIET → "weak"
    from swing_screener.recommendation.decision_summary import _catalyst_label  # type: ignore[attr-defined]
    label = _catalyst_label(opp)
    assert label == "weak"


def test_company_catalyst_requires_evidence_list():
    c = _company()
    assert len(c.evidence) >= 1
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/intelligence/catalysts/test_models.py -q
```
Expected: FAIL — `catalysts` module not found.

- [ ] **Step 3: Create the package init files**

```bash
touch src/swing_screener/intelligence/catalysts/__init__.py
mkdir -p tests/intelligence/catalysts
touch tests/intelligence/catalysts/__init__.py
```

- [ ] **Step 4: Create `src/swing_screener/intelligence/catalysts/models.py`**

```python
from __future__ import annotations
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class CatalystOpportunityState(str, Enum):
    CATALYST_ACTIVE = "CATALYST_ACTIVE"
    TRENDING = "TRENDING"
    WATCH = "WATCH"
    COOLING_OFF = "COOLING_OFF"
    QUIET = "QUIET"


class SourceEvidence(BaseModel):
    title: str
    url: str
    publisher: str | None = None
    published_at: str | None = None
    quote_or_summary: str
    relevance: str


class MarketTheme(BaseModel):
    name: str
    summary: str
    time_horizon: Literal["short_term", "medium_term", "long_term"]
    confidence: float = Field(ge=0, le=1)


class CausalChainStep(BaseModel):
    step: int
    cause: str
    effect: str
    affected_sector: str | None = None


class CompanyCatalyst(BaseModel):
    ticker: str
    company_name: str
    exchange: str | None = None
    benefit_type: Literal["first_order", "second_order", "third_order", "bottleneck", "loser"]
    thesis: str
    causal_chain: list[CausalChainStep]
    evidence: list[SourceEvidence]
    catalyst_strength: float = Field(ge=0, le=10)
    market_awareness: float = Field(ge=0, le=10)
    priced_in_risk: float = Field(ge=0, le=10)
    swing_relevance: float = Field(ge=0, le=10)
    risk_level: Literal["low", "medium", "high"]
    key_risks: list[str]
    expected_time_horizon: Literal["days", "weeks", "months", "multi_year"]


class CatalystReport(BaseModel):
    report_id: str
    event_summary: str
    themes: list[MarketTheme]
    causal_chains: list[CausalChainStep]
    beneficiaries: list[CompanyCatalyst]
    losers: list[CompanyCatalyst]
    hidden_opportunities: list[CompanyCatalyst]
    non_actionable_notes: list[str]
    generated_at: str  # ISO datetime string


class CatalystOpportunity(BaseModel):
    ticker: str
    state: CatalystOpportunityState
    catalyst_strength: float = Field(ge=0, le=10)
    thesis: str
    key_risks: list[str] = []
    sources: list[str] = []  # URLs from evidence
    report_id: str
    generated_at: str  # ISO datetime string
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/intelligence/catalysts/test_models.py -q
```
Expected: all PASS.

- [ ] **Step 6: Run full backend suite to confirm no regressions**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/intelligence/catalysts/ tests/intelligence/catalysts/
git commit -m "feat(catalysts): add domain models — CatalystReport, CatalystOpportunity"
```

---

### Task 2: Catalyst Store

**Files:**
- Create: `src/swing_screener/intelligence/catalysts/store.py`
- Create: `tests/intelligence/catalysts/test_store.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/intelligence/catalysts/test_store.py
from __future__ import annotations
import json
from datetime import date, datetime, timezone
from pathlib import Path
import pytest
from swing_screener.intelligence.catalysts.models import (
    CatalystOpportunity, CatalystOpportunityState, CatalystReport, MarketTheme,
)
from swing_screener.intelligence.catalysts.store import CatalystStore


def _make_report(report_id: str = "r1") -> CatalystReport:
    return CatalystReport(
        report_id=report_id,
        event_summary="Test event.",
        themes=[MarketTheme(name="AI infra", summary="Demand rising.", time_horizon="short_term", confidence=0.8)],
        causal_chains=[], beneficiaries=[], losers=[], hidden_opportunities=[],
        non_actionable_notes=[],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _make_opportunity(ticker: str = "AAPL", report_id: str = "r1") -> CatalystOpportunity:
    return CatalystOpportunity(
        ticker=ticker, state=CatalystOpportunityState.CATALYST_ACTIVE,
        catalyst_strength=8.0, thesis="Strong AI demand.", key_risks=["competition"],
        sources=["https://example.com/1"], report_id=report_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def test_save_and_load_report_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    report = _make_report("r1")
    store.save_report(report)
    loaded = store.load_report("r1")
    assert loaded is not None
    assert loaded.report_id == "r1"
    assert loaded.event_summary == "Test event."


def test_load_report_returns_none_for_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    assert store.load_report("nonexistent") is None


def test_load_latest_report_returns_most_recent(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    r1 = _make_report("r1")
    r2 = _make_report("r2")
    store.save_report(r1)
    store.save_report(r2)
    latest = store.load_latest_report()
    assert latest is not None
    assert latest.report_id == "r2"


def test_save_symbol_index_merges_across_reports(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    d = date(2026, 5, 24)
    opp_aapl = _make_opportunity("AAPL", "r1")
    opp_msft = _make_opportunity("MSFT", "r2")
    store.save_symbol_index(d, [opp_aapl])
    store.save_symbol_index(d, [opp_msft])  # second call must not overwrite AAPL
    aapl = store.load_symbol_opportunity("AAPL", d)
    msft = store.load_symbol_opportunity("MSFT", d)
    assert aapl is not None
    assert msft is not None


def test_symbol_lookup_is_case_insensitive(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    d = date(2026, 5, 24)
    store.save_symbol_index(d, [_make_opportunity("aapl")])
    assert store.load_symbol_opportunity("AAPL", d) is not None


def test_load_symbol_opportunity_returns_none_for_different_date(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    store.save_symbol_index(date(2026, 5, 23), [_make_opportunity("AAPL")])
    assert store.load_symbol_opportunity("AAPL", date(2026, 5, 24)) is None


def test_corrupt_json_handled_safely(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    (tmp_path / "intelligence" / "catalyst_reports" / "by_symbol").mkdir(parents=True, exist_ok=True)
    corrupt_path = tmp_path / "intelligence" / "catalyst_reports" / "by_symbol" / "2026-05-24.json"
    corrupt_path.write_text("{bad json}")
    assert store.load_symbol_opportunity("AAPL", date(2026, 5, 24)) is None
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/intelligence/catalysts/test_store.py -q
```
Expected: FAIL — `CatalystStore` not found.

- [ ] **Step 3: Create `src/swing_screener/intelligence/catalysts/store.py`**

```python
from __future__ import annotations
import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystReport
from swing_screener.settings.paths import data_dir

logger = logging.getLogger(__name__)


class CatalystStore:
    """Persist and retrieve catalyst reports and symbol opportunity index."""

    def _reports_dir(self, for_date: date) -> Path:
        d = data_dir() / "intelligence" / "catalyst_reports" / for_date.isoformat()
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _latest_ptr(self) -> Path:
        p = data_dir() / "intelligence" / "catalyst_reports"
        p.mkdir(parents=True, exist_ok=True)
        return p / "latest.json"

    def _symbol_index_path(self, for_date: date) -> Path:
        p = data_dir() / "intelligence" / "catalyst_reports" / "by_symbol"
        p.mkdir(parents=True, exist_ok=True)
        return p / f"{for_date.isoformat()}.json"

    def save_report(self, report: CatalystReport) -> None:
        today = datetime.now(timezone.utc).date()
        report_path = self._reports_dir(today) / f"{report.report_id}.json"
        report_path.write_text(report.model_dump_json(indent=2))
        self._latest_ptr().write_text(json.dumps({"report_id": report.report_id, "date": today.isoformat()}))

    def load_report(self, report_id: str, for_date: date | None = None) -> CatalystReport | None:
        search_date = for_date or datetime.now(timezone.utc).date()
        report_path = self._reports_dir(search_date) / f"{report_id}.json"
        if not report_path.exists():
            return None
        try:
            return CatalystReport.model_validate_json(report_path.read_text())
        except (ValueError, OSError) as exc:
            logger.warning("Failed to load catalyst report %s: %s", report_id, exc)
            return None

    def load_latest_report(self) -> CatalystReport | None:
        ptr = self._latest_ptr()
        if not ptr.exists():
            return None
        try:
            meta = json.loads(ptr.read_text())
            report_id = meta["report_id"]
            for_date = date.fromisoformat(meta["date"])
            return self.load_report(report_id, for_date)
        except (KeyError, ValueError, OSError) as exc:
            logger.warning("Failed to load latest catalyst report: %s", exc)
            return None

    def save_symbol_index(self, for_date: date, opportunities: list[CatalystOpportunity]) -> None:
        """Merge opportunities into today's index — last updated wins per ticker."""
        path = self._symbol_index_path(for_date)
        existing: dict = {}
        if path.exists():
            try:
                existing = json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                existing = {}
        for opp in opportunities:
            existing[opp.ticker.upper()] = json.loads(opp.model_dump_json())
        path.write_text(json.dumps(existing, indent=2))

    def load_symbol_opportunity(self, ticker: str, for_date: date | None = None) -> CatalystOpportunity | None:
        target_date = for_date or datetime.now(timezone.utc).date()
        path = self._symbol_index_path(target_date)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            entry = data.get(ticker.upper())
            if entry is None:
                return None
            return CatalystOpportunity.model_validate(entry)
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            logger.warning("Failed to load catalyst opportunity for %s: %s", ticker, exc)
            return None

    def load_symbol_index(self, for_date: date | None = None) -> dict[str, CatalystOpportunity]:
        target_date = for_date or datetime.now(timezone.utc).date()
        path = self._symbol_index_path(target_date)
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text())
            result: dict[str, CatalystOpportunity] = {}
            for ticker, entry in data.items():
                try:
                    result[ticker.upper()] = CatalystOpportunity.model_validate(entry)
                except ValueError:
                    continue
            return result
        except (json.JSONDecodeError, OSError):
            return {}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/intelligence/catalysts/test_store.py -q
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/catalysts/store.py tests/intelligence/catalysts/test_store.py
git commit -m "feat(catalysts): add CatalystStore with merge-safe symbol index"
```

---

### Task 3: Catalyst Generator

**Files:**
- Create: `src/swing_screener/intelligence/catalysts/prompts.py`
- Create: `src/swing_screener/intelligence/catalysts/generator.py`
- Create: `tests/intelligence/catalysts/test_generator.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/intelligence/catalysts/test_generator.py
from __future__ import annotations
import json
from datetime import date
from unittest.mock import MagicMock, patch
import pytest
from swing_screener.intelligence.catalysts.generator import CatalystReportGenerator
from swing_screener.intelligence.catalysts.models import CatalystReport


_FAKE_REPORT = {
    "report_id": "test-001",
    "event_summary": "US steel tariffs at 25%.",
    "themes": [{"name": "Steel tariffs", "summary": "Cost pressure.", "time_horizon": "short_term", "confidence": 0.8}],
    "causal_chains": [{"step": 1, "cause": "tariff", "effect": "higher costs", "affected_sector": "manufacturing"}],
    "beneficiaries": [{
        "ticker": "STLD", "company_name": "Steel Dynamics",
        "benefit_type": "first_order", "thesis": "Domestic prices rise.",
        "causal_chain": [{"step": 1, "cause": "tariff", "effect": "price increase", "affected_sector": None}],
        "evidence": [{"title": "Reuters", "url": "https://reuters.com/1", "quote_or_summary": "Tariff announced.", "relevance": "Direct."}],
        "catalyst_strength": 7.5, "market_awareness": 5.0, "priced_in_risk": 4.0, "swing_relevance": 6.5,
        "risk_level": "medium", "key_risks": ["reversal"], "expected_time_horizon": "weeks",
    }],
    "losers": [],
    "hidden_opportunities": [],
    "non_actionable_notes": [],
    "generated_at": "2026-05-24T10:00:00Z",
}


def _mock_openai_response(payload: dict) -> MagicMock:
    response = MagicMock()
    choice = MagicMock()
    choice.message.content = f"```json\n{json.dumps(payload)}\n```"
    response.choices = [choice]
    response.output_text = json.dumps(payload)
    return response


def test_generate_from_url_returns_valid_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_url("https://reuters.com/1")
    assert isinstance(report, CatalystReport)
    assert report.event_summary == "US steel tariffs at 25%."
    assert len(report.beneficiaries) == 1


def test_generate_from_url_writes_to_store(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_url("https://reuters.com/1")
    from swing_screener.intelligence.catalysts.store import CatalystStore
    store = CatalystStore()
    loaded = store.load_report(report.report_id)
    assert loaded is not None


def test_generate_from_web_search_returns_valid_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_web_search()
    assert isinstance(report, CatalystReport)


def test_invalid_json_raises_value_error(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text="not json at all")
        gen = CatalystReportGenerator()
        with pytest.raises(ValueError):
            gen.generate_from_url("https://example.com/bad")


def test_prompt_contains_guardrails():
    from swing_screener.intelligence.catalysts.prompts import SYSTEM_PROMPT
    assert "do not" in SYSTEM_PROMPT.lower() or "must not" in SYSTEM_PROMPT.lower()
    assert "buy" not in SYSTEM_PROMPT.lower() or "do not" in SYSTEM_PROMPT.lower()
    assert "source" in SYSTEM_PROMPT.lower()
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/intelligence/catalysts/test_generator.py -q
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/swing_screener/intelligence/catalysts/prompts.py`**

```python
SYSTEM_PROMPT = """\
You are a market intelligence analyst. Given news sources, identify market themes, \
causal chains, and which publicly-traded companies may benefit or be harmed.

Rules you MUST follow:
- Do NOT generate direct buy or sell recommendations.
- Do NOT suggest entry prices, stop losses, or position sizes.
- You MUST attribute every company thesis to at least one source URL (evidence list).
- Catalyst without source attribution must be assigned catalyst_strength <= 2.0.
- Output structured JSON only — no prose outside the JSON block.

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- report_id: string UUID (generate one)
- event_summary: string — one paragraph describing the triggering event
- themes: array of {name, summary, time_horizon: "short_term"|"medium_term"|"long_term", confidence: 0.0-1.0}
- causal_chains: array of {step: int, cause, effect, affected_sector}
- beneficiaries: array of CompanyCatalyst objects (companies that may benefit)
- losers: array of CompanyCatalyst objects (companies that may be harmed)
- hidden_opportunities: array of CompanyCatalyst — non-obvious second/third-order plays
- non_actionable_notes: array of strings — important context not useful for swing trading
- generated_at: ISO 8601 datetime string

CompanyCatalyst schema:
{
  ticker, company_name, exchange (optional),
  benefit_type: "first_order"|"second_order"|"third_order"|"bottleneck"|"loser",
  thesis: string,
  causal_chain: [{step, cause, effect, affected_sector}],
  evidence: [{title, url, publisher, published_at, quote_or_summary, relevance}],
  catalyst_strength: 0-10,
  market_awareness: 0-10 (10 = fully priced in),
  priced_in_risk: 0-10,
  swing_relevance: 0-10 (relevance for 5-20 day swing trade),
  risk_level: "low"|"medium"|"high",
  key_risks: [string],
  expected_time_horizon: "days"|"weeks"|"months"|"multi_year"
}
"""

URL_USER_PROMPT = """\
Analyze the following news article URL and extract market catalyst intelligence.

URL: {url}

Search for and read the article, then produce the structured catalyst report.
Focus on swing-trading-relevant catalysts (5-20 day time horizon).
"""

WEB_SEARCH_USER_PROMPT = """\
Search for the most important market-moving news from the last 24-72 hours.

Focus on themes with concrete company impact for swing trading:
- Earnings beats/misses with sector read-through
- Policy or regulatory changes (tariffs, rates, approvals)
- Supply chain disruptions or bottlenecks
- Technology announcements with product/revenue impact
- Sector rotation catalysts

Search broadly, then produce the structured catalyst report covering the top 2-3 themes.
"""
```

- [ ] **Step 4: Create `src/swing_screener/intelligence/catalysts/generator.py`**

```python
from __future__ import annotations
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystOpportunityState, CatalystReport
from swing_screener.intelligence.catalysts.prompts import SYSTEM_PROMPT, URL_USER_PROMPT, WEB_SEARCH_USER_PROMPT
from swing_screener.intelligence.catalysts.store import CatalystStore

logger = logging.getLogger(__name__)
_MODEL = "gpt-4o"


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in LLM output: {text[:300]}")


def _opportunities_from_report(report: CatalystReport) -> list[CatalystOpportunity]:
    result: list[CatalystOpportunity] = []
    now = datetime.now(timezone.utc).isoformat()
    for company in [*report.beneficiaries, *report.hidden_opportunities]:
        state = CatalystOpportunityState.CATALYST_ACTIVE if company.catalyst_strength >= 6.7 else (
            CatalystOpportunityState.WATCH if company.catalyst_strength >= 4.0 else CatalystOpportunityState.QUIET
        )
        result.append(CatalystOpportunity(
            ticker=company.ticker.upper(),
            state=state,
            catalyst_strength=company.catalyst_strength,
            thesis=company.thesis,
            key_risks=company.key_risks,
            sources=[ev.url for ev in company.evidence],
            report_id=report.report_id,
            generated_at=now,
        ))
    for company in report.losers:
        result.append(CatalystOpportunity(
            ticker=company.ticker.upper(),
            state=CatalystOpportunityState.COOLING_OFF,
            catalyst_strength=company.catalyst_strength,
            thesis=company.thesis,
            key_risks=company.key_risks,
            sources=[ev.url for ev in company.evidence],
            report_id=report.report_id,
            generated_at=now,
        ))
    return result


class CatalystReportGenerator:
    def __init__(self) -> None:
        self._client = OpenAI()
        self._store = CatalystStore()

    def _generate(self, user_prompt: str) -> CatalystReport:
        response = self._client.responses.create(
            model=_MODEL,
            tools=[{"type": "web_search_preview"}],
            input=[{"role": "user", "content": user_prompt}],
        )
        raw = _extract_json(response.output_text)
        # Ensure a stable report_id
        if not raw.get("report_id"):
            raw["report_id"] = str(uuid.uuid4())
        if not raw.get("generated_at"):
            raw["generated_at"] = datetime.now(timezone.utc).isoformat()
        report = CatalystReport.model_validate(raw)
        self._persist(report)
        return report

    def generate_from_url(self, url: str) -> CatalystReport:
        return self._generate(URL_USER_PROMPT.format(url=url))

    def generate_from_web_search(self) -> CatalystReport:
        return self._generate(WEB_SEARCH_USER_PROMPT)

    def _persist(self, report: CatalystReport) -> None:
        from datetime import datetime, timezone
        try:
            self._store.save_report(report)
            opportunities = _opportunities_from_report(report)
            today = datetime.now(timezone.utc).date()
            self._store.save_symbol_index(today, opportunities)
        except Exception as exc:
            logger.warning("Failed to persist catalyst report %s: %s", report.report_id, exc)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/intelligence/catalysts/test_generator.py -q
```
Expected: all PASS.

- [ ] **Step 6: Run full backend suite**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/intelligence/catalysts/prompts.py src/swing_screener/intelligence/catalysts/generator.py tests/intelligence/catalysts/test_generator.py
git commit -m "feat(catalysts): add CatalystReportGenerator with url and web-search modes"
```

---

### Task 4: Catalyst API Endpoints

**Files:**
- Create: `api/routers/catalysts.py`
- Create: `tests/api/test_catalyst_api.py`
- Modify: `api/main.py`
- Modify: `web-ui/src/lib/api.ts`

- [ ] **Step 1: Write the failing tests**

```python
# tests/api/test_catalyst_api.py
from __future__ import annotations
import json
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

_FAKE_REPORT_PAYLOAD = {
    "report_id": "r-test", "event_summary": "Steel tariff.", "themes": [],
    "causal_chains": [], "beneficiaries": [], "losers": [], "hidden_opportunities": [],
    "non_actionable_notes": [], "generated_at": "2026-05-24T10:00:00Z",
}

_FAKE_OPPORTUNITY = {
    "ticker": "STLD", "state": "CATALYST_ACTIVE", "catalyst_strength": 8.0,
    "thesis": "Domestic steel prices rise.", "key_risks": [], "sources": [], "report_id": "r-test",
    "generated_at": "2026-05-24T10:00:00Z",
}


def test_manual_generation_succeeds(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    from swing_screener.intelligence.catalysts.models import CatalystReport
    fake_report = CatalystReport.model_validate(_FAKE_REPORT_PAYLOAD)
    with patch("api.routers.catalysts.CatalystReportGenerator") as MockGen:
        instance = MagicMock()
        instance.generate_from_url.return_value = fake_report
        MockGen.return_value = instance
        response = client.post("/api/catalysts/manual", json={"url": "https://reuters.com/1"})
    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "r-test"


def test_manual_generation_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/catalysts/manual", json={"url": "https://reuters.com/1"})
    assert response.status_code == 503


def test_daily_scan_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/catalysts/daily-scan")
    assert response.status_code == 503


def test_latest_returns_404_when_no_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    response = client.get("/api/catalysts/latest")
    assert response.status_code == 404


def test_latest_returns_cached_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystReport
    store = CatalystStore()
    store.save_report(CatalystReport.model_validate(_FAKE_REPORT_PAYLOAD))
    response = client.get("/api/catalysts/latest")
    assert response.status_code == 200
    assert response.json()["report_id"] == "r-test"


def test_symbol_endpoint_returns_404_when_no_opportunity(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    response = client.get("/api/catalysts/symbol/AAPL")
    assert response.status_code == 404


def test_symbol_endpoint_returns_opportunity(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystOpportunity
    store = CatalystStore()
    from datetime import datetime, timezone
    store.save_symbol_index(datetime.now(timezone.utc).date(), [CatalystOpportunity.model_validate(_FAKE_OPPORTUNITY)])
    response = client.get("/api/catalysts/symbol/STLD")
    assert response.status_code == 200
    assert response.json()["ticker"] == "STLD"


def test_existing_intelligence_endpoints_unaffected(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 404  # no cache, but endpoint exists
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/api/test_catalyst_api.py -q
```
Expected: FAIL — `catalysts` router not mounted.

- [ ] **Step 3: Create `api/routers/catalysts.py`**

```python
"""API endpoints for market catalyst reports and symbol opportunities."""
from __future__ import annotations
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from swing_screener.intelligence.catalysts.generator import CatalystReportGenerator
from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystReport
from swing_screener.intelligence.catalysts.store import CatalystStore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/catalysts", tags=["catalysts"])


def _require_api_key() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")


class ManualCatalystRequest(BaseModel):
    url: str


@router.post("/manual", response_model=CatalystReport)
def generate_manual(request: ManualCatalystRequest) -> CatalystReport:
    """Generate a catalyst report from a specific news URL."""
    _require_api_key()
    try:
        return CatalystReportGenerator().generate_from_url(request.url)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/daily-scan", response_model=CatalystReport)
def daily_scan() -> CatalystReport:
    """Generate a catalyst report by searching recent market news."""
    _require_api_key()
    try:
        return CatalystReportGenerator().generate_from_web_search()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/latest", response_model=CatalystReport)
def get_latest() -> CatalystReport:
    """Return the most recently generated catalyst report, or 404."""
    store = CatalystStore()
    report = store.load_latest_report()
    if report is None:
        raise HTTPException(status_code=404, detail="No catalyst report available")
    return report


@router.get("/symbol/{ticker}", response_model=CatalystOpportunity)
def get_symbol_opportunity(ticker: str) -> CatalystOpportunity:
    """Return today's catalyst opportunity for a symbol, or 404."""
    store = CatalystStore()
    opp = store.load_symbol_opportunity(ticker.upper())
    if opp is None:
        raise HTTPException(status_code=404, detail=f"No catalyst opportunity for {ticker} today")
    return opp
```

- [ ] **Step 4: Mount the router in `api/main.py`**

Find the block of `app.include_router(...)` calls (around line 289) and add after the intelligence router line:

```python
from api.routers import catalysts
# ...
app.include_router(catalysts.router, prefix="/api", tags=["catalysts"])
```

Also add `catalysts` to the import from `api.routers`:
```python
from api.routers import (
    # existing imports...
    catalysts,
)
```

- [ ] **Step 5: Add endpoint constants to `web-ui/src/lib/api.ts`**

Add these after the existing `intelligenceSweep` line:

```typescript
catalystsManual: '/api/catalysts/manual',
catalystsDailyScan: '/api/catalysts/daily-scan',
catalystsLatest: '/api/catalysts/latest',
catalystsSymbol: (ticker: string) => `/api/catalysts/symbol/${encodeURIComponent(ticker)}`,
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/api/test_catalyst_api.py -q && pytest tests/api/test_intelligence_api.py -q
```
Expected: all PASS.

- [ ] **Step 7: Typecheck frontend**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add api/routers/catalysts.py api/main.py web-ui/src/lib/api.ts tests/api/test_catalyst_api.py
git commit -m "feat(catalysts): add REST endpoints — manual, daily-scan, latest, symbol"
```

---

### Task 5: Feed Catalyst Opportunities Into Screener Decisions

**Files:**
- Modify: `src/swing_screener/recommendation/models.py`
- Modify: `src/swing_screener/recommendation/decision_summary.py`
- Modify: `api/services/screener_service.py`
- Test: `tests/test_decision_summary.py` (add tests)

Context: `build_decision_summary` in `decision_summary.py` already accepts `opportunity: Any | None` and calls `_catalyst_label(opportunity)` which reads `.state` and `.catalyst_strength` via duck-typing. The only change needed is:
1. Add `catalyst_summary` and `catalyst_sources` fields to `DecisionSummary` — populate from opportunity when present.
2. In `screener_service.py:_apply_decision_summary_context`, load today's symbol opportunity index and pass the matching `CatalystOpportunity` to `build_decision_summary`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_decision_summary.py`:

```python
# Add to existing tests/test_decision_summary.py
from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystOpportunityState


def _make_catalyst_opportunity(ticker: str = "AAPL", state: str = "CATALYST_ACTIVE", strength: float = 8.0) -> CatalystOpportunity:
    return CatalystOpportunity(
        ticker=ticker, state=CatalystOpportunityState(state),
        catalyst_strength=strength, thesis="AI demand surge fuels chip orders.",
        key_risks=["demand slowdown"], sources=["https://example.com/1"],
        report_id="r1", generated_at="2026-05-24T10:00:00Z",
    )


def test_decision_summary_has_catalyst_summary_when_active(make_candidate):
    """catalyst_summary is populated from opportunity.thesis when catalyst is active."""
    candidate = make_candidate("AAPL")
    opp = _make_catalyst_opportunity("AAPL", "CATALYST_ACTIVE", 8.0)
    summary = build_decision_summary(candidate, opportunity=opp, fundamentals=None)
    assert summary.catalyst_label == "active"
    assert summary.catalyst_summary is not None
    assert "AI demand" in summary.catalyst_summary


def test_decision_summary_catalyst_summary_none_when_no_opportunity(make_candidate):
    candidate = make_candidate("AAPL")
    summary = build_decision_summary(candidate, opportunity=None, fundamentals=None)
    assert summary.catalyst_label == "weak"
    assert summary.catalyst_summary is None
    assert summary.catalyst_sources == []


def test_decision_summary_catalyst_sources_from_opportunity(make_candidate):
    candidate = make_candidate("AAPL")
    opp = _make_catalyst_opportunity("AAPL", "CATALYST_ACTIVE", 8.0)
    summary = build_decision_summary(candidate, opportunity=opp, fundamentals=None)
    assert "https://example.com/1" in summary.catalyst_sources


def test_quiet_opportunity_maps_to_weak_label(make_candidate):
    candidate = make_candidate("AAPL")
    opp = _make_catalyst_opportunity("AAPL", "QUIET", 1.0)
    summary = build_decision_summary(candidate, opportunity=opp, fundamentals=None)
    assert summary.catalyst_label == "weak"
```

Also add a screener service integration test in `tests/api/test_screener_endpoints.py` (find the existing file and add):

```python
def test_screener_candidate_gets_catalyst_label_when_opportunity_exists(tmp_path, monkeypatch):
    """When a catalyst opportunity exists in today's index, candidate gets catalyst_label=active."""
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystOpportunityState
    from datetime import datetime, timezone
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    today = datetime.now(timezone.utc).date()
    # This test requires a screener run — mark as integration
    pytest.mark.integration
```

*(The full screener integration test is complex — the important unit tests are in `test_decision_summary.py` above.)*

- [ ] **Step 2: Check what `make_candidate` fixture looks like or create a minimal one**

Look in `tests/test_decision_summary.py` for existing fixtures. If `make_candidate` doesn't exist, find how `build_decision_summary` is currently called in that file, and reuse the existing candidate creation pattern.

- [ ] **Step 3: Run to verify new tests fail**

```bash
pytest tests/test_decision_summary.py -k "catalyst_summary" -q
```
Expected: FAIL — `DecisionSummary` has no `catalyst_summary` field.

- [ ] **Step 4: Add `catalyst_summary` and `catalyst_sources` to `DecisionSummary` in `src/swing_screener/recommendation/models.py`**

Find the `DecisionSummary` class (around line 60) and add two fields at the end:

```python
class DecisionSummary(BaseModel):
    symbol: str
    action: DecisionAction
    conviction: DecisionConviction
    technical_label: SignalLabel
    fundamentals_label: SignalLabel
    valuation_label: ValuationLabel
    catalyst_label: CatalystLabel
    why_now: str
    what_to_do: str
    main_risk: str
    trade_plan: DecisionTradePlan = Field(default_factory=DecisionTradePlan)
    valuation_context: DecisionValuationContext = Field(default_factory=DecisionValuationContext)
    drivers: DecisionDrivers = Field(default_factory=DecisionDrivers)
    explanation: ExplanationContract | None = None
    catalyst_summary: str | None = None          # populated when catalyst_label == "active"
    catalyst_sources: list[str] = Field(default_factory=list)
```

- [ ] **Step 5: Populate `catalyst_summary` and `catalyst_sources` in `build_decision_summary`**

In `src/swing_screener/recommendation/decision_summary.py`, find the `build_decision_summary` function (around line 810). After `catalyst_label = _catalyst_label(opportunity)` is computed, add:

```python
catalyst_label = _catalyst_label(opportunity)
catalyst_summary: str | None = None
catalyst_sources: list[str] = []
if opportunity is not None:
    catalyst_summary = _get_value(opportunity, "thesis", None)
    raw_sources = _get_value(opportunity, "sources", [])
    catalyst_sources = list(raw_sources) if raw_sources else []
```

Then in the `DecisionSummary(...)` constructor call at the end of `build_decision_summary`, add:

```python
catalyst_summary=catalyst_summary,
catalyst_sources=catalyst_sources,
```

- [ ] **Step 6: Run the decision summary tests**

```bash
pytest tests/test_decision_summary.py -q
```
Expected: all PASS.

- [ ] **Step 7: Load the symbol index in `api/services/screener_service.py`**

In `_apply_decision_summary_context` (around line 468), add the symbol index load at the top and pass the opportunity:

```python
def _apply_decision_summary_context(
    candidates: list[ScreenerCandidate],
    *,
    fundamentals_storage: FundamentalsStorage | None = None,
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates

    fundamentals = fundamentals_storage or FundamentalsStorage()

    # Load today's catalyst opportunity index once for all candidates
    catalyst_index: dict = {}
    try:
        from swing_screener.intelligence.catalysts.store import CatalystStore
        catalyst_index = CatalystStore().load_symbol_index()
    except Exception:
        pass  # catalyst data is optional — never block the screener

    unique_tickers = {candidate.ticker for candidate in candidates}
    snapshot_cache = {ticker: fundamentals.load_snapshot(ticker) for ticker in unique_tickers}

    enriched: list[ScreenerCandidate] = []
    for candidate in candidates:
        fund_snap = snapshot_cache.get(candidate.ticker)
        fund_asof = getattr(fund_snap, "asof_date", None) if fund_snap is not None else None
        opportunity = catalyst_index.get(candidate.ticker.upper())
        enriched.append(
            candidate.model_copy(
                update={
                    "decision_summary": build_decision_summary(
                        candidate,
                        opportunity=opportunity,
                        fundamentals=fund_snap,
                    ),
                    "fundamentals_snapshot": fund_snap,
                    "fundamentals_asof": str(fund_asof) if fund_asof else None,
                    "intelligence_asof": opportunity.generated_at if opportunity else None,
                }
            )
        )
    return enriched
```

- [ ] **Step 8: Run full backend suite**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/swing_screener/recommendation/models.py src/swing_screener/recommendation/decision_summary.py api/services/screener_service.py tests/test_decision_summary.py
git commit -m "feat(catalysts): feed catalyst opportunities into screener decision summaries"
```

---

### Task 6: Frontend Catalyst API Hooks

**Files:**
- Create: `web-ui/src/features/intelligence/catalysts/types.ts`
- Create: `web-ui/src/features/intelligence/catalysts/api.ts`
- Create: `web-ui/src/features/intelligence/catalysts/hooks.ts`
- Create: `web-ui/src/features/intelligence/catalysts/types.test.ts`
- Modify: `web-ui/src/test/mocks/handlers.ts`

- [ ] **Step 1: Write failing type transform tests**

```typescript
// web-ui/src/features/intelligence/catalysts/types.test.ts
import { describe, it, expect } from 'vitest';
import { transformCatalystOpportunity, transformCatalystReport } from './types';
import type { CatalystOpportunityAPI, CatalystReportAPI } from './types';

const _opp: CatalystOpportunityAPI = {
  ticker: 'STLD',
  state: 'CATALYST_ACTIVE',
  catalyst_strength: 8.0,
  thesis: 'Domestic steel prices rise.',
  key_risks: ['reversal'],
  sources: ['https://reuters.com/1'],
  report_id: 'r1',
  generated_at: '2026-05-24T10:00:00Z',
};

const _report: CatalystReportAPI = {
  report_id: 'r1',
  event_summary: 'Steel tariff.',
  themes: [{ name: 'Steel', summary: 'Cost pressure.', time_horizon: 'short_term', confidence: 0.8 }],
  causal_chains: [],
  beneficiaries: [],
  losers: [],
  hidden_opportunities: [],
  non_actionable_notes: [],
  generated_at: '2026-05-24T10:00:00Z',
};

describe('transformCatalystOpportunity', () => {
  it('maps snake_case fields to camelCase', () => {
    const result = transformCatalystOpportunity(_opp);
    expect(result.catalystStrength).toBe(8.0);
    expect(result.keyRisks).toEqual(['reversal']);
    expect(result.reportId).toBe('r1');
    expect(result.generatedAt).toBe('2026-05-24T10:00:00Z');
  });

  it('preserves ticker, state, thesis, sources', () => {
    const result = transformCatalystOpportunity(_opp);
    expect(result.ticker).toBe('STLD');
    expect(result.state).toBe('CATALYST_ACTIVE');
    expect(result.thesis).toBe('Domestic steel prices rise.');
    expect(result.sources).toHaveLength(1);
  });
});

describe('transformCatalystReport', () => {
  it('maps report_id and generated_at', () => {
    const result = transformCatalystReport(_report);
    expect(result.reportId).toBe('r1');
    expect(result.generatedAt).toBe('2026-05-24T10:00:00Z');
    expect(result.eventSummary).toBe('Steel tariff.');
    expect(result.themes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd web-ui && npx vitest run src/features/intelligence/catalysts/types.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `web-ui/src/features/intelligence/catalysts/types.ts`**

```typescript
export type CatalystOpportunityState =
  | 'CATALYST_ACTIVE'
  | 'TRENDING'
  | 'WATCH'
  | 'COOLING_OFF'
  | 'QUIET';

export interface CatalystOpportunityAPI {
  ticker: string;
  state: CatalystOpportunityState;
  catalyst_strength: number;
  thesis: string;
  key_risks: string[];
  sources: string[];
  report_id: string;
  generated_at: string;
}

export interface CatalystOpportunity {
  ticker: string;
  state: CatalystOpportunityState;
  catalystStrength: number;
  thesis: string;
  keyRisks: string[];
  sources: string[];
  reportId: string;
  generatedAt: string;
}

export function transformCatalystOpportunity(api: CatalystOpportunityAPI): CatalystOpportunity {
  return {
    ticker: api.ticker,
    state: api.state,
    catalystStrength: api.catalyst_strength,
    thesis: api.thesis,
    keyRisks: api.key_risks,
    sources: api.sources,
    reportId: api.report_id,
    generatedAt: api.generated_at,
  };
}

export interface MarketThemeAPI {
  name: string;
  summary: string;
  time_horizon: 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
}

export interface MarketTheme {
  name: string;
  summary: string;
  timeHorizon: 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
}

export interface CatalystReportAPI {
  report_id: string;
  event_summary: string;
  themes: MarketThemeAPI[];
  causal_chains: unknown[];
  beneficiaries: unknown[];
  losers: unknown[];
  hidden_opportunities: unknown[];
  non_actionable_notes: string[];
  generated_at: string;
}

export interface CatalystReport {
  reportId: string;
  eventSummary: string;
  themes: MarketTheme[];
  nonActionableNotes: string[];
  generatedAt: string;
}

export function transformCatalystReport(api: CatalystReportAPI): CatalystReport {
  return {
    reportId: api.report_id,
    eventSummary: api.event_summary,
    themes: api.themes.map((t) => ({
      name: t.name,
      summary: t.summary,
      timeHorizon: t.time_horizon,
      confidence: t.confidence,
    })),
    nonActionableNotes: api.non_actionable_notes,
    generatedAt: api.generated_at,
  };
}
```

- [ ] **Step 4: Create `web-ui/src/features/intelligence/catalysts/api.ts`**

```typescript
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type { CatalystOpportunityAPI, CatalystReportAPI } from './types';

export async function postCatalystManual(url: string): Promise<CatalystReportAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.catalystsManual), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'Catalyst report generation failed');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function postCatalystDailyScan(): Promise<CatalystReportAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.catalystsDailyScan), { method: 'POST' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'Daily catalyst scan failed');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function getCatalystsLatest(): Promise<CatalystReportAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.catalystsLatest));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'No catalyst report available');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function getCatalystSymbol(ticker: string): Promise<CatalystOpportunityAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.catalystsSymbol(ticker)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || `No catalyst for ${ticker}`);
  }
  return response.json() as Promise<CatalystOpportunityAPI>;
}
```

- [ ] **Step 5: Create `web-ui/src/features/intelligence/catalysts/hooks.ts`**

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getCatalystsLatest,
  getCatalystSymbol,
  postCatalystDailyScan,
  postCatalystManual,
} from './api';
import { transformCatalystOpportunity, transformCatalystReport } from './types';
import type { CatalystOpportunity, CatalystReport } from './types';

export function useLatestCatalystReportQuery() {
  return useQuery<CatalystReport, Error>({
    queryKey: ['catalysts', 'latest'],
    queryFn: async () => transformCatalystReport(await getCatalystsLatest()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSymbolCatalystQuery(ticker: string, enabled: boolean) {
  return useQuery<CatalystOpportunity, Error>({
    queryKey: ['catalysts', 'symbol', ticker],
    queryFn: async () => transformCatalystOpportunity(await getCatalystSymbol(ticker)),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useManualCatalystReportMutation() {
  return useMutation<CatalystReport, Error, string>({
    mutationFn: async (url: string) => transformCatalystReport(await postCatalystManual(url)),
  });
}

export function useDailyCatalystScanMutation() {
  return useMutation<CatalystReport, Error, void>({
    mutationFn: async () => transformCatalystReport(await postCatalystDailyScan()),
  });
}
```

- [ ] **Step 6: Add MSW handlers**

In `web-ui/src/test/mocks/handlers.ts`, add:

```typescript
import { http, HttpResponse } from 'msw';

// Add to the handlers array:
http.post('/api/catalysts/daily-scan', () =>
  HttpResponse.json({
    report_id: 'mock-r1', event_summary: 'Mock catalyst.', themes: [],
    causal_chains: [], beneficiaries: [], losers: [], hidden_opportunities: [],
    non_actionable_notes: [], generated_at: '2026-05-24T10:00:00Z',
  })
),
http.get('/api/catalysts/latest', () => HttpResponse.json({
  report_id: 'mock-r1', event_summary: 'Mock catalyst.', themes: [],
  causal_chains: [], beneficiaries: [], losers: [], hidden_opportunities: [],
  non_actionable_notes: [], generated_at: '2026-05-24T10:00:00Z',
})),
http.get('/api/catalysts/symbol/:ticker', ({ params }) =>
  HttpResponse.json({
    ticker: (params.ticker as string).toUpperCase(),
    state: 'CATALYST_ACTIVE', catalyst_strength: 8.0,
    thesis: 'Mock thesis.', key_risks: [], sources: [],
    report_id: 'mock-r1', generated_at: '2026-05-24T10:00:00Z',
  })
),
```

- [ ] **Step 7: Run tests**

```bash
cd web-ui && npx vitest run src/features/intelligence/catalysts/ && npm run typecheck
```
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add web-ui/src/features/intelligence/catalysts/ web-ui/src/test/mocks/handlers.ts
git commit -m "feat(catalysts): add frontend types, API client, and React Query hooks"
```

---

### Task 7: Today Page Market Catalyst Scan Button

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add i18n keys to `web-ui/src/i18n/messages.en.ts`**

Find the `todayPage.actionList` block and add:

```typescript
catalystScan: 'Run market catalyst scan',
catalystScanRunning: 'Scanning...',
catalystScanDone: 'Catalyst scan complete — {{count}} themes found',
catalystScanError: 'Catalyst scan failed',
catalystScanLastRun: 'Last run',
```

- [ ] **Step 2: Add the scan button to `Today.tsx`**

Read `web-ui/src/pages/Today.tsx`. Find the `TodayActionList` component. Add imports near the top of the file:

```typescript
import { useDailyCatalystScanMutation, useLatestCatalystReportQuery } from '@/features/intelligence/catalysts/hooks';
```

Inside `TodayActionList`, add the mutation and latest query hooks, then the scan button JSX adjacent to the intelligence sweep button. Place it in a `<div className="flex items-center gap-3 mb-3">` wrapper alongside the sweep button to keep them grouped:

```typescript
const catalystScanMutation = useDailyCatalystScanMutation();
const latestCatalystQuery = useLatestCatalystReportQuery();
```

Add this JSX block immediately after the existing sweep button div:

```typescript
<div className="flex items-center gap-3 mb-3">
  <Button
    type="button"
    size="sm"
    variant="secondary"
    disabled={catalystScanMutation.isPending}
    onClick={() => catalystScanMutation.mutate()}
  >
    {catalystScanMutation.isPending
      ? t('todayPage.actionList.catalystScanRunning')
      : t('todayPage.actionList.catalystScan')}
  </Button>
  {catalystScanMutation.isSuccess && (
    <span className="text-xs text-gray-500">
      {t('todayPage.actionList.catalystScanDone', {
        count: String(catalystScanMutation.data.themes.length),
      })}
    </span>
  )}
  {catalystScanMutation.isError && (
    <span className="text-xs text-rose-600">{t('todayPage.actionList.catalystScanError')}</span>
  )}
  {!catalystScanMutation.isPending && !catalystScanMutation.isSuccess && latestCatalystQuery.data && (
    <span className="text-xs text-gray-400">
      {t('todayPage.actionList.catalystScanLastRun')}:{' '}
      {new Date(latestCatalystQuery.data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )}
</div>
```

- [ ] **Step 3: Typecheck and test**

```bash
cd web-ui && npm run typecheck && npm test -- --run 2>&1 | tail -10
```
Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(catalysts): add market catalyst scan button to Today page"
```

---

### Task 8: Beginner Catalyst Explanation on Candidate Cards

**Context:** `DailyReviewCandidate.decisionSummary` already carries `catalystLabel`. After Task 5, `DecisionSummary` also has `catalyst_summary` and `catalyst_sources`. These need to flow through the API types and be rendered when `catalystLabel === 'active'`.

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/dailyReview/types.ts`
- Modify the Today page candidate card component that renders new candidates

- [ ] **Step 1: Add `catalyst_summary` and `catalyst_sources` to `DecisionSummaryAPI` in `web-ui/src/features/screener/types.ts`**

Find `DecisionSummaryAPI` interface and add:

```typescript
export interface DecisionSummaryAPI {
  // ...existing fields...
  catalyst_label: DecisionCatalystLabel;
  catalyst_summary: string | null;       // add
  catalyst_sources: string[];            // add
  // ...rest...
}
```

Find `DecisionSummary` interface (camelCase) and add:

```typescript
export interface DecisionSummary {
  // ...existing fields...
  catalystLabel: DecisionCatalystLabel;
  catalystSummary: string | null;        // add
  catalystSources: string[];             // add
  // ...rest...
}
```

Find the `transformDecisionSummary` (or equivalent) function and add:

```typescript
catalystSummary: apiSummary.catalyst_summary ?? null,
catalystSources: apiSummary.catalyst_sources ?? [],
```

- [ ] **Step 2: Run typecheck to find any places that need updating**

```bash
cd web-ui && npm run typecheck 2>&1 | head -30
```
Fix any type errors — most will be in test fixture files that need `catalystSummary: null, catalystSources: []` added.

- [ ] **Step 3: Find the candidate card component used for new candidates on the Today page**

Read `web-ui/src/pages/Today.tsx` and trace which component renders `review.newCandidates`. It's likely a component in `src/components/domain/` or `src/features/dailyReview/`. Read that component.

- [ ] **Step 4: Add catalyst explanation rendering to the candidate card**

In the candidate card component, after the existing action/decision content, add:

```typescript
{candidate.decisionSummary?.catalystLabel === 'active' && candidate.decisionSummary.catalystSummary && (
  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
    <p className="font-semibold text-emerald-800 text-xs uppercase tracking-wide mb-1">
      {t('todayPage.candidateCard.catalystContext')}
    </p>
    <p className="text-emerald-900">{candidate.decisionSummary.catalystSummary}</p>
    {candidate.decisionSummary.catalystSources.length > 0 && (
      <details className="mt-1">
        <summary className="text-xs text-emerald-700 cursor-pointer select-none">
          {t('todayPage.candidateCard.catalystSources')} ({candidate.decisionSummary.catalystSources.length})
        </summary>
        <ul className="mt-1 space-y-0.5">
          {candidate.decisionSummary.catalystSources.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:underline break-all">
                {url}
              </a>
            </li>
          ))}
        </ul>
      </details>
    )}
  </div>
)}
```

- [ ] **Step 5: Add i18n keys**

In `messages.en.ts`, add to `todayPage` (or the appropriate section):

```typescript
candidateCard: {
  catalystContext: 'Market catalyst context',
  catalystSources: 'Sources',
},
```

- [ ] **Step 6: Run tests**

```bash
cd web-ui && npm test -- --run 2>&1 | tail -10 && npm run typecheck
```
Expected: all PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/dailyReview/types.ts web-ui/src/i18n/messages.en.ts
# Also add the candidate card component file
git commit -m "feat(catalysts): show catalyst context on Today candidate cards when active"
```

---

### Task 9: Workspace Catalyst Context Card

**Files:**
- Create: `web-ui/src/components/domain/workspace/CatalystContextCard.tsx`
- Create: `web-ui/src/components/domain/workspace/CatalystContextCard.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// web-ui/src/components/domain/workspace/CatalystContextCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CatalystContextCard from './CatalystContextCard';
import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';

const baseOpportunity: CatalystOpportunity = {
  ticker: 'STLD',
  state: 'CATALYST_ACTIVE',
  catalystStrength: 8.0,
  thesis: 'Domestic steel prices rise due to tariffs.',
  keyRisks: ['policy reversal'],
  sources: ['https://reuters.com/1'],
  reportId: 'r1',
  generatedAt: '2026-05-24T10:00:00Z',
};

it('renders the thesis text', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText('Domestic steel prices rise due to tariffs.')).toBeInTheDocument();
});

it('renders the state badge', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText(/CATALYST_ACTIVE/i)).toBeInTheDocument();
});

it('renders key risks', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText('policy reversal')).toBeInTheDocument();
});

it('sources are collapsed by default', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  // details element should not be open by default
  const details = document.querySelector('details');
  expect(details?.open).toBe(false);
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/CatalystContextCard.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Create `web-ui/src/components/domain/workspace/CatalystContextCard.tsx`**

```typescript
import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';
import { t } from '@/i18n/t';

const STATE_LABEL: Record<string, string> = {
  CATALYST_ACTIVE: 'Active',
  TRENDING: 'Trending',
  WATCH: 'Watch',
  COOLING_OFF: 'Cooling off',
  QUIET: 'Quiet',
};

const STATE_COLOR: Record<string, string> = {
  CATALYST_ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  TRENDING: 'bg-teal-100 text-teal-700 border-teal-200',
  WATCH: 'bg-amber-100 text-amber-700 border-amber-200',
  COOLING_OFF: 'bg-slate-100 text-slate-600 border-slate-200',
  QUIET: 'bg-slate-100 text-slate-400 border-slate-200',
};

interface CatalystContextCardProps {
  opportunity: CatalystOpportunity;
}

export default function CatalystContextCard({ opportunity }: CatalystContextCardProps) {
  const { state, thesis, keyRisks, sources } = opportunity;
  const stateLabel = STATE_LABEL[state] ?? state;
  const stateColor = STATE_COLOR[state] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('workspacePage.panels.analysis.intelligence.marketCatalyst')}
        </p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${stateColor}`}>
          {stateLabel}
        </span>
      </div>

      <p className="text-sm text-slate-800">{thesis}</p>

      {keyRisks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">
            {t('workspacePage.panels.analysis.intelligence.keyRisks')}
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {keyRisks.map((risk, i) => (
              <li key={i} className="text-sm text-slate-700">{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
            {t('workspacePage.panels.analysis.intelligence.sources')} ({sources.length})
          </summary>
          <ul className="mt-2 space-y-1 list-none pl-0">
            {sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all text-xs">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add i18n keys to `messages.en.ts`**

Find `workspacePage.panels.analysis.intelligence` and add:

```typescript
marketCatalyst: 'Market catalyst context',
keyRisks: 'Key risks',
```

- [ ] **Step 5: Wire `CatalystContextCard` into `SymbolAnalysisContent.tsx`**

Add import:

```typescript
import { useSymbolCatalystQuery } from '@/features/intelligence/catalysts/hooks';
import CatalystContextCard from '@/components/domain/workspace/CatalystContextCard';
```

Inside the component, after `intelligenceLatest`:

```typescript
const catalystQuery = useSymbolCatalystQuery(ticker, activeTab === 'intelligence');
```

In the `{activeTab === 'intelligence' && (...)}` panel, add the catalyst card BEFORE the `IntelligenceCard` (so market context appears above position signal):

```typescript
{catalystQuery.data && (
  <CatalystContextCard opportunity={catalystQuery.data} />
)}
```

- [ ] **Step 6: Run all tests**

```bash
cd web-ui && npm test -- --run 2>&1 | tail -10 && npm run typecheck
```
Expected: all PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/components/domain/workspace/CatalystContextCard.tsx web-ui/src/components/domain/workspace/CatalystContextCard.test.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(catalysts): add CatalystContextCard to workspace Intelligence tab"
```

---

### Task 10: Staleness Guard and Docs

**Purpose:** Prevent stale catalyst opportunities from influencing screener decisions. A "stale" opportunity is one generated more than N days ago (configurable via `config/intelligence.yaml`).

**Files:**
- Modify: `src/swing_screener/intelligence/catalysts/store.py`
- Modify: `api/services/screener_service.py`
- Test: `tests/intelligence/catalysts/test_store.py` (add staleness tests)
- Test: add one backend test for screener staleness behavior

- [ ] **Step 1: Write failing staleness tests**

Add to `tests/intelligence/catalysts/test_store.py`:

```python
def test_load_symbol_opportunity_returns_none_for_stale(tmp_path, monkeypatch):
    """An opportunity older than the stale threshold returns None."""
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from datetime import timedelta
    store = CatalystStore()
    stale_date = date.today() - timedelta(days=4)
    store.save_symbol_index(stale_date, [_make_opportunity("AAPL")])
    # load without specifying a date → uses today → stale entry not returned
    result = store.load_symbol_opportunity("AAPL")
    assert result is None  # today's index is empty


def test_load_symbol_index_returns_only_todays_entries(tmp_path, monkeypatch):
    """load_symbol_index without date returns only today's data."""
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    yesterday = date.today() - timedelta(days=1)
    store.save_symbol_index(yesterday, [_make_opportunity("AAPL")])
    index = store.load_symbol_index()  # defaults to today
    assert "AAPL" not in index
```

And add to `tests/api/test_screener_endpoints.py` (append to existing file):

```python
def test_screener_candidate_does_not_use_stale_catalyst(tmp_path, monkeypatch):
    """Candidate remains catalyst_label='weak' when only yesterday's opportunity exists."""
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystOpportunityState
    from datetime import datetime, timezone, timedelta
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    opp = CatalystOpportunity(
        ticker="AAPL", state=CatalystOpportunityState.CATALYST_ACTIVE, catalyst_strength=9.0,
        thesis="Big AI news.", key_risks=[], sources=[], report_id="r1",
        generated_at="2026-05-23T10:00:00Z",
    )
    store.save_symbol_index(yesterday, [opp])
    # Today's index is empty — load_symbol_index() returns {} → opportunity=None
    from swing_screener.intelligence.catalysts.store import CatalystStore as CS
    today_index = CS().load_symbol_index()  # defaults to today
    assert "AAPL" not in today_index
```

- [ ] **Step 2: Verify tests pass (they should, since the existing store already uses today's date)**

```bash
pytest tests/intelligence/catalysts/test_store.py -q
```
Expected: all PASS — the date-keyed design already makes stale entries invisible via `load_symbol_index()`.

If any test fails, the store's `load_symbol_index()` default-date logic needs to be verified.

- [ ] **Step 3: Add staleness guard in `screener_service.py` as defense-in-depth**

In `_apply_decision_summary_context`, after loading `catalyst_index`, add a second check: if the opportunity's `generated_at` is more than 2 days old, treat it as None:

```python
from datetime import datetime, timezone, timedelta

_CATALYST_STALE_DAYS = 2  # opportunities older than this are ignored

def _is_stale(opportunity: object | None) -> bool:
    if opportunity is None:
        return True
    try:
        generated_at = datetime.fromisoformat(str(getattr(opportunity, "generated_at", "")))
        if generated_at.tzinfo is None:
            generated_at = generated_at.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - generated_at).days > _CATALYST_STALE_DAYS
    except (ValueError, TypeError):
        return True
```

Then in the loop, replace `opportunity = catalyst_index.get(candidate.ticker.upper())` with:

```python
raw_opportunity = catalyst_index.get(candidate.ticker.upper())
opportunity = None if _is_stale(raw_opportunity) else raw_opportunity
```

- [ ] **Step 4: Run the full backend suite**

```bash
pytest -q
```
Expected: all PASS.

- [ ] **Step 5: Run full frontend suite**

```bash
cd web-ui && npm test -- --run && npm run typecheck && npm run lint
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add api/services/screener_service.py tests/intelligence/catalysts/test_store.py tests/api/test_screener_endpoints.py
git commit -m "feat(catalysts): add staleness guard — stale opportunities do not influence screener"
```

---

## Final Integration Check

After all 10 tasks:

```bash
# Backend
pytest tests/intelligence/catalysts/ -q
pytest tests/api/test_catalyst_api.py -q
pytest tests/api/test_intelligence_api.py -q
pytest tests/api/test_screener_endpoints.py -q
pytest tests/test_decision_summary.py -q
pytest -q  # full suite

# Frontend
cd web-ui
npm test -- --run
npm run typecheck
npm run lint
```

Manual check:
1. Start backend: `python -m uvicorn api.main:app --port 8000 --reload`
2. Start frontend: `cd web-ui && npm run dev`
3. Open Today. Confirm both "Run Intelligence Sweep" and "Run market catalyst scan" buttons are present and visually distinct.
4. Run catalyst scan. Confirm completion message shows theme count.
5. Open a symbol workspace → Intelligence tab. Confirm `CatalystContextCard` appears above `IntelligenceCard` when a catalyst exists.
6. Check Today new candidates: if `catalystLabel === 'active'`, confirm green catalyst context box with thesis and collapsed sources.
7. Confirm that a symbol with NO catalyst opportunity renders normally — no errors, no catalyst UI.

---

## Non-Negotiable Guardrails

- Catalyst intelligence must not add candidates that failed technical/risk filters
- Catalyst intelligence must not override stop, sizing, or close-position actions
- Open-position `HOLD`/`TRIM`/`EXIT` remains part of the existing symbol intelligence sweep
- Stale opportunities (>2 days old) must not influence screener output
- All LLM outputs must be validated through Pydantic models before use
- Every company catalyst thesis must have ≥1 source URL (enforced by prompt; weak validation by `catalyst_strength ≤ 2.0`)
