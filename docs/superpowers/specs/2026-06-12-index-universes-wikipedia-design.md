# Index Universes via Wikipedia + yfinance — Design

**Date:** 2026-06-12
**Branch:** `feat/index-universes-wikipedia`
**Status:** Approved (approach + enrichment confirmed)

## Problem

The universe registry ships index snapshots for only 2 of the indices the user
tracks (`italy_ftse_mib`, `amsterdam_aex`). The other 8 broker indices have no
snapshot, so screens against them log "not found" symbols. Updating an index
today means hand-editing snapshot JSON **and** hand-writing an
`instrument_master.json` record per symbol (exchange_mic, currency, country,
timezone, provider map, type). `validate_universe_snapshot` rejects any
constituent missing from the master, and index snapshots **raise** when stale.
That manual path does not scale to hundreds of new symbols.

## Goal

Add the 8 missing indices as refreshable registry snapshots, with constituents
and instrument-master records generated automatically from free sources, and a
one-command refresh path so future index reviews are a rerun, not a hand-edit.

Non-goals: paid data providers, live/intraday data, changing the OHLCV provider,
touching curated (non-index) universes.

## Index set

Country-prefixed ids, matching the existing `italy_ftse_mib` convention.

| Broker name | id | benchmark | Yahoo suffix | Wikipedia page |
|---|---|---|---|---|
| USA 500 | `us_sp500` | `^GSPC` | (none) | List_of_S%26P_500_companies |
| USA TECH 100 | `us_nasdaq100` | `^NDX` | (none) | Nasdaq-100 |
| USA 30 | `us_dow30` | `^DJI` | (none) | Dow_Jones_Industrial_Average |
| Germany 40 | `germany_dax` | `^GDAXI` | `.DE` | DAX |
| CAC 40 | `france_cac40` | `^FCHI` | `.PA` | CAC_40 |
| UK 100 | `uk_ftse100` | `^FTSE` | `.L` | FTSE_100_Index |
| Spain 35 | `spain_ibex35` | `^IBEX` | `.MC` | IBEX_35 |
| Europe 50 | `europe_eurostoxx50` | `^STOXX50E` | (mixed) | EURO_STOXX_50 |

EURO STOXX 50 is multi-venue: its Wikipedia "Ticker"/"Main listing" columns
carry the local symbol+venue, so it uses an explicit per-row venue map rather
than a single suffix.

## Approach (approved)

Refreshable Wikipedia adapter wired into the existing
`refresh_snapshot_from_source` / `build_refreshed_snapshot` flow. One command
rebuilds any index. Chosen over a one-time static script because the user's core
pain is "hard to update".

## Components

### 1. `wikipedia_sources.py` (new, `src/swing_screener/data/`)

Pure-ish fetch + parse layer, mirroring `universe_sources.py` style.

- `WIKIPEDIA_INDEX_CONFIG: dict[str, IndexPageConfig]` — per id: page URL,
  constituent-table matcher (column-name predicate, since table index drifts),
  ticker column, suffix rule (static suffix, or per-row venue map for EuroStoxx).
- `fetch_index_constituents(universe_id, *, fetch_text=_fetch_text) -> list[RawConstituent]`
  — fetch page with `Mozilla/5.0` UA (Wikipedia 403s without it), `pandas.read_html`
  on the HTML string, select the constituent table by column predicate, read the
  ticker + company columns, normalize to Yahoo symbols.
- Symbol normalization: US dots→dashes (`BRK.B`→`BRK-B`); append suffix for EU;
  strip stray exchange prefixes. Yahoo-symbol validity is confirmed downstream by
  enrichment (symbols yfinance cannot resolve are dropped with a note).

`fetch_text` is injectable so tests run on fixture HTML offline.

### 2. `instrument_enrichment.py` (new, `src/swing_screener/data/`)

Turns a Yahoo symbol into an `instrument_master.json` record.

- `enrich_symbol(symbol, *, info_provider) -> InstrumentRecord | None`
  — pulls `exchange`, `currency`, `quoteType`, `fullExchangeName` via yfinance
  `Ticker(symbol).info`; maps Yahoo exchange code → MIC using the existing
  `YAHOO_EXCHANGE_TO_MIC` table in `symbol_discovery.py` (extend if a needed code
  is missing); derives `country_code` and `timezone` from a small MIC→(country,
  tz) table (yfinance `timeZoneFullName` is unreliable, returns None for some
  venues). Returns `None` (with a note) when the symbol does not resolve.
- `instrument_type`: map `quoteType` EQUITY→`equity`, ETF→`etf`, else passthrough.
- Builds `provider_symbol_map.yahoo_finance` = symbol; `stooq` left absent unless
  trivially derivable (existing records have stooq only where known — not required).
- `source` = `"wikipedia_yfinance"`, `source_asof` / `last_reviewed_at` = today.

`info_provider` injectable → tests mock yfinance.

### 3. Adapter hook in `universe_sources.py`

- New branch in `refresh_snapshot_from_source`: when
  `source_adapter == "wikipedia_index_review"`, call a new
  `refresh_index_from_wikipedia(universe_id, current_snapshot, instrument_master, ...)`.
- That function: fetch constituents → for each, look up master; if missing, call
  `enrich_symbol` and stage the new record → build `constituents` list
  (symbol, exchange_mic, currency, source_name, source_symbol) → return
  `UniverseSourceResult` plus the staged new master records (extend the result
  dataclass with `new_master_records: list[dict]`, default empty, so the existing
  Euronext path is unchanged).

### 4. Master persistence in `universe.py`

`refresh_package_universe(universe_id, apply=True)` currently writes only the
snapshot. Extend the `apply` path: when the source result carries
`new_master_records`, merge them into `data/intelligence/instrument_master.json`
(append new symbols, do not overwrite existing), sort by symbol, write back,
bust the `lru_cache`. Read-only preview (`apply=False`) stages nothing.

### 5. Manifest + initial snapshots

- Add 8 manifest entries (`kind: "index"`, `source: "wikipedia"`,
  `source_adapter: "wikipedia_index_review"`, `stale_after_days: 100`).
- Seed each snapshot file with empty/placeholder constituents + the adapter id,
  then run the refresh to populate (network step below).

### 6. Build / population

Run `refresh_package_universe(id, apply=True)` for all 8 ids (a thin
`python -m ...` invocation or the existing universe CLI refresh subcommand if one
exists; otherwise add `universe refresh --name <id> --apply` to `cli.py`,
matching the existing argparse style). Commit the resulting snapshots + the
grown `instrument_master.json`.

## Data flow

```
Wikipedia page ──UA fetch──▶ read_html ──col predicate──▶ raw tickers
        │
        ▼ normalize (suffix / dots→dashes)
   Yahoo symbols ──master lookup──▶ hit? use record
        │                          miss? enrich_symbol(yfinance) ──▶ new master record (or drop+note)
        ▼
   constituents[] + new_master_records[]  ──apply──▶  snapshot JSON  +  instrument_master.json
```

## Error handling

- Wikipedia fetch failure / table-not-found → `UniverseSourceError` with the id
  and URL; refresh aborts, no partial write.
- Symbol yfinance cannot resolve → dropped from constituents, recorded in
  `notes`; does not fail the whole index.
- Empty constituent set after parsing → `UniverseSourceError` (guards against a
  page layout change silently producing an empty index).
- Master merge never overwrites an existing symbol (existing curation wins).

## Testing

- `tests/test_wikipedia_sources.py` — fixture HTML per index shape (US bare,
  EU suffixed, EuroStoxx multi-venue); assert correct table selection + symbol
  normalization. Offline.
- `tests/test_instrument_enrichment.py` — mocked `info_provider`; assert MIC
  mapping, country/tz derivation, type mapping, unresolved→None.
- `tests/test_universe_sources.py` — extend: `wikipedia_index_review` adapter
  builds constituents + new_master_records from mocked fetch/enrich; Euronext
  path still passes (regression on the dataclass change).
- `tests/test_universe.py` / data-management tests — `refresh_package_universe`
  apply path merges master records without clobbering, busts cache.
- One `@pytest.mark.integration` live test hitting real Wikipedia for `us_dow30`
  (smallest, 30 names), skipped in CI.
- After population: `pytest -q` green, `ruff check .`, `black .`, and
  `validate_universe_snapshot` returns no errors for all 8 new ids.

## Docs to update (per CLAUDE.md checklist)

- `data/README.md` — instrument_master growth + new index snapshots, migration note.
- `docs/engineering/MODULE_ARCHITECTURE.md` — new modules `wikipedia_sources.py`,
  `instrument_enrichment.py`.
- `config/README.md` — only if a config key is added (none currently planned).
- `api/README.md` — no endpoint change expected (universes router already lists
  manifest entries dynamically); confirm and note if so.
- `docs/overview/INDEX.md` — add this spec.

## Open risks

- Wikipedia table layout can shift → column-predicate selection + empty-set guard
  + tests mitigate; periodic refresh re-validates.
- yfinance `.info` is rate-limited / occasionally flaky → enrichment runs once at
  build, tolerant of per-symbol failures (drop+note).
- EURO STOXX 50 venue mapping is the fiddliest (multi-country); if a clean column
  isn't parseable, fall back to enriching each ticker's primary listing via
  yfinance from the bare ticker + a candidate-suffix probe.
