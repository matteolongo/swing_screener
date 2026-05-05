# Watchlist Pipeline View — Implementation Plan

> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Turn the watchlist from a static symbol list into a ranked pipeline that shows which names are closest to triggering, with enough context to review them quickly from Research and Daily Review.

**Architecture:** Keep persisted watchlist storage unchanged and add a dedicated enrichment layer in the API. `WatchlistService` reads raw watchlist items from `WatchlistRepository`, fetches recent OHLCV with the existing market-data provider, computes the breakout trigger using the existing selection signal board, derives `distance_to_trigger_pct`, and returns a richer `WatchlistItemView`. Daily Review consumes the same service and filters names within 3% of the trigger zone into a new `watchlist_near_trigger` section. The frontend adds a Watchlist tab in Research and a compact near-trigger section in Today.

**Tech Stack:** Python/FastAPI backend, React 18/TypeScript frontend, existing OHLCV provider and screener signal logic

---

## Implementation status - 2026-05-04

Status: implemented on `codex/watchlist-pipeline`.

Branch stack:

- Branch: `codex/watchlist-pipeline`
- Base: `codex/time-stop-nudge`
- PR: pending

What changed:

- Added `WatchlistService` to enrich watchlist rows with `current_price`, `signal_trigger_price`, `distance_to_trigger_pct`, `signal`, `last_bar`, and a 5-bar `price_history` sparkline payload.
- Extended the watchlist API response shape with `WatchlistItemView` while keeping `watchlist.json` persistence untouched.
- Added a Research > Watchlist tab with a pipeline table sorted by distance to trigger and a 5-day sparkline.
- Added a Daily Review section `watchlist_near_trigger` surfaced above new candidates for names within 3% of the buy zone.
- Added focused backend and frontend coverage for the enrichment path, Daily Review mapping, and the new UI panel.

Validation run:

- `pytest tests/api/test_watchlist_service.py tests/api/test_daily_review_service.py tests/api/test_watchlist_endpoints.py`
- `cd web-ui && npm test -- --run src/components/domain/watchlist/WatchlistPipelinePanel.test.tsx src/features/dailyReview/types.test.ts src/pages/Today.test.tsx src/features/watchlist/hooks.test.tsx`
- `cd web-ui && npm run typecheck`

---

## File map

| File | Change |
|---|---|
| `api/models/watchlist.py` | Add `WatchlistItemView` with enriched trigger-distance fields |
| `api/services/watchlist_service.py` | New enrichment service for pipeline ordering and sparkline history |
| `api/routers/watchlist.py` | Serve enriched watchlist items via `WatchlistService` |
| `api/models/daily_review.py` | Add `watchlist_near_trigger` to the Daily Review payload |
| `api/services/daily_review_service.py` | Pull near-trigger watchlist names into Today |
| `web-ui/src/components/domain/watchlist/WatchlistPipelinePanel.tsx` | New Research watchlist pipeline panel |
| `web-ui/src/pages/Research.tsx` | Add Watchlist tab and ticker handoff into analysis |
| `web-ui/src/pages/Today.tsx` | Render the near-trigger watchlist section above candidates |
| `web-ui/src/features/watchlist/types.ts` | Extend watchlist client types with enrichment fields |
| `web-ui/src/features/dailyReview/types.ts` | Map the new Daily Review watchlist section |
| `tests/api/test_watchlist_service.py` | Backend enrichment and sorting coverage |
| `web-ui/src/components/domain/watchlist/WatchlistPipelinePanel.test.tsx` | Frontend watchlist panel coverage |
