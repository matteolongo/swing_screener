# Pending Orders as First-Class Daily Review Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each pending entry order from `DailyReview.pendingOrdersReview` as an inline row in `TodayActionList`, between the "Requires Action" and "Watchlist near trigger" sections, with a stale/active/unknown badge and days-pending count.

**Architecture:** The backend already categorises pending entry orders into `stale` / `still_valid` / `no_data` and returns them in `DailyReview.pendingOrdersReview`. The frontend types and transforms are complete. The only missing piece is a `PendingOrderItem` row component inside `TodayActionList` and the corresponding section render. No new files are needed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + MSW, i18n via `t()`.

---

## Files

| Action | Path |
|--------|------|
| Modify | `web-ui/src/i18n/messages.en.ts` |
| Modify | `web-ui/src/pages/Today.tsx` |
| Modify | `web-ui/src/pages/Today.test.tsx` |

---

## Baseline

- [ ] **Step 0: Confirm tests pass**

```bash
cd web-ui && npm test -- --run src/pages/Today.test.tsx
```

Expected: all existing tests pass (should show ~7 tests).

---

## Task 1: Add i18n keys

**Files:** Modify `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1.1: Locate the `todayPage.actionList` block**

It ends just before `keyboard:` at approximately line 2063:

```ts
      timeStopWarning: 'Stale trade: consider closing or documenting a reason to hold.',
    },
    keyboard: {
```

- [ ] **Step 1.2: Add the pending orders i18n keys**

In `web-ui/src/i18n/messages.en.ts`, replace the end of `actionList`:

```ts
      timeStopWarning: 'Stale trade: consider closing or documenting a reason to hold.',
      pendingOrdersSection: 'Pending Orders',
      pendingOrdersCategory: {
        stale: 'Stale',
        still_valid: 'Active',
        no_data: 'Unknown',
      },
      pendingOrdersDaysPending: '{{n}}d pending',
    },
    keyboard: {
```

- [ ] **Step 1.3: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 1.4: Commit i18n keys**

```bash
cd web-ui && git add src/i18n/messages.en.ts
git commit -m "feat(i18n): add pending orders row labels for daily review action list"
```

---

## Task 2: Write failing tests

**Files:** Modify `web-ui/src/pages/Today.test.tsx`

The test fixture needs `pendingOrdersReview` in the mock daily-review response. We use a real order (`orderId`, `ticker`, `category`, `daysPending`).

- [ ] **Step 2.1: Add a helper factory and a fixture at the top of `Today.test.tsx`**

After the existing `threeCloseItemReview` constant, insert:

```ts
function makePendingOrderReview(
  ticker: string,
  orderId: string,
  category: 'stale' | 'still_valid' | 'no_data' = 'stale',
  daysPending = 7,
) {
  return {
    order_id: orderId,
    ticker,
    category,
    days_pending: daysPending,
  };
}

const reviewWithPendingOrders = {
  watchlist_near_trigger: [],
  positions_add_on_candidates: [],
  positions_hold: [],
  positions_update_stop: [],
  new_candidates: [],
  positions_close: [],
  pending_orders_review: [
    makePendingOrderReview('TSLA', 'ORD-TSLA-001', 'stale', 8),
    makePendingOrderReview('AMD', 'ORD-AMD-001', 'still_valid', 2),
  ],
  summary: {
    total_positions: 0,
    no_action: 0,
    update_stop: 0,
    close_positions: 0,
    new_candidates: 0,
    add_on_candidates: 0,
    watchlist_near_trigger: 0,
    review_date: '2026-05-16',
  },
};
```

- [ ] **Step 2.2: Add a new describe block for the pending orders section**

Append at the bottom of `Today.test.tsx`:

```ts
describe('Today page — pending orders review section', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-16' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json(reviewWithPendingOrders)
      )
    );
  });

  it('renders a pending orders section when pendingOrdersReview has items', async () => {
    renderWithProviders(<Today />);
    expect(
      await screen.findByText(t('todayPage.actionList.pendingOrdersSection'))
    ).toBeInTheDocument();
  });

  it('renders one row per pending order', async () => {
    renderWithProviders(<Today />);
    await screen.findByText(t('todayPage.actionList.pendingOrdersSection'));
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('AMD')).toBeInTheDocument();
  });

  it('shows stale badge for a stale order', async () => {
    renderWithProviders(<Today />);
    await screen.findByText(t('todayPage.actionList.pendingOrdersSection'));
    expect(
      screen.getByText(t('todayPage.actionList.pendingOrdersCategory.stale'))
    ).toBeInTheDocument();
  });

  it('shows active badge for a still_valid order', async () => {
    renderWithProviders(<Today />);
    await screen.findByText(t('todayPage.actionList.pendingOrdersSection'));
    expect(
      screen.getByText(t('todayPage.actionList.pendingOrdersCategory.still_valid'))
    ).toBeInTheDocument();
  });

  it('pending orders section appears before watchlist near-trigger in the DOM', async () => {
    server.use(
      http.get('*/api/daily-review', () =>
        HttpResponse.json({
          ...reviewWithPendingOrders,
          watchlist_near_trigger: [
            {
              ticker: 'ASML',
              watched_at: '2026-05-01T10:00:00Z',
              watch_price: 660,
              currency: 'EUR',
              source: 'screener',
              current_price: 671,
              signal_trigger_price: 680,
              distance_to_trigger_pct: -1.3,
              price_history: [],
            },
          ],
          summary: { ...reviewWithPendingOrders.summary, watchlist_near_trigger: 1 },
        })
      )
    );

    renderWithProviders(<Today />);

    const pendingEl = await screen.findByText(
      t('todayPage.actionList.pendingOrdersSection')
    );
    const watchlistEl = screen.getByText(
      new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i')
    );

    expect(
      pendingEl.compareDocumentPosition(watchlistEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2.3: Add `beforeEach` import if not present**

Ensure `beforeEach` is in the vitest import line at the top of `Today.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
```

- [ ] **Step 2.4: Run tests and verify they fail**

```bash
cd web-ui && npm test -- --run src/pages/Today.test.tsx
```

Expected: 5 new tests fail with "Unable to find element" or similar. Existing 7 tests still pass.

---

## Task 3: Implement `PendingOrderItem` and section

**Files:** Modify `web-ui/src/pages/Today.tsx`

- [ ] **Step 3.1: Add `PendingOrderReview` to the type import**

Find the import block near line 25–31:

```ts
import type {
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
} from '@/features/dailyReview/types';
```

Replace with:

```ts
import type {
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  PendingOrderReview,
} from '@/features/dailyReview/types';
```

- [ ] **Step 3.2: Add the `PendingOrderItem` component**

After the `WatchlistNearTriggerItem` function (around line 253) and before the `SectionHeader` function, insert:

```tsx
interface PendingOrderItemProps {
  item: PendingOrderReview;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function PendingOrderItem({ item, onClick, isFocused }: PendingOrderItemProps) {
  const isStale = item.category === 'stale';
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2',
        isStale ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded',
        isStale
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      )}>
        {t(`todayPage.actionList.pendingOrdersCategory.${item.category}`)}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {t('todayPage.actionList.pendingOrdersDaysPending', { n: String(item.daysPending) })}
      </span>
      {item.note && (
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">
          {item.note}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 3.3: Add pending orders to `flatItems`**

In `TodayActionList`, find the `flatItems = useMemo(...)` (around line 444) and add pending orders between positionsUpdateStop and filteredCandidates:

```tsx
  const flatItems = useMemo(
    () => [
      ...(review?.watchlistNearTrigger.map((i) => ({ ticker: i.ticker, id: `watch-${i.ticker}` })) ?? []),
      ...(review?.positionsClose.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsUpdateStop.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.pendingOrdersReview?.map((i) => ({ ticker: i.ticker, id: `pending-${i.orderId}` })) ?? []),
      ...filteredCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker })),
      ...filteredAddOns.map((i) => ({ ticker: i.ticker, id: i.ticker + '-addon' })),
      ...(review?.positionsHold.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
    ],
    [review, filteredCandidates, filteredAddOns],
  );
```

- [ ] **Step 3.4: Render the pending orders section**

In `TodayActionList`'s return, after the "Requires Action" section and **before** the watchlist section (around line 633 in the original), insert:

```tsx
        {/* Pending Orders section — individual order rows between requires-action and watchlist */}
        {(review?.pendingOrdersReview ?? []).length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded">
              {t('todayPage.actionList.pendingOrdersSection')} · {review!.pendingOrdersReview!.length}
            </div>
            <div className="space-y-0.5">
              {review!.pendingOrdersReview!.map((item) => {
                const idx = flatItems.findIndex((fi) => fi.id === `pending-${item.orderId}`);
                return (
                  <PendingOrderItem
                    key={item.orderId}
                    item={item}
                    onClick={handleItemClick}
                    isFocused={focusedIndex === idx}
                  />
                );
              })}
            </div>
          </div>
        )}
```

The final section order in `TodayActionList`'s render is:
1. Requires Action (close + update-stop)
2. Pending Orders ← NEW
3. Watchlist near-trigger
4. Opportunities
5. Holding (collapsed)

- [ ] **Step 3.5: Run tests to verify they pass**

```bash
cd web-ui && npm test -- --run src/pages/Today.test.tsx
```

Expected: all 12 tests pass (7 existing + 5 new).

- [ ] **Step 3.6: Run full test suite**

```bash
cd web-ui && npm test -- --run && npm run typecheck && npm run lint
```

Expected: 0 failures, 0 type errors, 0 lint warnings.

- [ ] **Step 3.7: Commit implementation**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx
git commit -m "feat(today): render pending order rows in TodayActionList as first-class review items"
```

---

## Task 4: Push and open PR

- [ ] **Step 4.1: Push branch**

```bash
git push -u origin feat/pending-orders-daily-review
```

- [ ] **Step 4.2: Create PR**

```bash
gh pr create \
  --title "feat(today): pending orders as first-class daily review items" \
  --body "$(cat <<'EOF'
## Summary
- Adds a **Pending Orders** section to `TodayActionList` between Requires Action and Watchlist Near Trigger
- Each pending entry order from `DailyReview.pendingOrdersReview` appears as a clickable row with a Stale/Active/Unknown badge and a days-pending counter
- Stale orders (≥5 days) get an amber border and badge; still_valid orders get a gray neutral style
- Pending orders included in `flatItems` so j/k keyboard navigation works through them
- 5 new tests added (section render, per-row render, badge labels, DOM section order)

## No backend changes
Backend already returns `pending_orders_review` in `/api/daily-review`. Frontend types and transforms were also already complete. This PR is frontend-only: a new row component and section in `Today.tsx`.

## Test plan
- [ ] `npm test -- --run src/pages/Today.test.tsx` — 12 tests pass
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 warnings
- [ ] Manual: open Today page with pending orders in JSON — rows appear with correct badges
- [ ] Manual: keyboard j/k navigates through pending order rows

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Individual rows per `PendingOrderReview` item ✅
- Stale/still_valid/no_data badge differentiation ✅
- Position between "Requires Action" and watchlist ✅
- Keyboard navigation (`flatItems` inclusion) ✅
- Tests for render, badges, DOM order ✅
- No backend changes needed (already complete) ✅
- i18n keys for all new strings ✅

**Placeholder scan:** None — all code and test content is complete.

**Type consistency:** `PendingOrderReview` imported from `@/features/dailyReview/types` (already defined there). `orderId` field used throughout (matches the transformed frontend type). `item.category` typed as `'stale' | 'still_valid' | 'no_data'` — template literal key access is safe.
