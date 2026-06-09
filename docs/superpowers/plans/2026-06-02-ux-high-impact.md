# UX High-Impact Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface exhaustion score on Today's daily action rows, add 1-click stop accept, merge the duplicate OpenPositionIntelligencePanel into the action list, and add earnings proximity badges to position rows.

**Architecture:** Four changes: (1) backend wires exhaustion from `suggest_position_stop` into daily review models, (2) frontend daily review types gain exhaustion fields surfaced on Hold/Update rows, (3) UpdateItem gets an inline "Accept" stop button, (4) OpenPositionIntelligencePanel is removed from Today and its AI signal is inlined on action list rows, and (5) earnings proximity badge added per position row.

**Tech Stack:** Python / FastAPI / Pydantic v2 (backend), React 18 / TypeScript / React Query (frontend). Tests: pytest (backend), Vitest (frontend).

---

## File Map

**Backend (modify only):**
- `api/models/daily_review.py` — add `exhaustion_score`, `exhaustion_label` to `DailyReviewPositionHold` and `DailyReviewPositionUpdate`
- `api/services/daily_review_service.py` — pass exhaustion fields from `suggestion` to model constructors (two call sites)

**Frontend (modify only):**
- `web-ui/src/features/dailyReview/types.ts` — add exhaustion fields to API and domain types + transforms for Hold/Update
- `web-ui/src/pages/Today.tsx` — render exhaustion badge on HoldItem/UpdateItem; add 1-click accept on UpdateItem; inline AI signal on all position rows; add earnings badge; remove `OpenPositionIntelligencePanel` import/render
- `web-ui/src/i18n/messages.en.ts` — add i18n keys for exhaustion badge and accept action

**Tests (modify only):**
- `tests/test_daily_review_service.py` — assert exhaustion fields present on Hold/Update items (if file exists; check first)
- `web-ui/src/features/dailyReview/types.test.ts` — assert transforms preserve exhaustion fields

---

## Task 1 — Backend: exhaustion fields in daily review models

**Files:**
- Modify: `api/models/daily_review.py`
- Modify: `api/services/daily_review_service.py`

Context: `suggest_position_stop()` already returns a `PortfolioUpdate` Pydantic model (defined in `api/models/portfolio.py`) with `exhaustion_score: Optional[float] = None` and `exhaustion_label: Optional[str] = None`. The daily review service calls `suggest_position_stop` and builds `DailyReviewPositionHold` / `DailyReviewPositionUpdate` from the result. Neither model currently carries exhaustion data.

There are **two** copies of the position-routing logic in `daily_review_service.py` (one used for the web path around line 120, one around line 440). Both must be updated.

- [ ] **Step 1: Add exhaustion fields to DailyReviewPositionHold**

In `api/models/daily_review.py`, add two optional fields to `DailyReviewPositionHold`:

```python
class DailyReviewPositionHold(BaseModel):
    """A position that requires no action (keep current stop)."""
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    days_open: int = 0
    time_stop_warning: bool = False
    reason: str = Field(..., description="Why no action is needed")
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None
```

- [ ] **Step 2: Add exhaustion fields to DailyReviewPositionUpdate**

In the same file, add to `DailyReviewPositionUpdate`:

```python
class DailyReviewPositionUpdate(BaseModel):
    """A position that needs stop price update."""
    position_id: str
    ticker: str
    entry_price: float
    stop_current: float
    stop_suggested: float
    current_price: float
    r_now: float
    days_open: int = 0
    time_stop_warning: bool = False
    reason: str = Field(..., description="Why stop should be updated")
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None
```

- [ ] **Step 3: Wire exhaustion into daily_review_service.py (first call site ~line 174)**

In `api/services/daily_review_service.py`, when `suggestion.action == "NO_ACTION"`, pass exhaustion:

```python
positions_hold.append(
    DailyReviewPositionHold(
        position_id=pos.position_id,
        ticker=pos.ticker,
        entry_price=pos.entry_price,
        stop_price=pos.stop_price,
        current_price=suggestion.last,
        r_now=suggestion.r_now,
        **self._time_stop_payload_from_position(pos, suggestion.r_now, active_manage),
        reason=suggestion.reason,
        exhaustion_score=suggestion.exhaustion_score,
        exhaustion_label=suggestion.exhaustion_label,
    )
)
```

When `suggestion.action == "MOVE_STOP_UP"`:

```python
positions_update.append(
    DailyReviewPositionUpdate(
        position_id=pos.position_id,
        ticker=pos.ticker,
        entry_price=pos.entry_price,
        stop_current=pos.stop_price,
        stop_suggested=suggestion.stop_suggested,
        current_price=suggestion.last,
        r_now=suggestion.r_now,
        **self._time_stop_payload_from_position(pos, suggestion.r_now, active_manage),
        reason=suggestion.reason,
        exhaustion_score=suggestion.exhaustion_score,
        exhaustion_label=suggestion.exhaustion_label,
    )
)
```

- [ ] **Step 4: Wire exhaustion into daily_review_service.py (second call site ~line 460)**

Find the second copy of the same `if suggestion.action == "NO_ACTION"` / `"MOVE_STOP_UP"` block (around line 460) and apply identical changes.

- [ ] **Step 5: Run backend tests**

```bash
pytest -q
```

Expected: all tests pass. If a daily review service test exists that constructs `DailyReviewPositionHold` without exhaustion fields, it should still pass because both fields default to `None`.

- [ ] **Step 6: Commit**

```bash
git add api/models/daily_review.py api/services/daily_review_service.py
git commit -m "feat(api): add exhaustion fields to daily review position models"
```

---

## Task 2 — Frontend: exhaustion fields in daily review types and Today position rows

**Files:**
- Modify: `web-ui/src/features/dailyReview/types.ts`
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

Context: `DailyReviewPositionHoldAPI`, `DailyReviewPositionUpdateAPI`, and their domain types `DailyReviewPositionHold`, `DailyReviewPositionUpdate` don't have exhaustion fields. The transform functions `transformPositionHold` and `transformPositionUpdate` also need updating. `HoldItem` and the update item component in `Today.tsx` need a new exhaustion badge.

The backend returns label values `"fine"`, `"watch"`, or `"exit"` for `exhaustion_label`. The UI should map these to colours matching the existing pattern: fine → emerald, watch → amber, exit → rose.

- [ ] **Step 1: Add exhaustion fields to DailyReviewPositionHoldAPI**

In `web-ui/src/features/dailyReview/types.ts`, add to `DailyReviewPositionHoldAPI`:

```typescript
export interface DailyReviewPositionHoldAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_price: number;
  current_price: number;
  r_now: number;
  days_open?: number;
  time_stop_warning?: boolean;
  reason: string;
  exhaustion_score?: number | null;
  exhaustion_label?: string | null;
}
```

- [ ] **Step 2: Add exhaustion fields to DailyReviewPositionUpdateAPI**

```typescript
export interface DailyReviewPositionUpdateAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_current: number;
  stop_suggested: number;
  current_price: number;
  r_now: number;
  days_open?: number;
  time_stop_warning?: boolean;
  reason: string;
  exhaustion_score?: number | null;
  exhaustion_label?: string | null;
}
```

- [ ] **Step 3: Add exhaustion fields to domain types**

Add to `DailyReviewPositionHold`:

```typescript
export interface DailyReviewPositionHold {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  currentPrice: number;
  rNow: number;
  daysOpen: number;
  timeStopWarning: boolean;
  reason: string;
  exhaustionScore: number | null;
  exhaustionLabel: string | null;
}
```

Add to `DailyReviewPositionUpdate`:

```typescript
export interface DailyReviewPositionUpdate {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopCurrent: number;
  stopSuggested: number;
  currentPrice: number;
  rNow: number;
  daysOpen: number;
  timeStopWarning: boolean;
  reason: string;
  exhaustionScore: number | null;
  exhaustionLabel: string | null;
}
```

- [ ] **Step 4: Update transformPositionHold**

```typescript
export function transformPositionHold(api: DailyReviewPositionHoldAPI): DailyReviewPositionHold {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopPrice: api.stop_price,
    currentPrice: api.current_price,
    rNow: api.r_now,
    daysOpen: api.days_open ?? 0,
    timeStopWarning: api.time_stop_warning ?? false,
    reason: api.reason,
    exhaustionScore: api.exhaustion_score ?? null,
    exhaustionLabel: api.exhaustion_label ?? null,
  };
}
```

- [ ] **Step 5: Update transformPositionUpdate**

Note: `transformPositionUpdate` in `web-ui/src/features/dailyReview/types.ts` is a **different** function from `transformPositionUpdate` in `web-ui/src/types/position.ts`. Do not confuse them.

```typescript
export function transformPositionUpdate(api: DailyReviewPositionUpdateAPI): DailyReviewPositionUpdate {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopCurrent: api.stop_current,
    stopSuggested: api.stop_suggested,
    currentPrice: api.current_price,
    rNow: api.r_now,
    daysOpen: api.days_open ?? 0,
    timeStopWarning: api.time_stop_warning ?? false,
    reason: api.reason,
    exhaustionScore: api.exhaustion_score ?? null,
    exhaustionLabel: api.exhaustion_label ?? null,
  };
}
```

- [ ] **Step 6: Add i18n key for exhaustion badge on position rows**

In `web-ui/src/i18n/messages.en.ts`, find the `todayPage` section (search for `todayPage:`) and add under `actionList`:

```typescript
exhaustionBadge: '{{label}} {{score}}',
```

- [ ] **Step 7: Add ExhaustionBadge helper component in Today.tsx**

Add before the `HoldItem` component definition in `web-ui/src/pages/Today.tsx`:

```typescript
function ExhaustionBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score == null || label == null) return null;
  const emoji = label === 'exit' ? '🔴' : label === 'watch' ? '🟡' : '🟢';
  const colorClass =
    label === 'exit'
      ? 'text-rose-700 dark:text-rose-400'
      : label === 'watch'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-emerald-700 dark:text-emerald-400';
  return (
    <span className={`text-xs font-medium tabular-nums shrink-0 ${colorClass}`} title={`Exhaustion: ${score.toFixed(1)}/10`}>
      {emoji} {score.toFixed(1)}
    </span>
  );
}
```

- [ ] **Step 8: Add ExhaustionBadge to HoldItem**

In the `HoldItem` render, add after the `TimeStopBadge`:

```typescript
<ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
```

- [ ] **Step 9: Add ExhaustionBadge to UpdateItem (the update stop row)**

Find the component that renders `DailyReviewPositionUpdate` rows in `TodayActionList` (search for `stop_suggested` or `stopSuggested` in `Today.tsx`; the component renders the update stop rows). Add `ExhaustionBadge` the same way.

- [ ] **Step 10: Write tests for transforms**

In `web-ui/src/features/dailyReview/types.test.ts`, add:

```typescript
it('transformPositionHold maps exhaustion fields', () => {
  const api: DailyReviewPositionHoldAPI = {
    position_id: 'p1', ticker: 'AAPL', entry_price: 100, stop_price: 90,
    current_price: 110, r_now: 1.0, reason: 'hold', exhaustion_score: 6.5, exhaustion_label: 'watch',
  };
  const result = transformPositionHold(api);
  expect(result.exhaustionScore).toBe(6.5);
  expect(result.exhaustionLabel).toBe('watch');
});

it('transformPositionHold defaults exhaustion to null when absent', () => {
  const api: DailyReviewPositionHoldAPI = {
    position_id: 'p1', ticker: 'AAPL', entry_price: 100, stop_price: 90,
    current_price: 110, r_now: 1.0, reason: 'hold',
  };
  const result = transformPositionHold(api);
  expect(result.exhaustionScore).toBeNull();
  expect(result.exhaustionLabel).toBeNull();
});

it('transformPositionUpdate maps exhaustion fields', () => {
  const api: DailyReviewPositionUpdateAPI = {
    position_id: 'p1', ticker: 'AAPL', entry_price: 100, stop_current: 90,
    stop_suggested: 95, current_price: 115, r_now: 1.5, reason: 'move up',
    exhaustion_score: 8.2, exhaustion_label: 'exit',
  };
  const result = transformPositionUpdate(api);
  expect(result.exhaustionScore).toBe(8.2);
  expect(result.exhaustionLabel).toBe('exit');
});
```

Note: import `DailyReviewPositionHoldAPI`, `DailyReviewPositionUpdateAPI`, `transformPositionHold`, `transformPositionUpdate` from `'@/features/dailyReview/types'`. If the test file doesn't exist yet, create it with a `describe('daily review transforms', ...)` wrapper.

- [ ] **Step 11: Run frontend tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add web-ui/src/features/dailyReview/types.ts web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git add web-ui/src/features/dailyReview/types.test.ts
git commit -m "feat(web-ui): show exhaustion badge on Today position action rows"
```

---

## Task 3 — Frontend: 1-click accept stop on UpdateItem

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`

Context: `TodayActionList` renders `DailyReviewPositionUpdate` items. Currently clicking the row loads the ticker in the analysis canvas and the user must navigate to Book to update the stop. We want an inline "Accept" button that calls `useUpdateStopMutation` directly with `stopSuggested` as the new stop, without any navigation.

`useUpdateStopMutation` is already imported in `Today.tsx` from `@/features/portfolio/hooks`. It takes `{ positionId, request: UpdateStopRequest }` where `UpdateStopRequest = { newStop: number; reason?: string }`.

- [ ] **Step 1: Add useUpdateStopMutation to TodayActionList**

`TodayActionList` already imports `useUpdateStopMutation` (check; if not, add it). Inside `TodayActionList`, instantiate the mutation:

```typescript
const acceptStopMutation = useUpdateStopMutation();
```

- [ ] **Step 2: Add accepted state tracking**

Inside `TodayActionList`, add:

```typescript
const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add accept handler**

```typescript
const handleAcceptStop = useCallback(
  (positionId: string, stopSuggested: number, reason: string) => {
    acceptStopMutation.mutate(
      { positionId, request: { newStop: stopSuggested, reason } },
      { onSuccess: () => setAcceptedStops((prev) => new Set([...prev, positionId])) },
    );
  },
  [acceptStopMutation],
);
```

- [ ] **Step 4: Add i18n key for accept action**

In `web-ui/src/i18n/messages.en.ts`, under `todayPage.actionList`, add:

```typescript
acceptStop: 'Accept',
acceptStopDone: '✓',
```

- [ ] **Step 5: Pass accept handler to UpdateItem rows**

Find where `UpdateItem` components are rendered in `TodayActionList` (search for `<UpdateItem` or the update stop rows in `Today.tsx`). Pass the handler and state:

```typescript
<UpdateItem
  item={item}
  onClick={onTickerSelect}
  onAccept={(positionId, stopSuggested, reason) =>
    handleAcceptStop(positionId, stopSuggested, reason)
  }
  isDone={acceptedStops.has(item.positionId)}
  isAccepting={
    acceptStopMutation.isPending &&
    acceptStopMutation.variables?.positionId === item.positionId
  }
/>
```

- [ ] **Step 6: Update UpdateItem component**

Find the component that renders `DailyReviewPositionUpdate` rows (look for the component rendering `stopSuggested` text in Today.tsx). Update its props and render:

```typescript
interface UpdateItemProps {
  item: DailyReviewPositionUpdate;
  onClick: (ticker: string) => void;
  onAccept?: (positionId: string, stopSuggested: number, reason: string) => void;
  isDone?: boolean;
  isAccepting?: boolean;
  isFocused?: boolean;
}

function UpdateItem({ item, onClick, onAccept, isDone, isAccepting, isFocused }: UpdateItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-amber-500',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t('todayPage.actionList.updateStop')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
      {isDone ? (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
          {t('todayPage.actionList.acceptStopDone')}
        </span>
      ) : onAccept ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onAccept(item.positionId, item.stopSuggested, item.reason);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onAccept(item.positionId, item.stopSuggested, item.reason);
            }
          }}
          className={cn(
            'text-xs px-2 py-0.5 rounded shrink-0 cursor-pointer',
            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'hover:bg-amber-200 dark:hover:bg-amber-800/40',
            isAccepting && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isAccepting ? '…' : t('todayPage.actionList.acceptStop')}
        </span>
      ) : null}
    </button>
  );
}
```

Note: `ExhaustionBadge` was defined in Task 2. If Task 2 is not yet committed, define it inline here.

- [ ] **Step 7: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(web-ui): 1-click accept stop button on Today update stop rows"
```

---

## Task 4 — Frontend: merge OpenPositionIntelligencePanel into TodayActionList

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`

Context: `Today.tsx` renders two panels showing open positions:

1. `OpenPositionIntelligencePanel` (purple section, defined in `web-ui/src/components/domain/positions/OpenPositionIntelligencePanel.tsx`) — shows AI stop-action badge + AI signal (HOLD/TRIM/EXIT) + summary line + "Analyze" button per position.

2. `TodayActionList` — shows Close/Update/Hold/ExitSignal rows from daily review.

Same position (e.g. APAM.AS) appears in both. Fix: use `useOpenPositionsIntelligence()` inside `TodayActionList`, look up the intelligence summary by ticker for each position row, and display the AI signal inline. Then remove `OpenPositionIntelligencePanel` and its import from `Today.tsx`.

`useOpenPositionsIntelligence()` returns an array of `OpenPositionIntelligenceSummary` objects each with `ticker`, `positionSignal` (nullable), `intelligence.summaryLine`, and `stopAction`. It is defined in `web-ui/src/features/portfolio/hooks.ts`. `useAnalyzePositionMutation` is also there.

- [ ] **Step 1: Import useOpenPositionsIntelligence into TodayActionList**

Inside the `TodayActionList` function body in `Today.tsx`, add:

```typescript
const { data: intelligenceSummaries } = useOpenPositionsIntelligence();
const intelligenceByTicker = useMemo(
  () => new Map(intelligenceSummaries?.map((s) => [s.ticker, s]) ?? []),
  [intelligenceSummaries],
);
const analyzeMutation = useAnalyzePositionMutation();
```

Add the required imports at the top of `Today.tsx` if not already present:

```typescript
import { useOpenPositionsIntelligence, useAnalyzePositionMutation } from '@/features/portfolio/hooks';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';
```

- [ ] **Step 2: Add AiSignalBadge helper component**

Before `HoldItem` in `Today.tsx`:

```typescript
function AiSignalBadge({ summary, onAnalyze, isAnalyzing }: {
  summary: OpenPositionIntelligenceSummary | undefined;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}) {
  if (!summary) return null;
  const posSignal = summary.intelligence?.positionSignal;
  if (!posSignal) return null;
  const colorClass =
    posSignal.action === 'EXIT'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : posSignal.action === 'TRIM'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  const labelMap: Record<string, string> = { HOLD: 'Hold', TRIM: 'Trim', EXIT: 'Exit' };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${colorClass}`}>
      {labelMap[posSignal.action] ?? posSignal.action}
    </span>
  );
}
```

- [ ] **Step 3: Pass intelligenceByTicker to HoldItem, UpdateItem, CloseItem, ExitSignalItem**

For each position row rendered in `TodayActionList`, pass the intelligence summary:

```typescript
<HoldItem
  item={item}
  onClick={onTickerSelect}
  isFocused={focusedTicker === item.ticker}
  intelligenceSummary={intelligenceByTicker.get(item.ticker)}
/>
```

(Same pattern for UpdateItem, CloseItem, ExitSignalItem.)

- [ ] **Step 4: Add intelligenceSummary prop and AiSignalBadge to HoldItem**

```typescript
interface HoldItemProps {
  item: DailyReviewPositionHold;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

function HoldItem({ item, onClick, isFocused, intelligenceSummary }: HoldItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-gray-300 dark:border-gray-600',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {t('dailyReview.table.hold.holdBadge')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
      <AiSignalBadge summary={intelligenceSummary} onAnalyze={() => {}} isAnalyzing={false} />
      <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.reason}</span>
    </button>
  );
}
```

Add `intelligenceSummary` prop similarly to `CloseItem` and `ExitSignalItem` and render `AiSignalBadge` there too. The "Analyze" button from the old panel is dropped for now (it was a secondary action; user can still trigger analysis from Research).

- [ ] **Step 5: Remove OpenPositionIntelligencePanel from Today.tsx**

In `Today.tsx`, remove:
1. The import: `import OpenPositionIntelligencePanel from '@/components/domain/positions/OpenPositionIntelligencePanel';`
2. The render: `<OpenPositionIntelligencePanel onTickerSelect={handleTickerSelect} />`

- [ ] **Step 6: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all tests pass. There may be a test for `OpenPositionIntelligencePanel` import in Today tests — verify it doesn't break anything (the component itself still exists, just not rendered on Today).

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/pages/Today.tsx
git commit -m "feat(web-ui): inline AI signal on Today position rows, remove duplicate intelligence panel"
```

---

## Task 5 — Frontend: earnings proximity badge on Today position rows

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

Context: `useEarningsProximity(ticker)` is defined in `web-ui/src/features/portfolio/hooks.ts`. It calls `GET /api/portfolio/earnings-proximity/:ticker` and returns `{ ticker, nextEarningsDate, daysUntil, warning }`. `warning` is `true` when earnings are within a short window (backend decides threshold). Each call is independently cached by React Query per ticker.

`TodayActionList` renders all open-position rows. We want a small earnings badge if `warning === true` (e.g. "⚠ 3d" to earnings).

Because we can't conditionally call hooks per row, we use a wrapper component strategy: create an `EarningsBadge` component that internally calls `useEarningsProximity` for its own ticker. React Query deduplicates and caches, so multiple renders are fine.

- [ ] **Step 1: Create EarningsBadge component**

Add in `Today.tsx`, before `HoldItem`:

```typescript
function EarningsBadge({ ticker }: { ticker: string }) {
  const { data } = useEarningsProximity(ticker);
  if (!data?.warning || data.daysUntil == null) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 shrink-0"
      title={`Earnings in ${data.daysUntil} day${data.daysUntil === 1 ? '' : 's'}`}
    >
      {t('todayPage.actionList.earningsBadge', { days: String(data.daysUntil) })}
    </span>
  );
}
```

Add import at top:
```typescript
import { useEarningsProximity } from '@/features/portfolio/hooks';
```

- [ ] **Step 2: Add i18n key**

In `web-ui/src/i18n/messages.en.ts` under `todayPage.actionList`:

```typescript
earningsBadge: '⚠ {{days}}d',
```

- [ ] **Step 3: Add EarningsBadge to HoldItem, UpdateItem, CloseItem, ExitSignalItem**

In each position row component, add after `AiSignalBadge`:

```typescript
<EarningsBadge ticker={item.ticker} />
```

- [ ] **Step 4: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(web-ui): show earnings proximity badge on Today position rows"
```

---

## Final check

Run:

```bash
pytest -q && cd web-ui && npm run typecheck && npm test -- --run
```

All tests must pass. Then push:

```bash
git push origin ux/high-impact
```
