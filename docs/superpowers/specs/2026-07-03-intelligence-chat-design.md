# Intelligence Analysis Chat Design

> Status: approved for implementation planning  
> Date: 2026-07-03  
> Base branch: `codex/feat-intelligence-dedicated-tab`  
> Target branch: stacked branch above the dedicated Intelligence tab work

## Summary

Add a compact, ChatGPT-like follow-up chat to the `Intelligence` tab. The chat lets the user ask questions about the loaded symbol intelligence analysis and, on explicit request, refresh app-owned datasource evidence for deeper investigation.

The chat is persisted per ticker per day, remains advisory-only, and does not create or modify orders or positions.

## User Decisions

- Persistence: persist conversations per ticker/day.
- Research mode: default to cached/current analysis; refresh app datasources only when the user explicitly requests it.
- Operational scope: advisory follow-up only. The assistant may explain whether new evidence strengthens or weakens the thesis and what to monitor, but must not create orders or execute position actions.
- Layout: in the `Intelligence` tab, render the analysis first and a compact chat below it. The chat composer is sticky at the bottom of the chat block.
- Evidence display: show sources/evidence only when a response uses a refresh/search.

## Goals

- Give the user a live Q&A surface for the currently loaded intelligence analysis.
- Keep the Overview panel clean; this feature belongs only in the `Intelligence` tab.
- Make datasource usage explicit and bounded to providers already used by the app.
- Persist useful follow-ups for the trading day so the user can return to the same ticker.
- Preserve auditability by storing user/assistant messages and refreshed evidence references.

## Non-Goals

- No order placement, stop updates, scale-out, or exit execution.
- No unrestricted web browsing.
- No cross-ticker conversational memory.
- No long-term multi-day chat memory in the first implementation.
- No streaming UI in the first implementation unless existing app primitives make it trivial.

## UX Design

### Placement

`SymbolAnalysisContent` renders `IntelligenceChatPanel` below `NarrativeAnalysisCard` inside the `intelligence` tab.

If no intelligence analysis exists yet:

- show the existing "Analyze with AI" empty state;
- keep chat disabled;
- show copy: "Run analysis first to ask follow-up questions."

### Layout

Desktop and mobile both use a vertical flow:

1. Analysis card.
2. Compact chat panel.

The chat panel:

- has a compact header: "Ask follow-ups";
- displays "Persisted for {ticker} today";
- uses dense user/assistant bubbles;
- has a bounded message area with internal scroll;
- keeps the composer sticky at the bottom of the chat panel;
- includes a send button;
- includes a refresh-source affordance.

### Refresh Affordance

The first implementation should support an explicit UI toggle:

- label: "Refresh app sources first";
- default: off;
- when on, `refresh_sources=true` is sent with the message.

The backend may also detect clear textual requests like "refresh news first" later, but this is not required for the first slice. The explicit toggle is the source of truth.

### Evidence Display

Assistant messages generated with `refresh_sources=false` render as normal chat bubbles without evidence.

Assistant messages generated with `refresh_sources=true` include a compact collapsible section:

- title: "Evidence used";
- rows with label, source/provider, date if available, and URL if available;
- empty state: "No refreshed evidence returned by configured sources."

## Backend Design

### API Endpoints

Add endpoints under the existing intelligence router:

```http
GET /api/intelligence/{ticker}/chat?date=YYYY-MM-DD
POST /api/intelligence/{ticker}/chat
```

`date` defaults to today's local app date when omitted.

### Models

Request:

```python
class IntelligenceChatRequest(BaseModel):
    message: str
    refresh_sources: bool = False
    analysis_generated_at: str | None = None
    candidate: dict[str, Any] | None = None
    position: dict[str, Any] | None = None
```

Message:

```python
class IntelligenceChatEvidence(BaseModel):
    label: str
    source: str | None = None
    url: str | None = None
    date: str | None = None
    summary: str | None = None

class IntelligenceChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
    refresh_sources: bool = False
    evidence_used: list[IntelligenceChatEvidence] = Field(default_factory=list)
```

Response:

```python
class IntelligenceChatResponse(BaseModel):
    ticker: str
    chat_date: str
    messages: list[IntelligenceChatMessage]
    refreshed_at: str | None = None
```

### Storage

Store conversations in JSON files:

```text
data/intelligence/chat/{TICKER}/{YYYY-MM-DD}.json
```

Each file contains:

- ticker;
- chat date;
- latest known `analysis_generated_at`;
- message list;
- updated timestamp.

Use atomic write semantics consistent with existing cache/history helpers where practical.

### Context Construction

The chat service builds context from app-owned data only:

- latest cached `SymbolIntelligence` via `read_from_cache(ticker)`;
- current day's conversation history;
- recent intelligence history from `read_history(ticker)`;
- `evidenceLedger`, news, upcoming events, key numbers, risk factors, prediction bullets, `inputsUsed` from the latest analysis;
- optional candidate/position payload passed from the frontend;
- refreshed evidence from `collect_evidence(ticker)` only when `refresh_sources=true`.

If no latest analysis exists, the POST endpoint returns `409 Conflict` with a clear message instructing the UI to run analysis first.

### Datasource Policy

When `refresh_sources=false`:

- do not call `collect_evidence`;
- do not call external/web providers;
- answer only from cached intelligence, chat history, and passed context.

When `refresh_sources=true`:

- call only datasource collectors already configured in the app, starting with `collect_evidence(ticker)`;
- include returned evidence in the prompt context;
- include normalized evidence references in the response.

No general web browsing is allowed.

### LLM Prompt Rules

The system/developer prompt for this chat must enforce:

- advisory-only behavior;
- no order creation or trade execution;
- do not invent missing evidence;
- distinguish cached analysis from refreshed evidence;
- if refreshed evidence conflicts with prior analysis, explain the conflict and what to monitor;
- if data is stale or missing, say so explicitly;
- keep answers concise and trader-actionable;
- never mention implementation/provider internals beyond source labels shown in evidence.

### Error Handling

- `404` or `409` when there is no cached analysis: frontend disables chat and prompts analysis generation.
- `503` when the analyzer/LLM is unavailable.
- `500` for unexpected failures, with safe UI copy.
- If refresh datasource fails but cached context exists, return an assistant response explaining that refresh failed and answer from cached context only, unless the failure prevents a useful response.

## Frontend Design

### Feature Module

Add to `web-ui/src/features/intelligence`:

- API functions: `getIntelligenceChat`, `sendIntelligenceChatMessage`;
- hooks: `useIntelligenceChatQuery`, `useSendIntelligenceChatMutation`;
- types and transforms for snake_case to camelCase.

### Component

Add:

```text
web-ui/src/components/domain/workspace/IntelligenceChatPanel.tsx
```

Props:

```ts
interface IntelligenceChatPanelProps {
  ticker: string;
  intelligence: SymbolIntelligence | null;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
}
```

Behavior:

- disabled without `intelligence`;
- loads persisted chat when the `Intelligence` tab is active and intelligence exists;
- sends user message with optional `refreshSources`;
- renders optimistic user bubble if feasible;
- renders assistant bubble and evidence section from response;
- keeps composer sticky within the chat panel.

### Integration

In `SymbolAnalysisContent`:

- render `IntelligenceChatPanel` below `NarrativeAnalysisCard`;
- pass ticker, displayed intelligence, candidate, and position;
- keep chat out of Overview.

### Copy

Add i18n keys under `workspacePage.panels.analysis.intelligence.chat`.

Minimum keys:

- title: "Ask follow-ups"
- persistedToday: "Persisted for {{ticker}} today"
- disabled: "Run analysis first to ask follow-up questions."
- placeholder: "Ask about {{ticker}}..."
- refreshSources: "Refresh app sources first"
- send: "Send"
- sending: "Sending..."
- evidenceUsed: "Evidence used"
- noEvidence: "No refreshed evidence returned by configured sources."
- advisoryOnly: "Advisory only. No orders are created."
- loadError: "Failed to load chat"
- sendError: "Failed to send message"

## Testing Plan

### Backend Tests

- GET returns empty persisted conversation for ticker/day when no file exists and latest analysis exists.
- POST persists user and assistant messages under `data/intelligence/chat/{TICKER}/{YYYY-MM-DD}.json`.
- POST with no latest intelligence returns `409`.
- POST with `refresh_sources=false` does not call `collect_evidence`.
- POST with `refresh_sources=true` calls `collect_evidence` and returns `evidence_used`.
- Stored messages survive a follow-up GET.
- Prompt construction includes latest analysis and excludes arbitrary external browsing.

### Frontend Tests

- `IntelligenceChatPanel` is disabled without analysis.
- Chat loads under the `Intelligence` tab when analysis exists.
- Sending a message renders user and assistant bubbles.
- Refresh toggle sends `refreshSources: true`.
- Evidence section renders only for assistant messages with evidence.
- Existing `AnalysisCanvasPanel` tests continue to verify chat is not in Overview.

## Rollout Plan

Implement as a new stacked branch after `codex/feat-intelligence-dedicated-tab`.

Suggested branch split:

1. Backend chat API and persistence.
2. Frontend chat panel and integration.
3. Polish/docs/tests.

If implementation time should be minimized, combine all three in one branch but keep backend service and frontend component boundaries clean.

## Implementation Defaults

- Generate assistant responses through a dedicated `IntelligenceChatService`, not by extending `SymbolAnalyzer`.
- Reuse existing analyzer configuration and evidence collection where needed, but keep follow-up chat separate from full analysis generation.
- Store chat messages and evidence references only. Do not persist candidate or position snapshots in chat files in the first slice.
- Reconstruct current candidate/position context on each request from frontend payload and cached app data.
- Use one stacked implementation branch unless the diff becomes too large; keep backend service and frontend component boundaries clean either way.
