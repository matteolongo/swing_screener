# Trade Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Add structured tags (setup type, exit reason, market condition) to closed positions so trades are queryable for performance analysis.

**Architecture:** Tags are stored as a `tags: list[str]` field on the Position JSON record. The close-position modal gets a chip-based tag picker step. Journal table gets a tag filter. No backend query needed — filtering is client-side.

**Tech Stack:** Python/Pydantic (backend model), React 18/TypeScript (frontend), MSW (test mocking), i18n via `t()`

---

## Implementation status - 2026-05-03

Status: implemented in draft PR https://github.com/matteolongo/swing_screener/pull/232.

Branch stack:

- Branch: `codex/trade-tagging`
- Base: `main`
- Head commit: `6128fd03`

Implemented commits:

- `763f68d8 feat: add tags field to Position model and close endpoint`
- `f4637299 feat: add tags to frontend Position types`
- `353e11c2 feat: add trade tag i18n strings`
- `7f048d63 feat: add tag picker step to close position modal`
- `6128fd03 feat: add tag column and filters to journal`

What changed:

- `Position` records now support a `tags` list.
- Closing a position can persist selected tags.
- Frontend position types transform tags at the API boundary.
- The close-position modal includes a tag picker step.
- The journal shows trade tags and supports client-side tag filtering.

Review notes:

- Compare PR #232 against `main`.
- Confirm tag IDs are stable enough for analytics, because Feature 2 aggregates directly on stored tag strings.
- Confirm UX copy and available tags match the desired trading workflow before merging downstream PRs.

## File map

| File | Change |
|---|---|
| `api/models/portfolio.py` | Add `tags` field to `Position` and `ClosePositionRequest` |
| `api/services/portfolio_service.py` | Write tags on `close_position()` |
| `web-ui/src/types/position.ts` | Add `tags` to `Position`, `PositionApiResponse`, `transformPosition()` |
| `web-ui/src/i18n/messages.en.ts` | Add tag label strings + close modal step strings |
| `web-ui/src/components/domain/positions/ClosePositionModal.tsx` | Add tag picker step |
| `web-ui/src/components/domain/positions/ClosePositionModal.test.tsx` | Tests for tag step |
| `web-ui/src/pages/Journal.tsx` | Add tag column + filter chips |
| `web-ui/src/pages/Journal.test.tsx` | Tests for tag filtering |

---

### Task 1: Backend — add `tags` field to Position model and close endpoint

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Test: `tests/api/test_trade_tagging.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_trade_tagging.py`:

```python
"""Tests for trade tagging on position close."""
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps

@pytest.fixture
def client_with_open_position(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({
        "asof": "2026-01-01",
        "positions": [{
            "position_id": "POS-TAG-001",
            "ticker": "AAPL",
            "status": "open",
            "entry_date": "2026-01-01",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 10,
            "initial_risk": 50.0,
            "notes": "",
            "tags": [],
        }]
    }))
    orders_file.write_text(json.dumps({"asof": "2026-01-01", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)

def test_close_with_tags_stores_tags(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={
            "exit_price": 110.0,
            "tags": ["breakout", "stop_hit"],
        }
    )
    assert response.status_code == 200
    # Verify tags persisted
    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.status_code == 200
    assert set(resp.json()["tags"]) == {"breakout", "stop_hit"}

def test_close_without_tags_stores_empty_list(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={"exit_price": 110.0}
    )
    assert response.status_code == 200
    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.json()["tags"] == []
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/api/test_trade_tagging.py -v
```
Expected: FAIL — `tags` not accepted by `ClosePositionRequest`

- [ ] **Step 3: Add `tags` to Position and ClosePositionRequest in `api/models/portfolio.py`**

In `Position` (after `lesson` field, line ~37):
```python
tags: list[str] = Field(default_factory=list, description="Structured trade tags")
```

In `ClosePositionRequest` (after `lesson` field, line ~77):
```python
tags: list[str] = Field(default_factory=list, description="Structured tags for this trade")
```

- [ ] **Step 4: Write tags in `close_position()` in `api/services/portfolio_service.py`**

In the `close_position` method, after the `lesson` block (around line 777), add:
```python
if request.tags is not None:
    pos["tags"] = list(request.tags)
```

- [ ] **Step 5: Run tests to confirm passing**

```bash
pytest tests/api/test_trade_tagging.py -v
```
Expected: 2 PASSED

- [ ] **Step 6: Run full backend suite**

```bash
pytest -q
```
Expected: all pass (new tests + existing)

- [ ] **Step 7: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py tests/api/test_trade_tagging.py
git commit -m "feat: add tags field to Position model and close endpoint"
```

---

### Task 2: Frontend types — add `tags` to Position types

**Files:**
- Modify: `web-ui/src/types/position.ts`

- [ ] **Step 1: Add `tags` to the frontend types**

In `web-ui/src/types/position.ts`, add to `Position` interface (after `lesson`):
```typescript
tags?: string[];
```

Add to `PositionApiResponse` interface (after `lesson`):
```typescript
tags?: string[] | null;
```

Add to `ClosePositionRequest` interface (after `lesson`):
```typescript
tags?: string[];
```

In `transformPosition()`, add (after `lesson` mapping):
```typescript
tags: apiPosition.tags ?? [],
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/types/position.ts
git commit -m "feat: add tags to frontend Position types"
```

---

### Task 3: i18n — add tag labels and close modal strings

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add tag strings**

In `web-ui/src/i18n/messages.en.ts`, add a top-level `tradeTags` section and `closePositionModal.tagsStep`:

```typescript
tradeTags: {
  stepTitle: 'Tag this trade (optional)',
  stepHint: 'Tags help you find patterns in your journal',
  // Setup type tags
  breakout: 'Breakout',
  pullback: 'Pullback',
  addOn: 'Add-on',
  // Exit reason tags
  stopHit: 'Stop hit',
  targetReached: 'Target reached',
  timeStop: 'Time stop',
  manualExit: 'Manual exit',
  // Market condition tags
  trending: 'Trending market',
  choppy: 'Choppy market',
  newsDriven: 'News driven',
},
```

Also add to `closePositionModal` (or create it if missing):
```typescript
closePositionModal: {
  title: 'Close position',
  skipTags: 'Skip',
  confirmClose: 'Confirm close',
},
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat: add trade tag i18n strings"
```

---

### Task 4: Frontend — tag picker in ClosePositionModal

**Files:**
- Modify: `web-ui/src/components/domain/positions/ClosePositionModal.tsx`
- Create: `web-ui/src/components/domain/positions/ClosePositionModal.test.tsx`

First, read the existing ClosePositionModal to understand its current structure:
```bash
cat web-ui/src/components/domain/positions/ClosePositionModal.tsx
```

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/components/domain/positions/ClosePositionModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import ClosePositionModal from './ClosePositionModal';
import { t } from '@/i18n/t';

const openPosition = {
  positionId: 'POS-001',
  ticker: 'AAPL',
  status: 'open' as const,
  entryDate: '2026-01-01',
  entryPrice: 100,
  stopPrice: 95,
  shares: 10,
};

describe('ClosePositionModal tag picker', () => {
  it('shows tag chips after filling close price', async () => {
    renderWithProviders(
      <ClosePositionModal position={openPosition} onClose={() => {}} />
    );
    const priceInput = screen.getByRole('spinbutton');
    fireEvent.change(priceInput, { target: { value: '110' } });
    expect(await screen.findByText(t('tradeTags.stepTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('tradeTags.breakout'))).toBeInTheDocument();
  });

  it('submits selected tags with close request', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('*/api/portfolio/positions/POS-001/close', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ status: 'ok', position_id: 'POS-001', exit_price: 110 });
      })
    );
    renderWithProviders(
      <ClosePositionModal position={openPosition} onClose={() => {}} />
    );
    const priceInput = screen.getByRole('spinbutton');
    fireEvent.change(priceInput, { target: { value: '110' } });
    fireEvent.click(await screen.findByText(t('tradeTags.breakout')));
    fireEvent.click(screen.getByText(t('closePositionModal.confirmClose')));
    await vi.waitFor(() => {
      expect((capturedBody as { tags: string[] }).tags).toContain('breakout');
    });
  });

  it('submits empty tags when skipped', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('*/api/portfolio/positions/POS-001/close', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ status: 'ok', position_id: 'POS-001', exit_price: 110 });
      })
    );
    renderWithProviders(
      <ClosePositionModal position={openPosition} onClose={() => {}} />
    );
    const priceInput = screen.getByRole('spinbutton');
    fireEvent.change(priceInput, { target: { value: '110' } });
    fireEvent.click(await screen.findByText(t('closePositionModal.skipTags')));
    await vi.waitFor(() => {
      expect((capturedBody as { tags: string[] }).tags).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/positions/ClosePositionModal.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Add tag picker to ClosePositionModal**

The modal has a price+reason form. Add a second "step" that shows after the price is entered (not a two-screen wizard — just a section that appears below):

```typescript
// Add to state:
const [selectedTags, setSelectedTags] = useState<string[]>([]);

// Tag groups (define above component or in a constants file):
const TAG_GROUPS = [
  {
    key: 'setup',
    tags: [
      { id: 'breakout', label: t('tradeTags.breakout') },
      { id: 'pullback', label: t('tradeTags.pullback') },
      { id: 'add_on', label: t('tradeTags.addOn') },
    ],
  },
  {
    key: 'exit',
    tags: [
      { id: 'stop_hit', label: t('tradeTags.stopHit') },
      { id: 'target_reached', label: t('tradeTags.targetReached') },
      { id: 'time_stop', label: t('tradeTags.timeStop') },
      { id: 'manual_exit', label: t('tradeTags.manualExit') },
    ],
  },
  {
    key: 'condition',
    tags: [
      { id: 'trending', label: t('tradeTags.trending') },
      { id: 'choppy', label: t('tradeTags.choppy') },
      { id: 'news_driven', label: t('tradeTags.newsDriven') },
    ],
  },
];

// Toggle tag helper:
function toggleTag(id: string) {
  setSelectedTags(prev =>
    prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
  );
}
```

Add tag chips section in JSX (show when exitPrice input has a value):
```tsx
{exitPrice && (
  <div className="mt-4">
    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {t('tradeTags.stepTitle')}
    </p>
    <p className="text-xs text-gray-500 mb-3">{t('tradeTags.stepHint')}</p>
    <div className="flex flex-wrap gap-2">
      {TAG_GROUPS.flatMap(g => g.tags).map(tag => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleTag(tag.id)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            selectedTags.includes(tag.id)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          )}
        >
          {tag.label}
        </button>
      ))}
    </div>
  </div>
)}
```

In the submit handler, include `tags: selectedTags` in the close request body.

Add "Skip" link and "Confirm close" button replacing the existing submit button when tags section is visible.

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/positions/ClosePositionModal.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/positions/ClosePositionModal.tsx web-ui/src/components/domain/positions/ClosePositionModal.test.tsx
git commit -m "feat: add tag picker step to close position modal"
```

---

### Task 5: Journal — tag column and filter chips

**Files:**
- Modify: `web-ui/src/pages/Journal.tsx`
- Create: `web-ui/src/pages/Journal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/pages/Journal.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import JournalPage from './Journal';
import { t } from '@/i18n/t';

const closedPositions = [
  {
    position_id: 'POS-001', ticker: 'AAPL', status: 'closed',
    entry_date: '2026-01-01', entry_price: 100, stop_price: 95,
    shares: 10, initial_risk: 50, exit_price: 110, exit_date: '2026-01-15',
    notes: '', tags: ['breakout'],
  },
  {
    position_id: 'POS-002', ticker: 'MSFT', status: 'closed',
    entry_date: '2026-01-05', entry_price: 200, stop_price: 190,
    shares: 5, initial_risk: 50, exit_price: 195, exit_date: '2026-01-20',
    notes: '', tags: ['pullback', 'stop_hit'],
  },
];

describe('Journal tag filtering', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/portfolio/positions', () =>
        HttpResponse.json({ positions: closedPositions, asof: '2026-01-20' })
      )
    );
  });

  it('shows both positions with no filter active', async () => {
    renderWithProviders(<JournalPage />);
    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('filters to only breakout trades when breakout chip clicked', async () => {
    renderWithProviders(<JournalPage />);
    await screen.findByText('AAPL');
    fireEvent.click(screen.getByText(t('tradeTags.breakout')));
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('clicking active filter chip clears it', async () => {
    renderWithProviders(<JournalPage />);
    await screen.findByText('AAPL');
    fireEvent.click(screen.getByText(t('tradeTags.breakout')));
    fireEvent.click(screen.getByText(t('tradeTags.breakout')));
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/pages/Journal.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Add tag filter chips and tag column to Journal.tsx**

Add state and filter logic near the top of the `JournalPage` component:
```typescript
const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

const allTags = useMemo(() => {
  const tagSet = new Set<string>();
  closedPositions.forEach(p => (p.tags ?? []).forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}, [closedPositions]);

const filteredPositions = useMemo(() =>
  activeTagFilter
    ? closedPositions.filter(p => (p.tags ?? []).includes(activeTagFilter))
    : closedPositions,
  [closedPositions, activeTagFilter]
);
```

Add filter chips above the table:
```tsx
{allTags.length > 0 && (
  <div className="flex flex-wrap gap-2 mb-4">
    {allTags.map(tag => (
      <button
        key={tag}
        onClick={() => setActiveTagFilter(prev => prev === tag ? null : tag)}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
          activeTagFilter === tag
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
        )}
      >
        {t(`tradeTags.${tag.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any) ?? tag}
      </button>
    ))}
  </div>
)}
```

Change table data source from `closedPositions` to `filteredPositions`.

Add a Tags column to the journal table header and row:
```tsx
// In header row:
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
// In data row:
<td className="px-4 py-3 text-xs text-gray-500">
  {(position.tags ?? []).join(', ') || '—'}
</td>
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/pages/Journal.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 5: Run full frontend suite**

```bash
cd web-ui && npx vitest run
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/pages/Journal.tsx web-ui/src/pages/Journal.test.tsx
git commit -m "feat: add tag filter chips and tag column to journal"
```
