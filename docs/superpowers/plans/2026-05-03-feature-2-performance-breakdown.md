# Performance Breakdown by Setup Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.
> **Depends on:** Feature 1 (trade tagging) must be merged first — this feature reads the `tags` field.

**Goal:** Add an "Edge by Setup Type" section to the Analytics/Performance page showing win rate, average R, and expectancy broken down by tag.

**Architecture:** Pure client-side aggregation — no new API endpoints. The existing `GET /api/portfolio/positions` returns all positions including closed ones with their `tags` array. We group and aggregate in a React component. The Analytics page already uses the positions hook.

**Tech Stack:** React 18 / TypeScript, existing `usePositions` hook, Vitest + MSW for tests

---

## File map

| File | Change |
|---|---|
| `web-ui/src/i18n/messages.en.ts` | Add `analyticsPage.edgeBreakdown.*` keys |
| `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.tsx` | New component — stat table by tag group |
| `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.test.tsx` | Tests |
| `web-ui/src/pages/Analytics.tsx` | Mount EdgeBreakdownTable below existing stats |

---

### Task 1: i18n strings

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add strings**

```typescript
// Add inside the existing messages object:
analyticsPage: {
  // ... existing keys preserved ...
  edgeBreakdown: {
    title: 'Edge by setup type',
    emptyState: 'Close and tag 5 or more trades to see your edge breakdown.',
    colTag: 'Tag',
    colTrades: 'Trades',
    colWinRate: 'Win rate',
    colAvgR: 'Avg R',
    colExpectancy: 'Expectancy',
    expectancyHint: 'Avg R × win rate − avg loss R × loss rate',
    byConditionTitle: 'By market condition',
  },
},
```

- [ ] **Step 2: Typecheck**

```bash
cd web-ui && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat: add edge breakdown i18n keys"
```

---

### Task 2: EdgeBreakdownTable component

**Files:**
- Create: `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.tsx`
- Create: `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import EdgeBreakdownTable from './EdgeBreakdownTable';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';

function makePosition(overrides: Partial<Position>): Position {
  return {
    ticker: 'TEST',
    status: 'closed',
    entryDate: '2026-01-01',
    entryPrice: 100,
    stopPrice: 95,
    shares: 10,
    initialRisk: 50,
    exitPrice: 110,
    exitDate: '2026-01-15',
    notes: '',
    tags: [],
    ...overrides,
  };
}

describe('EdgeBreakdownTable', () => {
  it('shows empty state when fewer than 5 tagged trades', () => {
    const positions = [
      makePosition({ tags: ['breakout'], exitPrice: 110 }),
      makePosition({ tags: ['breakout'], exitPrice: 90 }),
    ];
    renderWithProviders(<EdgeBreakdownTable positions={positions} />);
    expect(screen.getByText(t('analyticsPage.edgeBreakdown.emptyState'))).toBeInTheDocument();
  });

  it('shows breakdown when 5+ tagged trades exist', () => {
    const positions = Array.from({ length: 6 }, (_, i) =>
      makePosition({ tags: ['breakout'], exitPrice: i % 2 === 0 ? 110 : 90 })
    );
    renderWithProviders(<EdgeBreakdownTable positions={positions} />);
    expect(screen.getByText('breakout')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument(); // trades count
  });

  it('computes win rate correctly', () => {
    // 3 wins (exit > entry), 1 loss — 75% win rate
    const positions = [
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 90, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
    ];
    renderWithProviders(<EdgeBreakdownTable positions={positions} />);
    expect(screen.getByText('80%')).toBeInTheDocument(); // 4/5 wins
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/EdgeBreakdownTable.test.tsx
```
Expected: FAIL — component not found

- [ ] **Step 3: Implement EdgeBreakdownTable**

Create `web-ui/src/components/domain/portfolio/EdgeBreakdownTable.tsx`:

```typescript
import { useMemo } from 'react';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';

interface TagStats {
  tag: string;
  count: number;
  winRate: number;  // 0–100
  avgR: number;
  expectancy: number;  // avgWinR * winRate/100 - avgLossR * lossRate/100
}

function finalR(p: Position): number | null {
  if (!p.initialRisk || p.initialRisk <= 0 || p.exitPrice == null) return null;
  return (p.exitPrice - p.entryPrice) / p.initialRisk;
}

function computeTagStats(positions: Position[]): TagStats[] {
  const byTag = new Map<string, Position[]>();
  for (const p of positions) {
    for (const tag of p.tags ?? []) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(p);
    }
  }

  const stats: TagStats[] = [];
  for (const [tag, tagged] of byTag.entries()) {
    const rs = tagged.map(finalR).filter((r): r is number => r !== null);
    if (rs.length === 0) continue;
    const wins = rs.filter(r => r > 0);
    const losses = rs.filter(r => r <= 0);
    const winRate = (wins.length / rs.length) * 100;
    const avgWinR = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const expectancy = avgWinR * (winRate / 100) - avgLossR * (1 - winRate / 100);
    stats.push({
      tag,
      count: rs.length,
      winRate,
      avgR: rs.reduce((a, b) => a + b, 0) / rs.length,
      expectancy,
    });
  }
  return stats.sort((a, b) => b.expectancy - a.expectancy);
}

const MIN_TRADES_FOR_DISPLAY = 5;

interface Props {
  positions: Position[];
}

export default function EdgeBreakdownTable({ positions }: Props) {
  const taggedClosed = useMemo(
    () => positions.filter(p => p.status === 'closed' && (p.tags ?? []).length > 0),
    [positions]
  );
  const stats = useMemo(() => computeTagStats(taggedClosed), [taggedClosed]);

  if (taggedClosed.length < MIN_TRADES_FOR_DISPLAY) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
        {t('analyticsPage.edgeBreakdown.emptyState')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {(['colTag', 'colTrades', 'colWinRate', 'colAvgR', 'colExpectancy'] as const).map(key => (
              <th key={key} className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                {t(`analyticsPage.edgeBreakdown.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.tag} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{s.tag}</td>
              <td className="px-4 py-2 tabular-nums">{s.count}</td>
              <td className="px-4 py-2 tabular-nums">{Math.round(s.winRate)}%</td>
              <td className={cn('px-4 py-2 tabular-nums font-semibold', s.avgR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {s.avgR >= 0 ? '+' : ''}{formatNumber(s.avgR, 2)}R
              </td>
              <td className={cn('px-4 py-2 tabular-nums font-semibold', s.expectancy >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {s.expectancy >= 0 ? '+' : ''}{formatNumber(s.expectancy, 2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/EdgeBreakdownTable.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/portfolio/EdgeBreakdownTable.tsx web-ui/src/components/domain/portfolio/EdgeBreakdownTable.test.tsx
git commit -m "feat: add EdgeBreakdownTable component with tag aggregation"
```

---

### Task 3: Wire EdgeBreakdownTable into Analytics page

**Files:**
- Modify: `web-ui/src/pages/Analytics.tsx`

First read the bottom of the Analytics page to find where to insert:
```bash
tail -50 web-ui/src/pages/Analytics.tsx
```

- [ ] **Step 1: Import and mount the component**

Add import at top of `Analytics.tsx`:
```typescript
import EdgeBreakdownTable from '@/components/domain/portfolio/EdgeBreakdownTable';
```

Add a section after the existing stat cards section (before the closing `</div>` of the page container):
```tsx
{/* Edge by setup type */}
<section className="mt-8">
  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
    {t('analyticsPage.edgeBreakdown.title')}
  </h2>
  <EdgeBreakdownTable positions={allPositions} />
</section>
```

Where `allPositions` is the existing closed positions array already used on the page. Check how `Analytics.tsx` fetches positions — it uses `usePositions('closed')`. Pass that data down.

- [ ] **Step 2: Run full frontend suite**

```bash
cd web-ui && npx vitest run
```
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/Analytics.tsx
git commit -m "feat: mount EdgeBreakdownTable on Analytics page"
```
