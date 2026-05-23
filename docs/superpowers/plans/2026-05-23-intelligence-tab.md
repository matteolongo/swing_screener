# Intelligence Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand "Intelligence" tab to the workspace canvas that triggers an OpenAI web-search-grounded LLM analysis for any selected symbol, returning structured labels (action + conviction) and a Markdown narrative.

**Architecture:** A new `POST /api/intelligence/{ticker}` endpoint calls `SymbolAnalyzer`, which builds a prompt from the technical context, invokes the OpenAI Responses API with `web_search_preview`, parses the JSON response, and returns a `SymbolIntelligence` model. The frontend adds a 4th tab to the workspace canvas (`SymbolAnalysisContent`) that triggers the call via a React Query mutation and renders the result in `IntelligenceCard`.

**Tech Stack:** Python `openai>=1.66` SDK (Responses API), FastAPI, Pydantic v2, React 18, TypeScript, React Query (`useMutation`), `react-markdown`, Vitest/MSW for tests.

---

## File Map

**New (backend):**
- `src/swing_screener/intelligence/__init__.py`
- `src/swing_screener/intelligence/models.py` — Pydantic request/response models
- `src/swing_screener/intelligence/symbol_analyzer.py` — OpenAI Responses API caller
- `api/routers/intelligence.py` — FastAPI router
- `tests/intelligence/__init__.py`
- `tests/intelligence/test_symbol_analyzer.py`

**New (frontend):**
- `web-ui/src/features/intelligence/types.ts` — TS types + transform
- `web-ui/src/features/intelligence/api.ts` — fetch call
- `web-ui/src/features/intelligence/hooks.ts` — React Query mutation
- `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`
- `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`

**Modified:**
- `pyproject.toml` — add `openai>=1.66`
- `config/intelligence.yaml` — add `web_search_model` + `web_search_max_tokens` under `config.llm`
- `api/main.py` — register intelligence router
- `web-ui/src/lib/api.ts` — add `intelligenceAnalyze` endpoint constant
- `web-ui/src/components/domain/workspace/types.ts` — extend `WorkspaceAnalysisTab`
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — add Intelligence tab
- `web-ui/src/i18n/messages.en.ts` — add intelligence i18n keys

---

## Task 1: Backend models

**Files:**
- Create: `src/swing_screener/intelligence/__init__.py`
- Create: `src/swing_screener/intelligence/models.py`
- Create: `tests/intelligence/__init__.py`

- [ ] **Step 1: Create the intelligence package**

```bash
touch src/swing_screener/intelligence/__init__.py
touch tests/intelligence/__init__.py
```

- [ ] **Step 2: Write the failing model test**

Create `tests/intelligence/test_models.py`:

```python
import pytest
from pydantic import ValidationError
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest


def test_symbol_intelligence_request_defaults():
    req = SymbolIntelligenceRequest(close=48.5, signal="breakout")
    assert req.currency == "USD"
    assert req.entry is None
    assert req.sector is None


def test_symbol_intelligence_request_full():
    req = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        entry=49.0,
        stop=44.0,
        sma_20=45.0,
        sma_50=40.0,
        sma_200=35.0,
        momentum_6m=32.5,
        momentum_12m=78.0,
        sector="Materials",
        currency="EUR",
    )
    assert req.close == 48.5
    assert req.currency == "EUR"


def test_symbol_intelligence_valid_action():
    intel = SymbolIntelligence(
        symbol="APAM",
        generated_at="2026-05-23T10:00:00",
        action="BUY_NOW",
        conviction="high",
        summary_line="Cyclical recovery play with improving EBITDA.",
        narrative="## Why it's moving\n...",
        sources=["https://example.com"],
    )
    assert intel.action == "BUY_NOW"
    assert intel.conviction == "high"


def test_symbol_intelligence_rejects_invalid_action():
    with pytest.raises(ValidationError):
        SymbolIntelligence(
            symbol="APAM",
            generated_at="2026-05-23T10:00:00",
            action="INVALID_ACTION",
            conviction="high",
            summary_line="x",
            narrative="x",
            sources=[],
        )
```

- [ ] **Step 3: Run to confirm failure**

```bash
pytest tests/intelligence/test_models.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` (file doesn't exist yet).

- [ ] **Step 4: Create `src/swing_screener/intelligence/models.py`**

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from swing_screener.recommendation.models import DecisionAction, DecisionConviction


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


class SymbolIntelligence(BaseModel):
    symbol: str
    generated_at: str
    action: DecisionAction
    conviction: DecisionConviction
    summary_line: str
    narrative: str
    sources: list[str]
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pytest tests/intelligence/test_models.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/intelligence/ tests/intelligence/
git commit -m "feat(intelligence): add SymbolIntelligence Pydantic models"
```

---

## Task 2: Config + dependency

**Files:**
- Modify: `config/intelligence.yaml`
- Modify: `pyproject.toml`

- [ ] **Step 1: Add `openai>=1.66` to `pyproject.toml`**

In `pyproject.toml`, find the `dependencies` list and add `"openai>=1.66"` after the existing `langchain-openai` line:

```toml
  "langchain-openai>=0.3.0",
  "openai>=1.66",
```

- [ ] **Step 2: Sync dependencies**

```bash
uv sync
```

Expected: resolves `openai>=1.66` without conflicts (it's already a transitive dep, this just pins the floor).

- [ ] **Step 3: Add web search config to `config/intelligence.yaml`**

Inside the file, under `config.llm:`, add the two new keys after the existing `model:` key:

```yaml
config:
  llm:
    # ... existing keys unchanged (enabled, provider, model, etc.) ...
    web_search_model: gpt-4o
    web_search_max_tokens: 2000
```

To find the right insertion point, open `config/intelligence.yaml` and locate the `llm:` block. Add the two lines at the end of that block, before the next top-level key (`catalyst:` or similar).

- [ ] **Step 4: Verify config loads correctly**

```bash
python -c "
from swing_screener.settings import get_settings_manager
doc = get_settings_manager().load_intelligence_document()
llm = doc.get('config', {}).get('llm', {})
print('web_search_model:', llm.get('web_search_model'))
print('web_search_max_tokens:', llm.get('web_search_max_tokens'))
"
```

Expected output:
```
web_search_model: gpt-4o
web_search_max_tokens: 2000
```

- [ ] **Step 5: Commit**

```bash
git add config/intelligence.yaml pyproject.toml
git commit -m "feat(intelligence): add openai dep and web_search config"
```

---

## Task 3: SymbolAnalyzer

**Files:**
- Create: `src/swing_screener/intelligence/symbol_analyzer.py`
- Create: `tests/intelligence/test_symbol_analyzer.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/intelligence/test_symbol_analyzer.py`:

```python
from unittest.mock import MagicMock, patch

import pytest

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer, _extract_json


# --- unit tests for JSON extraction ---

def test_extract_json_from_fenced_block():
    text = '```json\n{"action": "BUY_NOW", "conviction": "high"}\n```'
    result = _extract_json(text)
    assert result["action"] == "BUY_NOW"


def test_extract_json_from_bare_object():
    text = 'Some prose before {"action": "WATCH", "conviction": "low"} some prose after'
    result = _extract_json(text)
    assert result["action"] == "WATCH"


def test_extract_json_raises_when_missing():
    with pytest.raises(ValueError, match="No JSON found"):
        _extract_json("no json here at all")


# --- integration test with mocked OpenAI client ---

_FAKE_RESPONSE_JSON = {
    "action": "BUY_NOW",
    "conviction": "high",
    "summary_line": "Cyclical recovery with strong EBITDA momentum.",
    "narrative": "## Why it's moving\nAperam Q1 2026 beat on EBITDA.",
    "sources": ["https://aperam.com/q1-2026"],
}

_FAKE_RESPONSE_TEXT = (
    "```json\n"
    + __import__("json").dumps(_FAKE_RESPONSE_JSON)
    + "\n```"
)


def _make_fake_openai_response(text: str):
    resp = MagicMock()
    resp.output_text = text
    return resp


def test_symbol_analyzer_returns_intelligence():
    fake_response = _make_fake_openai_response(_FAKE_RESPONSE_TEXT)
    request = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        entry=49.0,
        stop=44.0,
        sma_20=45.0,
        sma_50=40.0,
        sma_200=35.0,
        momentum_6m=32.5,
        momentum_12m=78.0,
        sector="Materials",
        currency="EUR",
    )

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("APAM", request)

    assert isinstance(result, SymbolIntelligence)
    assert result.symbol == "APAM"
    assert result.action == "BUY_NOW"
    assert result.conviction == "high"
    assert result.summary_line == "Cyclical recovery with strong EBITDA momentum."
    assert "Aperam" in result.narrative
    assert result.sources == ["https://aperam.com/q1-2026"]


def test_symbol_analyzer_raises_on_invalid_action():
    bad_json = __import__("json").dumps({
        "action": "TOTALLY_WRONG",
        "conviction": "high",
        "summary_line": "x",
        "narrative": "x",
        "sources": [],
    })
    fake_response = _make_fake_openai_response(f"```json\n{bad_json}\n```")
    request = SymbolIntelligenceRequest(close=10.0, signal="pullback")

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        with pytest.raises(Exception):
            analyzer.analyze("XYZ", request)
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/intelligence/test_symbol_analyzer.py -v
```

Expected: `ImportError` — `symbol_analyzer` doesn't exist yet.

- [ ] **Step 3: Create `src/swing_screener/intelligence/symbol_analyzer.py`**

```python
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.settings import get_settings_manager

_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: full Markdown string with sections ## Why it's moving, ## Key risks, ## Synthetic read
- sources: list of URLs you cited (may be empty if no relevant sources found)

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

    return (
        f"Symbol: {ticker}\n"
        f"Signal: {req.signal}\n"
        f"Close: {fmt(req.close)} {req.currency}\n"
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}\n"
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%\n"
        f"Entry: {fmt(req.entry)} | Stop: {fmt(req.stop)}\n"
        f"Sector: {req.sector or 'Unknown'}\n\n"
        f"Search for recent news, earnings results, catalysts, and analyst views for {ticker}. "
        f"Then produce the structured JSON analysis."
    )


class SymbolAnalyzer:
    def __init__(self) -> None:
        doc = get_settings_manager().load_intelligence_document()
        llm_cfg = doc.get("config", {}).get("llm", {})
        self._model = llm_cfg.get("web_search_model", "gpt-4o")
        self._max_tokens = int(llm_cfg.get("web_search_max_tokens", 2000))
        self._client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

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
        return SymbolIntelligence(
            symbol=ticker,
            generated_at=datetime.now(timezone.utc).isoformat(),
            action=raw["action"],
            conviction=raw["conviction"],
            summary_line=raw["summary_line"],
            narrative=raw["narrative"],
            sources=raw.get("sources", []),
        )
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/intelligence/ -v
```

Expected: all tests in `test_models.py` and `test_symbol_analyzer.py` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/symbol_analyzer.py tests/intelligence/test_symbol_analyzer.py
git commit -m "feat(intelligence): add SymbolAnalyzer with OpenAI Responses API"
```

---

## Task 4: API router

**Files:**
- Create: `api/routers/intelligence.py`
- Modify: `api/main.py`

- [ ] **Step 1: Create `api/routers/intelligence.py`**

```python
"""API endpoint for on-demand symbol intelligence analysis."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(ticker: str, request: SymbolIntelligenceRequest) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol."""
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")
    try:
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(ticker.upper(), request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

- [ ] **Step 2: Register the router in `api/main.py`**

In `api/main.py`, add the import at the top with the other router imports:

```python
from api.routers import (
    config,
    daily_review,
    fundamentals,
    intelligence,   # ← add this
    portfolio,
    screener,
    screener_history,
    strategy,
    universes,
    watchlist,
    weekly_reviews,
)
```

Then add the `include_router` call after the existing `fundamentals` line:

```python
app.include_router(fundamentals.router, prefix="/api/fundamentals", tags=["fundamentals"])
app.include_router(intelligence.router, prefix="/api", tags=["intelligence"])  # ← add this
```

Note: prefix is `/api` (not `/api/intelligence`) because the router itself already declares `prefix="/intelligence"`, giving a final path of `/api/intelligence/{ticker}`.

- [ ] **Step 3: Start the API and verify the endpoint appears in the docs**

```bash
python -m uvicorn api.main:app --port 8000 --reload
```

Open `http://localhost:8000/docs` and confirm `POST /api/intelligence/{ticker}` appears under the `intelligence` tag.

Stop the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add api/routers/intelligence.py api/main.py
git commit -m "feat(intelligence): add POST /api/intelligence/{ticker} endpoint"
```

---

## Task 5: Frontend types + API client + i18n

**Files:**
- Create: `web-ui/src/features/intelligence/types.ts`
- Create: `web-ui/src/features/intelligence/api.ts`
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add the endpoint constant to `web-ui/src/lib/api.ts`**

Find the `API_ENDPOINTS` object. After the last existing `intelligence*` line (around line 65), add:

```ts
  intelligenceAnalyze: (ticker: string) => `/api/intelligence/${encodeURIComponent(ticker)}`,
```

- [ ] **Step 2: Write the failing type test**

Create `web-ui/src/features/intelligence/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transformIntelligence } from './types';
import type { SymbolIntelligenceAPI } from './types';

describe('transformIntelligence', () => {
  it('converts snake_case API shape to camelCase', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'APAM',
      generated_at: '2026-05-23T10:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      summary_line: 'Cyclical recovery.',
      narrative: '## Why\n...',
      sources: ['https://example.com'],
    };
    const result = transformIntelligence(api);
    expect(result.symbol).toBe('APAM');
    expect(result.generatedAt).toBe('2026-05-23T10:00:00Z');
    expect(result.summaryLine).toBe('Cyclical recovery.');
    expect(result.sources).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/features/intelligence/types.test.ts
```

Expected: `Cannot find module './types'`.

- [ ] **Step 4: Create `web-ui/src/features/intelligence/types.ts`**

```ts
import type { DecisionAction, DecisionConviction } from '@/features/screener/types';

export type { DecisionAction, DecisionConviction };

export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summary_line: string;
  narrative: string;
  sources: string[];
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summaryLine: string;
  narrative: string;
  sources: string[];
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    sources: api.sources,
  };
}
```

- [ ] **Step 5: Create `web-ui/src/features/intelligence/api.ts`**

```ts
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type { SymbolIntelligenceAPI } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

export interface IntelligenceRequestPayload {
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
}

export function candidateToPayload(candidate: SymbolAnalysisCandidate | null | undefined): IntelligenceRequestPayload | null {
  if (!candidate?.close) return null;
  return {
    close: candidate.close,
    signal: candidate.signal ?? 'unknown',
    entry: candidate.entry ?? null,
    stop: candidate.stop ?? null,
    sma_20: candidate.sma20 ?? null,
    sma_50: candidate.sma50 ?? null,
    sma_200: candidate.sma200 ?? null,
    momentum_6m: candidate.momentum6m ?? null,
    momentum_12m: candidate.momentum12m ?? null,
    sector: candidate.sector ?? null,
    currency: candidate.currency ?? 'USD',
  };
}

export async function postIntelligenceAnalysis(
  ticker: string,
  payload: IntelligenceRequestPayload
): Promise<SymbolIntelligenceAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceAnalyze(ticker)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to analyze ${ticker}`);
  }
  return response.json() as Promise<SymbolIntelligenceAPI>;
}
```

- [ ] **Step 6: Add i18n keys to `web-ui/src/i18n/messages.en.ts`**

Find the `workspacePage.panels.analysis.tabs` object (around line 566) and add the intelligence tab label:

```ts
tabs: {
  overview: 'Overview',
  order: 'Order',
  fundamentals: 'Fundamentals',
  intelligence: 'Intelligence',   // ← add this
},
```

Then find the `workspacePage.panels.analysis` block and add an `intelligence` section after the existing `computeAnalysis` block:

```ts
intelligence: {
  analyzeAction: 'Analyze with AI',
  analyzingAction: 'Analyzing...',
  emptyState: 'Click "Analyze with AI" to generate a web-search-grounded analysis for this symbol.',
  sources: 'Sources',
  analyzeError: 'Failed to generate analysis',
},
```

- [ ] **Step 7: Run type tests — expect pass**

```bash
cd web-ui && npx vitest run src/features/intelligence/types.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 8: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors (MessageKey type auto-derives from messages.en.ts).

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/features/intelligence/ web-ui/src/lib/api.ts web-ui/src/i18n/messages.en.ts
git commit -m "feat(intelligence): add frontend types, API client, and i18n keys"
```

---

## Task 6: Frontend hook

**Files:**
- Create: `web-ui/src/features/intelligence/hooks.ts`

- [ ] **Step 1: Create `web-ui/src/features/intelligence/hooks.ts`**

```ts
import { useMutation } from '@tanstack/react-query';
import { candidateToPayload, postIntelligenceAnalysis } from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { SymbolIntelligence } from '@/features/intelligence/types';
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
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/features/intelligence/hooks.ts
git commit -m "feat(intelligence): add useIntelligenceAnalysisMutation hook"
```

---

## Task 7: IntelligenceCard component

**Files:**
- Create: `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`
- Create: `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`

- [ ] **Step 1: Install `react-markdown`**

```bash
cd web-ui && npm install react-markdown
```

- [ ] **Step 2: Write the failing component test**

Create `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntelligenceCard from './IntelligenceCard';
import type { SymbolIntelligence } from '@/features/intelligence/types';

const baseIntel: SymbolIntelligence = {
  symbol: 'APAM',
  generatedAt: '2026-05-23T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  summaryLine: 'Cyclical recovery with improving EBITDA.',
  narrative: '## Why it\'s moving\nAperam Q1 2026 beat.',
  sources: ['https://aperam.com/q1-2026'],
};

describe('IntelligenceCard', () => {
  it('renders action and conviction badges', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText('Buy Now')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders the summary line', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText('Cyclical recovery with improving EBITDA.')).toBeInTheDocument();
  });

  it('renders the narrative as markdown', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText("Why it's moving")).toBeInTheDocument();
  });

  it('shows sources count and URL when expanded', async () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    const summary = screen.getByText(/Sources \(1\)/);
    expect(summary).toBeInTheDocument();
    await userEvent.click(summary);
    expect(screen.getByText('https://aperam.com/q1-2026')).toBeInTheDocument();
  });

  it('renders nothing for empty sources', () => {
    render(<IntelligenceCard intelligence={{ ...baseIntel, sources: [] }} />);
    expect(screen.queryByText(/Sources/)).toBeNull();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/IntelligenceCard.test.tsx
```

Expected: `Cannot find module './IntelligenceCard'`.

- [ ] **Step 4: Create `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`**

```tsx
import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import type { SymbolIntelligence, DecisionAction, DecisionConviction } from '@/features/intelligence/types';
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

interface IntelligenceCardProps {
  intelligence: SymbolIntelligence;
}

export default function IntelligenceCard({ intelligence }: IntelligenceCardProps) {
  const { action, conviction, summaryLine, narrative, sources } = intelligence;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={actionVariant(action)}>{actionLabel(action)}</Badge>
        <Badge variant="default">{convictionLabel(conviction)}</Badge>
      </div>

      <p className="text-sm text-slate-700 font-medium">{summaryLine}</p>

      <hr className="border-slate-100" />

      <div className="prose prose-sm max-w-none text-slate-800">
        <ReactMarkdown>{narrative}</ReactMarkdown>
      </div>

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

- [ ] **Step 5: Run tests — expect pass**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/IntelligenceCard.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/components/domain/workspace/IntelligenceCard.tsx web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx web-ui/package.json web-ui/package-lock.json
git commit -m "feat(intelligence): add IntelligenceCard component"
```

---

## Task 8: Wire up Intelligence tab

**Files:**
- Modify: `web-ui/src/components/domain/workspace/types.ts`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`

- [ ] **Step 1: Extend `WorkspaceAnalysisTab` in `types.ts`**

In `web-ui/src/components/domain/workspace/types.ts`, change:

```ts
export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'order';
```

to:

```ts
export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'order' | 'intelligence';
```

- [ ] **Step 2: Add Intelligence tab to `SymbolAnalysisContent.tsx`**

Open `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`.

**a) Merge new imports into the existing react import** at the top of the file. The current file has `import type { ReactNode } from 'react';`. Replace it with:

```tsx
import { useState, useEffect, type ReactNode } from 'react';
```

Then add these new imports after the existing import block:

```tsx
import IntelligenceCard from '@/components/domain/workspace/IntelligenceCard';
import { useIntelligenceAnalysisMutation } from '@/features/intelligence/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
```

**b) Add the Intelligence tab to the tabs array** (after the existing `fundamentals` tab):

```ts
const tabs: Array<{ id: WorkspaceAnalysisTab; label: string }> = [
  { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
  { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
  { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  { id: 'intelligence', label: t('workspacePage.panels.analysis.tabs.intelligence') },  // ← add
];
```

**c) Add local state and mutation** inside the component body (after the existing mutation declarations):

```tsx
const intelligenceMutation = useIntelligenceAnalysisMutation();
const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);

// Reset intelligence result when the selected ticker changes
useEffect(() => {
  setIntelligenceResult(null);
  intelligenceMutation.reset();
}, [ticker]);  // eslint-disable-line react-hooks/exhaustive-deps
```

**d) Add the Intelligence tab panel** inside the scrollable content area (after the `{activeTab === 'order' ? orderPanel : null}` line):

```tsx
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
            {
              onSuccess: (result) => setIntelligenceResult(result),
            }
          );
        }}
      >
        {intelligenceMutation.isPending
          ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
          : t('workspacePage.panels.analysis.intelligence.analyzeAction')}
      </Button>
    </div>

    {intelligenceMutation.isError && (
      <p className="text-sm text-rose-600">
        {intelligenceMutation.error instanceof Error
          ? intelligenceMutation.error.message
          : t('workspacePage.panels.analysis.intelligence.analyzeError')}
      </p>
    )}

    {intelligenceResult ? (
      <IntelligenceCard intelligence={intelligenceResult} />
    ) : !intelligenceMutation.isPending && !intelligenceMutation.isError ? (
      <p className="text-sm text-gray-500">
        {t('workspacePage.panels.analysis.intelligence.emptyState')}
      </p>
    ) : null}
  </div>
)}
```

- [ ] **Step 3: Run the full test suite**

```bash
cd /path/to/swing_screener && pytest -q && cd web-ui && npm test
```

Expected: all backend tests pass, all frontend tests pass (including the existing workspace tests — the new tab should not break them since they don't assert on tab count).

- [ ] **Step 4: Run typecheck and lint**

```bash
cd web-ui && npm run typecheck && npm run lint
```

Expected: no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/types.ts web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx
git commit -m "feat(intelligence): wire up Intelligence tab in workspace canvas"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Set env var and start the API**

```bash
export OPENAI_API_KEY=<your-key>
python -m uvicorn api.main:app --port 8000 --reload
```

- [ ] **Step 2: Start the frontend**

```bash
cd web-ui && npm run dev
```

- [ ] **Step 3: Test the happy path**

1. Open `http://localhost:5173`
2. Navigate to the Workspace page
3. Run the screener — select any candidate from the inbox
4. Click the **Intelligence** tab in the analysis canvas
5. Click **Analyze with AI**
6. Verify: loading spinner appears, then `IntelligenceCard` renders with action badge, conviction badge, summary line, narrative sections, and sources

- [ ] **Step 4: Test error handling**

1. Stop the API
2. Click **Analyze with AI** again
3. Verify: error message appears below the button, no crash

- [ ] **Step 5: Test ticker change resets state**

1. With a result showing, click a different symbol in the screener inbox
2. Switch to Intelligence tab
3. Verify: result is cleared (shows empty state, not the previous symbol's result)

- [ ] **Step 6: Final full test run + commit**

```bash
pytest -q && cd web-ui && npm test && npm run typecheck && npm run lint
```

All pass. Then:

```bash
git add -p  # stage any remaining changes
git commit -m "feat(intelligence): complete Intelligence tab implementation"
```
