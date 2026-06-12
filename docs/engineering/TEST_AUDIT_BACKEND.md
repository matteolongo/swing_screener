# Backend Test Suite Audit

Audit of the Python test suite under `tests/`. Goal: cut low-value tests, close real coverage gaps, keep the suite fast. Every finding below was verified (collected and/or read), not taken from a survey pass. Line numbers are against `main` at the time of writing.

## 1. Baseline (measured)

- 106 test files, **748 passing** (1 skipped, 9 integration deselected), **13.5s** wall (`pytest -q -m "not integration"`).
- The suite is already fast. The slowest single test is 2.53s and it is just first-test import warmup, not real work. Realistic speed savings from this audit are **~2–3s**, not a transformation. The dominant payoff is **maintenance and coverage**, not wall time.
- `tests/conftest.py` is effectively empty (imports `pytest`, nothing else). No shared OHLCV/candidate/snapshot factories — builders are re-implemented across many files.

## 2. Not useful / trivial tests

| Test | Why |
|------|-----|
| `tests/test_instrument_master.py:48` `test_instrument_master_active_records_have_no_reason` | Body is a bare `pass` inside the loop — **no assertion at all**. Dead test, always green. Delete. |
| `tests/test_instrument_master.py:25` `test_instrument_master_exists` | Asserts a JSON file exists; subsumed by every other test in the file that reads it. Fold away. |

These are data-fixture validations (schema of `instrument_master.json`), not logic tests. They belong together as one parametrized data-integrity check rather than 6 separate functions.

## 3. Deletable tests

No test is *strictly* safe-to-delete-with-zero-coverage-loss except `test_instrument_master_active_records_have_no_reason` (§2 — it asserts nothing). Everything else flagged by the initial survey as "deletable" turned out to add at least one branch on inspection. Do **not** blanket-delete the unit-vs-API pairs — see §4.

## 4. Redundant tests (overlap, decide which to keep)

**Verified correction to the initial survey:** the two flagged "duplicate pairs" are not equivalent.

- **`tests/test_concentration.py` (2 fn) vs `tests/api/test_concentration.py` (3 fn)** — *Mild* overlap. The top-level tests call `sector_concentration_warnings()` directly (threshold trigger + skip); the API tests assert the same logic surfaces through the summary endpoint with correct pct and flag. Both layers are cheap. **Keep both**, or move the threshold-boundary cases to the unit file and keep the API test to one integration assertion. Low priority.
- **`tests/test_earnings_proximity.py` (10 fn) vs `tests/api/test_earnings_proximity.py` (4 fn)** — **NOT redundant.** The top-level file covers provider fallback (`finnhub → yfinance`), auth-failure disabling the batch, multi-ticker, and both-sources-fail — none of which the API file tests. The API file only covers the 10-day warning threshold + per-ticker caching. **Keep both.** (The plan's earlier "drop the unit copy" call was wrong.)

Net: there is little genuine redundancy in the backend suite. This is a healthy sign, not a reduction opportunity.

## 5. Not effective tests (weak assertions)

`assert x is not None` / `assert bool(...) is True` clusters — these pass as long as a value exists, regardless of correctness. Highest concentration:

| File | Count | Action |
|------|------:|--------|
| `tests/unit/strategies/test_validation.py` | 12 | Many are legitimate boolean-flag checks; audit the `is not None` ones and assert the actual validation message/severity. |
| `tests/api/test_screener_run_manager.py` | 10 | Replace existence checks with state/transition assertions (queued→running→done). |
| `tests/api/test_same_symbol_reentry.py` | 9 | Assert the re-entry decision value, not just that a result came back. |
| `tests/test_combined_priority.py` | 6 | `assert *_score is not None` → assert score bounds / ordering. |
| `tests/test_decision_summary.py` | 4 | `assert summary.* is not None` → assert the summarized values. |
| `tests/test_fundamentals_scoring.py` | 4 | Assert score ranges, not field presence. |

Not every `is True/False` is wrong — checks like `assert bool(filtered.loc[...]) is True` in `test_universe.py`/`test_trend.py` are asserting real filter outcomes. The fix is targeted, not mechanical.

## 6. Tests that must be improved

- **Magic numbers without intent** — `tests/test_trade_thesis.py:190` asserts `stop_rules[0].threshold == 490.0` with no derivation; `tests/test_earnings_proximity.py` hardcodes day thresholds (10/7/9/5). Name the constants or add a comment deriving them.
- **Over-broad exception handling** — `tests/test_finnhub_client.py` (`test_..._returns_empty_dict_on_http_error`) catches generic failures; assert the specific `httpx` error path.
- **Fixture duplication** — `_make_ohlcv` / candidate / snapshot builders are redefined across 10+ files. Promote a `ohlcv_frame` factory and a `candidate`/`snapshot` builder to `tests/conftest.py`. This shrinks the suite and removes drift, without changing coverage. Highest-leverage cleanup in the suite.

## 7. Untested paths / missing tests

**Modules with no test reference at all** (verified — not even imported in `tests/`):

| Module | LOC | defs | Note |
|--------|----:|-----:|------|
| `src/swing_screener/utils/date_helpers.py` | 105 | 4 | Pure date logic, trivially testable. Likely exercised transitively but never asserted. |
| `src/swing_screener/utils/dataframe_helpers.py` | 98 | 4 | OHLCV MultiIndex helpers — core data contract, deserves direct edge tests (empty frame, missing field). |
| `src/swing_screener/data/providers/factory.py` | 102 | 2 | Provider selection/wiring — untested branch logic. |
| `src/swing_screener/strategy/registry.py` | 32 | 4 | Strategy lookup/registration. |
| `src/swing_screener/strategy/orchestrator.py` | 23 | 1 | Orchestration entry — only run via higher-level paths. |
| `src/swing_screener/strategy/report_config.py` | 18 | 0 | Pure config; skip. |

**Branch/edge gaps in modules that have a test file but thin coverage:**
- `risk/regime.py` — only disabled-case and trend+vol case tested. Add: NaN closes, insufficient warmup period, individual multiplier application.
- `selection/pipeline.py` — exercised only indirectly via API/integration. Add direct: empty universe, filter-failure propagation, NaN in ranking.
- `portfolio/state.py` — scale-in tested at happy path; add blended-entry precision when `add_price == entry_price`, max-favorable-price preservation.
- `data/market_data.py` — add multi-ticker partial-fetch failure.

**Recommended new edge cases (parametrize):** position sizing across account sizes (only one size tested today), ATR windows, SMA periods.

## 8. Slow tests (measured `--durations`)

The only non-trivial real costs:

| Test(s) | ~Time | Note |
|---------|------:|------|
| `tests/api/test_concentration.py::test_concentration_included_in_summary` | 2.53s | First-test import warmup, not the test itself. Ignore. |
| `tests/test_file_lock.py` concurrency tests (`TestConcurrentAccess`, `TestLockTimeout`) | ~0.5s ea | Real `time.sleep(0.5)` / `0.1` to force lock contention (`test_file_lock.py:221,232`). |
| `tests/test_finnhub_client.py` enrich tests | 0.5–0.66s ea | Heavy mock setup, no I/O. |
| Polling loops with `time.sleep(0.05)` | small | `tests/api/test_fundamentals_warmup_manager.py:52`, `tests/api/test_screener_endpoints.py:1033,1089`. |

**Action:** add a `slow` marker to the `file_lock` concurrency tests so the default dev loop can run `-m "not slow"`. This is the only meaningful wall-clock lever and it saves ~1.5–2s. Do not bother "optimizing" anything else.

## 9. Prioritized actions

| # | Action | Category | Effort | Payoff |
|---|--------|----------|-------|--------|
| 1 | Delete `test_instrument_master_active_records_have_no_reason` (asserts nothing) | useless | trivial | correctness |
| 2 | Promote OHLCV/candidate/snapshot factories to `conftest.py`; de-dupe ~10 files | improve | M | maintenance ↑↑, suite size ↓ |
| 3 | Add `slow` marker to `test_file_lock.py` concurrency tests | slow | trivial | ~1.5–2s faster default run |
| 4 | Replace `is not None` clusters in `test_validation.py`, `test_combined_priority.py`, `test_decision_summary.py` with value/bounds asserts | not effective | M | catches real regressions |
| 5 | Add tests for `dataframe_helpers.py`, `data/providers/factory.py`, `date_helpers.py` | missing | M | covers core data contract |
| 6 | Add edge cases: `risk/regime.py` (NaN/warmup), `selection/pipeline.py` (empty/failure), `portfolio/state.py` (blended precision) | missing | M | covers risk-critical branches |
| 7 | Fold the 6 `instrument_master` data-integrity functions into one parametrized check | trivial | S | clarity |

**Honest expectation:** suite stays ~748 tests (deletions ≈ additions), wall time drops ~2s with the `slow` marker, and the real win is fixture de-duplication + risk-path edge coverage. There is no large redundancy to harvest here.

## 10. Implementation status (this PR)

**Done:**
- Deleted the dead no-op test `test_instrument_master_active_records_have_no_reason`.
- Registered a `slow` marker (`pyproject.toml`) and applied it to `test_file_lock.py`'s `TestConcurrentAccess` / `TestLockTimeout` — `-m "not slow"` now drops that file from ~3.0s to ~0.1s.
- Added coverage for three previously-untested modules: `tests/test_date_helpers.py`, `tests/test_dataframe_helpers.py`, `tests/data/test_provider_factory.py`.
- Added edge cases to `tests/test_regime_risk.py` (missing benchmark, insufficient history, trend-above-SMA) and a new `tests/test_selection_pipeline.py` (ineligible universe, exclude-tickers tolerance).

**Investigated and intentionally not changed (would be churn for no gain):**
- *Weak `is not None` assertions* — on reading them, the flagged lines in `test_combined_priority.py` and `test_decision_summary.py` are **guards followed by real assertions** (bounds/ordering/content). Not weak; left as-is.
- *conftest fixture consolidation* — the 9 `_make_ohlcv` helpers have **different signatures and semantics** (scenario series vs close-lists vs per-ticker dict vs random). They share a name, not a contract; a single shared fixture would require rewriting each test's data setup. Deferred.
- *`instrument_master` parametrize* — the remaining checks are genuinely distinct assertions; folding them would reduce clarity. Kept separate.
- *`portfolio/state.py` / `data/market_data.py` edges* — deferred; left as documented gaps above.
