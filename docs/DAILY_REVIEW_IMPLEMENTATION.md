# Daily Review Implementation Guide

**Feature:** Daily Routine - Unified trading dashboard  
**Status:** Production Ready ✅  
**Branch:** v2/daily-routine-revamp  
**Date:** February 11, 2026

---

## Overview

The Daily Review feature combines screener results with position management in a single unified dashboard. Users can:
- See new trade candidates from screener
- Review positions requiring stop updates
- Identify positions to close
- Create orders directly from candidates
- View historical daily reviews

---

## Architecture

### Backend (FastAPI)

**Service:** `DailyReviewService` (`api/services/daily_review_service.py`)
- Combines screener results + position analysis in single API call
- Categorizes positions by action: NO_ACTION, MOVE_STOP_UP, CLOSE_STOP_HIT, CLOSE_TIME_EXIT
- Auto-saves to `data/daily_reviews/daily_review_YYYY-MM-DD_strategy.json`

**Models:** (`api/models/daily_review.py`)
- `DailyReview` - Main response
- `DailyReviewCandidate` - Screener candidate with recommendation
- `DailyReviewPositionHold` - No action needed
- `DailyReviewPositionUpdate` - Stop update suggested
- `DailyReviewPositionClose` - Close suggested
- `DailyReviewSummary` - Stats summary

**Router:** `GET /api/daily-review?top_n=10` (`api/routers/daily_review.py`)

### Frontend (React + TypeScript)

**Types:** `web-ui/src/types/dailyReview.ts`
- API types (snake_case) + Frontend types (camelCase)
- Transform functions at API boundary

**API Client:** `web-ui/src/features/dailyReview/api.ts`
- `getDailyReview()` - Fetch function
- `useDailyReview()` - React Query hook with 5-min caching

**Page:** `web-ui/src/pages/DailyReview.tsx` (844 lines)
- 4 collapsible sections (candidates, hold, update, close)
- Refresh button with loading state
- Create Order modal integration
- Recommendation modal integration

---

## Key Implementation Patterns

### 1. PositionsResponse Handling

**CRITICAL:** `PortfolioService.list_positions()` returns `PositionsResponse` object, not a list.

```python
# WRONG - Will cause AttributeError
positions = portfolio.list_positions()
for pos in positions:  # ERROR!
    print(pos.position_id)

# CORRECT
positions_response = portfolio.list_positions()
for pos in positions_response.positions:  # Works!
    print(pos.position_id)
```

**Files:**
- `api/services/daily_review_service.py:60-62`
- `tests/api/test_daily_review_service.py:75-103`

**Why it matters:** This bug appeared during development (commit 708bf6b). Tests must mock correctly:

```python
mock_portfolio.list_positions.return_value = PositionsResponse(
    positions=[...],
    asof="2026-02-11"
)
```

---

### 2. Type Transformation Pattern

**Rule:** Backend uses snake_case (Python), Frontend uses camelCase (TypeScript)

**Transform at API boundary:**

```typescript
// API Response
interface DailyReviewCandidateAPI {
  entry_price: number;
  stop_price: number;
  r_reward: number;
}

// Frontend Type
interface DailyReviewCandidate {
  entryPrice: number;
  stopPrice: number;
  rReward: number;
}

// Transform Function
function transformCandidate(api: DailyReviewCandidateAPI): DailyReviewCandidate {
  return {
    entryPrice: api.entry_price,
    stopPrice: api.stop_price,
    rReward: api.r_reward,
  };
}
```

**Files:**
- `web-ui/src/types/dailyReview.ts:110-158`
- See also: `position.ts`, `order.ts` for same pattern

---

### 3. React Query Caching Strategy

**Pattern:** Manual refresh with aggressive caching

```typescript
useQuery({
  queryKey: ['dailyReview', topN],
  queryFn: () => getDailyReview(topN),
  staleTime: 1000 * 60 * 5,        // 5 minutes - data is stable
  refetchOnWindowFocus: false,      // User controls refresh
})
```

**Rationale:** Daily review data doesn't change frequently within a trading session. Let user decide when to refresh.

**Implementation:** Refresh button with loading spinner:

```tsx
const { refetch, isFetching } = useDailyReview(10);

<Button onClick={() => refetch()} disabled={isFetching}>
  <RefreshCw className={isFetching ? 'animate-spin' : ''} />
  {isFetching ? 'Refreshing...' : 'Refresh'}
</Button>
```

**Files:**
- `web-ui/src/features/dailyReview/api.ts:31-37`
- `web-ui/src/pages/DailyReview.tsx:78-87`

---

### 4. Modal Reusability

**Discovery:** Same modals are used across Screener, Daily Review, and Positions pages.

**Pattern:**

```tsx
// Reused across pages
<CreateOrderModal
  candidate={selectedCandidate}
  risk={riskConfig}
  onClose={() => setShowModal(false)}
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    setShowModal(false);
  }}
/>
```

**Shared Modals:**
1. `CreateOrderModal` - Used in Screener.tsx, DailyReview.tsx
2. `RecommendationModal` - Used in Screener.tsx, DailyReview.tsx
3. `UpdateStopModal` - Could be reused in Daily Review (not yet implemented)
4. `ClosePositionModal` - Could be reused in Daily Review (not yet implemented)

**Files:**
- `web-ui/src/pages/DailyReview.tsx:624-858` - CreateOrderModal
- `web-ui/src/pages/Screener.tsx:743-989` - Original CreateOrderModal

**TODO:** Extract to `web-ui/src/components/domain/` for better organization

---

### 5. Recommendation Validation (Risk Management)

**CRITICAL:** Create Order modal blocks NOT_RECOMMENDED trades.

```typescript
if (!isRecommended) {
  setError('This setup is not recommended. Review the checklist and fix issues first.');
  setIsSubmitting(false);
  return;
}
```

**Why it matters:** Aligns with project's "risk-first" philosophy. Prevents users from accidentally trading bad setups.

**Files:**
- `web-ui/src/pages/DailyReview.tsx:661-668`
- `web-ui/src/pages/Screener.tsx:780-784`

**Rule:** NEVER bypass this validation—it's a safety mechanism.

---

### 6. Historical Data Tracking

**Feature:** Every daily review is auto-saved to preserve trading decisions.

**Location:** `data/daily_reviews/`  
**Format:** `daily_review_YYYY-MM-DD_strategy.json`  
**Example:** `daily_review_2026-02-11_default.json`

**Contents:**
```json
{
  "new_candidates": [...],
  "positions_hold": [...],
  "positions_update_stop": [...],
  "positions_close": [...],
  "summary": {
    "review_date": "2026-02-11",
    "total_positions": 5,
    "no_action": 2,
    "update_stop": 2,
    "close_positions": 1,
    "new_candidates": 10
  }
}
```

**Implementation:**

```python
def _save_review(self, review: DailyReview, strategy_name: str) -> None:
    review_date = review.summary.review_date
    filename = f"daily_review_{review_date.isoformat()}_{strategy_name}.json"
    filepath = self.daily_reviews_dir / filename
    
    review_dict = review.model_dump(mode="json")
    
    with open(filepath, 'w') as f:
        json.dump(review_dict, f, indent=2)
```

**Files:**
- `api/services/daily_review_service.py:140-156`
- `.gitignore` - Excludes `data/daily_reviews/`
- `data/README.md` - Documentation

**Use cases:**
- Audit trail of trading decisions
- Performance analysis over time
- Compare recommendations vs. actual trades

---

## Common Gotchas

### 1. RiskConfig Property Names

**WRONG:**
```typescript
risk.maxRiskPerTrade  // This property doesn't exist!
```

**CORRECT:**
```typescript
risk.riskPct  // Correct property name
```

**Full interface:**
```typescript
interface RiskConfig {
  accountSize: number;
  riskPct: number;           // ← Use this
  maxPositionPct: number;
  minShares: number;
  kAtr: number;
  minRr: number;
  maxFeeRiskPct: number;
}
```

**Files:**
- `web-ui/src/types/config.ts:7-15`

---

### 2. Badge Variant Names

**Available variants:**
- Badge: `'default'`, `'primary'`, `'success'`, `'warning'`, `'error'`
- Button: `'primary'`, `'secondary'`, `'danger'`, `'ghost'`

**NOT available:**
- ~~`'info'`~~ (use `'primary'`)
- ~~`'danger'`~~ for Badge (use `'error'`)

---

## Testing Strategy

### Backend Tests

**Pattern:** Mock at service boundary, not implementation details.

```python
# Good: Mock service response
mock_screener.run_screener.return_value = ScreenerResponse(...)
mock_portfolio.list_positions.return_value = PositionsResponse(
    positions=[...],
    asof="2026-02-11"
)

# Bad: Mock internal methods
mock_screener._fetch_data = Mock(...)  # Too deep!
```

**Files:**
- `tests/api/test_daily_review_service.py` - 8 tests, all passing

### Frontend Tests

**Pattern:** Use `renderWithProviders()` helper for React Query + Router.

```typescript
import { renderWithProviders } from '@/test/utils';

test('displays candidates table', async () => {
  renderWithProviders(<DailyReview />);
  await screen.findByText('New Trade Candidates');
});
```

**Files:**
- `web-ui/src/test/utils.tsx` - Test utilities
- `web-ui/src/test/mocks/handlers.ts` - MSW API mocks

---

## How to Extend

### Adding a New Section

**Example:** Add "Profit Taking" section

**1. Backend Model:**
```python
# api/models/daily_review.py
class DailyReviewPositionProfit(BaseModel):
    position_id: str
    ticker: str
    current_r: float
    suggested_target: float
    reason: str
```

**2. Backend Service:**
```python
# api/services/daily_review_service.py
def generate_daily_review(...):
    positions_profit = []
    for pos in positions:
        if should_take_profit(pos):
            positions_profit.append(...)
    
    return DailyReview(..., positions_profit=positions_profit)
```

**3. Frontend Type:**
```typescript
// web-ui/src/types/dailyReview.ts
export interface DailyReviewPositionProfit {
  positionId: string;
  ticker: string;
  currentR: number;
  suggestedTarget: number;
  reason: string;
}
```

**4. Frontend UI:**
```tsx
// web-ui/src/pages/DailyReview.tsx
<CollapsibleSection title="💰 Take Profit">
  <ProfitTable positions={review.positionsProfit} />
</CollapsibleSection>
```

**5. Tests:**
```python
def test_profit_taking(mock_screener, mock_portfolio):
    # Test profit-taking logic
```

---

## Debugging Tips

### Daily Review won't load

**1. Check API response:**
```bash
curl http://localhost:8000/api/daily-review?top_n=10
```

**2. Common issues:**
- PositionsResponse not extracted (use `.positions`)
- Transform function missing fields
- RiskConfig property name wrong

**3. Browser console:**
- TypeScript errors (red squiggles)
- Network tab for API errors
- React Query devtools for cache state

### Tests failing

**Backend:**
- Check mock return types match PositionsResponse
- Verify ScreenerResponse has correct fields

**Frontend:**
- Run `npx tsc --noEmit` for type errors
- Check MSW handlers return correct API shape

---

## Related Files

### Core Implementation
- `api/services/daily_review_service.py` - Service logic
- `api/models/daily_review.py` - API types
- `api/routers/daily_review.py` - HTTP endpoint
- `web-ui/src/types/dailyReview.ts` - TypeScript types
- `web-ui/src/features/dailyReview/api.ts` - API client
- `web-ui/src/pages/DailyReview.tsx` - Page component

### Testing
- `tests/api/test_daily_review_service.py` - Backend tests (8/8)
- `web-ui/vitest.config.ts` - Test configuration

### Documentation
- `data/README.md` - Data directory structure
- `ROADMAP.md` - Feature roadmap
- `AGENTS.md` - AI agent guidelines

---

## Commit History

```
a8b40d8 - feat: Add refresh button and Create Order modal
a69b906 - feat: Add recommendation modal to Daily Review candidates
708bf6b - fix: Daily Review service - handle PositionsResponse correctly
9a77f40 - feat: Daily Review frontend page (Phase 3)
e6e1d24 - docs: Update ROADMAP with daily routine and future plans
7bc7c13 - test: Add tests for stop order synchronization
6de16d3 - fix: Update stop modal pre-fills suggested price
f87f6b1 - feat: Daily Review API endpoint and stop sync (Phases 1-2)
```

---

## Next Steps

**Future enhancements:**
- [ ] Extract modals to `web-ui/src/components/domain/`
- [ ] Add Update Stop modal to Daily Review (reuse from Positions)
- [ ] Add Close Position modal to Daily Review (reuse from Positions)
- [ ] Update `docs/WEB_UI_GUIDE.md` with Daily Review section
- [ ] Add architecture diagram for data flow

**Next feature:** Currency filter implementation (see session plan.md)

---

_Last updated: 2026-02-11_  
_See AGENTS.md for project conventions and philosophy_
