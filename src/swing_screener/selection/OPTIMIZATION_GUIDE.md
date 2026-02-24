# Selection Module Optimization Guide

## Responsibility
Unify candidate discovery flow: universe filtering, ranking, and entry signal generation.

## Optimization Instructions
1. Keep the pipeline vectorized end-to-end (feature table, ranking percentiles, and signal board generation).
2. Compute shared rolling windows once and reuse across entry rules.
3. Minimize intermediate DataFrame copies between `universe`, `ranking`, and `entries` stages.

## Simplification Instructions
1. Keep one canonical orchestration path via `selection/pipeline.py`.
2. Separate concerns cleanly:
- `universe.py`: eligibility and features
- `ranking.py`: scoring and ordering
- `entries.py`: signal generation
3. Keep input/output contracts explicit for each stage.

## Definition of Done
- Selection stages run through canonical module only.
- No duplicated screener/signal logic in other domains.
- Output parity preserved vs baseline tests.
