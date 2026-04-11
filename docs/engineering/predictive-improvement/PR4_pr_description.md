# PR 4 — Combined Ranking Stage (Two-Stage Pipeline)

**Branch:** `feat/combined-ranking` → `feature/ux-revamp`

---

## Summary

- Adds a two-stage ranking pipeline: Stage 1 widens the technical prefilter to `3 × final_top_n`; Stage 2 blends technical + fundamentals + catalyst + valuation into a `combined_priority_score` that determines the final cut
- Symbols with mediocre raw momentum but strong catalyst and quality fundamentals can now reach the top-N list
- All weights and the prefilter multiplier are configurable via `config/defaults.yaml` under `selection.combined_priority`
- `raw_technical_rank` is stamped on every output candidate for debugging and audit

## Problem solved

The screener previously selected top candidates using only three momentum columns before fundamentals or intelligence were consulted. A symbol with strong catalyst and high-quality fundamentals never reached the top-N list if its raw momentum was mid-table.

## Changes

**`src/swing_screener/recommendation/priority.py`** (new)
- `CombinedPriorityConfig` dataclass (all weights + prefilter_multiplier, configurable via settings)
- `compute_combined_priority()`: normalizes confidence (min-max), derives label-based sub-scores from `decision_summary`, computes blended score, sorts descending; stamps `raw_technical_rank` and `combined_priority_score` on each candidate
- Freshness and data-quality penalties are reserved (0.0 stubs) for PR6/PR7

**`src/swing_screener/selection/ranking.py`**
- Added `normalize_technical_score(df)` helper: min-max normalization of the `score` column for DataFrame-based consumers

**`api/models/screener.py`**
- Added `raw_technical_rank: Optional[int]` and `combined_priority_score: Optional[float]` to `ScreenerCandidate`

**`api/services/screener_service.py`**
- `run_screener`: widens prefilter head to `request.top × prefilter_multiplier`
- After `_apply_decision_summary_context`, calls `compute_combined_priority` and slices to `requested_top`

**`config/defaults.yaml`**
- Added `selection.combined_priority` block with all configurable weights and `prefilter_multiplier: 3`

**Frontend (`web-ui/src/features/screener/types.ts`)**
- Added `rawTechnicalRank?: number` and `combinedPriorityScore?: number` to `ScreenerCandidate` and `ScreenerCandidateAPI`; mapped in `transformScreenerResponse`

## Tests

4 new tests in `tests/test_combined_priority.py`:
- `test_catalyst_lifts_mid_ranked_candidate` — MID (#5 technically) with strong catalyst + fundamentals outranks TOP (#1 technically, weak signals)
- `test_weak_fundamentals_drops_top_technical_candidate` — TECH1 (#1 technically, weak quality) ranks below TECH2 (#2 technically, strong quality)
- `test_raw_technical_rank_preserved` — all output candidates carry original technical rank; no duplicates
- `test_combined_priority_score_is_in_unit_interval` — score bounded in [0, 1]

All 548 backend tests pass.

## Part of

Predictive & Explanation Improvement Plan — PR4 of 8
Base branch: `feature/ux-revamp`
Unblocks: PR5, PR6, PR7
