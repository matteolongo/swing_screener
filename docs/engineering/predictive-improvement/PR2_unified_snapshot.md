# PR 2 — Unified Symbol Analysis Snapshot

> Branch: `feat/unified-snapshot`
> Base: `feature/ux-revamp`
> Depends on: PR1
> Blocks: PR3, PR4

---

## Problem

The workspace currently assembles symbol analysis from three independent storage queries, each with its own `asof` timestamp:

- `screener`: `workspace_snapshot.asof_date`
- `intelligence`: `self._storage.latest_opportunities_date()`
- `portfolio`: `positions_response.asof`

These can come from different market closes. A symbol can be explained using a technical setup from Tuesday, fundamentals from last week, and an intelligence opportunity from Monday. The user cannot tell.

Additionally, when fundamentals load in the frontend, `rebuildDecisionSummaryWithFundamentals()` in `decisionSummary.ts` recomputes the full decision summary locally — including action, conviction, drivers, and risk text — duplicating all server logic and creating a maintenance and drift risk.

**Verified**: `WorkspaceContextMeta.sources` exposes separate timestamps per layer with no consistency check or warning.

---

## Changes

### 1. New file: `src/swing_screener/recommendation/snapshot.py`

Define `SymbolAnalysisSnapshot`:

```python
@dataclass
class SourceMeta:
    layer: str          # "technical" | "fundamentals" | "intelligence"
    asof_date: date | None
    is_fresh: bool      # True if asof_date == analysis reference date

@dataclass
class SymbolAnalysisSnapshot:
    symbol: str
    asof_date: date                       # reference date (typically screener run date)
    technical: ScreenerCandidate | None
    fundamentals: FundamentalsSnapshot | None
    intelligence: Opportunity | None
    decision_summary: DecisionSummary | None
    source_meta: list[SourceMeta]
    warnings: list[str]                   # human-readable, e.g. "fundamentals from 3 days ago"
    is_consistent_snapshot: bool          # True only when all present layers share asof_date
```

`is_consistent_snapshot` logic:
- Collect `asof_date` from each present layer.
- If all match the snapshot `asof_date`, `is_consistent_snapshot = True`.
- Otherwise `False` and a warning is added per mismatched layer.

### 2. `api/services/workspace_context_service.py`

- Build `SymbolAnalysisSnapshot` when assembling workspace context.
- Expose `is_consistent_snapshot` and `warnings` in the API response.
- Add a `source_meta` array to the response model.

### 3. `api/services/screener_service.py`

In `_apply_decision_summary_context`, attach the source timestamps of fundamentals and intelligence to each candidate so the snapshot builder can consume them:

```python
# Add to ScreenerCandidate or DecisionSummary metadata
fundamentals_asof: date | None = None
intelligence_asof: date | None = None
```

### 4. Frontend — remove duplicate decision logic

**`web-ui/src/features/screener/decisionSummary.ts`**

- Remove `rebuildDecisionSummaryWithFundamentals()` or replace its body with a direct return of the server-provided `candidate.decisionSummary`.
- If the backend already returns a complete `decision_summary`, the frontend should not re-derive `action`, `conviction`, `drivers`, or risk text.

**Components that call the rebuild function**

- Wire them to use `candidate.decisionSummary` directly.
- If `decisionSummary` is `null` (candidate not yet enriched), show a loading state — do not compute locally.

### 5. API response model

Add to the workspace/symbol response:
```json
{
  "is_consistent_snapshot": false,
  "snapshot_warnings": ["fundamentals from 2026-04-08, technical from 2026-04-11"],
  "source_meta": [
    { "layer": "technical", "asof_date": "2026-04-11" },
    { "layer": "fundamentals", "asof_date": "2026-04-08" },
    { "layer": "intelligence", "asof_date": "2026-04-11" }
  ]
}
```

---

## Tests

### `tests/test_snapshot.py` (new)

**Test 1 — consistent snapshot when all layers match**
```python
def test_consistent_snapshot_when_all_layers_match():
    snap = build_snapshot(asof=date(2026, 4, 11), ...)
    assert snap.is_consistent_snapshot is True
    assert snap.warnings == []
```

**Test 2 — inconsistent snapshot exposes warning**
```python
def test_inconsistent_snapshot_produces_warning():
    snap = build_snapshot(
        asof=date(2026, 4, 11),
        fundamentals_asof=date(2026, 4, 8),
        ...
    )
    assert snap.is_consistent_snapshot is False
    assert any("fundamentals" in w for w in snap.warnings)
```

**Test 3 — missing layer does not crash snapshot builder**
```python
def test_missing_intelligence_layer_is_allowed():
    snap = build_snapshot(asof=date(2026, 4, 11), intelligence=None, ...)
    assert snap.is_consistent_snapshot is True   # only present layers compared
```

---

## Acceptance criteria

- [ ] Workspace reads one canonical symbol analysis payload.
- [ ] `is_consistent_snapshot` is `False` and warnings appear when layers have different dates.
- [ ] Frontend no longer calls `rebuildDecisionSummaryWithFundamentals()` to derive action/conviction/drivers.
- [ ] All three new tests pass.
- [ ] No existing screener or workspace tests broken.
