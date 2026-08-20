# Symbol Workspace Review Fixes Design

**Date:** 2026-08-04
**Status:** Approved

## Context

PR #435 expands Today into a symbol analysis workspace and adds explicit data
trust, provenance, freshness, retries, and request-state reporting. An xhigh
review found eleven gaps between the approved workspace design and the committed
implementation. This stacked change fixes all of them without changing manual
execution boundaries or Backtest behavior.

The branch targets `feat/symbol-workspace-redesign` and remains a single stacked
PR because the backend cache semantics, frontend trust model, compact rail, and
activity history are parts of one user-visible contract.

## Goals

- Keep validated evidence available when a provider refresh fails.
- Distinguish volume-data provider failure from a valid empty result.
- Use server-owned provenance and content timestamps for workspace health.
- Prevent mismatched intelligence responses from entering the active workspace.
- Load all orders without applying a literal `all` backend filter.
- Render a real compact symbol rail while preserving the mounted list state.
- Maintain a bounded, request-ID-based activity history for the active workspace
  session, including discarded late responses.
- Announce each new failure once without leaving persistent content as an alert.
- Use UTC consistently for evidence cache dates.
- Restore a clean `git diff --check` result.

## Non-goals

- No automatic trading, order submission, stop mutation, or broker integration.
- No automatic paid intelligence calls on symbol selection or generic refresh.
- No changes to Backtest calculations, routing, or visible behavior.
- No new operator-tunable freshness policy in the browser.
- No unrelated redesign of Today, Screener, or Watchlist.

## Architecture

React Query remains the owner of server data and Zustand remains the owner of
workspace selection, layout, and session-local activity history. API responses
carry authoritative provider, data-as-of, fetch-time, and freshness information;
the browser transforms but does not recreate those facts.

The existing Today source panels remain mounted. When the workspace is expanded,
each panel renders a compact representation through a shared symbol-rail row
primitive instead of squeezing the full table or card layout. This preserves
query state, filters, sorting, selection, and scroll state without introducing a
second data owner.

Workspace activity is a separate UI model rather than a renamed source snapshot.
Source snapshots describe the current trust state; activity records describe
individual requests and their lifecycle. Both carry normalized ticker and
selection version so a late response can be rejected and recorded as discarded.

## Backend behavior

### Evidence refresh and cache preservation

`collect_evidence` will use the current UTC date when no `asof_date` is supplied.
Normal cached reads remain unchanged.

For forced refreshes, collectors produce per-provider outcomes before the cache
is replaced:

- If every attempted collector fails, return no refreshed items to the endpoint
  while preserving the prior validated cache file byte-for-byte.
- If at least one collector succeeds, merge refreshed providers with prior cached
  evidence from providers that failed during this attempt. Re-curate the merged
  set and atomically replace the cache.
- A successful provider that legitimately returns zero items replaces that
  provider's prior entries with zero items; it is not treated as a failure.
- Temporary files are written beside the target and moved into place only after
  serialization succeeds.

The refresh endpoint continues to report `fresh`, `partial`, or `failed` from
the attempt manifest. Preserved prior evidence does not turn a failed provider
attempt into a successful one.

Latest-cache freshness uses UTC dates. A cache dated after the injected current
date is not `fresh`; it is treated as stale/invalid metadata rather than silently
accepting clock skew.

### Volume analysis failure

`GET /api/market-data/{ticker}/volume-analysis` returns HTTP 502 with a sanitized
structured detail when OHLCV collection raises. A provider returning an empty
frame remains a valid HTTP 200 empty/no-trade analysis. The response never
includes raw exception text, credentials, or provider payloads.

## Frontend trust contracts

### Prices

The workspace prices source consumes `TickerCandles.provider`, `dataAsOf`, and
`fetchedAt` directly. Intelligence staleness compares its generation time with
content dependency times such as candle `dataAsOf`, never React Query's
`dataUpdatedAt`. Refetching identical bars therefore does not invalidate an
analysis.

### Intelligence

Intelligence health uses the existing `dataStatus`, `degradedReasons`, and source
list. It does not require a nonexistent `provider` property. Current results are
fresh unless their status says stale/intraday/unknown or degraded reasons require
a partial state.

`useIntelligenceLatestQuery` validates that the transformed response symbol
matches the normalized requested ticker. Mismatches reject with a typed identity
error, so every consumer—including `SymbolAnalysisContent`—shares the guard.
Mutation results retain their existing ticker and selection-version checks.

### Orders

`fetchOrders('all')` omits the `status` query parameter, matching
`fetchPositions('all')`. Specific status filters remain unchanged.

## Compact symbol rail

A reusable `SymbolRailRow` presents:

- ticker;
- canonical workflow or list status;
- selected state;
- the source-specific primary context needed to distinguish rows.

Today, Screener, and Watchlist receive an explicit compact mode from `Today.tsx`.
Compact mode hides wide-only controls and columns but keeps the same component
instance and data/query ownership. Selecting a rail row uses the existing
selection action. Collapsing or closing restores the full panel with its prior
tab, filters, sorting, scroll, and selection intact.

On small screens the workspace continues to replace the list rather than forcing
the narrow desktop rail. Full-screen mode hides the rail without clearing the
selection.

## Activity lifecycle

### Data model

`WorkspaceActivity` contains:

- `requestId`;
- normalized `ticker`;
- `selectionVersion`;
- `sourceId`;
- lifecycle phase: `active`, `completed`, `partial`, `failed`, or `discarded`;
- `startedAt` and nullable `finishedAt`;
- provider/provenance fields when known;
- sanitized error and retryability metadata;
- optional pipeline step for intelligence work.

The workspace store exposes explicit begin, settle, dismiss, and clear-session
operations. History is capped to the newest 20 records for the active selection
session. Changing ticker/version removes records from the visible session but
does not allow an older callback to mutate current source content.

### Recording

Explicit refreshes and intelligence generation allocate a request ID before the
request starts. Query-backed sources allocate an ID on each transition into a
fetching state. Settlement records completed, partial, or failed based on the
real query/mutation result.

Callbacks compare their captured ticker/version with the current workspace. A
mismatch records `discarded` for the captured session and does not update visible
content. Intelligence trace stages remain the detailed pipeline source; the
activity record exposes only the current/highest-level step.

### Drawer and accessibility

The activity drawer lists active and recent completed, partial, discarded, and
failed requests newest-first. Failures remain until dismissed, retried, or
superseded by a successful request for the same ticker and source.

A newly observed failure identity is announced once through an alert. Persistent
history uses status semantics and is not re-announced after unrelated rerenders.

## Error handling

- Raw provider exceptions remain server-side.
- Provider failures are retryable and visible without replacing prior usable
  content.
- Normal absence remains neutral and distinct from failure.
- Identity mismatches fail closed and are recorded as discarded diagnostics.
- Atomic cache writes prevent a serialization or process failure from truncating
  the last validated evidence file.

## Testing strategy

Every production change follows red-green TDD.

Backend tests cover:

- all collectors failing with an existing evidence cache;
- partial refresh preserving entries from failed providers;
- a successful empty provider intentionally clearing its prior entries;
- atomic replacement and UTC/future-date freshness behavior;
- volume provider exception returning sanitized 502;
- normal empty volume data remaining HTTP 200.

Frontend tests cover:

- current intelligence no longer becoming permanently partial;
- candle provenance flowing into workspace state;
- identical-bar refetch not making intelligence outdated;
- `fetchOrders('all')` omitting the filter;
- wrong-symbol latest intelligence rejecting at the query boundary;
- all three Today source tabs rendering compact rail rows in expanded mode;
- full panels retaining state after collapse/close;
- activity request IDs and every lifecycle phase;
- late response discard behavior;
- one-time failure announcement and retained history.

Focused suites run after each task. Final verification includes the complete
backend and frontend test suites, frontend typecheck/lint/build, Ruff on changed
Python files, and `git diff --check` against the PR #435 head.

## Documentation and delivery

Update the nearest API, intelligence, and Web UI documentation where contracts or
behavior change. Remove the two trailing-space violations in the existing status
truth design. Commit and push the fixes on a branch based on
`feat/symbol-workspace-redesign`, then open a draft PR whose base is that branch.
