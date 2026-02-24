# Screeners Module Optimization Guide

## Responsibility
Filter trade universes and rank candidates for downstream strategy/reporting.

## Optimization Instructions
1. Replace row-wise reason assembly with vectorized mask-based logic.
2. Compute percentile ranks in one pass for all ranking factors.
3. Avoid repeated sorting/reindexing when intermediate ordering is not consumed.

## Simplification Instructions
1. Keep filter criteria centralized and declarative.
2. Separate eligibility filtering from ranking/scoring for easier testing.

## Definition of Done
- Filtering/ranking scales better on larger universes.
- Reason generation is deterministic and easier to maintain.
- Ranking behavior is covered by regression tests.
