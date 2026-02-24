# Intelligence Module Optimization Guide

## Responsibility
Run the intelligence pipeline: ingest events, score signals, cluster themes, update state, and persist snapshots.

## Optimization Instructions
1. Cache static inputs (for example, curated peer maps) at process scope instead of reloading from disk each run.
2. Replace repetitive per-artifact storage writes with a loop-based persistence routine.
3. Reduce repeated parsing/normalization overhead by pre-sanitizing config once per run.

## Simplification Instructions
1. Refactor config sanitation into generic reusable helpers (numeric bounds, booleans, lists, nested fields).
2. Keep pipeline stages pure and narrow: fetch, score, cluster, persist.
3. Define explicit contracts between pipeline stage inputs/outputs.

## Definition of Done
- Pipeline run path has fewer side effects and repeated parsing steps.
- Storage logic is centralized.
- Stage boundaries are testable in isolation.
