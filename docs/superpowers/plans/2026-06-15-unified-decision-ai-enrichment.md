# Unified Decision View + Full-Data AI Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the symbol canvas show one screener-owned verdict with a unified "what to do & why" view, while the LLM always receives the full data context (fundamentals + Finnhub + earnings) and uses multi-hop live news plus a forward-catalyst pass.

**Architecture:** The deterministic screener owns the headline verdict; the LLM is enrichment displayed below, flagged as a second opinion when it disagrees. A server-side enricher fills any missing fundamentals/Finnhub/earnings on the `SymbolIntelligenceRequest` before the LLM call (blocking), so both the API and CLI paths get full data. The prompt gains a raw-fundamentals block and a multi-hop + catalyst search instruction.

**Tech Stack:** Python 3 / FastAPI / pydantic / pytest (backend); React 18 / TypeScript / Zustand / React Query / Vitest / i18n (frontend); OpenAI Responses API with `web_search_preview`.

**Spec:** `docs/superpowers/specs/2026-06-15-unified-decision-ai-enrichment-design.md`

**Branch:** `feat/unified-decision-ai-enrichment` (already created off `main`).

**Conventions:** Run `pytest -m "not integration" -q` for backend; `cd web-ui && npm test && npm run typecheck && npm run lint` for frontend. `pytest` invoked from shell is **system python** — use `.venv/bin/python -m pytest` to match the server interpreter. All UI strings via `web-ui/src/i18n/messages.en.ts`; assert via i18n keys, never hardcoded copy. API model change + web type change in the same PR (this plan).

---

## File Structure

**Backend**
- Modify: `src/swing_screener/intelligence/models.py` — add raw-fundamentals fields to `SymbolIntelligenceRequest`.
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py` — fundamentals prompt block + multi-hop/catalyst `_SYSTEM_PROMPT`.
- Modify: `config/intelligence.yaml` — bump `web_search_max_tokens`.
- Modify: `api/models/fundamentals.py` — expose Finnhub fields on `FundamentalSnapshotResponse`.
- Create: `api/services/intelligence_enrichment.py` — request enricher.
- Modify: `api/routers/intelligence.py` — call enricher in `analyze_symbol`.
- Tests: `tests/test_intelligence_prompt.py` (new), `tests/test_intelligence_enrichment.py` (new), `tests/test_fundamentals_api.py` (extend if present, else new assertions).

**Frontend**
- Modify: `web-ui/src/i18n/messages.en.ts` — new keys.
- Modify: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx` — remove action banner, add inline second-opinion note.
- Create: `web-ui/src/components/domain/workspace/DecisionWhyPanel.tsx` — unified "what to do & why" panel.
- Create: `web-ui/src/components/domain/workspace/FundamentalsStrip.tsx` — compact overview fundamentals strip.
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — overview ordering.
- Tests: co-located `*.test.tsx` for each new/changed component.

**Docs**
- Modify: `src/swing_screener/intelligence/README.md`, `config/README.md`, `web-ui/docs/WEB_UI_GUIDE.md`, `api/README.md`.

---

## Task 1: Add raw-fundamentals fields to `SymbolIntelligenceRequest`

**Files:**
- Modify: `src/swing_screener/intelligence/models.py:82-129`
- Test: `tests/test_intelligence_prompt.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/test_intelligence_prompt.py`:

```python
from swing_screener.intelligence.models import SymbolIntelligenceRequest


def test_request_accepts_raw_fundamentals_fields():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="breakout",
        trailing_pe=22.5,
        revenue_growth_yoy=0.18,
        gross_margin=0.46,
        net_margin=0.21,
        return_on_equity=0.30,
        debt_to_equity=0.8,
    )
    assert req.trailing_pe == 22.5
    assert req.revenue_growth_yoy == 0.18
    assert req.gross_margin == 0.46
    assert req.net_margin == 0.21
    assert req.return_on_equity == 0.30
    assert req.debt_to_equity == 0.8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py::test_request_accepts_raw_fundamentals_fields -q`
Expected: FAIL — pydantic rejects unknown fields / `AttributeError`.

- [ ] **Step 3: Add the fields**

In `src/swing_screener/intelligence/models.py`, inside `SymbolIntelligenceRequest`, after the existing `fundamentals_label` line (currently line 112) add:

```python
    # Raw fundamentals (filled by the server-side enricher when absent)
    trailing_pe: float | None = None
    revenue_growth_yoy: float | None = None
    gross_margin: float | None = None
    net_margin: float | None = None
    return_on_equity: float | None = None
    debt_to_equity: float | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py::test_request_accepts_raw_fundamentals_fields -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/models.py tests/test_intelligence_prompt.py
git commit -m "feat(intelligence): add raw-fundamentals fields to request model"
```

---

## Task 2: Render a fundamentals block in the prompt

**Files:**
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py:176-188` (after the technical block)
- Test: `tests/test_intelligence_prompt.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_intelligence_prompt.py`:

```python
from swing_screener.intelligence.symbol_analyzer import _build_user_prompt


def test_prompt_includes_fundamentals_block():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="breakout",
        trailing_pe=22.5,
        revenue_growth_yoy=0.18,
        gross_margin=0.46,
        return_on_equity=0.30,
        debt_to_equity=0.8,
    )
    prompt = _build_user_prompt("AAPL", req)
    assert "--- Fundamentals ---" in prompt
    assert "P/E: 22.50" in prompt
    assert "Revenue growth YoY: 18.0%" in prompt
    assert "Gross margin: 46.0%" in prompt


def test_prompt_omits_fundamentals_block_when_absent():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req)
    assert "--- Fundamentals ---" not in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py -q`
Expected: FAIL on `test_prompt_includes_fundamentals_block` — block not present.

- [ ] **Step 3: Implement the block**

In `src/swing_screener/intelligence/symbol_analyzer.py`, immediately after the technical-context block that ends with the `req.recent_patterns` handling (after current line 188, before `if not has_position:` at line 190), insert:

```python
    has_fundamentals = any(
        x is not None
        for x in (
            req.trailing_pe,
            req.revenue_growth_yoy,
            req.gross_margin,
            req.net_margin,
            req.return_on_equity,
            req.debt_to_equity,
        )
    )
    if has_fundamentals:
        def _pct(v: float | None) -> str | None:
            return f"{v * 100:.1f}%" if v is not None else None

        fund_parts = [
            f"P/E: {req.trailing_pe:.2f}" if req.trailing_pe is not None else None,
            f"Revenue growth YoY: {_pct(req.revenue_growth_yoy)}" if req.revenue_growth_yoy is not None else None,
            f"Gross margin: {_pct(req.gross_margin)}" if req.gross_margin is not None else None,
            f"Net margin: {_pct(req.net_margin)}" if req.net_margin is not None else None,
            f"ROE: {_pct(req.return_on_equity)}" if req.return_on_equity is not None else None,
            f"Debt/Equity: {req.debt_to_equity:.2f}" if req.debt_to_equity is not None else None,
        ]
        lines += ["", "--- Fundamentals ---", " | ".join(p for p in fund_parts if p)]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py -q`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/symbol_analyzer.py tests/test_intelligence_prompt.py
git commit -m "feat(intelligence): render raw fundamentals block in prompt"
```

---

## Task 3: Multi-hop news + catalyst-pass prompt; token bump

**Files:**
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py:14-80` (`_SYSTEM_PROMPT`) and `:302-305` (search instruction)
- Modify: `config/intelligence.yaml`
- Test: `tests/test_intelligence_prompt.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_intelligence_prompt.py`:

```python
from swing_screener.intelligence.symbol_analyzer import _SYSTEM_PROMPT


def test_system_prompt_requires_multi_hop_and_catalyst_search():
    text = _SYSTEM_PROMPT.lower()
    assert "follow" in text and "lead" in text          # multi-hop guidance
    assert "forward-looking catalyst" in text           # dedicated catalyst pass
    assert "cite" in text                               # require source citations


def test_user_prompt_search_instruction_is_multi_hop():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req).lower()
    assert "follow" in prompt and "catalyst" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py -k "multi_hop or catalyst_search" -q`
Expected: FAIL — current prompt lacks these instructions.

- [ ] **Step 3: Rewrite the search guidance**

Insert a new `SEARCH STRATEGY` block into `_SYSTEM_PROMPT`. Leave the opening sentence (lines 14-16) and every existing rule (`CRITICAL RULES — TRADE PLAN NUMBERS:`, `EXISTING POSITION MODE`, the JSON field list) unchanged. Locate the line `CRITICAL RULES — TRADE PLAN NUMBERS:` (line 18) and paste these lines immediately before it (followed by one blank line):

```text
SEARCH STRATEGY — LIVE NEWS, MULTI-HOP:
• Start with a broad news search (recent headlines, earnings results, analyst views).
• Then FOLLOW THE LEADS you find: an earnings beat → search the guidance and analyst reaction; a downgrade → search the stated reason; a new product/partnership → search demand and competitive response. Iterate until you have a forward-looking view, not just a snapshot.
• Run a dedicated FORWARD-LOOKING CATALYST pass: search explicitly for upcoming earnings dates, product launches, macro events, and regulatory decisions that could move the price. These drive `upcoming_events` and `prediction_bullets`.
• CITE the URL of every news source you rely on in `sources`. Do not assert news without a citation.
```

The resulting `_SYSTEM_PROMPT` opening looks like:

```python
_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

SEARCH STRATEGY — LIVE NEWS, MULTI-HOP:
• Start with a broad news search (recent headlines, earnings results, analyst views).
• Then FOLLOW THE LEADS you find: an earnings beat → search the guidance and analyst reaction; a downgrade → search the stated reason; a new product/partnership → search demand and competitive response. Iterate until you have a forward-looking view, not just a snapshot.
• Run a dedicated FORWARD-LOOKING CATALYST pass: search explicitly for upcoming earnings dates, product launches, macro events, and regulatory decisions that could move the price. These drive `upcoming_events` and `prediction_bullets`.
• CITE the URL of every news source you rely on in `sources`. Do not assert news without a citation.

CRITICAL RULES — TRADE PLAN NUMBERS:
• The "Close" in the input is the CURRENT MARKET PRICE — it is NOT the entry price.
...
"""
```

(The `...` marks the existing unchanged rules — do not retype them.)

Then replace the closing search instruction in `_build_user_prompt` (lines 302-305):

```python
    lines.append(
        f"\nSearch broadly for recent news, earnings results, catalysts, and analyst views for {ticker}, "
        "then follow the most material leads with further searches and run a forward-looking catalyst pass. "
        "Cite every source. Finally produce the structured JSON analysis."
    )
```

- [ ] **Step 4: Bump the token budget**

In `config/intelligence.yaml`, under the `llm:` section, set `web_search_max_tokens` to `4000` (from 2000) and add an inline comment: `# raised for multi-hop news + catalyst search`. If the key is absent, add it under `llm:`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_intelligence_prompt.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/intelligence/symbol_analyzer.py config/intelligence.yaml tests/test_intelligence_prompt.py
git commit -m "feat(intelligence): multi-hop news + catalyst-pass prompt, raise token budget"
```

---

## Task 4: Expose Finnhub fields on `FundamentalSnapshotResponse`

**Files:**
- Modify: `api/models/fundamentals.py:62-101`
- Test: `tests/test_fundamentals_response_model.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/test_fundamentals_response_model.py`:

```python
from api.models.fundamentals import FundamentalSnapshotResponse


def test_response_exposes_finnhub_signals():
    resp = FundamentalSnapshotResponse.model_validate(
        {
            "symbol": "AAPL",
            "asof_date": "2026-06-15",
            "provider": "yfinance",
            "updated_at": "2026-06-15T00:00:00Z",
            "insider_net_shares_90d": -1200,
            "insider_transaction_count_90d": 5,
            "forward_eps_estimate": 2.10,
            "analyst_upgrade_downgrade_net_30d": 3,
            "net_margin": 0.25,
        }
    )
    assert resp.insider_net_shares_90d == -1200
    assert resp.insider_transaction_count_90d == 5
    assert resp.forward_eps_estimate == 2.10
    assert resp.analyst_upgrade_downgrade_net_30d == 3
    assert resp.net_margin == 0.25
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_fundamentals_response_model.py -q`
Expected: FAIL — fields default to `None` (not present on model), assertions fail / attributes missing.

- [ ] **Step 3: Add the fields**

In `api/models/fundamentals.py`, in `FundamentalSnapshotResponse`, after `error: Optional[str] = None` (line 101) add:

```python
    # Finnhub enrichment signals (additive, optional)
    net_margin: Optional[float] = None
    insider_net_shares_90d: Optional[int] = None
    insider_transaction_count_90d: Optional[int] = None
    forward_eps_estimate: Optional[float] = None
    analyst_upgrade_downgrade_net_30d: Optional[int] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_fundamentals_response_model.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/models/fundamentals.py tests/test_fundamentals_response_model.py
git commit -m "feat(api): expose Finnhub signals on FundamentalSnapshotResponse"
```

---

## Task 5: Server-side request enricher (auto-fetch, block)

**Files:**
- Create: `api/services/intelligence_enrichment.py`
- Test: `tests/test_intelligence_enrichment.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/test_intelligence_enrichment.py`:

```python
from types import SimpleNamespace

from api.services.intelligence_enrichment import enrich_intelligence_request
from swing_screener.intelligence.models import SymbolIntelligenceRequest


class _FakeFundamentals:
    def __init__(self, snapshot):
        self._snapshot = snapshot
        self.calls = []

    def get_snapshot(self, symbol):
        self.calls.append(symbol)
        return self._snapshot


def _snapshot(**over):
    base = dict(
        sector="Technology",
        trailing_pe=20.0,
        revenue_growth_yoy=0.15,
        gross_margin=0.44,
        net_margin=0.22,
        return_on_equity=0.31,
        debt_to_equity=0.7,
        insider_net_shares_90d=-500,
        insider_transaction_count_90d=4,
        forward_eps_estimate=2.05,
        analyst_upgrade_downgrade_net_30d=2,
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_enricher_fills_missing_fundamentals_and_finnhub():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    fund = _FakeFundamentals(_snapshot())
    out = enrich_intelligence_request("AAPL", req, fundamentals=fund, earnings=lambda t: (5, "2026-06-20"))
    assert out.trailing_pe == 20.0
    assert out.gross_margin == 0.44
    assert out.insider_net_shares_90d == -500
    assert out.forward_eps_estimate == 2.05
    assert out.days_to_earnings == 5
    assert out.next_earnings_date == "2026-06-20"
    assert fund.calls == ["AAPL"]


def test_enricher_does_not_overwrite_provided_values():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout", trailing_pe=99.0, days_to_earnings=1)
    fund = _FakeFundamentals(_snapshot())
    out = enrich_intelligence_request("AAPL", req, fundamentals=fund, earnings=lambda t: (5, "2026-06-20"))
    assert out.trailing_pe == 99.0          # not overwritten
    assert out.days_to_earnings == 1        # not overwritten
    assert out.gross_margin == 0.44         # still filled where missing


def test_enricher_is_resilient_to_provider_errors():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")

    class _Boom:
        def get_snapshot(self, symbol):
            raise RuntimeError("provider down")

    def _earn_boom(_t):
        raise RuntimeError("earnings down")

    out = enrich_intelligence_request("AAPL", req, fundamentals=_Boom(), earnings=_earn_boom)
    assert out.trailing_pe is None          # degrades, does not raise
    assert out.days_to_earnings is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_intelligence_enrichment.py -q`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the enricher**

Create `api/services/intelligence_enrichment.py`:

```python
"""Fill a SymbolIntelligenceRequest with fundamentals/Finnhub/earnings before the LLM call.

Auto-fetch, block: missing fields are fetched synchronously. Provider failures degrade
to leaving the field None rather than failing the analysis.
"""
from __future__ import annotations

import logging
from typing import Callable, Protocol

from swing_screener.intelligence.models import SymbolIntelligenceRequest

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

    if not updates:
        return request
    return request.model_copy(update=updates)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_intelligence_enrichment.py -q`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add api/services/intelligence_enrichment.py tests/test_intelligence_enrichment.py
git commit -m "feat(api): server-side intelligence request enricher (auto-fetch, block)"
```

---

## Task 6: Wire the enricher into the analyze endpoint

**Files:**
- Modify: `api/routers/intelligence.py:71-84`
- Test: `tests/test_intelligence_router_enrichment.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/test_intelligence_router_enrichment.py`:

```python
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo


class _Fund:
    def get_snapshot(self, symbol):
        return SimpleNamespace(
            sector="Tech", trailing_pe=20.0, revenue_growth_yoy=0.15, gross_margin=0.44,
            net_margin=0.22, return_on_equity=0.31, debt_to_equity=0.7,
            insider_net_shares_90d=-500, insider_transaction_count_90d=4,
            forward_eps_estimate=2.05, analyst_upgrade_downgrade_net_30d=2,
        )


class _Port:
    def get_earnings_proximity(self, ticker):
        return SimpleNamespace(days_until=5, next_earnings_date="2026-06-20")


class _Repo:
    def list_positions(self, status=None):
        return [], None


def test_analyze_enriches_request_before_calling_llm(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured = {}

    def _fake_analyze(self, ticker, req, past_positions=None):
        captured["req"] = req
        return SimpleNamespace(
            symbol=ticker, generated_at="2026-06-15T00:00:00Z", action="WATCH",
            conviction="medium", catalyst_urgency="none", summary_line="x", narrative="y",
            upcoming_events=[], position_signal=None, position_outlook=None, sources=[],
            inputs_used={}, price_hook=None, key_numbers=[], risk_factors=[],
            prediction_bullets=[], past_trades_context=None,
        )

    app.dependency_overrides[get_fundamentals_service] = lambda: _Fund()
    app.dependency_overrides[get_portfolio_service] = lambda: _Port()
    app.dependency_overrides[get_positions_repo] = lambda: _Repo()
    try:
        with patch("api.routers.intelligence.SymbolAnalyzer.analyze", _fake_analyze):
            client = TestClient(app)
            resp = client.post("/api/intelligence/AAPL", json={"close": 100.0, "signal": "breakout"})
        assert resp.status_code == 200
        assert captured["req"].trailing_pe == 20.0
        assert captured["req"].forward_eps_estimate == 2.05
        assert captured["req"].days_to_earnings == 5
    finally:
        app.dependency_overrides.clear()
```

> Note: confirm the mounted prefix — if the app mounts the router under `/api`, the path is `/api/intelligence/AAPL` (check `api/main.py`); otherwise use `/intelligence/AAPL`.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_intelligence_router_enrichment.py -q`
Expected: FAIL — `captured["req"].trailing_pe` is `None` (enricher not wired).

- [ ] **Step 3: Wire the enricher**

In `api/routers/intelligence.py`, add imports near the top:

```python
from api.dependencies import (
    get_fundamentals_service,
    get_portfolio_service,
    get_positions_repo,
)
from api.services.fundamentals_service import FundamentalsService
from api.services.intelligence_enrichment import enrich_intelligence_request
```

(Keep the existing `get_portfolio_service` / `get_positions_repo` imports — consolidate, don't duplicate.)

Add a small adapter so the enricher gets the raw snapshot dataclass fields via the response model (which now carries them after Task 4). Replace the `analyze_symbol` body (lines 71-84):

```python
@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(
    ticker: str,
    request: SymbolIntelligenceRequest,
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    fundamentals_service: FundamentalsService = Depends(get_fundamentals_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol, after enriching with full data."""
    _require_api_key()
    upper = ticker.upper()

    def _earnings(t: str) -> tuple[int | None, str | None]:
        ep = portfolio_service.get_earnings_proximity(t)
        return ep.days_until, ep.next_earnings_date

    request = enrich_intelligence_request(
        upper,
        request,
        fundamentals=fundamentals_service,
        earnings=_earnings,
    )
    try:
        past_positions, _ = positions_repo.list_positions(status="closed")
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(upper, request, past_positions=past_positions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

> `FundamentalsService.get_snapshot(symbol)` returns a `FundamentalSnapshotResponse`; the enricher reads attributes by name, which now include the Finnhub fields (Task 4) and the fundamentals fields (already present). No signature change needed in the enricher.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_intelligence_router_enrichment.py -q`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `.venv/bin/python -m pytest -m "not integration" -q`
Expected: PASS (pre-existing `tests/test_universe_snapshot.py` failures noted in branch history are unrelated; everything else green).

- [ ] **Step 6: Commit**

```bash
git add api/routers/intelligence.py tests/test_intelligence_router_enrichment.py
git commit -m "feat(api): enrich intelligence request with full data before LLM call"
```

---

## Task 7: i18n keys for the new UI

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts:608-657`
- Test: covered by component tests in Tasks 8-10 (no standalone test).

- [ ] **Step 1: Add keys**

In `web-ui/src/i18n/messages.en.ts`, inside the `intelligence` object (after `fullRationale: 'Full rationale',` at line 656) add:

```typescript
          aiAnalysisTitle: 'AI analysis',
          secondOpinion: 'AI second opinion: {{aiAction}} — differs from the screener verdict ({{screenerAction}}). The screener verdict stands.',
```

Inside the same `analysis` panel object, add a sibling block for the unified panel and fundamentals strip (after the `intelligence` object closes at line 657):

```typescript
        decisionWhy: {
          title: 'What to do & why',
          whatToDo: 'What to do',
          whyNow: 'Why now',
          watchFor: 'Watch for',
          noGuidance: 'Run the screener to get an actionable read.',
        },
        fundamentalsStrip: {
          title: 'Fundamentals',
          pe: 'P/E',
          revenueGrowth: 'Rev growth',
          grossMargin: 'Gross margin',
          valuation: 'Valuation',
          unavailable: 'No fundamentals loaded',
        },
```

- [ ] **Step 2: Typecheck**

Run: `cd web-ui && npm run typecheck`
Expected: PASS (no missing-key type errors).

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat(web): i18n keys for unified decision panel and fundamentals strip"
```

---

## Task 8: Remove competing banner; add inline second-opinion note

**Files:**
- Modify: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx:60-69,123-141`
- Test: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `NarrativeAnalysisCard.test.tsx` (follow the file's existing render/fixture helpers; assert via i18n `t(...)`):

```typescript
import { t } from '@/i18n/t';

it('does not render a competing action banner verdict', () => {
  // intelligence.action = BUY_NOW, screener decisionSummary.action = WATCH
  renderCard({ action: 'BUY_NOW' }, { decisionSummary: { action: 'WATCH' } });
  // The headline "SYMBOL — Buy Now" banner must be gone; AI title shown instead
  expect(screen.queryByText(/—\s*Buy Now/i)).not.toBeInTheDocument();
  expect(screen.getByText(t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle'))).toBeInTheDocument();
});

it('shows an inline second-opinion note when AI disagrees with the screener', () => {
  renderCard({ action: 'BUY_NOW' }, { decisionSummary: { action: 'WATCH' } });
  const note = t('workspacePage.panels.analysis.intelligence.secondOpinion', {
    aiAction: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
    screenerAction: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
  });
  expect(screen.getByText(note)).toBeInTheDocument();
});

it('shows no second-opinion note when actions agree', () => {
  renderCard({ action: 'WATCH' }, { decisionSummary: { action: 'WATCH' } });
  expect(screen.queryByText(/second opinion/i)).not.toBeInTheDocument();
});
```

> Adapt `renderCard(intelligenceOverrides, candidateOverrides)` to the fixtures already used in this test file. Reuse existing builders rather than inventing new shapes.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`
Expected: FAIL — banner still present, `aiAnalysisTitle` not rendered, no second-opinion note.

- [ ] **Step 3: Implement**

In `NarrativeAnalysisCard.tsx`:

1. Delete the `bannerClass` function (lines 60-69).
2. Replace the banner JSX (lines 125-131) with a neutral header:

```tsx
      {/* Neutral AI header — verdict lives in the screener-owned decision header above */}
      <div className="px-3 py-2 flex items-center justify-between gap-3 bg-slate-100 text-slate-800">
        <span className="font-semibold text-sm">
          {symbol} — {t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle')}
        </span>
        <Badge variant={convictionVariant(conviction)}>{convictionLabel(conviction)}</Badge>
      </div>
```

3. Replace the existing mismatch block (lines 134-141) with the relabeled inline second-opinion note:

```tsx
        {candidate?.decisionSummary?.action && action !== candidate.decisionSummary.action && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('workspacePage.panels.analysis.intelligence.secondOpinion', {
              aiAction: actionLabel(action),
              screenerAction: actionLabel(candidate.decisionSummary.action),
            })}
          </div>
        )}
```

(`bannerClass` is now unused — confirm no other references remain so lint stays clean.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx
git commit -m "feat(web): drop competing AI banner, show inline second-opinion note"
```

---

## Task 9: `DecisionWhyPanel` — unified "what to do & why"

**Files:**
- Create: `web-ui/src/components/domain/workspace/DecisionWhyPanel.tsx`
- Test: `web-ui/src/components/domain/workspace/DecisionWhyPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `DecisionWhyPanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DecisionWhyPanel from './DecisionWhyPanel';
import { t } from '@/i18n/t';

const summary = {
  whatToDo: 'Place a stop-buy above 152.',
  whyNow: 'Breakout from a 6-week base on rising volume.',
  mainRisk: 'Earnings in 5 days could whipsaw the entry.',
} as const;

describe('DecisionWhyPanel', () => {
  it('renders what-to-do / why-now / watch-for from the screener summary', () => {
    render(<DecisionWhyPanel summary={summary as never} aiSummaryLine={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionWhy.title'))).toBeInTheDocument();
    expect(screen.getByText(summary.whatToDo)).toBeInTheDocument();
    expect(screen.getByText(summary.whyNow)).toBeInTheDocument();
    expect(screen.getByText(summary.mainRisk)).toBeInTheDocument();
  });

  it('appends the AI summary line to why-now when present', () => {
    render(<DecisionWhyPanel summary={summary as never} aiSummaryLine="AI: momentum confirms continuation." />);
    expect(screen.getByText(/AI: momentum confirms continuation\./)).toBeInTheDocument();
  });

  it('shows guidance fallback when no summary is available', () => {
    render(<DecisionWhyPanel summary={null} aiSummaryLine={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionWhy.noGuidance'))).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/DecisionWhyPanel.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement**

Create `DecisionWhyPanel.tsx`:

```tsx
import type { DecisionSummary } from '@/features/screener/types';
import { t } from '@/i18n/t';

interface DecisionWhyPanelProps {
  summary?: DecisionSummary | null;
  aiSummaryLine?: string | null;
}

export default function DecisionWhyPanel({ summary, aiSummaryLine }: DecisionWhyPanelProps) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm text-slate-500">
          {t('workspacePage.panels.analysis.decisionWhy.noGuidance')}
        </p>
      </div>
    );
  }

  const whyNow = [summary.whyNow, aiSummaryLine].filter(Boolean).join(' · ');
  const rows = [
    { label: t('workspacePage.panels.analysis.decisionWhy.whatToDo'), value: summary.whatToDo },
    { label: t('workspacePage.panels.analysis.decisionWhy.whyNow'), value: whyNow },
    { label: t('workspacePage.panels.analysis.decisionWhy.watchFor'), value: summary.mainRisk },
  ].filter((r) => r.value);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('workspacePage.panels.analysis.decisionWhy.title')}
      </div>
      <dl className="mt-2 grid gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</dt>
            <dd className="mt-1 text-sm text-slate-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/DecisionWhyPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/DecisionWhyPanel.tsx web-ui/src/components/domain/workspace/DecisionWhyPanel.test.tsx
git commit -m "feat(web): DecisionWhyPanel unified what-to-do/why view"
```

---

## Task 10: `FundamentalsStrip` — compact overview summary

**Files:**
- Create: `web-ui/src/components/domain/workspace/FundamentalsStrip.tsx`
- Test: `web-ui/src/components/domain/workspace/FundamentalsStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `FundamentalsStrip.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FundamentalsStrip from './FundamentalsStrip';
import { t } from '@/i18n/t';

describe('FundamentalsStrip', () => {
  it('renders P/E, revenue growth, gross margin, valuation', () => {
    render(
      <FundamentalsStrip
        trailingPe={22.5}
        revenueGrowthYoy={0.18}
        grossMargin={0.46}
        valuationLabel="fair"
      />,
    );
    expect(screen.getByText(t('workspacePage.panels.analysis.fundamentalsStrip.pe'))).toBeInTheDocument();
    expect(screen.getByText('22.5')).toBeInTheDocument();
    expect(screen.getByText('18.0%')).toBeInTheDocument();
    expect(screen.getByText('46.0%')).toBeInTheDocument();
  });

  it('renders an unavailable note when nothing is loaded', () => {
    render(<FundamentalsStrip />);
    expect(
      screen.getByText(t('workspacePage.panels.analysis.fundamentalsStrip.unavailable')),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/FundamentalsStrip.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement**

Create `FundamentalsStrip.tsx`:

```tsx
import { t } from '@/i18n/t';

interface FundamentalsStripProps {
  trailingPe?: number | null;
  revenueGrowthYoy?: number | null;
  grossMargin?: number | null;
  valuationLabel?: string | null;
}

function pct(v: number | null | undefined): string | null {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : null;
}

export default function FundamentalsStrip({
  trailingPe,
  revenueGrowthYoy,
  grossMargin,
  valuationLabel,
}: FundamentalsStripProps) {
  const items = [
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.pe'), value: typeof trailingPe === 'number' ? trailingPe.toFixed(1) : null },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.revenueGrowth'), value: pct(revenueGrowthYoy) },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.grossMargin'), value: pct(grossMargin) },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.valuation'), value: valuationLabel ?? null },
  ].filter((i) => i.value);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
        {t('workspacePage.panels.analysis.fundamentalsStrip.unavailable')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        {t('workspacePage.panels.analysis.fundamentalsStrip.title')}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{i.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{i.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/FundamentalsStrip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/FundamentalsStrip.tsx web-ui/src/components/domain/workspace/FundamentalsStrip.test.tsx
git commit -m "feat(web): compact FundamentalsStrip for overview"
```

---

## Task 11: Restructure the overview tab ordering

**Files:**
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx:160-280`
- Test: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx` if present, else `AnalysisCanvasPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add an ordering test (use the file's existing provider/render helper — `renderWithProviders`). If no `SymbolAnalysisContent.test.tsx` exists, add to `AnalysisCanvasPanel.test.tsx`:

```typescript
import { t } from '@/i18n/t';

it('overview shows the unified decision panel above the AI analysis section', () => {
  // render the overview with a candidate that has a decisionSummary and an AI narrative
  renderOverview(/* candidate + intelligence fixtures from this file */);
  const decisionTitle = screen.getByText(t('workspacePage.panels.analysis.decisionWhy.title'));
  const aiTitle = screen.getByText(t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle'));
  // DOM order: decision-why precedes AI analysis
  expect(decisionTitle.compareDocumentPosition(aiTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('overview renders the compact fundamentals strip', () => {
  renderOverview(/* candidate fixtures */);
  expect(screen.getByText(t('workspacePage.panels.analysis.fundamentalsStrip.title'))).toBeInTheDocument();
});
```

> Reuse this file's existing fixtures/mocks (MSW handlers, candidate builder). Don't invent new fixtures.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
Expected: FAIL — `decisionWhy.title` / `fundamentalsStrip.title` not rendered.

- [ ] **Step 3: Implement the reorder**

In `SymbolAnalysisContent.tsx`:

1. Add imports:

```tsx
import DecisionWhyPanel from '@/components/domain/workspace/DecisionWhyPanel';
import FundamentalsStrip from '@/components/domain/workspace/FundamentalsStrip';
```

2. Inside the `activeTab === 'overview'` block, place the unified panel + fundamentals strip immediately after `AnalysisDecisionStrip` and before the narrative/chart. Insert at the top of the overview fragment (after line 160 `{activeTab === 'overview' && (` and its `<>`):

```tsx
            <DecisionWhyPanel
              summary={candidate?.decisionSummary}
              aiSummaryLine={hasNarrative ? displayedIntelligence?.summaryLine ?? null : null}
            />
            <FundamentalsStrip
              trailingPe={fundamentalsQuery.data?.trailingPe ?? null}
              revenueGrowthYoy={fundamentalsQuery.data?.revenueGrowthYoy ?? null}
              grossMargin={fundamentalsQuery.data?.grossMargin ?? null}
              valuationLabel={candidate?.decisionSummary?.valuationLabel ?? null}
            />
```

> `fundamentalsQuery` currently only runs when `activeTab === 'fundamentals'` (line 55-57). Change that guard so the snapshot is also fetched for the overview strip: `useFundamentalSnapshotQuery(activeTab === 'fundamentals' || activeTab === 'overview' ? ticker : undefined)`. Verify the snapshot type exposes `trailingPe`, `revenueGrowthYoy`, `grossMargin` (camelCase via `transformFundamentals*`); if the web type lacks them, add them to the fundamentals snapshot type + transform in the same task (API already returns them).

3. The existing `NarrativeAnalysisCard` / `DecisionSummaryCard` / chart / `TechnicalMetricsGrid` blocks stay, but the chart + `TechnicalMetricsGrid` should now appear **after** the AI narrative card so technical detail sits below. Reorder the JSX so the sequence is: `DecisionWhyPanel` → `FundamentalsStrip` → `NarrativeAnalysisCard`/`DecisionSummaryCard` (AI) → chart block → `TechnicalMetricsGrid` → catalyst card → analyze/refresh buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd web-ui && npm test && npm run typecheck && npm run lint`
Expected: all green, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx
git commit -m "feat(web): unified decision view + fundamentals strip in overview"
```

---

## Task 12: Documentation

**Files:**
- Modify: `src/swing_screener/intelligence/README.md`
- Modify: `config/README.md`
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `api/README.md`

- [ ] **Step 1: Update intelligence README**

In `src/swing_screener/intelligence/README.md`, under "Input Context" note that the analyze endpoint now **auto-fetches missing fundamentals + Finnhub + earnings server-side (blocking)** before the LLM call, and that the prompt includes a raw fundamentals block plus a multi-hop news + forward-catalyst search instruction. List the new `SymbolIntelligenceRequest` fields (`trailing_pe`, `revenue_growth_yoy`, `gross_margin`, `net_margin`, `return_on_equity`, `debt_to_equity`).

- [ ] **Step 2: Update config README**

In `config/README.md`, note `web_search_max_tokens` raised to 4000 for multi-hop search (point to `config/intelligence.yaml`).

- [ ] **Step 3: Update Web UI guide**

In `web-ui/docs/WEB_UI_GUIDE.md`, update the workspace/overview description: single screener-owned verdict header, `DecisionWhyPanel` unified read, compact `FundamentalsStrip`, AI analysis as enrichment with an inline second-opinion note, technical detail below.

- [ ] **Step 4: Update API README**

In `api/README.md`, note `FundamentalSnapshotResponse` gained optional Finnhub fields and that `POST /intelligence/{ticker}` enriches the request before analysis (request body fields remain optional; no breaking change).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/README.md config/README.md web-ui/docs/WEB_UI_GUIDE.md api/README.md
git commit -m "docs: unified decision view + full-data AI enrichment"
```

---

## Final verification

- [ ] Backend: `.venv/bin/python -m pytest -m "not integration" -q` — green (except known unrelated `test_universe_snapshot.py`).
- [ ] Frontend: `cd web-ui && npm test && npm run typecheck && npm run lint` — green, zero warnings.
- [ ] Manual smoke (optional, needs `OPENAI_API_KEY`): run an analysis on a symbol, confirm the canvas shows one verdict, the unified panel, the fundamentals strip, and the AI section below with a second-opinion note when actions differ.
- [ ] PR compare link: `https://github.com/matteolongo/swing_screener/compare/main...feat/unified-decision-ai-enrichment?expand=1`
