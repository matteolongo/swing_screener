## Summary

- **Root cause**: `useSymbolIntelligenceRunner` was calling `runIntelligence({ symbols: [symbol] })` with no `technicalReadiness`, causing the backend `_normalize_technical` to default every symbol to `0.5` regardless of actual screener rank.
- **Fix**: derive `technicalReadiness` from `candidate.confidence` when a screener candidate exists for the symbol; pass it to the API. When no candidate is found the backend documented fallback (0.5) still applies — the frontend does not guess.
- **Observability**: added debug log in `_normalize_technical` so missing handoffs are visible in backend logs without changing behavior.

## Files changed

| File | Change |
|---|---|
| `web-ui/src/features/intelligence/useSymbolIntelligenceRunner.ts` | Derive and pass `technicalReadiness` from screener candidate |
| `src/swing_screener/intelligence/pipeline.py` | Debug log when symbol or full map is absent |
| `tests/test_intelligence_pipeline.py` | 4 new unit tests |

## Tests

Four new tests added to `test_intelligence_pipeline.py`:

- `test_normalize_technical_passes_through_provided_value` — explicit value returned unchanged
- `test_normalize_technical_missing_symbol_defaults_to_0_5` — absent symbol gets 0.5
- `test_normalize_technical_none_map_defaults_all_to_0_5` — nil map defaults everything
- `test_normalize_technical_higher_readiness_raises_opportunity_score` — end-to-end: readiness=0.9 produces higher opportunity score than 0.5

Full suite: **541 passed, 2 skipped**.

## Test plan

- [ ] Open workspace for a symbol present in the screener result → verify backend log shows the real confidence value, not 0.5
- [ ] Open workspace for a symbol not in the screener result → verify backend log shows fallback 0.5
- [ ] Run `pytest tests/test_intelligence_pipeline.py` — 10 tests pass

Part of the Predictive and Explanation Improvement refactor — see `docs/engineering/predictive-improvement/ROADMAP.md`.
