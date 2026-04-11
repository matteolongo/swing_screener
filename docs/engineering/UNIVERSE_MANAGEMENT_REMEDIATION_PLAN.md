# Universe Management Remediation Plan

## Overview

This document tracks the execution of the Universe Registry Cutover — a breaking cleanup that replaced the CSV-based universe system with a snapshot-only JSON registry, removed legacy aliases, and enforced instrument-master validation.

See the original specification in the plan file for full context and design decisions.

---

## Status: Complete ✅

Implemented on 2026-04-11. All 610 Python tests and 6 frontend tests pass.

---

## Completed Work

### Registry and Data Layer

- [x] Created `src/swing_screener/data/universes/registry/manifest.json` (14 entries)
- [x] Created `src/swing_screener/data/universes/registry/snapshots/*.json` (14 snapshot files)
- [x] Expanded `data/intelligence/instrument_master.json` to 374 records (full coverage of all universe symbols)
- [x] Added required fields to instrument master: `status`, `status_reason`, `replacement_symbol`, `source`, `source_asof`, `last_reviewed_at`
- [x] Deleted all 15 CSV files from `src/swing_screener/data/universes/`
- [x] Deleted old `manifest.json` and `README.md`

### Code Changes

- [x] Rewrote `src/swing_screener/data/universe.py` — snapshot-backed loading, stale check, `validate_universe_snapshot()`
- [x] Updated `src/swing_screener/data/currency.py` — instrument master → suffix → UNKNOWN precedence; GBP/CHF/SEK/DKK/NOK support
- [x] Updated `src/swing_screener/selection/universe.py` — UNKNOWN currency passes runtime filter
- [x] Updated `src/swing_screener/data/__init__.py` — removed `save_universe_file` export
- [x] Updated `pyproject.toml` — package-data globs updated to registry paths
- [x] Updated `api/services/screener_service.py` — `_REMOVED_UNIVERSE_IDS` map, 422 on removed ids, default universe → `"us_all"`
- [x] Updated `src/swing_screener/cli.py` — removed `filter` subcommand; added `validate` and `doctor`
- [x] Updated `mcp_server/tools/screener/list_universes.py` — description references new ids
- [x] Updated `web-ui/src/features/screener/universeStorage.ts` — removed alias normalization
- [x] Updated `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx` — removed migration hook, default → `"us_all"`
- [x] Updated `web-ui/src/test/mocks/handlers.ts` — mock universe list updated

### Tests

- [x] Added `tests/test_universe_snapshot.py`
- [x] Added `tests/test_instrument_master.py`
- [x] Updated `tests/test_universe_data_management.py`
- [x] Updated `tests/test_universe_loader.py` (no changes needed)
- [x] Updated `tests/api/test_screener_endpoints.py` — new ids, 422 tests added
- [x] Updated `tests/test_agent_runtime.py`
- [x] Updated `tests/api/test_daily_review_service.py`
- [x] Updated `tests/api/test_daily_review_compute_endpoint.py`
- [x] Updated `tests/test_error_handling.py`
- [x] Updated `tests/data/test_currency.py`
- [x] Updated `web-ui/src/features/screener/universeStorage.test.ts`

### Amsterdam Composition (2026-03-23 Euronext Quarterly Review)

- [x] Removed `WDP.BR` (Belgian Brussels listing — wrong exchange)
- [x] Applied September 2025 AEX expansion to 30 members (CVC.AS, INPST.AS, JDEP.AS added)
- [x] Applied March 2026 AEX changes: RAND.AS removed (→ AMX), SBMO.AS added (← AMX), WDP.AS added
- [x] Applied March 2026 AMX changes: SBMO.AS removed (→ AEX), RAND.AS added (← AEX)

---

## Open Items

### AEX 30th Member (Low Priority)

The AEX expanded to 30 members in September 2025. The current `amsterdam_aex.json` has **29 confirmed members**. The 30th member is likely TKWY.AS (Just Eat Takeaway, formerly Takeaway.com) based on available evidence but was not confirmed with certainty. Verify against the official [Euronext AEX composition PDF](https://live.euronext.com/sites/default/files/documentation/index-composition/) and add if correct.

### AMX Full Composition (Low Priority)

The `amsterdam_amx.json` has 24 members. AMX should have 25. One member may be missing from the original source data. Cross-check against the official [Euronext AMX composition PDF](https://live.euronext.com/sites/default/files/documentation/index-composition/).

### `europe_proxies_usd` Coverage (Low Priority)

The snapshot has 28 tickers as a first-pass curation. Review against a definitive list of USD-traded US-venue European ADRs. Stale threshold is 365 days; no urgency.

---

## New Universe ID Reference

| Old Id | New Id | Notes |
|---|---|---|
| `usd_all` / `mega` / `mega_all` | `us_all` | |
| `usd_mega_stocks` / `mega_stocks` | `us_mega_stocks` | |
| `usd_core_etfs` / `core_etfs` | `us_core_etfs` | |
| `usd_defense_all` / `defense_all` | `us_defense_all` | |
| `usd_defense_stocks` / `defense_stocks` | `us_defense_stocks` | |
| `usd_defense_etfs` / `defense_etfs` | `us_defense_etfs` | |
| `usd_healthcare_all` / `healthcare_all` | `us_healthcare_all` | |
| `usd_healthcare_stocks` / `healthcare_stocks` | `us_healthcare_stocks` | |
| `usd_healthcare_etfs` / `healthcare_etfs` | `us_healthcare_etfs` | |
| `eur_europe_large` / `europe_large` / `mega_europe` | `europe_large_eur` | Non-EUR lines removed |
| `usd_europe_large` | `europe_proxies_usd` | Content entirely replaced |
| `eur_amsterdam_all` / `amsterdam_all` | `amsterdam_all` | |
| `eur_amsterdam_aex` / `amsterdam_aex` | `amsterdam_aex` | |
| `eur_amsterdam_amx` / `amsterdam_amx` | `amsterdam_amx` | |
| `eur_all` | — | Dropped with no replacement |
