# Unified Decision View + Full-Data AI Enrichment

**Date:** 2026-06-15
**Branch:** `feat/unified-decision-ai-enrichment` (based on `main`)

## Problem

The symbol analysis canvas presents two competing verdicts:

- The **deterministic screener** verdict (`candidate.decisionSummary.action`) — e.g. `WATCH` — shown in the screener table and in `AnalysisDecisionStrip`.
- The **LLM** verdict (`intelligence.action`) — e.g. `BUY_NOW` — shown in its own coloured banner inside `NarrativeAnalysisCard`.

When they disagree the user sees "Watch" in the table but "Buy now" in the canvas, with only a small mismatch note to reconcile them. There is no single answer to "what should I do and why".

Two further gaps undermine the AI output:

1. **Incomplete data reaches the LLM.** The web payload (`candidateToPayload`) never fills the Finnhub signals (insider, forward EPS, analyst actions), the fundamentals snapshot (P/E, revenue growth, margins, balance-sheet signals), or the next earnings date — even though `SymbolIntelligenceRequest` already has fields for the Finnhub/earnings data. The prompt has **no raw fundamentals block at all**, only valuation labels.
2. **Shallow news search.** `_SYSTEM_PROMPT` instructs a single news search, weakening the "predict what can change from live news" goal.

## Goals

- One unified, screener-owned decision the user reads first: action + conviction + trade plan + what-to-do / why-now / watch-for.
- Technical detail and LLM analysis live **below** the decision, clearly separated.
- The LLM always receives the full available context (fundamentals + Finnhub + earnings + technicals + decision context + patterns).
- The LLM uses live, multi-hop web news plus a dedicated forward-catalyst pass to drive predictions.

## Non-goals

- The LLM does **not** own or override the verdict. The deterministic screener remains the source of truth (project ethos: deterministic, risk-first, no heuristic magic).
- No change to auto-execution, broker APIs, or intraday logic.

## Decisions (locked during brainstorming)

| # | Decision |
|---|----------|
| Verdict owner | **Screener owns**, LLM enriches. On disagreement the screener verdict stands; the LLM view is a flagged second opinion. |
| Data gathering | **Auto-fetch all, block.** On analyze, missing fundamentals + Finnhub + earnings are fetched server-side before the LLM call. |
| News depth | **Multi-hop news + dedicated catalyst pass.** |
| Second opinion on disagreement | **Inline note** inside the AI section (not hidden, not a headline). |
| Fundamentals in overview | **Surface a compact fundamentals strip** in the overview tab (full detail stays in the fundamentals tab). |
| Token budget | **Bump** `web_search_max_tokens` to fit more search hops. |
| PR scope | **One PR** covering UI + payload + prompt + auto-fetch. |

## Design

### 1. UI — one decision, details below

`SymbolAnalysisContent` overview tab, top to bottom:

1. **Decision header (sticky, screener-owned).** Keep `AnalysisDecisionStrip` as the *only* verdict surface: action badge + conviction + trade plan (entry / stop / target / %-to-target / R:R / risk% / 1R) + Watch/Unwatch + Prepare-order (on `BUY_NOW`). This is the headline answer.
2. **"What to do & why" panel (the unified view).** Three labelled lines — *What to do / Why now / Watch for* — sourced from `decisionSummary` (`whatToDo`, `whyNow`, `mainRisk`/warnings). When an AI result exists, the AI `summaryLine` / `priceHook` enrich the *why* line, but the action shown never changes. This panel renders even before the AI runs, using screener data alone.
3. **Compact fundamentals strip.** A small inline summary (valuation label + a few key fundamentals: P/E, revenue growth, gross margin) in the overview, with the full `FundamentalsSnapshotCard` remaining in the fundamentals tab.
4. **Technical section.** `CachedSymbolCandleChart` + pattern-stop line + `TechnicalMetricsGrid`.
5. **AI analysis section (clearly labelled).** Prediction bullets, key numbers, upcoming events / news, risk factors, full narrative (collapsible), sources, data-inputs chips, past-trades context.

`NarrativeAnalysisCard` changes:

- **Remove the coloured action banner** (`bannerClass(action)` + `actionLabel`). The card no longer presents a competing verdict.
- Replace it with a neutral "AI analysis" header.
- When `intelligence.action !== candidate.decisionSummary.action`, render an **inline second-opinion note**: e.g. *"AI second opinion: Buy now — differs from screener verdict (Watch). Screener verdict stands."* (i18n keyed). This reuses/relabels the existing `aiActionMismatch` string.

All new copy goes through `web-ui/src/i18n/`. No hardcoded strings.

### 2. Backend — always pass all data (auto-fetch, block)

Add a server-side enrichment step so both the API and the CLI benefit (single source of truth, no HTTP-only logic).

- Location: in `analyze_symbol` (`api/routers/intelligence.py`) via a small reusable enricher, so `SymbolAnalyzer.analyze` receives a fully populated `SymbolIntelligenceRequest`. (CLI path that builds the request gets the same enricher.)
- Before the LLM call, for fields that are `None` on the incoming request, fetch and fill:
  - **Finnhub** (`src/swing_screener/fundamentals/finnhub_client.py` via `fundamentals/service.py`): `insider_net_shares_90d`, `insider_transaction_count_90d`, `forward_eps_estimate`, `analyst_upgrade_downgrade_net_30d`.
  - **Fundamentals snapshot** (`api/services/fundamentals_service.py`): P/E, revenue growth, gross margin, balance-sheet signals → new `SymbolIntelligenceRequest` fields.
  - **Earnings** (`api/services/calendar_service.py` / `fundamentals/earnings_proximity.py`): `days_to_earnings`, `next_earnings_date`.
- **Block** until data is loaded; on a provider error, fail the analyze with a clear message rather than silently running on partial data. (Finnhub absence — no API key — degrades gracefully to "unavailable", does not hard-fail.)
- New `SymbolIntelligenceRequest` fields for the raw fundamentals numbers (Finnhub/earnings fields already exist on the model).
- **New fundamentals block in `_build_user_prompt`** rendering the raw fundamentals numbers (today only labels reach the prompt).
- Web `candidateToPayload` extended to send Finnhub + fundamentals + `next_earnings_date` when already loaded, to skip a redundant refetch; the server still fills any gaps.

### 3. Backend — multi-hop news + dedicated catalyst pass (prompt)

Rewrite the search instruction in `_SYSTEM_PROMPT`:

- **Multi-hop:** instruct the model to search broadly first, then follow leads (e.g. earnings beat → search guidance/analyst reaction; downgrade → search the stated reason; new product → search demand/competition signals), iterating until forward-looking catalysts are found.
- **Dedicated forward-catalyst pass:** explicitly search for upcoming earnings, product launches, macro events, and regulatory items; these populate `upcoming_events` and anchor `prediction_bullets`.
- Require URL citations in `sources` for every news claim.
- Bump `web_search_max_tokens` in `config/intelligence.yaml` (from 2000) to fit the extra hops; value chosen during implementation and documented inline.

### 4. Data flow

```
Analyze with AI (web or CLI)
        │
        ▼
SymbolIntelligenceRequest (partial)
        │  enricher fills missing: fundamentals + Finnhub + earnings
        ▼
SymbolIntelligenceRequest (full) ──► _build_user_prompt (now incl. fundamentals block)
        │
        ▼
LLM (web_search, multi-hop + catalyst pass) ──► SymbolIntelligence
        │
        ▼
UI: screener verdict = headline; AI = enrichment + inline second-opinion note on disagreement
```

## Testing

**Backend**

- Enricher: missing fields → fetched and filled; provided fields → not refetched; Finnhub unavailable → graceful, fundamentals/earnings errors → analyze fails clearly.
- `_build_user_prompt`: fundamentals block rendered when data present; absent when not.
- Prompt: multi-hop + catalyst-pass instructions present in `_SYSTEM_PROMPT`.
- `candidateToPayload`-equivalent request building includes the new fields.

**Frontend** (`vitest`, `renderWithProviders`, MSW, i18n-backed assertions)

- Overview renders single verdict header; `NarrativeAnalysisCard` has no coloured action banner.
- Second-opinion inline note appears only when AI action differs from screener action.
- "What to do & why" panel renders from screener data with no AI result; AI enriches the why line when present.
- Compact fundamentals strip renders in overview.

Run `pytest -q` and `cd web-ui && npm test && npm run typecheck && npm run lint` before and after.

## Documentation

- `src/swing_screener/intelligence/README.md`: auto-fetch-all behaviour, new fundamentals prompt block, multi-hop/catalyst search, new request fields.
- `config/README.md` + `config/intelligence.yaml` inline comment: token bump.
- `web-ui/docs/WEB_UI_GUIDE.md`: overview-tab restructure (unified decision, fundamentals strip).
- API surface unchanged (same endpoints, same response model); request model gains optional fields — note in `api/README.md` if the request schema is documented there.

## Risks / trade-offs

- **Latency & cost.** Auto-fetch (block) plus multi-hop search plus a catalyst pass make each AI run noticeably slower and more token-expensive. Accepted per the locked decisions. Mitigations available later if needed: per-day caching of fetched fundamentals/Finnhub, capping hops.
- **Provider failures** during block mode surface as analyze errors; the enricher must distinguish "no API key / optional source" (degrade) from "fetch failed" (fail).
