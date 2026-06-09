# UX Medium-Impact Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confidence and volume-quality signals to Today's candidate rows, and add a "submitted to broker" order state so users can track what they've sent to their broker vs what's just planned.

**Architecture:** Two independent changes. (1) Candidate rows in `Today.tsx` already have `confidence` and could have `volumeRatio` — just render them. (2) Backend order model gains a new `'submitted'` status value; frontend order type and order list UI reflect it.

**Tech Stack:** Python / FastAPI / Pydantic v2 (backend), React 18 / TypeScript / React Query (frontend). Tests: pytest (backend), Vitest (frontend).

---

## File Map

**Task 1 (candidate rows) — frontend only:**
- Modify: `web-ui/src/pages/Today.tsx` — add confidence chip and volume dot to `CandidateItem`
- Modify: `web-ui/src/i18n/messages.en.ts` — add confidence badge i18n key

**Task 2 (submitted order state) — backend + frontend:**
- Modify: `api/models/order.py` — add `'submitted'` to `OrderStatus` literal
- Modify: `api/repositories/orders_repo.py` — allow `submitted` status in write/read paths (if validated)
- Modify: `web-ui/src/types/order.ts` — add `'submitted'` to `OrderStatus` union
- Modify: `web-ui/src/i18n/messages.en.ts` — add `submitted` label to order status display
- Modify: orders list/table UI to show submitted badge (check `web-ui/src/pages/Book.tsx` and any order list components)

---

## Task 1 — Frontend: confidence and volume signal on Today candidate rows

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

Context: `CandidateItem` in `Today.tsx` receives a `DailyReviewCandidate` item. The `DailyReviewCandidate` type (defined in `web-ui/src/features/dailyReview/types.ts`) already has:
- `confidence?: number` — value 0–100 (percentage)
- `volumeRatio?: number` — float; value > 1.0 means above-average volume

The current `CandidateItem` only shows ticker, action badge, r/r, and name. Adding confidence and volume here gives the user enough signal to decide whether to open the side panel.

Volume quality: `volumeRatio >= 1.5` → strong (green dot), `< 0.8` → weak (gray dot), else neutral (no dot).

- [ ] **Step 1: Add i18n key for confidence chip**

In `web-ui/src/i18n/messages.en.ts`, find the `todayPage` section and add under `actionList`:

```typescript
candidateConfidence: '{{pct}}%',
```

- [ ] **Step 2: Add VolumeDot helper component in Today.tsx**

Add before `CandidateItem`:

```typescript
function VolumeDot({ ratio }: { ratio: number | undefined }) {
  if (ratio == null) return null;
  if (ratio >= 1.5) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (strong)`}
      />
    );
  }
  if (ratio < 0.8) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (weak)`}
      />
    );
  }
  return null;
}
```

- [ ] **Step 3: Update CandidateItem to show confidence and volume dot**

Find `CandidateItem` in `Today.tsx`. The current inner button renders:
- ticker span
- action/addOn badge
- r/r span
- name span (truncated)

Replace with:

```typescript
function CandidateItem({ item, isAddOn, onClick, isFocused }: CandidateItemProps) {
  const showCatalyst =
    !isAddOn &&
    item.decisionSummary?.catalystLabel === 'active' &&
    !!item.decisionSummary.catalystSummary;

  return (
    <div>
      <button
        type="button"
        onClick={() => onClick(item.ticker)}
        className={cn(
          'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-blue-500',
          isFocused && 'ring-1 ring-primary',
        )}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
          {item.ticker}
        </span>
        {isAddOn ? (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            {t('todayPage.actionList.addOn')}
          </span>
        ) : (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {item.decisionSummary?.action ?? item.signal}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          r/r: {formatNumber(item.rReward, 2)}R
        </span>
        {item.confidence != null && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
            {t('todayPage.actionList.candidateConfidence', { pct: String(Math.round(item.confidence)) })}
          </span>
        )}
        <VolumeDot ratio={item.volumeRatio} />
        {item.name && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.name}</span>
        )}
      </button>
      {showCatalyst && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <p className="font-semibold text-emerald-800 text-xs uppercase tracking-wide mb-1">
            {t('todayPage.candidateCard.catalystContext')}
          </p>
          <p className="text-emerald-900">{item.decisionSummary!.catalystSummary}</p>
          {item.decisionSummary!.catalystSources.length > 0 && (
            <details className="mt-1">
              <summary className="text-xs text-emerald-700 cursor-pointer select-none">
                {t('todayPage.candidateCard.catalystSources')} ({item.decisionSummary!.catalystSources.length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {item.decisionSummary!.catalystSources.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 hover:underline break-all"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: `item.volumeRatio` comes from `DailyReviewCandidate`. The type file already has this field. No backend change needed.

- [ ] **Step 4: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(web-ui): add confidence % and volume dot to Today candidate rows"
```

---

## Task 2 — Backend + Frontend: submitted order state

**Files:**
- Modify: `api/models/order.py` (check exact path — may be `api/models/`)
- Modify: `web-ui/src/types/order.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Modify: order list/filter UI components (check `web-ui/src/pages/Book.tsx` orders tab and any order table component)

Context: Orders currently have status `pending | filled | cancelled`. When a user places an order in their broker (Degiro), there's no way to mark it as "sent to broker, waiting for fill." Adding `submitted` fills this gap.

`submitted` sits between `pending` and `filled`: `pending` → `submitted` (user clicks "Mark submitted") → `filled` / `cancelled`.

**Backend:** Find the order status type in `api/models/order.py`. Search for `OrderStatus` or `order_status`. It will be a `Literal` or `str` type annotation. Add `'submitted'` to the allowed values. No migration needed — existing `pending` records are unaffected.

**Frontend:** Find `OrderStatus` in `web-ui/src/types/order.ts`. It is `type OrderStatus = 'pending' | 'filled' | 'cancelled'`. Add `'submitted'`.

**API endpoint:** Check if `PUT /api/orders/{order_id}/status` or similar exists in `api/routers/orders.py`. If not, the frontend can't update status yet — in that case, add a simple endpoint.

- [ ] **Step 1: Read existing order backend model**

Read `api/models/order.py` (or whichever file defines `OrderStatus`). Find exact Pydantic or type definition.

- [ ] **Step 2: Add 'submitted' to backend OrderStatus**

Find the `OrderStatus` definition (likely a `Literal` or enum). Add `'submitted'`:

Example if current code is:
```python
class Order(BaseModel):
    status: Literal['pending', 'filled', 'cancelled']
```

Change to:
```python
class Order(BaseModel):
    status: Literal['pending', 'submitted', 'filled', 'cancelled']
```

If there is a separate `OrderStatus` type alias, update that instead and leave `Order` unchanged.

- [ ] **Step 3: Check if a status-update endpoint exists**

```bash
grep -rn "status.*order\|order.*status\|mark.*submitted\|submit.*order" api/routers/ --include="*.py" | head -20
```

If no endpoint exists for updating order status, add one to `api/routers/orders.py`:

```python
@router.patch("/{order_id}/status")
def update_order_status(
    order_id: str,
    status: Literal['submitted', 'cancelled'],
    repo: OrdersRepository = Depends(get_orders_repo),
) -> dict:
    """Mark an order as submitted (sent to broker) or cancelled."""
    order = repo.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ('pending',):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {order.status} to {status}")
    repo.update_order_status(order_id, status)
    return {"order_id": order_id, "status": status}
```

If `OrdersRepository` doesn't have `update_order_status`, check what update methods exist and use the closest equivalent, or add a simple one.

- [ ] **Step 4: Write a pytest test for the new status**

Check if `tests/api/test_orders.py` exists. If so, add:

```python
def test_order_status_includes_submitted():
    from api.models.order import Order
    import pydantic
    # submitted is a valid status
    o = Order(
        order_id="test", ticker="AAPL", order_type="BUY_LIMIT",
        status="submitted", quantity=10, created_at="2026-01-01T00:00:00"
    )
    assert o.status == "submitted"

def test_order_status_rejects_unknown():
    from api.models.order import Order
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        Order(
            order_id="test", ticker="AAPL", order_type="BUY_LIMIT",
            status="invalid_status", quantity=10, created_at="2026-01-01T00:00:00"
        )
```

Adjust field names to match the actual `Order` model. Run `pytest -q` — fix if fields differ.

- [ ] **Step 5: Run backend tests**

```bash
pytest -q
```

All pass.

- [ ] **Step 6: Commit backend**

```bash
git add api/models/order.py api/routers/orders.py
git commit -m "feat(api): add submitted order status and PATCH endpoint"
```

- [ ] **Step 7: Add 'submitted' to frontend OrderStatus**

In `web-ui/src/types/order.ts`:

```typescript
export type OrderStatus = 'pending' | 'submitted' | 'filled' | 'cancelled';
```

- [ ] **Step 8: Add i18n label for submitted status**

In `web-ui/src/i18n/messages.en.ts`, find order-related status labels (search for `pending` in the orders section). Add `submitted` label:

```typescript
// Under ordersPage.filter or wherever status labels live:
submitted: 'Submitted',
```

Also add to the order filter tabs in `ordersPage.filter` if that section exists:
```typescript
submitted: 'Submitted',
```

- [ ] **Step 9: Show submitted badge in order list**

Find the orders table component (likely in `web-ui/src/pages/Book.tsx` or a dedicated orders component). Find where order status badges are rendered. Add a case for `submitted`:

```typescript
// In whatever renders the status badge:
case 'submitted':
  return <Badge variant="info">Submitted</Badge>;
// Or inline:
status === 'submitted' && (
  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
    {t('ordersPage.filter.submitted')}
  </span>
)
```

Add `submitted` to any filter tabs that show order statuses, following the existing pattern for `pending`, `filled`, `cancelled`.

- [ ] **Step 10: Add "Mark submitted" button to pending orders**

In `web-ui/src/pages/Book.tsx` orders tab (or the `PendingOrdersTab` component if separate), find where pending order action buttons are rendered. Add a "Mark submitted" button that calls the new PATCH endpoint:

```typescript
// In the pending orders action area:
<button
  type="button"
  onClick={() => markSubmittedMutation.mutate(order.orderId)}
  className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200"
>
  {t('ordersPage.markSubmitted')}
</button>
```

Add mutation hook in the relevant component:

```typescript
const markSubmittedMutation = useMutation({
  mutationFn: (orderId: string) =>
    fetch(apiUrl(`/api/orders/${orderId}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'submitted' }),
    }).then((r) => { if (!r.ok) throw new Error('Failed'); }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
});
```

Add i18n key:
```typescript
markSubmitted: 'Mark submitted',
```

- [ ] **Step 11: Run tests and typecheck**

```bash
pytest -q && cd web-ui && npm run typecheck && npm test -- --run
```

All pass.

- [ ] **Step 12: Commit frontend**

```bash
git add web-ui/src/types/order.ts web-ui/src/i18n/messages.en.ts
git add web-ui/src/pages/Book.tsx  # or whichever files changed
git commit -m "feat(web-ui): submitted order state and mark-submitted button"
```

---

## Final check

```bash
pytest -q && cd web-ui && npm run typecheck && npm test -- --run
```

Push:

```bash
git push origin ux/medium-impact
```
