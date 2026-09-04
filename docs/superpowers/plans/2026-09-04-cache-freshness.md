# Cache Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent evaluation or market-data caches from promoting partial-session results as final-close output.

**Architecture:** Bind evaluation cache entries to their actual input candle and configuration identity. At the provider boundary, reject cache files older than the close instant required for a final-close run.

**Tech Stack:** Python 3, pandas, Parquet, pytest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- `intraday` output may use partial candles only when explicitly labelled.
- `final_close` output must prove freshness; ambiguity fails closed.
- PR 3 is stacked on PR 2.

---

### Task 1 (PR 2): Version evaluation-cache provenance

**Branch:** `codex/version-eval-cache-provenance` from `codex/preserve-structural-targets`

**Files:**

- Modify: `src/swing_screener/selection/eval_cache.py`
- Modify: `src/swing_screener/strategy/modules/momentum.py`
- Modify: `tests/test_eval_cache.py`
- Modify: `tests/test_momentum.py`
- Modify: `src/swing_screener/selection/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add stale-identity regression tests**

Show that the same ticker/as-of date misses when the last candle timestamp,
market phase, evaluation schema version, strategy signature, or relevant sector
benchmark input changes. Show that an exact identity still hits.

- [ ] **Step 2: Introduce an explicit cache identity**

Add an immutable `EvaluationCacheIdentity` carrying
`schema_version`, `asof`, `last_bar`, `market_phase`, `strategy_signature`, and
`input_fingerprint`. Build the fingerprint deterministically from the ticker's
OHLCV slice and any sector benchmark series consumed by evaluation.

- [ ] **Step 3: Persist and validate identity metadata**

Store reserved metadata columns in each Parquet cache entry, validate all
identity fields on read, and strip metadata before returning evaluation rows.
Treat legacy entries without metadata as misses; do not guess freshness.

- [ ] **Step 4: Wire momentum evaluation to the identity**

Construct the identity before `split()`, include sector-relative inputs in the
fingerprint, and pass the same identity to `write()`. Keep ticker ordering
deterministic after combining hits and misses.

- [ ] **Step 5: Document and verify**

Run `pytest tests/test_eval_cache.py tests/test_momentum.py -q` and
`ruff check src/swing_screener/selection src/swing_screener/strategy/modules/momentum.py tests/test_eval_cache.py tests/test_momentum.py`.
Document the schema bump and automatic legacy miss, then commit with
`Bind evaluation cache entries to input provenance`.

---

### Task 2 (PR 3): Prevent partial candles from final-close promotion

**Branch:** `codex/prevent-partial-final-promotion` from `codex/version-eval-cache-provenance`

**Files:**

- Modify: `src/swing_screener/data/providers/base.py`
- Modify: `src/swing_screener/data/providers/yfinance_provider.py`
- Modify: `src/swing_screener/data/market_data.py`
- Modify: `api/services/screener_service.py`
- Modify: `tests/test_screening_window.py`
- Modify: `tests/test_screener_service.py`
- Modify: `src/swing_screener/data/providers/README.md`
- Modify: `src/swing_screener/data/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Reproduce the session transition**

With a fake clock, write a current-day cache before the relevant exchange close,
then run after close. Assert an intraday run may consume it but a final-close run
must refetch. Add a stale-cache fallback case and assert output remains labelled
stale/intraday rather than final.

- [ ] **Step 2: Add a cache freshness policy**

Define `MarketDataCachePolicy(fresh_after_utc: datetime | None)` and add it as an
optional fetch argument through the provider protocol and chunked-fetch helper.
Providers without disk caches may ignore it. The yfinance provider must compare
the cache file timestamp with `fresh_after_utc` before accepting the file.

- [ ] **Step 3: Derive the final-close threshold centrally**

In `ScreenerService`, derive the latest required close instant for the run's
active currencies from the screening-window result. Pass that instant as
`fresh_after_utc` only for a current-date `final_close` run; pass `None` for
historical and explicitly intraday runs.

- [ ] **Step 4: Propagate fallback provenance**

If provider health reports stale-cache fallback or the returned last bar cannot
satisfy the final-close boundary, mark the candidate/run data status as stale or
intraday. Never convert the status to `final_close` merely because wall-clock
time passed the close.

- [ ] **Step 5: Document and verify**

Run `pytest tests/test_screening_window.py tests/test_screener_service.py -q` plus
the provider tests, then `ruff check src/swing_screener/data api/services/screener_service.py tests`.
Document transition and fallback rules, and commit with
`Require post-close market-data freshness`.
