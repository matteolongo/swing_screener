# Intelligence Tab — Symbol Analysis via OpenAI Web Search

**Date:** 2026-05-23  
**Branch:** feat/intelligence-tab (to be created)  
**Status:** Approved, ready for implementation

## Problem

The workspace canvas shows deterministic technical and fundamental data for a selected symbol, but gives no qualitative context: why is the stock moving, what are the recent catalysts, is the setup backed by a business narrative? Users currently have to leave the app and research this manually (e.g. via ChatGPT).

## Goal

Add an on-demand "Intelligence" tab to the workspace canvas that lets the user trigger a web-search-grounded LLM analysis for any selected symbol. The result is a hybrid output: structured labels (action + conviction) and a narrative Markdown analysis (company context, catalysts, risks, synthetic read).

## Non-goals

- Automatic analysis on screener run or daily-review load
- Caching on the backend
- Multi-language output (English only)
- Integration with the existing `DecisionSummary` / deterministic pipeline

---

## Architecture

```
workspace canvas
└── SymbolAnalysisContent
    └── tab "Intelligence" (4th tab, after Order)
        ├── "Analyze with AI" button
        ├── loading / error state
        └── IntelligenceCard
            ├── action badge + conviction badge
            ├── summary_line (one-liner)
            ├── narrative Markdown (ReactMarkdown)
            └── sources (collapsible list of URLs)

frontend mutation (React Query)
    → POST /intelligence/{ticker}
        → SymbolAnalyzer
            → OpenAI Responses API + web_search_preview builtin tool
        ← SymbolIntelligence (Pydantic model)
    ← IntelligenceCard renders result
```

Result is kept in local React state for the lifetime of the tab session. Changing the selected symbol resets the state — analysis is time-sensitive and should not persist stale.

---

## Data Model

### Backend — `src/swing_screener/intelligence/models.py`

```python
from __future__ import annotations
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
    generated_at: str          # ISO 8601 datetime
    action: DecisionAction
    conviction: DecisionConviction
    summary_line: str          # one-line synthetic read
    narrative: str             # full Markdown (catalysts, risks, read)
    sources: list[str]         # URLs cited by the LLM
```

### Frontend — `web-ui/src/features/intelligence/types.ts`

```ts
// API response shape (snake_case)
export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summary_line: string;
  narrative: string;
  sources: string[];
}

// App-internal shape (camelCase)
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

---

## API

### Endpoint

```
POST /intelligence/{ticker}
Content-Type: application/json
Body: SymbolIntelligenceRequest
Response: SymbolIntelligence (200) | 422 | 500
```

No caching on the backend. Each call is fresh. Error responses include a human-readable `detail` field.

### Router — `api/routers/intelligence.py`

```python
router = APIRouter(prefix="/intelligence", tags=["intelligence"])

@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(ticker: str, request: SymbolIntelligenceRequest) -> SymbolIntelligence:
    analyzer = SymbolAnalyzer()
    return analyzer.analyze(ticker.upper(), request)
```

Register in `api/main.py`.

---

## Backend: SymbolAnalyzer

**File:** `src/swing_screener/intelligence/symbol_analyzer.py`

**Steps:**
1. Build a prompt embedding the technical context (signal, close vs SMAs, momentum %, entry/stop levels, sector).
2. Call `openai.responses.create()` with `tools=[{"type": "web_search_preview"}]` and `model` from `config/intelligence.yaml`.
3. Instruct the LLM to search for recent news, earnings, catalysts for the ticker and return a JSON block with: `action`, `conviction`, `summary_line`, `narrative` (Markdown), `sources` (list of URLs).
4. Extract the JSON from the response text, validate with Pydantic, return `SymbolIntelligence`.

**Prompt structure (system):**
```
You are a swing-trading analyst. Given the technical context below and live web search results,
produce a structured analysis for {ticker} in English.

Return ONLY a JSON block with these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- summary_line: one sentence synthetic read
- narrative: full Markdown analysis (## Why it's moving, ## Key risks, ## Synthetic read)
- sources: list of URLs cited

Technical context:
Signal: {signal}
Close: {close} {currency}
SMA20: {sma_20} | SMA50: {sma_50} | SMA200: {sma_200}
Momentum 6m: {momentum_6m}% | 12m: {momentum_12m}%
Entry: {entry} | Stop: {stop}
Sector: {sector}
```

**Config** — `config/intelligence.yaml` (file already exists; add `web_search` subsection under `config.llm`):
```yaml
config:
  llm:
    # ... existing keys unchanged ...
    web_search_model: gpt-4o          # model for Responses API + web_search_preview
    web_search_max_tokens: 2000
```

**Dependency** — `pyproject.toml`: add `openai>=1.66` explicitly (currently pulled in transitively via `langchain-openai`, but the Responses API requires this minimum version).

**Env var:** `OPENAI_API_KEY` (existing pattern in the project).

---

## Frontend

### New tab

`WorkspaceAnalysisTab` union type extended with `'intelligence'`.

In `SymbolAnalysisContent`, add:
```ts
{ id: 'intelligence', label: t('workspacePage.panels.intelligence.tab') }
```

### Hook — `web-ui/src/features/intelligence/hooks.ts`

```ts
export function useIntelligenceAnalysisMutation() {
  return useMutation({
    mutationFn: ({ ticker, context }: { ticker: string; context: SymbolIntelligenceAPI }) =>
      postIntelligenceAnalysis(ticker, context).then(transformIntelligence),
  });
}
```

Pattern identical to `useRefreshFundamentalSnapshotMutation`.

### IntelligenceCard layout

```
┌────────────────────────────────────────┐
│  [BUY_NOW]  [High]   ← action + conviction badges
│  "Setup timing is ready..."  ← summaryLine
│  ──────────────────────────
│  ## Why it's moving
│  ...narrative Markdown (ReactMarkdown)...
│  ──────────────────────────
│  ▶ Sources (3)   ← collapsible <details>
│    · https://...
│    · https://...
└────────────────────────────────────────┘
```

### Tab panel content (activeTab === 'intelligence')

```
[Analyze with AI]  button (disabled while loading)

if result:
  <IntelligenceCard intelligence={result} currency={candidate?.currency} />

if error:
  error message (text-rose-600)

if no result yet:
  empty state prompt ("Click Analyze with AI to generate a web-search-grounded analysis.")
```

State is local (`useState<SymbolIntelligence | null>`). Resets when `ticker` changes (via `useEffect`).

### i18n keys (new)

```
workspacePage.panels.intelligence.tab
workspacePage.panels.intelligence.analyzeAction
workspacePage.panels.intelligence.analyzingAction
workspacePage.panels.intelligence.emptyState
workspacePage.panels.intelligence.sources
workspacePage.panels.intelligence.analyzeError
```

---

## Files changed / created

**New:**
- `src/swing_screener/intelligence/__init__.py`
- `src/swing_screener/intelligence/models.py`
- `src/swing_screener/intelligence/symbol_analyzer.py`
- `api/routers/intelligence.py`
- `web-ui/src/features/intelligence/types.ts`
- `web-ui/src/features/intelligence/api.ts`
- `web-ui/src/features/intelligence/hooks.ts`
- `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`

**Modified:**
- `api/main.py` — register intelligence router
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — add Intelligence tab
- `web-ui/src/components/domain/workspace/types.ts` — extend `WorkspaceAnalysisTab`
- `config/intelligence.yaml` — add `web_search_model` + `web_search_max_tokens` under `config.llm`
- `pyproject.toml` — add `openai>=1.66` explicit dependency
- `web-ui/src/i18n/` — add intelligence keys
- `api/dependencies.py` — add `SymbolAnalyzer` dependency if needed

**Tests:**
- `tests/intelligence/test_symbol_analyzer.py` — mock OpenAI call, verify JSON parsing and model validation
- `web-ui/src/features/intelligence/` — hook and type transform tests
- `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx` — render test

---

## Out of scope

- Persisting intelligence results to disk
- Showing intelligence in daily-review
- Auto-triggering on screener run
- Support for non-English output
