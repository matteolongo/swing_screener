# Social Module Optimization Guide

## Responsibility
Ingest social/news events, compute sentiment/attention metrics, and produce overlay adjustments.

## Optimization Instructions
1. Introduce a provider registry instead of hard-coded provider branching.
2. Gate expensive OHLCV fetches behind minimum event/sample checks.
3. Avoid repeated full-event sorting by maintaining sorted/merged structures incrementally.

## Simplification Instructions
1. Centralize cache merge/update behavior inside cache utilities.
2. Keep analysis pipeline stages explicit: fetch -> score -> aggregate -> overlay.

## Definition of Done
- Provider extension no longer requires touching core dispatch logic.
- Unnecessary market data calls are reduced.
- Overlay outputs are unchanged under regression tests.
