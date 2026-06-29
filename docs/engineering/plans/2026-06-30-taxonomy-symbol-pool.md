# Taxonomy-based Symbol Pool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-at-a-time universe selection with a single taxonomy-filtered symbol pool; the screener pre-filters by taxonomy (no network) then fetches OHLCV only for the filtered subset.

**Architecture:** A committed `data/symbol_pool.json` is the query-time source of truth, built by merging the 25 universe snapshots with the instrument master (network-free) plus best-effort yfinance enrichment. The screener resolves its working ticker list from the pool via a `TaxonomyFilter` instead of a universe id. Fetch failures accumulate per-symbol and cross a threshold into `data/review_queue.json`, surfaced in the UI for manual remove/restore.

**Tech Stack:** Python 3 / FastAPI / Pydantic / pandas (backend); React 18 + TypeScript + Zustand + React Query + Vite + Vitest (frontend). File locking via `portalocker` through `api/utils/file_lock.py`.

**Spec:** `docs/engineering/specs/2026-06-30-taxonomy-symbol-pool-design.md`

## Global Constraints

- OHLCV is a pandas DataFrame with MultiIndex columns `(field, ticker)`; never reshape it.
- Risk math is R-multiple based (`1R = entry - stop`); never introduce fixed-dollar/percentage substitutes.
- snake_case (backend) ↔ camelCase (frontend) transform ONLY at the API boundary via the existing `transform*` functions in `web-ui/src/features/screener/types.ts`.
- All user-facing strings go through `web-ui/src/i18n/messages.en.ts`; no hardcoded UI strings in components or test assertions.
- API model changes and the corresponding Web UI type changes ship in the same commit.
- Configurable behavior lives in YAML under `config/`, accessed via `get_settings_manager().get_low_level_defaults_payload(<section>)`; never hardcode operator-tunable settings.
- Secrets via environment variables only; never committed YAML.
- Frontend: ESLint zero warnings; coverage ≥80% lines / ≥75% branches.
- Provider base `fetch_ohlcv(tickers, start_date, end_date, interval="1d")` — write the failure-tracking wrapper to NOT depend on a `force_refresh` kwarg (it lands via the separate `fix/cache-review-pr3` branch; keep the wrapper a thin pass-through so the rebase is mechanical).
- `fetch_failure_threshold` default = 3. `universe` request field kept as a deprecated alias this PR; removed in a later stacked PR.
- Symbol pool has no floor filter — all symbols included; the filter bar controls exclusion at screen time.

## Phase → PR mapping (stacked)

- **Phase 1** → PR `feat/taxonomy-symbol-pool` (this branch): pool data layer, build logic, committed pool, config.
- **Phase 2** → PR `feat/taxonomy-screener-integration`: TaxonomyFilter, screener pre-filter, failure tracking, pool API, presets.
- **Phase 3** → PR `feat/taxonomy-filter-bar`: quick filter bar + repurposed panel, request wiring.
- **Phase 4** → PR `feat/taxonomy-review-queue`: header badge + review-queue drawer.

Each phase is independently testable and mergeable. Execute in order.

---

## File Structure

**Phase 1 (backend, core lib + data + repos)**
- Create `src/swing_screener/data/symbol_pool.py` — schema dataclasses, taxonomy derivation, `build_pool_base`, `enrich_pool_taxonomy`, `filter_pool_by_taxonomy`, load/serialize.
- Create `tests/data/test_symbol_pool.py`
- Create `data/symbol_pool.json` — committed generated artifact.
- Modify `config/defaults.yaml` — add `low_level.symbol_pool` section.
- Modify `config/README.md`, `data/README.md`.

**Phase 2 (backend, API + screener)**
- Create `api/repositories/symbol_pool_repo.py`, `api/repositories/review_queue_repo.py`
- Create `api/services/pool_service.py`
- Create `api/routers/pool.py`
- Create `config/taxonomy_presets.yaml`
- Modify `api/models/screener.py` (TaxonomyFilter, ScreenerRequest), `api/services/screener_service.py` (`_resolve_universe_and_window`, fetch failure tracking), `api/dependencies.py`, `api/main.py`, `api/README.md`.
- Tests: `tests/api/test_pool_router.py`, `tests/api/test_review_queue.py`, additions to `tests/test_screener_service.py`.

**Phase 3 (frontend, filter bar)**
- Create `web-ui/src/features/pool/types.ts`, `api.ts`, `hooks.ts`
- Create `web-ui/src/components/domain/screener/QuickFilterBar.tsx` (+ test)
- Modify `web-ui/src/features/screener/types.ts` (TaxonomyFilter, ScreenerRequest, transform), `api.ts`, `web-ui/src/components/domain/screener/ScreenerForm.tsx`, `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`, `web-ui/src/pages/Today.tsx`, `web-ui/src/lib/queryKeys.ts`, `web-ui/src/i18n/messages.en.ts`.

**Phase 4 (frontend, review queue)**
- Create `web-ui/src/components/domain/pool/ReviewQueueDrawer.tsx` (+ test)
- Modify `web-ui/src/features/pool/hooks.ts` (queue hooks), `web-ui/src/components/layout/Header.tsx`, `web-ui/src/i18n/messages.en.ts`.

---

# PHASE 1 — Pool data layer & build logic

**Deliverable:** A committed `data/symbol_pool.json` plus a tested module that builds and filters it. No API or UI changes.

### Task 1.1: Symbol pool schema & serialization

**Files:**
- Create: `src/swing_screener/data/symbol_pool.py`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Produces:
  - `REGION_VALUES = ("us", "europe", "asia_pacific", "other")`
  - `CAP_TIER_VALUES = ("large", "mid", "small", "micro")`
  - `LIQUIDITY_TIER_VALUES = ("high", "mid", "low")`
  - `INSTRUMENT_DETAIL_VALUES = ("equity", "etf_equity", "etf_sector", "etf_leveraged", "etf_bond", "etf_commodity")`
  - `@dataclass PoolSymbol` with fields: `symbol: str`, `exchange_mic: str | None`, `currency: str | None`, `region: str | None`, `market_cap_tier: str | None`, `sector: str | None`, `industry: str | None`, `index_memberships: list[str]`, `liquidity_tier: str | None`, `instrument_type: str | None`, `instrument_type_detail: str | None`, `available_providers: list[str]`, `primary_provider: str | None`, `taxonomy_refreshed_at: str | None`, `fetch_failure_count: int = 0`, `last_fetch_ok_at: str | None = None`
  - `pool_symbol_to_dict(sym: PoolSymbol) -> dict` and `pool_symbol_from_dict(d: dict) -> PoolSymbol`
  - `POOL_SCHEMA_VERSION = 1`

- [ ] **Step 1: Write the failing test**

```python
# tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import (
    PoolSymbol, pool_symbol_to_dict, pool_symbol_from_dict, POOL_SCHEMA_VERSION,
)


def test_pool_symbol_roundtrips_through_dict():
    sym = PoolSymbol(
        symbol="AAPL", exchange_mic="XNAS", currency="USD", region="us",
        market_cap_tier="large", sector="Technology", industry="Consumer Electronics",
        index_memberships=["us_sp500", "broad_market_stocks"], liquidity_tier="high",
        instrument_type="equity", instrument_type_detail="equity",
        available_providers=["yfinance"], primary_provider="yfinance",
        taxonomy_refreshed_at="2026-06-30", fetch_failure_count=0, last_fetch_ok_at=None,
    )
    d = pool_symbol_to_dict(sym)
    assert d["symbol"] == "AAPL"
    assert d["index_memberships"] == ["us_sp500", "broad_market_stocks"]
    assert pool_symbol_from_dict(d) == sym


def test_pool_symbol_from_dict_tolerates_missing_optional_fields():
    sym = pool_symbol_from_dict({"symbol": "MSFT"})
    assert sym.symbol == "MSFT"
    assert sym.fetch_failure_count == 0
    assert sym.index_memberships == []
    assert sym.available_providers == []
    assert POOL_SCHEMA_VERSION == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'swing_screener.data.symbol_pool'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/swing_screener/data/symbol_pool.py
"""Unified taxonomy-filtered symbol pool: schema, build, and filtering.

The pool (`data/symbol_pool.json`) is the query-time source of truth for the
screener. It is built by merging the universe registry snapshots with the
instrument master (network-free) plus best-effort yfinance enrichment.
"""
from __future__ import annotations

from dataclasses import dataclass, field

POOL_SCHEMA_VERSION = 1

REGION_VALUES = ("us", "europe", "asia_pacific", "other")
CAP_TIER_VALUES = ("large", "mid", "small", "micro")
LIQUIDITY_TIER_VALUES = ("high", "mid", "low")
INSTRUMENT_DETAIL_VALUES = (
    "equity", "etf_equity", "etf_sector", "etf_leveraged", "etf_bond", "etf_commodity",
)


@dataclass
class PoolSymbol:
    symbol: str
    exchange_mic: str | None = None
    currency: str | None = None
    region: str | None = None
    market_cap_tier: str | None = None
    sector: str | None = None
    industry: str | None = None
    index_memberships: list[str] = field(default_factory=list)
    liquidity_tier: str | None = None
    instrument_type: str | None = None
    instrument_type_detail: str | None = None
    available_providers: list[str] = field(default_factory=list)
    primary_provider: str | None = None
    taxonomy_refreshed_at: str | None = None
    fetch_failure_count: int = 0
    last_fetch_ok_at: str | None = None


def pool_symbol_to_dict(sym: PoolSymbol) -> dict:
    return {
        "symbol": sym.symbol,
        "exchange_mic": sym.exchange_mic,
        "currency": sym.currency,
        "region": sym.region,
        "market_cap_tier": sym.market_cap_tier,
        "sector": sym.sector,
        "industry": sym.industry,
        "index_memberships": list(sym.index_memberships),
        "liquidity_tier": sym.liquidity_tier,
        "instrument_type": sym.instrument_type,
        "instrument_type_detail": sym.instrument_type_detail,
        "available_providers": list(sym.available_providers),
        "primary_provider": sym.primary_provider,
        "taxonomy_refreshed_at": sym.taxonomy_refreshed_at,
        "fetch_failure_count": int(sym.fetch_failure_count or 0),
        "last_fetch_ok_at": sym.last_fetch_ok_at,
    }


def pool_symbol_from_dict(d: dict) -> PoolSymbol:
    return PoolSymbol(
        symbol=str(d["symbol"]).strip().upper(),
        exchange_mic=d.get("exchange_mic"),
        currency=d.get("currency"),
        region=d.get("region"),
        market_cap_tier=d.get("market_cap_tier"),
        sector=d.get("sector"),
        industry=d.get("industry"),
        index_memberships=list(d.get("index_memberships") or []),
        liquidity_tier=d.get("liquidity_tier"),
        instrument_type=d.get("instrument_type"),
        instrument_type_detail=d.get("instrument_type_detail"),
        available_providers=list(d.get("available_providers") or []),
        primary_provider=d.get("primary_provider"),
        taxonomy_refreshed_at=d.get("taxonomy_refreshed_at"),
        fetch_failure_count=int(d.get("fetch_failure_count") or 0),
        last_fetch_ok_at=d.get("last_fetch_ok_at"),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py
git commit -m "feat: add symbol pool schema and serialization"
```

---

### Task 1.2: Taxonomy derivation helpers

**Files:**
- Modify: `src/swing_screener/data/symbol_pool.py`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Consumes: `REGION_VALUES`, `CAP_TIER_VALUES`, `LIQUIDITY_TIER_VALUES` from Task 1.1.
- Produces:
  - `derive_region(exchange_mic: str | None, country_code: str | None) -> str` (returns one of REGION_VALUES)
  - `derive_cap_tier(market_cap: float | None, thresholds: dict | None = None) -> str | None`
  - `derive_liquidity_tier(avg_dollar_volume: float | None, thresholds: dict | None = None) -> str | None`
  - `derive_instrument_detail(quote_type: str | None, category: str | None, instrument_type: str | None) -> str | None`
  - `derive_providers(provider_symbol_map: dict | None) -> tuple[list[str], str | None]` (returns `(available_providers, primary_provider)`; defaults to `(["yfinance"], "yfinance")` when map empty)
  - Module constants: `DEFAULT_CAP_THRESHOLDS = {"large": 10_000_000_000, "mid": 2_000_000_000, "small": 300_000_000}` and `DEFAULT_LIQUIDITY_THRESHOLDS = {"high": 50_000_000, "mid": 5_000_000}`
  - `PROVIDER_KEY_MAP = {"yahoo_finance": "yfinance", "yfinance": "yfinance", "degiro": "degiro", "eodhd": "eodhd", "polygon": "polygon"}`
  - Region MIC map: `EUROPE_MICS = {"XAMS","XETR","XPAR","XMAD","XMIL","XLON","XBRU","XLIS","XHEL","XSTO","XCSE","XOSL","XSWX","XWBO","XDUB"}`, `ASIA_PACIFIC_MICS = {"XSHE","XSHG","XHKG","XTKS","XKRX","XASX","XTAI","XBOM","XNSE","XSES"}`, `US_MICS = {"XNAS","XNYS","ARCX","BATS","XASE","XOTC"}`

- [ ] **Step 1: Write the failing test**

```python
# append to tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import (
    derive_region, derive_cap_tier, derive_liquidity_tier,
    derive_instrument_detail, derive_providers,
)


def test_derive_region_from_mic():
    assert derive_region("XNAS", "US") == "us"
    assert derive_region("XAMS", "NL") == "europe"
    assert derive_region("XTKS", "JP") == "asia_pacific"
    assert derive_region("ZZZZ", None) == "other"


def test_derive_region_falls_back_to_country_when_mic_unknown():
    assert derive_region(None, "DE") == "europe"
    assert derive_region(None, "US") == "us"
    assert derive_region(None, "HK") == "asia_pacific"


def test_derive_cap_tier_buckets():
    assert derive_cap_tier(20_000_000_000) == "large"
    assert derive_cap_tier(5_000_000_000) == "mid"
    assert derive_cap_tier(1_000_000_000) == "small"
    assert derive_cap_tier(100_000_000) == "micro"
    assert derive_cap_tier(None) is None


def test_derive_liquidity_tier_buckets():
    assert derive_liquidity_tier(100_000_000) == "high"
    assert derive_liquidity_tier(10_000_000) == "mid"
    assert derive_liquidity_tier(1_000_000) == "low"
    assert derive_liquidity_tier(None) is None


def test_derive_instrument_detail():
    assert derive_instrument_detail("EQUITY", None, "equity") == "equity"
    assert derive_instrument_detail("ETF", "Technology", "etf") == "etf_sector"
    assert derive_instrument_detail("ETF", "Trading--Leveraged Equity", "etf") == "etf_leveraged"
    assert derive_instrument_detail("ETF", "Corporate Bond", "etf") == "etf_bond"
    assert derive_instrument_detail("ETF", "Commodities Focused", "etf") == "etf_commodity"
    assert derive_instrument_detail("ETF", "Large Blend", "etf") == "etf_equity"
    assert derive_instrument_detail(None, None, "etf") == "etf_equity"


def test_derive_providers_defaults_to_yfinance():
    assert derive_providers(None) == (["yfinance"], "yfinance")
    assert derive_providers({}) == (["yfinance"], "yfinance")


def test_derive_providers_maps_known_keys():
    available, primary = derive_providers({"yahoo_finance": "AAPL", "degiro": "1234"})
    assert set(available) == {"yfinance", "degiro"}
    assert primary == "yfinance"  # yfinance preferred when present
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: FAIL with `ImportError: cannot import name 'derive_region'`

- [ ] **Step 3: Write minimal implementation**

Append to `src/swing_screener/data/symbol_pool.py`:

```python
DEFAULT_CAP_THRESHOLDS = {"large": 10_000_000_000, "mid": 2_000_000_000, "small": 300_000_000}
DEFAULT_LIQUIDITY_THRESHOLDS = {"high": 50_000_000, "mid": 5_000_000}

PROVIDER_KEY_MAP = {
    "yahoo_finance": "yfinance", "yfinance": "yfinance",
    "degiro": "degiro", "eodhd": "eodhd", "polygon": "polygon",
}
PROVIDER_PREFERENCE = ("yfinance", "polygon", "eodhd", "degiro")

US_MICS = {"XNAS", "XNYS", "ARCX", "BATS", "XASE", "XOTC"}
EUROPE_MICS = {
    "XAMS", "XETR", "XPAR", "XMAD", "XMIL", "XLON", "XBRU", "XLIS",
    "XHEL", "XSTO", "XCSE", "XOSL", "XSWX", "XWBO", "XDUB",
}
ASIA_PACIFIC_MICS = {
    "XSHE", "XSHG", "XHKG", "XTKS", "XKRX", "XASX", "XTAI", "XBOM", "XNSE", "XSES",
}

_US_COUNTRIES = {"US", "USA"}
_EUROPE_COUNTRIES = {
    "NL", "DE", "FR", "ES", "IT", "GB", "UK", "BE", "PT", "FI", "SE",
    "DK", "NO", "CH", "AT", "IE",
}
_ASIA_PACIFIC_COUNTRIES = {"CN", "HK", "JP", "KR", "AU", "TW", "IN", "SG"}


def derive_region(exchange_mic: str | None, country_code: str | None) -> str:
    mic = (exchange_mic or "").upper()
    if mic in US_MICS:
        return "us"
    if mic in EUROPE_MICS:
        return "europe"
    if mic in ASIA_PACIFIC_MICS:
        return "asia_pacific"
    cc = (country_code or "").upper()
    if cc in _US_COUNTRIES:
        return "us"
    if cc in _EUROPE_COUNTRIES:
        return "europe"
    if cc in _ASIA_PACIFIC_COUNTRIES:
        return "asia_pacific"
    return "other"


def derive_cap_tier(market_cap: float | None, thresholds: dict | None = None) -> str | None:
    if market_cap is None:
        return None
    t = thresholds or DEFAULT_CAP_THRESHOLDS
    if market_cap >= t["large"]:
        return "large"
    if market_cap >= t["mid"]:
        return "mid"
    if market_cap >= t["small"]:
        return "small"
    return "micro"


def derive_liquidity_tier(avg_dollar_volume: float | None, thresholds: dict | None = None) -> str | None:
    if avg_dollar_volume is None:
        return None
    t = thresholds or DEFAULT_LIQUIDITY_THRESHOLDS
    if avg_dollar_volume >= t["high"]:
        return "high"
    if avg_dollar_volume >= t["mid"]:
        return "mid"
    return "low"


def derive_instrument_detail(
    quote_type: str | None, category: str | None, instrument_type: str | None
) -> str | None:
    qt = (quote_type or "").upper()
    itype = (instrument_type or "").lower()
    is_etf = qt == "ETF" or itype == "etf"
    if not is_etf:
        if qt in {"EQUITY", "STOCK"} or itype == "equity":
            return "equity"
        return instrument_type or None
    cat = (category or "").lower()
    if "leverag" in cat or "inverse" in cat or "ultra" in cat:
        return "etf_leveraged"
    if "bond" in cat or "fixed income" in cat or "treasury" in cat:
        return "etf_bond"
    if "commodit" in cat or "gold" in cat or "silver" in cat or "oil" in cat:
        return "etf_commodity"
    _SECTOR_WORDS = (
        "technology", "financial", "energy", "health", "industrial",
        "utilities", "materials", "consumer", "real estate", "communication",
    )
    if any(w in cat for w in _SECTOR_WORDS):
        return "etf_sector"
    return "etf_equity"


def derive_providers(provider_symbol_map: dict | None) -> tuple[list[str], str | None]:
    if not provider_symbol_map:
        return (["yfinance"], "yfinance")
    available: list[str] = []
    for raw_key in provider_symbol_map:
        mapped = PROVIDER_KEY_MAP.get(str(raw_key).lower())
        if mapped and mapped not in available:
            available.append(mapped)
    if not available:
        return (["yfinance"], "yfinance")
    primary = next((p for p in PROVIDER_PREFERENCE if p in available), available[0])
    return (available, primary)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py
git commit -m "feat: add taxonomy derivation helpers for symbol pool"
```

---

### Task 1.3: Network-free base pool build (merge snapshots + instrument master)

**Files:**
- Modify: `src/swing_screener/data/symbol_pool.py`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Consumes: `PoolSymbol`, `derive_region`, `derive_providers` (Tasks 1.1–1.2); registry loaders `list_package_universes()` and `_load_snapshot(id)` and `get_instrument_record(symbol)` from `src/swing_screener/data/universe.py`.
- Produces:
  - `build_pool_base(snapshots: dict[str, dict] | None = None, instrument_master: dict[str, dict] | None = None) -> list[PoolSymbol]` — pure: merges all snapshot constituents + instrument master records; sets symbol, exchange_mic, currency, region, instrument_type (coarse), index_memberships, available_providers, primary_provider; leaves yfinance fields None. Injectable args for testing; defaults read the real registry + instrument master.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import build_pool_base


def test_build_pool_base_merges_snapshots_and_instrument_master():
    snapshots = {
        "us_sp500": {
            "id": "us_sp500",
            "constituents": [
                {"symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD"},
                {"symbol": "MSFT", "exchange_mic": "XNAS", "currency": "USD"},
            ],
        },
        "broad_market_stocks": {
            "id": "broad_market_stocks",
            "constituents": [
                {"symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD"},
                {"symbol": "ASML", "exchange_mic": "XAMS", "currency": "EUR"},
            ],
        },
    }
    instrument_master = {
        "AAPL": {
            "symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD",
            "country_code": "US", "instrument_type": "equity",
            "provider_symbol_map": {"yahoo_finance": "AAPL"},
        },
        "ASML": {
            "symbol": "ASML", "exchange_mic": "XAMS", "currency": "EUR",
            "country_code": "NL", "instrument_type": "equity",
            "provider_symbol_map": {"yahoo_finance": "ASML.AS", "degiro": "1001"},
        },
    }
    pool = build_pool_base(snapshots=snapshots, instrument_master=instrument_master)
    by_symbol = {s.symbol: s for s in pool}

    assert set(by_symbol) == {"AAPL", "MSFT", "ASML"}
    assert sorted(by_symbol["AAPL"].index_memberships) == ["broad_market_stocks", "us_sp500"]
    assert by_symbol["AAPL"].region == "us"
    assert by_symbol["ASML"].region == "europe"
    assert set(by_symbol["ASML"].available_providers) == {"yfinance", "degiro"}
    assert by_symbol["ASML"].primary_provider == "yfinance"
    # yfinance-only fields remain None until enrichment
    assert by_symbol["AAPL"].sector is None
    assert by_symbol["AAPL"].market_cap_tier is None


def test_build_pool_base_handles_symbol_absent_from_instrument_master():
    snapshots = {"x": {"id": "x", "constituents": [{"symbol": "NEW", "exchange_mic": "XNYS", "currency": "USD"}]}}
    pool = build_pool_base(snapshots=snapshots, instrument_master={})
    sym = pool[0]
    assert sym.symbol == "NEW"
    assert sym.region == "us"
    assert sym.available_providers == ["yfinance"]
    assert sym.primary_provider == "yfinance"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py::test_build_pool_base_merges_snapshots_and_instrument_master -q`
Expected: FAIL with `ImportError: cannot import name 'build_pool_base'`

- [ ] **Step 3: Write minimal implementation**

Append to `src/swing_screener/data/symbol_pool.py`:

```python
def _default_snapshots() -> dict[str, dict]:
    from swing_screener.data.universe import _load_snapshot, list_package_universes
    out: dict[str, dict] = {}
    for uid in list_package_universes():
        try:
            out[uid] = _load_snapshot(uid)
        except Exception:  # noqa: BLE001 - skip unreadable snapshot
            continue
    return out


def _default_instrument_master() -> dict[str, dict]:
    from swing_screener.data.universe import _load_instrument_master
    return _load_instrument_master()


def build_pool_base(
    snapshots: dict[str, dict] | None = None,
    instrument_master: dict[str, dict] | None = None,
) -> list[PoolSymbol]:
    """Merge universe snapshots + instrument master into base PoolSymbols (no network)."""
    snaps = snapshots if snapshots is not None else _default_snapshots()
    master = instrument_master if instrument_master is not None else _default_instrument_master()

    pool: dict[str, PoolSymbol] = {}
    for uid, snap in snaps.items():
        for c in snap.get("constituents", []) or []:
            sym = str(c.get("symbol", "")).strip().upper()
            if not sym:
                continue
            entry = pool.get(sym)
            if entry is None:
                entry = PoolSymbol(symbol=sym)
                pool[sym] = entry
            if uid not in entry.index_memberships:
                entry.index_memberships.append(uid)
            if not entry.exchange_mic and c.get("exchange_mic"):
                entry.exchange_mic = c.get("exchange_mic")
            if not entry.currency and c.get("currency"):
                entry.currency = c.get("currency")

    for sym, entry in pool.items():
        rec = master.get(sym) or {}
        if rec.get("exchange_mic"):
            entry.exchange_mic = rec["exchange_mic"]
        if rec.get("currency"):
            entry.currency = rec["currency"]
        if rec.get("instrument_type"):
            entry.instrument_type = rec["instrument_type"]
        entry.region = derive_region(entry.exchange_mic, rec.get("country_code"))
        available, primary = derive_providers(rec.get("provider_symbol_map"))
        entry.available_providers = available
        entry.primary_provider = primary

    return list(pool.values())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py
git commit -m "feat: build network-free base symbol pool from snapshots + instrument master"
```

---

### Task 1.4: Taxonomy filtering over the pool

**Files:**
- Modify: `src/swing_screener/data/symbol_pool.py`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Consumes: `PoolSymbol`.
- Produces:
  - `@dataclass(frozen=True) TaxonomyFilterSpec` with optional list fields: `region`, `market_cap_tier`, `sector`, `index_memberships`, `instrument_type_detail`, `provider`, `currency`, `exchange_mics`, `liquidity_tier` (each `tuple[str, ...] | None = None`).
  - `filter_pool_by_taxonomy(pool: list[PoolSymbol], spec: TaxonomyFilterSpec) -> list[PoolSymbol]` — AND across dimensions, OR within a dimension's values; a `None` dimension is a no-op; provider matches against `available_providers`; a symbol with a `None` field is EXCLUDED when that dimension is filtered (can't prove membership).

- [ ] **Step 1: Write the failing test**

```python
# append to tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import TaxonomyFilterSpec, filter_pool_by_taxonomy


def _mk(symbol, **kw):
    return PoolSymbol(symbol=symbol, **kw)


def test_filter_none_spec_returns_all():
    pool = [_mk("A", region="us"), _mk("B", region="europe")]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec())
    assert {s.symbol for s in out} == {"A", "B"}


def test_filter_single_dimension_or_within():
    pool = [_mk("A", region="us"), _mk("B", region="europe"), _mk("C", region="asia_pacific")]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(region=("us", "europe")))
    assert {s.symbol for s in out} == {"A", "B"}


def test_filter_and_across_dimensions():
    pool = [
        _mk("A", region="us", market_cap_tier="large"),
        _mk("B", region="us", market_cap_tier="small"),
        _mk("C", region="europe", market_cap_tier="large"),
    ]
    out = filter_pool_by_taxonomy(
        pool, TaxonomyFilterSpec(region=("us",), market_cap_tier=("large",))
    )
    assert {s.symbol for s in out} == {"A"}


def test_filter_excludes_symbol_with_null_field_when_dimension_active():
    pool = [_mk("A", sector="Technology"), _mk("B", sector=None)]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(sector=("Technology",)))
    assert {s.symbol for s in out} == {"A"}


def test_filter_index_membership_matches_any():
    pool = [_mk("A", index_memberships=["us_sp500"]), _mk("B", index_memberships=["germany_dax"])]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(index_memberships=("us_sp500",)))
    assert {s.symbol for s in out} == {"A"}


def test_filter_provider_matches_available():
    pool = [
        _mk("A", available_providers=["yfinance", "degiro"]),
        _mk("B", available_providers=["yfinance"]),
    ]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(provider=("degiro",)))
    assert {s.symbol for s in out} == {"A"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: FAIL with `ImportError: cannot import name 'TaxonomyFilterSpec'`

- [ ] **Step 3: Write minimal implementation**

Append to `src/swing_screener/data/symbol_pool.py` (add `from dataclasses import ... ` already imported; add `from typing import Iterable` at top if needed):

```python
@dataclass(frozen=True)
class TaxonomyFilterSpec:
    region: tuple[str, ...] | None = None
    market_cap_tier: tuple[str, ...] | None = None
    sector: tuple[str, ...] | None = None
    index_memberships: tuple[str, ...] | None = None
    instrument_type_detail: tuple[str, ...] | None = None
    provider: tuple[str, ...] | None = None
    currency: tuple[str, ...] | None = None
    exchange_mics: tuple[str, ...] | None = None
    liquidity_tier: tuple[str, ...] | None = None


def _matches_scalar(value: str | None, allowed: tuple[str, ...] | None) -> bool:
    if not allowed:
        return True
    if value is None:
        return False
    return value in set(allowed)


def _matches_list(values: list[str], allowed: tuple[str, ...] | None) -> bool:
    if not allowed:
        return True
    return bool(set(values) & set(allowed))


def filter_pool_by_taxonomy(pool: list[PoolSymbol], spec: TaxonomyFilterSpec) -> list[PoolSymbol]:
    out: list[PoolSymbol] = []
    for s in pool:
        if not _matches_scalar(s.region, spec.region):
            continue
        if not _matches_scalar(s.market_cap_tier, spec.market_cap_tier):
            continue
        if not _matches_scalar(s.sector, spec.sector):
            continue
        if not _matches_scalar(s.instrument_type_detail, spec.instrument_type_detail):
            continue
        if not _matches_scalar(s.currency, spec.currency):
            continue
        if not _matches_scalar(s.exchange_mic, spec.exchange_mics):
            continue
        if not _matches_scalar(s.liquidity_tier, spec.liquidity_tier):
            continue
        if not _matches_list(s.index_memberships, spec.index_memberships):
            continue
        if not _matches_list(s.available_providers, spec.provider):
            continue
        out.append(s)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py
git commit -m "feat: add taxonomy filtering over symbol pool"
```

---

### Task 1.5: Best-effort yfinance enrichment

**Files:**
- Modify: `src/swing_screener/data/symbol_pool.py`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Consumes: `PoolSymbol`, `derive_cap_tier`, `derive_liquidity_tier`, `derive_instrument_detail`.
- Produces:
  - `enrich_pool_taxonomy(pool, info_fn, asof_date, cap_thresholds=None, liquidity_thresholds=None) -> list[str]` where `info_fn: Callable[[str], dict | None]` returns a ticker-info dict (keys `sector`, `industry`, `marketCap`, `averageDailyVolume3Month`/`averageVolume`, `regularMarketPrice`, `quoteType`, `category`). Mutates each `PoolSymbol` in place: sets sector, industry, market_cap_tier, liquidity_tier (from avg volume × price), instrument_type_detail, taxonomy_refreshed_at. Returns list of symbols that failed enrichment (info_fn returned None or raised). Never raises for a single symbol failure.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import enrich_pool_taxonomy


def test_enrich_populates_yfinance_fields():
    pool = [PoolSymbol(symbol="AAPL", instrument_type="equity")]
    info = {
        "AAPL": {
            "sector": "Technology", "industry": "Consumer Electronics",
            "marketCap": 3_000_000_000_000, "averageVolume": 50_000_000,
            "regularMarketPrice": 200.0, "quoteType": "EQUITY", "category": None,
        }
    }
    failed = enrich_pool_taxonomy(pool, info_fn=info.get, asof_date="2026-06-30")
    assert failed == []
    s = pool[0]
    assert s.sector == "Technology"
    assert s.market_cap_tier == "large"
    assert s.liquidity_tier == "high"  # 50M * 200 = 10B dollar volume
    assert s.instrument_type_detail == "equity"
    assert s.taxonomy_refreshed_at == "2026-06-30"


def test_enrich_records_failures_and_continues():
    pool = [PoolSymbol(symbol="GOOD"), PoolSymbol(symbol="BAD")]
    info = {"GOOD": {"sector": "Energy", "marketCap": 5e9, "averageVolume": 1e6, "regularMarketPrice": 50.0, "quoteType": "EQUITY"}}

    def info_fn(sym):
        if sym == "BAD":
            raise RuntimeError("network")
        return info.get(sym)

    failed = enrich_pool_taxonomy(pool, info_fn=info_fn, asof_date="2026-06-30")
    assert failed == ["BAD"]
    assert pool[0].sector == "Energy"
    assert pool[1].sector is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: FAIL with `ImportError: cannot import name 'enrich_pool_taxonomy'`

- [ ] **Step 3: Write minimal implementation**

Append to `src/swing_screener/data/symbol_pool.py` (ensure `from typing import Callable` at top):

```python
def _coerce_float(value) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def enrich_pool_taxonomy(
    pool: list[PoolSymbol],
    info_fn: "Callable[[str], dict | None]",
    asof_date: str,
    cap_thresholds: dict | None = None,
    liquidity_thresholds: dict | None = None,
) -> list[str]:
    """Best-effort enrichment of yfinance-derived taxonomy fields. Returns failed symbols."""
    failed: list[str] = []
    for s in pool:
        try:
            info = info_fn(s.symbol)
        except Exception:  # noqa: BLE001 - per-symbol failure must not abort the run
            failed.append(s.symbol)
            continue
        if not info:
            failed.append(s.symbol)
            continue
        s.sector = info.get("sector") or s.sector
        s.industry = info.get("industry") or s.industry
        s.market_cap_tier = derive_cap_tier(_coerce_float(info.get("marketCap")), cap_thresholds)
        avg_vol = _coerce_float(info.get("averageDailyVolume3Month")) or _coerce_float(info.get("averageVolume"))
        price = _coerce_float(info.get("regularMarketPrice"))
        dollar_vol = avg_vol * price if (avg_vol is not None and price is not None) else None
        s.liquidity_tier = derive_liquidity_tier(dollar_vol, liquidity_thresholds)
        s.instrument_type_detail = derive_instrument_detail(
            info.get("quoteType"), info.get("category"), s.instrument_type
        )
        s.taxonomy_refreshed_at = asof_date
    return failed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py
git commit -m "feat: best-effort yfinance taxonomy enrichment for symbol pool"
```

---

### Task 1.6: Pool file load/serialize + config section

**Files:**
- Modify: `src/swing_screener/data/symbol_pool.py`
- Modify: `config/defaults.yaml`
- Test: `tests/data/test_symbol_pool.py`

**Interfaces:**
- Consumes: `PoolSymbol`, `pool_symbol_to_dict`, `pool_symbol_from_dict`, `POOL_SCHEMA_VERSION`.
- Produces:
  - `serialize_pool(pool: list[PoolSymbol], asof_date: str | None = None) -> dict` → `{"schema_version": 1, "asof": asof_date, "symbols": [...]}`
  - `deserialize_pool(payload: dict) -> list[PoolSymbol]`
  - `load_symbol_pool_thresholds() -> tuple[dict, dict, int]` returning `(cap_thresholds, liquidity_thresholds, fetch_failure_threshold)` from `low_level.symbol_pool` config, falling back to module defaults and 3.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/data/test_symbol_pool.py
from swing_screener.data.symbol_pool import serialize_pool, deserialize_pool


def test_serialize_deserialize_roundtrip():
    pool = [PoolSymbol(symbol="AAPL", region="us", index_memberships=["us_sp500"])]
    payload = serialize_pool(pool, asof_date="2026-06-30")
    assert payload["schema_version"] == 1
    assert payload["asof"] == "2026-06-30"
    assert payload["symbols"][0]["symbol"] == "AAPL"
    restored = deserialize_pool(payload)
    assert restored == pool
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: FAIL with `ImportError: cannot import name 'serialize_pool'`

- [ ] **Step 3: Write minimal implementation**

Append to `src/swing_screener/data/symbol_pool.py`:

```python
def serialize_pool(pool: list[PoolSymbol], asof_date: str | None = None) -> dict:
    return {
        "schema_version": POOL_SCHEMA_VERSION,
        "asof": asof_date,
        "symbols": [pool_symbol_to_dict(s) for s in pool],
    }


def deserialize_pool(payload: dict) -> list[PoolSymbol]:
    return [pool_symbol_from_dict(d) for d in payload.get("symbols", [])]


def load_symbol_pool_thresholds() -> tuple[dict, dict, int]:
    try:
        from swing_screener.settings import get_settings_manager
        cfg = get_settings_manager().get_low_level_defaults_payload("symbol_pool")
    except Exception:  # noqa: BLE001
        cfg = {}
    cap = dict(DEFAULT_CAP_THRESHOLDS)
    cap.update({k: v for k, v in (cfg.get("market_cap_thresholds") or {}).items()})
    liq = dict(DEFAULT_LIQUIDITY_THRESHOLDS)
    liq.update({k: v for k, v in (cfg.get("liquidity_thresholds") or {}).items()})
    threshold = int(cfg.get("fetch_failure_threshold", 3) or 3)
    return cap, liq, threshold
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS

- [ ] **Step 5: Add config section**

Add to `config/defaults.yaml` under the existing `low_level:` mapping (match indentation of sibling sections):

```yaml
  symbol_pool:
    # Market-cap tier thresholds in USD (>= bound assigns the tier).
    market_cap_thresholds:
      large: 10000000000   # >= $10B
      mid: 2000000000      # >= $2B
      small: 300000000     # >= $300M (below = micro)
    # Liquidity tier thresholds in USD average daily dollar volume.
    liquidity_thresholds:
      high: 50000000       # >= $50M
      mid: 5000000         # >= $5M (below = low)
    # Consecutive OHLCV fetch failures before a symbol moves to the review queue.
    fetch_failure_threshold: 3
```

- [ ] **Step 6: Run full module test + commit**

Run: `pytest tests/data/test_symbol_pool.py -q`
Expected: PASS

```bash
git add src/swing_screener/data/symbol_pool.py tests/data/test_symbol_pool.py config/defaults.yaml
git commit -m "feat: add symbol pool serialization and config thresholds"
```

---

### Task 1.7: Generate and commit the initial pool artifact + docs

**Files:**
- Create: `data/symbol_pool.json`
- Modify: `config/README.md`, `data/README.md`

**Interfaces:**
- Consumes: `build_pool_base`, `enrich_pool_taxonomy`, `serialize_pool`, `load_symbol_pool_thresholds`.

- [ ] **Step 1: Generate the base pool (network-free) via a one-off script**

Run from repo root with the project venv:

```bash
.venv/bin/python - <<'PY'
import json
from swing_screener.data.symbol_pool import build_pool_base, serialize_pool
pool = build_pool_base()
payload = serialize_pool(pool, asof_date="2026-06-30")
with open("data/symbol_pool.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)
print("symbols:", len(payload["symbols"]))
PY
```

Expected: prints a symbol count (~1000–3000) and writes `data/symbol_pool.json`.

- [ ] **Step 2: Best-effort enrich taxonomy (sector/cap/liquidity) using the default provider's ticker info**

This step is network-bound and may be partial; commit whatever coverage it achieves. The deferred refresh trigger tops it up later.

```bash
.venv/bin/python - <<'PY'
import json
from swing_screener.data.symbol_pool import (
    deserialize_pool, enrich_pool_taxonomy, serialize_pool, load_symbol_pool_thresholds,
)
from swing_screener.data.providers.factory import get_default_provider

with open("data/symbol_pool.json", encoding="utf-8") as f:
    pool = deserialize_pool(json.load(f))

provider = get_default_provider()

def info_fn(sym):
    return provider.get_ticker_info(sym) or None

cap, liq, _ = load_symbol_pool_thresholds()
failed = enrich_pool_taxonomy(pool, info_fn=info_fn, asof_date="2026-06-30",
                              cap_thresholds=cap, liquidity_thresholds=liq)
payload = serialize_pool(pool, asof_date="2026-06-30")
with open("data/symbol_pool.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)
enriched = sum(1 for s in pool if s.sector)
print(f"enriched {enriched}/{len(pool)}; failed {len(failed)}")
PY
```

Expected: prints coverage. Partial coverage is acceptable for this PR.

- [ ] **Step 3: Document the new data file**

Add to `data/README.md` a section describing `symbol_pool.json`: schema (`schema_version`, `asof`, `symbols[]`), the meaning of each `PoolSymbol` field, that it's built by merging universe snapshots + instrument master plus best-effort yfinance enrichment, and that yfinance fields (`sector`, `market_cap_tier`, `liquidity_tier`, `instrument_type_detail`) may be null until enrichment runs. Note the (deferred) refresh trigger.

Add to `config/README.md` an entry for the `low_level.symbol_pool` section pointing at `defaults.yaml` and explaining the three threshold groups.

- [ ] **Step 4: Commit**

```bash
git add data/symbol_pool.json data/README.md config/README.md
git commit -m "feat: generate initial committed symbol pool + docs"
```

**Phase 1 gate:** `pytest tests/data/test_symbol_pool.py -q && ruff check src/swing_screener/data/symbol_pool.py && black --check src/swing_screener/data/symbol_pool.py` all green; `data/symbol_pool.json` committed.

---

# PHASE 2 — Screener integration & pool API

**Deliverable:** Screener resolves its working list from the pool via `TaxonomyFilter`; fetch failures cross into a review queue; pool/review-queue/presets endpoints exist. `universe` kept as deprecated alias.

### Task 2.1: Pool & review-queue repositories

**Files:**
- Create: `api/repositories/symbol_pool_repo.py`, `api/repositories/review_queue_repo.py`
- Test: `tests/api/test_review_queue.py`

**Interfaces:**
- Consumes: `locked_read_json`, `locked_write_json`, `locked_read_modify_write` from `api/utils/file_lock.py`; `deserialize_pool`, `serialize_pool`, `pool_symbol_from_dict` from `swing_screener.data.symbol_pool`.
- Produces:
  - `@dataclass SymbolPoolRepository(path: Path)` with `read() -> dict`, `write(data: dict) -> None`, `list_symbols() -> list[dict]`, `apply_fetch_results(ok: list[str], failed: list[str], asof: str, threshold: int) -> list[dict]` (read-modify-write: on ok → reset `fetch_failure_count=0`, set `last_fetch_ok_at=asof`; on failed → increment; returns the list of symbol dicts that reached/exceeded threshold this call).
  - `@dataclass ReviewQueueRepository(path: Path)` with `read() -> dict`, `write(data) -> None`, `list_entries() -> list[dict]`, `upsert(entries: list[dict]) -> None` (merge by symbol, bump counts/timestamps), `remove(symbol: str) -> bool`, `restore(symbol: str) -> dict | None` (pop entry, return it).

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_review_queue.py
import json
from pathlib import Path

from api.repositories.review_queue_repo import ReviewQueueRepository
from api.repositories.symbol_pool_repo import SymbolPoolRepository


def _write(path: Path, data: dict):
    path.write_text(json.dumps(data), encoding="utf-8")


def test_pool_repo_apply_fetch_results(tmp_path):
    path = tmp_path / "symbol_pool.json"
    _write(path, {"schema_version": 1, "asof": "2026-06-29", "symbols": [
        {"symbol": "AAPL", "fetch_failure_count": 2},
        {"symbol": "MSFT", "fetch_failure_count": 0},
    ]})
    repo = SymbolPoolRepository(path)
    crossed = repo.apply_fetch_results(ok=["MSFT"], failed=["AAPL"], asof="2026-06-30", threshold=3)
    assert [c["symbol"] for c in crossed] == ["AAPL"]  # 2 -> 3 crosses threshold
    data = repo.read()
    by = {s["symbol"]: s for s in data["symbols"]}
    assert by["AAPL"]["fetch_failure_count"] == 3
    assert by["MSFT"]["fetch_failure_count"] == 0
    assert by["MSFT"]["last_fetch_ok_at"] == "2026-06-30"


def test_review_queue_upsert_remove_restore(tmp_path):
    path = tmp_path / "review_queue.json"
    _write(path, {"entries": []})
    repo = ReviewQueueRepository(path)
    repo.upsert([{"symbol": "AAPL", "exchange_mic": "XNAS", "failure_count": 3,
                  "first_failed_at": "2026-06-28", "last_failed_at": "2026-06-30",
                  "reason": "no data"}])
    assert [e["symbol"] for e in repo.list_entries()] == ["AAPL"]
    restored = repo.restore("AAPL")
    assert restored["symbol"] == "AAPL"
    assert repo.list_entries() == []
    repo.upsert([{"symbol": "MSFT", "failure_count": 3}])
    assert repo.remove("MSFT") is True
    assert repo.remove("MSFT") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_review_queue.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.repositories.symbol_pool_repo'`

- [ ] **Step 3: Write minimal implementation**

```python
# api/repositories/symbol_pool_repo.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from api.utils.file_lock import locked_read_json, locked_read_modify_write, locked_write_json


@dataclass
class SymbolPoolRepository:
    path: Path

    def read(self) -> dict:
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def list_symbols(self) -> list[dict]:
        return self.read().get("symbols", [])

    def apply_fetch_results(
        self, ok: list[str], failed: list[str], asof: str, threshold: int
    ) -> list[dict]:
        ok_set = {s.upper() for s in ok}
        failed_set = {s.upper() for s in failed}
        crossed: list[dict] = []

        def _modify(data: dict) -> dict:
            crossed.clear()
            for sym in data.get("symbols", []):
                name = str(sym.get("symbol", "")).upper()
                if name in ok_set:
                    sym["fetch_failure_count"] = 0
                    sym["last_fetch_ok_at"] = asof
                elif name in failed_set:
                    prev = int(sym.get("fetch_failure_count") or 0)
                    sym["fetch_failure_count"] = prev + 1
                    if prev < threshold <= sym["fetch_failure_count"]:
                        crossed.append(dict(sym))
            return data

        locked_read_modify_write(self.path, _modify)
        return crossed
```

```python
# api/repositories/review_queue_repo.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from api.utils.file_lock import locked_read_modify_write, locked_write_json


@dataclass
class ReviewQueueRepository:
    path: Path

    def read(self) -> dict:
        if not self.path.exists():
            return {"entries": []}
        from api.utils.file_lock import locked_read_json
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def list_entries(self) -> list[dict]:
        return self.read().get("entries", [])

    def upsert(self, entries: list[dict]) -> None:
        incoming = {str(e["symbol"]).upper(): e for e in entries}

        def _modify(data: dict) -> dict:
            data.setdefault("entries", [])
            by_symbol = {str(e["symbol"]).upper(): e for e in data["entries"]}
            by_symbol.update(incoming)
            data["entries"] = list(by_symbol.values())
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)

    def remove(self, symbol: str) -> bool:
        target = symbol.upper()
        removed = {"flag": False}

        def _modify(data: dict) -> dict:
            entries = data.get("entries", [])
            kept = [e for e in entries if str(e["symbol"]).upper() != target]
            removed["flag"] = len(kept) != len(entries)
            data["entries"] = kept
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return removed["flag"]

    def restore(self, symbol: str) -> dict | None:
        target = symbol.upper()
        popped: dict = {}

        def _modify(data: dict) -> dict:
            entries = data.get("entries", [])
            kept = []
            for e in entries:
                if str(e["symbol"]).upper() == target and not popped:
                    popped.update(e)
                else:
                    kept.append(e)
            data["entries"] = kept
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return popped or None

    def _ensure_file(self) -> None:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.write({"entries": []})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/api/test_review_queue.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/repositories/symbol_pool_repo.py api/repositories/review_queue_repo.py tests/api/test_review_queue.py
git commit -m "feat: add symbol pool and review queue repositories"
```

---

### Task 2.2: TaxonomyFilter request model + presets loader

**Files:**
- Modify: `api/models/screener.py`
- Create: `config/taxonomy_presets.yaml`
- Create: `api/services/pool_service.py`
- Test: `tests/api/test_pool_router.py` (preset-loading portion)

**Interfaces:**
- Consumes: `TaxonomyFilterSpec` from `swing_screener.data.symbol_pool`.
- Produces:
  - In `api/models/screener.py`: `class TaxonomyFilter(BaseModel)` with optional `list[str]` fields `region, market_cap_tier, sector, index_memberships, instrument_type_detail, provider, currency, exchange_mics, liquidity_tier` (all default None); method `to_spec() -> TaxonomyFilterSpec`.
  - `ScreenerRequest` gains `taxonomy_filter: Optional[TaxonomyFilter] = None` and `preset: Optional[str] = None`; keeps `universe` (now documented as deprecated alias).
  - In `api/services/pool_service.py`: `load_taxonomy_presets() -> list[dict]` (each `{"id", "label", "filter": {...}}`) and `resolve_preset(preset_id: str) -> TaxonomyFilter | None`.

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_pool_router.py
from api.models.screener import TaxonomyFilter


def test_taxonomy_filter_to_spec():
    tf = TaxonomyFilter(region=["us"], market_cap_tier=["large", "mid"], provider=["yfinance"])
    spec = tf.to_spec()
    assert spec.region == ("us",)
    assert spec.market_cap_tier == ("large", "mid")
    assert spec.provider == ("yfinance",)
    assert spec.sector is None


def test_load_taxonomy_presets_returns_seeded_presets():
    from api.services.pool_service import load_taxonomy_presets
    presets = load_taxonomy_presets()
    ids = {p["id"] for p in presets}
    assert "us_large_cap_equities" in ids
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_pool_router.py -q`
Expected: FAIL with `ImportError: cannot import name 'TaxonomyFilter'`

- [ ] **Step 3: Add the model**

In `api/models/screener.py`, add near `ScreenerRequest` (import `from swing_screener.data.symbol_pool import TaxonomyFilterSpec` at top):

```python
class TaxonomyFilter(BaseModel):
    region: Optional[list[str]] = None
    market_cap_tier: Optional[list[str]] = None
    sector: Optional[list[str]] = None
    index_memberships: Optional[list[str]] = None
    instrument_type_detail: Optional[list[str]] = None
    provider: Optional[list[str]] = None
    currency: Optional[list[str]] = None
    exchange_mics: Optional[list[str]] = None
    liquidity_tier: Optional[list[str]] = None

    def to_spec(self) -> TaxonomyFilterSpec:
        def _t(v: Optional[list[str]]) -> Optional[tuple[str, ...]]:
            return tuple(v) if v else None

        return TaxonomyFilterSpec(
            region=_t(self.region),
            market_cap_tier=_t(self.market_cap_tier),
            sector=_t(self.sector),
            index_memberships=_t(self.index_memberships),
            instrument_type_detail=_t(self.instrument_type_detail),
            provider=_t(self.provider),
            currency=_t(self.currency),
            exchange_mics=_t(self.exchange_mics),
            liquidity_tier=_t(self.liquidity_tier),
        )
```

Add to `ScreenerRequest` (after `instrument_types`):

```python
    taxonomy_filter: Optional[TaxonomyFilter] = Field(
        default=None,
        description="Taxonomy pre-filter applied to the unified symbol pool.",
    )
    preset: Optional[str] = Field(
        default=None, description="Named taxonomy preset id (config/taxonomy_presets.yaml)."
    )
```

Update the `universe` field description to: `"DEPRECATED alias: resolves to taxonomy_filter.index_memberships=[universe]. Removed in a later release."`

- [ ] **Step 4: Seed the presets file**

Create `config/taxonomy_presets.yaml`:

```yaml
# Named taxonomy presets for the unified symbol pool screener.
# Each preset pre-fills the quick filter bar. Selecting one then editing a
# chip marks the selection "custom" in the UI.
presets:
  us_large_cap_equities:
    label: "US Large Cap Equities"
    filter:
      region: [us]
      market_cap_tier: [large]
      instrument_type_detail: [equity]
  eu_blue_chips:
    label: "EU Blue Chips"
    filter:
      region: [europe]
      market_cap_tier: [large]
      instrument_type_detail: [equity]
  sector_etfs:
    label: "Sector ETFs"
    filter:
      instrument_type_detail: [etf_sector]
  broad_market:
    label: "Broad Market"
    filter:
      index_memberships: [broad_market_stocks]
```

- [ ] **Step 5: Add the presets loader**

Create `api/services/pool_service.py`:

```python
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from api.models.screener import TaxonomyFilter
from swing_screener.settings.paths import config_dir


def _presets_path() -> Path:
    return config_dir() / "taxonomy_presets.yaml"


@lru_cache(maxsize=1)
def _load_presets_document() -> dict:
    path = _presets_path()
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        payload = yaml.safe_load(f) or {}
    return payload if isinstance(payload, dict) else {}


def load_taxonomy_presets() -> list[dict]:
    doc = _load_presets_document()
    presets = doc.get("presets", {}) or {}
    out: list[dict] = []
    for pid, body in presets.items():
        out.append({
            "id": pid,
            "label": (body or {}).get("label", pid),
            "filter": (body or {}).get("filter", {}) or {},
        })
    return out


def resolve_preset(preset_id: str) -> Optional[TaxonomyFilter]:
    for p in load_taxonomy_presets():
        if p["id"] == preset_id:
            return TaxonomyFilter(**p["filter"])
    return None
```

> Note: confirm the import path for `config_dir`. The exploration found `get_settings_manager()` and `repo_config_dir()`; if `swing_screener.settings.paths.config_dir` does not exist, use the same helper the settings manager uses (`from swing_screener.settings import paths` or replicate `repo_config_dir()`), verified by reading `src/swing_screener/settings/`.

- [ ] **Step 6: Run test + commit**

Run: `pytest tests/api/test_pool_router.py -q`
Expected: PASS

```bash
git add api/models/screener.py config/taxonomy_presets.yaml api/services/pool_service.py tests/api/test_pool_router.py
git commit -m "feat: add TaxonomyFilter model and taxonomy presets"
```

---

### Task 2.3: Screener pre-filter from the pool

**Files:**
- Modify: `api/services/screener_service.py`
- Modify: `api/dependencies.py` (inject pool + review repos into ScreenerService)
- Test: `tests/test_screener_service.py`

**Interfaces:**
- Consumes: `SymbolPoolRepository`, `ReviewQueueRepository`, `resolve_preset`, `filter_pool_by_taxonomy`, `deserialize_pool`.
- Produces: `_resolve_universe_and_window` resolves `ctx.tickers` from the pool. Resolution order: (1) explicit `request.tickers` (unchanged); (2) build `TaxonomyFilterSpec` from `request.taxonomy_filter` merged over `resolve_preset(request.preset)` and the deprecated `request.universe` (→ `index_memberships=[universe]`); (3) load pool symbols, drop those present in the review queue, drop `primary_provider` symbols whose provider creds are absent (degiro), `filter_pool_by_taxonomy`, take symbols, apply `universe_cap`, ensure benchmark. Empty filter = whole pool.

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_screener_service.py
from api.models.screener import ScreenerRequest, TaxonomyFilter


def test_resolve_universe_prefilters_from_pool(monkeypatch, screener_service_with_pool):
    # fixture builds a ScreenerService whose pool repo returns:
    #   AAPL(us,large,yfinance), ASML(europe,large,yfinance), TSM(asia_pacific,large,yfinance)
    # and an empty review queue.
    svc = screener_service_with_pool
    req = ScreenerRequest(taxonomy_filter=TaxonomyFilter(region=["us"]), top=5)
    ctx = svc._new_run_context(req)  # helper that builds _RunContext + strategy
    svc._resolve_universe_and_window(ctx)
    assert "AAPL" in ctx.screening_tickers
    assert "ASML" not in ctx.screening_tickers
    assert "TSM" not in ctx.screening_tickers


def test_resolve_universe_excludes_review_queue(screener_service_with_pool_and_queue):
    svc = screener_service_with_pool_and_queue  # queue contains AAPL
    req = ScreenerRequest(taxonomy_filter=TaxonomyFilter(region=["us"]), top=5)
    ctx = svc._new_run_context(req)
    svc._resolve_universe_and_window(ctx)
    assert "AAPL" not in ctx.screening_tickers


def test_universe_alias_maps_to_index_membership(screener_service_with_pool):
    svc = screener_service_with_pool
    req = ScreenerRequest(universe="us_sp500", top=5)
    ctx = svc._new_run_context(req)
    svc._resolve_universe_and_window(ctx)
    # AAPL is in us_sp500 per fixture; others are not
    assert "AAPL" in ctx.screening_tickers
```

> The fixtures `screener_service_with_pool[_and_queue]` and the `_new_run_context` helper are part of this task. If `_new_run_context` doesn't already exist on `ScreenerService`, add a thin test-only helper that mirrors the first lines of `run_screener` (build strategy dict + `_RunContext`). Read `run_screener` to copy the exact strategy-loading call.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_screener_service.py -k prefilter -q`
Expected: FAIL (pool not consulted yet)

- [ ] **Step 3: Implement the pre-filter**

Replace the universe-resolution block in `_resolve_universe_and_window` (the `if request.tickers / elif request.universe / else` ladder plus the `filter_tickers_by_metadata` call, lines ~283–318) with pool-based resolution. Add to `ScreenerService.__init__` the `pool_repo: SymbolPoolRepository` and `review_repo: ReviewQueueRepository` params. New body of the resolution block:

```python
    if request.tickers:
        ctx.tickers = [t.upper() for t in request.tickers]
        if ctx.benchmark not in ctx.tickers:
            ctx.tickers.append(ctx.benchmark)
    else:
        spec = self._build_taxonomy_spec(request)
        pool = deserialize_pool({"symbols": self._pool_repo.list_symbols()})
        queued = {e["symbol"].upper() for e in self._review_repo.list_entries()}
        pool = [s for s in pool if s.symbol not in queued]
        pool = [s for s in pool if self._provider_available(s.primary_provider)]
        filtered = filter_pool_by_taxonomy(pool, spec)
        universe_cap = max(500, requested_top * 2)
        symbols = [s.symbol for s in filtered][:universe_cap]
        if ctx.benchmark not in symbols:
            symbols.append(ctx.benchmark)
        ctx.tickers = symbols
```

Add helper methods to `ScreenerService`:

```python
    def _build_taxonomy_spec(self, request: ScreenerRequest):
        from swing_screener.data.symbol_pool import TaxonomyFilterSpec
        base = TaxonomyFilter()
        if request.preset:
            resolved = resolve_preset(request.preset)
            if resolved is not None:
                base = resolved
        if request.taxonomy_filter is not None:
            base = _merge_taxonomy(base, request.taxonomy_filter)
        if request.universe:  # deprecated alias
            existing = list(base.index_memberships or [])
            if request.universe not in existing:
                existing.append(request.universe)
            base = base.model_copy(update={"index_memberships": existing})
        return base.to_spec()

    def _provider_available(self, provider: str | None) -> bool:
        if provider in (None, "yfinance"):
            return True
        return provider in self._available_providers
```

Add module-level helper and a provider-availability set built in `__init__` (e.g. `self._available_providers = self._resolve_available_providers()` reading creds from config/env — yfinance always available; degiro only if credentials configured). Read `api/services/portfolio/` DeGiro credential check to reuse the existing "are degiro creds present" helper rather than re-implementing.

```python
def _merge_taxonomy(base: TaxonomyFilter, override: TaxonomyFilter) -> TaxonomyFilter:
    data = base.model_dump()
    for k, v in override.model_dump().items():
        if v:
            data[k] = v
    return TaxonomyFilter(**data)
```

Remove the now-dead `_REMOVED_UNIVERSE_IDS` branch and the `filter_tickers_by_metadata` call from this method (currency/exchange/instrument filtering now happens via the taxonomy spec). Keep `resolve_screening_currencies` working: pass `universe_id=None`.

- [ ] **Step 4: Wire dependencies**

In `api/dependencies.py`, add repo providers and pass them into `get_screener_service`:

```python
def get_symbol_pool_repo() -> SymbolPoolRepository:
    path = get_settings_manager().resolve_runtime_path("symbol_pool_file", DATA_DIR / "symbol_pool.json")
    return SymbolPoolRepository(path)


def get_review_queue_repo() -> ReviewQueueRepository:
    path = get_settings_manager().resolve_runtime_path("review_queue_file", DATA_DIR / "review_queue.json")
    return ReviewQueueRepository(path)
```

And extend `get_screener_service` signature with `pool_repo: SymbolPoolRepository = Depends(get_symbol_pool_repo)`, `review_repo: ReviewQueueRepository = Depends(get_review_queue_repo)`, passing both into `ScreenerService(...)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_screener_service.py -q`
Expected: PASS (existing + new). Fix any existing tests that constructed `ScreenerService(...)` without the new repos by passing fakes.

- [ ] **Step 6: Commit**

```bash
git add api/services/screener_service.py api/dependencies.py tests/test_screener_service.py
git commit -m "feat: resolve screener working list from taxonomy-filtered pool"
```

---

### Task 2.4: Fetch-failure tracking into the review queue

**Files:**
- Modify: `api/services/screener_service.py`
- Test: `tests/test_screener_service.py`

**Interfaces:**
- Consumes: `SymbolPoolRepository.apply_fetch_results`, `ReviewQueueRepository.upsert`, `load_symbol_pool_thresholds`.
- Produces: After OHLCV fetch in `_build_signals_and_fetch_ohlcv`, compute `ok` = screening tickers present in `ctx.ohlcv` Close columns, `failed` = requested minus ok (excluding benchmark). Post-run (after fetch, not mid-loop) call `pool_repo.apply_fetch_results(ok, failed, asof, threshold)`; for crossed symbols, build review entries and `review_repo.upsert(...)`. Wrapped in try/except → on failure, log + append a warning, never abort the screen.

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_screener_service.py
def test_failed_fetch_increments_pool_and_enqueues_on_threshold(screener_service_with_pool_fake_provider):
    # provider returns data for MSFT only; AAPL already at failure_count=2, threshold=3
    svc = screener_service_with_pool_fake_provider
    req = ScreenerRequest(taxonomy_filter=TaxonomyFilter(region=["us"]), top=5)
    svc.run_screener(req)
    queue = svc._review_repo.list_entries()
    assert any(e["symbol"] == "AAPL" for e in queue)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_screener_service.py -k failed_fetch -q`
Expected: FAIL (no enqueue yet)

- [ ] **Step 3: Implement tracking**

Add a private method and call it right after the OHLCV fetch + benchmark merge in `_build_signals_and_fetch_ohlcv`:

```python
    def _record_fetch_health(self, ctx: _RunContext) -> None:
        try:
            from swing_screener.data.symbol_pool import load_symbol_pool_thresholds
            _, _, threshold = load_symbol_pool_thresholds()
            present = set()
            if ctx.ohlcv is not None and not ctx.ohlcv.empty and "Close" in ctx.ohlcv.columns.get_level_values(0):
                present = set(ctx.ohlcv["Close"].columns)
            requested = [t for t in ctx.screening_tickers]
            ok = [t for t in requested if t in present]
            failed = [t for t in requested if t not in present]
            crossed = self._pool_repo.apply_fetch_results(ok, failed, ctx.asof_str, threshold)
            if crossed:
                entries = [{
                    "symbol": c["symbol"],
                    "exchange_mic": c.get("exchange_mic"),
                    "failure_count": c.get("fetch_failure_count"),
                    "first_failed_at": c.get("last_fetch_ok_at") or ctx.asof_str,
                    "last_failed_at": ctx.asof_str,
                    "reason": "OHLCV fetch returned no data",
                } for c in crossed]
                self._review_repo.upsert(entries)
        except Exception as exc:  # noqa: BLE001 - health tracking must never break a screen
            logger.warning("Fetch-health tracking failed: %s", exc)
            ctx.warnings.append("Fetch-health tracking unavailable this run.")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_screener_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/services/screener_service.py tests/test_screener_service.py
git commit -m "feat: track OHLCV fetch failures into the review queue"
```

---

### Task 2.5: Pool API router

**Files:**
- Create: `api/routers/pool.py`
- Modify: `api/services/pool_service.py` (symbol listing + queue actions), `api/main.py`, `api/README.md`
- Test: `tests/api/test_pool_router.py`

**Interfaces:**
- Consumes: `SymbolPoolRepository`, `ReviewQueueRepository`, `load_taxonomy_presets`, `filter_pool_by_taxonomy`, `deserialize_pool`.
- Produces endpoints (prefix `/api/pool`):
  - `GET /symbols?region=&market_cap_tier=&...&page=&page_size=` → `{"symbols": [...], "total": int, "page": int, "page_size": int}`
  - `GET /review-queue` → `{"entries": [...]}`
  - `POST /review-queue/{symbol}/remove` → `{"removed": bool}`
  - `POST /review-queue/{symbol}/restore` → `{"restored": bool}`
  - `GET /presets` → `{"presets": [{"id","label","filter"}]}`

- [ ] **Step 1: Write the failing test**

```python
# add to tests/api/test_pool_router.py
from fastapi.testclient import TestClient


def test_get_presets_endpoint(pool_test_client):
    resp = pool_test_client.get("/api/pool/presets")
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()["presets"]}
    assert "us_large_cap_equities" in ids


def test_get_symbols_filters_and_paginates(pool_test_client_with_seed):
    resp = pool_test_client_with_seed.get("/api/pool/symbols", params={"region": "us", "page_size": 1})
    body = resp.json()
    assert resp.status_code == 200
    assert body["page_size"] == 1
    assert all(s["region"] == "us" for s in body["symbols"])


def test_review_queue_remove_and_restore(pool_test_client_with_queue):
    c = pool_test_client_with_queue  # queue seeded with AAPL
    assert c.get("/api/pool/review-queue").json()["entries"]
    assert c.post("/api/pool/review-queue/AAPL/restore").json()["restored"] is True
    assert c.get("/api/pool/review-queue").json()["entries"] == []
```

> Provide pytest fixtures building a `TestClient(app)` with `get_symbol_pool_repo`/`get_review_queue_repo` dependency-overridden to repos backed by `tmp_path` seed files. Follow the override pattern in `tests/api/test_cache_router.py` (from `fix/cache-review-pr3`) or existing `tests/api/` clients.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_pool_router.py -k endpoint -q`
Expected: FAIL (router not mounted)

- [ ] **Step 3: Add service helpers**

Append to `api/services/pool_service.py`:

```python
from api.models.screener import TaxonomyFilter as _TF
from swing_screener.data.symbol_pool import deserialize_pool, filter_pool_by_taxonomy, pool_symbol_to_dict


def list_pool_symbols(repo, tax_filter: _TF, page: int, page_size: int) -> dict:
    pool = deserialize_pool({"symbols": repo.list_symbols()})
    filtered = filter_pool_by_taxonomy(pool, tax_filter.to_spec())
    total = len(filtered)
    start = max(0, (page - 1) * page_size)
    page_items = filtered[start:start + page_size]
    return {
        "symbols": [pool_symbol_to_dict(s) for s in page_items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
```

- [ ] **Step 4: Add the router**

Create `api/routers/pool.py`:

```python
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from api.dependencies import get_review_queue_repo, get_symbol_pool_repo
from api.models.screener import TaxonomyFilter
from api.repositories.review_queue_repo import ReviewQueueRepository
from api.repositories.symbol_pool_repo import SymbolPoolRepository
from api.services.pool_service import list_pool_symbols, load_taxonomy_presets

router = APIRouter()


@router.get("/symbols")
def get_symbols(
    region: Optional[list[str]] = Query(default=None),
    market_cap_tier: Optional[list[str]] = Query(default=None),
    sector: Optional[list[str]] = Query(default=None),
    index_memberships: Optional[list[str]] = Query(default=None),
    instrument_type_detail: Optional[list[str]] = Query(default=None),
    provider: Optional[list[str]] = Query(default=None),
    currency: Optional[list[str]] = Query(default=None),
    exchange_mics: Optional[list[str]] = Query(default=None),
    liquidity_tier: Optional[list[str]] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    repo: SymbolPoolRepository = Depends(get_symbol_pool_repo),
):
    tf = TaxonomyFilter(
        region=region, market_cap_tier=market_cap_tier, sector=sector,
        index_memberships=index_memberships, instrument_type_detail=instrument_type_detail,
        provider=provider, currency=currency, exchange_mics=exchange_mics,
        liquidity_tier=liquidity_tier,
    )
    return list_pool_symbols(repo, tf, page, page_size)


@router.get("/review-queue")
def get_review_queue(repo: ReviewQueueRepository = Depends(get_review_queue_repo)):
    return {"entries": repo.list_entries()}


@router.post("/review-queue/{symbol}/remove")
def remove_from_pool(symbol: str, repo: ReviewQueueRepository = Depends(get_review_queue_repo)):
    return {"removed": repo.remove(symbol)}


@router.post("/review-queue/{symbol}/restore")
def restore_to_pool(symbol: str, repo: ReviewQueueRepository = Depends(get_review_queue_repo)):
    restored = repo.restore(symbol)
    return {"restored": restored is not None}


@router.get("/presets")
def get_presets():
    return {"presets": load_taxonomy_presets()}
```

> `remove` semantics: this PR removes the entry from the review queue; permanently dropping the symbol from `symbol_pool.json` is a pool-mutation that belongs with the deferred pool-build/edit work. For now `remove` clears the queue entry and the symbol simply re-enters screening on the next run unless it fails again. Document this in `api/README.md`. (If hard pool removal is wanted now, add a `SymbolPoolRepository.remove(symbol)` mirroring the queue remove and call it here — flag as an open question.)

- [ ] **Step 5: Register the router**

In `api/main.py`, alongside the other includes:

```python
from api.routers import pool as pool_router
app.include_router(pool_router.router, prefix="/api/pool", tags=["pool"])
```

- [ ] **Step 6: Run tests + update api/README.md + commit**

Run: `pytest tests/api/test_pool_router.py -q`
Expected: PASS

Add the five endpoints to `api/README.md`, and note the deprecated `universe` field on `POST /api/screener/run`.

```bash
git add api/routers/pool.py api/services/pool_service.py api/main.py api/README.md tests/api/test_pool_router.py
git commit -m "feat: add pool symbols, review-queue, and presets API"
```

**Phase 2 gate:** `pytest -q -m "not integration"` green; `ruff check . && black --check .` clean.

---

# PHASE 3 — Frontend filter bar

**Deliverable:** Quick filter bar above the screener table drives a `taxonomyFilter` on the screener request; the collapsible panel holds generic dimensions; the universe `<Select>` is removed.

### Task 3.1: Pool feature types, API client, hooks

**Files:**
- Create: `web-ui/src/features/pool/types.ts`, `web-ui/src/features/pool/api.ts`, `web-ui/src/features/pool/hooks.ts`
- Modify: `web-ui/src/lib/queryKeys.ts`, `web-ui/src/lib/api.ts` (endpoint constants)
- Test: `web-ui/src/features/pool/hooks.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `TaxonomyPreset { id: string; label: string; filter: TaxonomyFilterValues }`, `TaxonomyFilterValues` (camelCase optional string[] for each dimension), `PoolSymbolSummary`, `ReviewQueueEntry { symbol; exchangeMic?; capTier?; sector?; provider?; failureCount; firstFailedAt; lastFailedAt; reason }`, and `transformReviewEntry(api) -> ReviewQueueEntry`.
  - `api.ts`: `fetchPresets(): Promise<TaxonomyPreset[]>`, `fetchReviewQueue(): Promise<ReviewQueueEntry[]>`, `removeFromPool(symbol)`, `restoreToPool(symbol)`.
  - `hooks.ts`: `usePresets()`, `useReviewQueue()`, `useRemoveFromPool()`, `useRestoreToPool()`.
  - `queryKeys`: `taxonomyPresets()`, `reviewQueue()`.

- [ ] **Step 1: Write the failing test**

```ts
// web-ui/src/features/pool/hooks.test.ts
import { describe, it, expect } from 'vitest';
import { transformReviewEntry } from './types';

describe('transformReviewEntry', () => {
  it('maps snake_case API entry to camelCase', () => {
    const out = transformReviewEntry({
      symbol: 'AAPL', exchange_mic: 'XNAS', failure_count: 3,
      first_failed_at: '2026-06-28', last_failed_at: '2026-06-30', reason: 'no data',
    });
    expect(out).toEqual({
      symbol: 'AAPL', exchangeMic: 'XNAS', failureCount: 3,
      firstFailedAt: '2026-06-28', lastFailedAt: '2026-06-30', reason: 'no data',
      capTier: undefined, sector: undefined, provider: undefined,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/features/pool/hooks.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement types/api/hooks**

`web-ui/src/features/pool/types.ts`:

```ts
export interface TaxonomyFilterValues {
  region?: string[];
  marketCapTier?: string[];
  sector?: string[];
  indexMemberships?: string[];
  instrumentTypeDetail?: string[];
  provider?: string[];
  currency?: string[];
  exchangeMics?: string[];
  liquidityTier?: string[];
}

export interface TaxonomyPreset {
  id: string;
  label: string;
  filter: TaxonomyFilterValues;
}

export interface ReviewQueueEntry {
  symbol: string;
  exchangeMic?: string;
  capTier?: string;
  sector?: string;
  provider?: string;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  reason: string;
}

interface ReviewQueueEntryAPI {
  symbol: string;
  exchange_mic?: string;
  cap_tier?: string;
  sector?: string;
  provider?: string;
  failure_count: number;
  first_failed_at: string;
  last_failed_at: string;
  reason: string;
}

export function transformReviewEntry(api: ReviewQueueEntryAPI): ReviewQueueEntry {
  return {
    symbol: api.symbol,
    exchangeMic: api.exchange_mic,
    capTier: api.cap_tier,
    sector: api.sector,
    provider: api.provider,
    failureCount: api.failure_count,
    firstFailedAt: api.first_failed_at,
    lastFailedAt: api.last_failed_at,
    reason: api.reason,
  };
}

interface TaxonomyPresetAPI {
  id: string;
  label: string;
  filter: Record<string, string[] | undefined>;
}

export function transformPreset(api: TaxonomyPresetAPI): TaxonomyPreset {
  const f = api.filter ?? {};
  return {
    id: api.id,
    label: api.label,
    filter: {
      region: f.region,
      marketCapTier: f.market_cap_tier,
      sector: f.sector,
      indexMemberships: f.index_memberships,
      instrumentTypeDetail: f.instrument_type_detail,
      provider: f.provider,
      currency: f.currency,
      exchangeMics: f.exchange_mics,
      liquidityTier: f.liquidity_tier,
    },
  };
}
```

`web-ui/src/features/pool/api.ts` (follow `runScreener` fetch pattern in `features/screener/api.ts`; add `pool*` endpoints to `lib/api.ts` `API_ENDPOINTS`):

```ts
import { apiUrl, API_ENDPOINTS } from '@/lib/api';
import {
  ReviewQueueEntry, TaxonomyPreset, transformPreset, transformReviewEntry,
} from './types';

export async function fetchPresets(): Promise<TaxonomyPreset[]> {
  const res = await fetch(apiUrl(API_ENDPOINTS.poolPresets));
  if (!res.ok) throw new Error('Failed to load presets');
  const body = await res.json();
  return (body.presets ?? []).map(transformPreset);
}

export async function fetchReviewQueue(): Promise<ReviewQueueEntry[]> {
  const res = await fetch(apiUrl(API_ENDPOINTS.poolReviewQueue));
  if (!res.ok) throw new Error('Failed to load review queue');
  const body = await res.json();
  return (body.entries ?? []).map(transformReviewEntry);
}

export async function removeFromPool(symbol: string): Promise<boolean> {
  const res = await fetch(apiUrl(API_ENDPOINTS.poolReviewQueueRemove(symbol)), { method: 'POST' });
  if (!res.ok) throw new Error('Failed to remove symbol');
  return (await res.json()).removed;
}

export async function restoreToPool(symbol: string): Promise<boolean> {
  const res = await fetch(apiUrl(API_ENDPOINTS.poolReviewQueueRestore(symbol)), { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restore symbol');
  return (await res.json()).restored;
}
```

`web-ui/src/features/pool/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchPresets, fetchReviewQueue, removeFromPool, restoreToPool } from './api';

export function usePresets() {
  return useQuery({ queryKey: queryKeys.taxonomyPresets(), queryFn: fetchPresets, staleTime: 60 * 60 * 1000 });
}

export function useReviewQueue() {
  return useQuery({ queryKey: queryKeys.reviewQueue(), queryFn: fetchReviewQueue });
}

export function useRemoveFromPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFromPool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviewQueue() }),
  });
}

export function useRestoreToPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreToPool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviewQueue() }),
  });
}
```

Add to `web-ui/src/lib/queryKeys.ts`:

```ts
  taxonomyPresets: () => ['taxonomy-presets'] as const,
  reviewQueue: () => ['review-queue'] as const,
```

Add endpoint constants to `web-ui/src/lib/api.ts` `API_ENDPOINTS`:

```ts
  poolPresets: '/api/pool/presets',
  poolReviewQueue: '/api/pool/review-queue',
  poolReviewQueueRemove: (s: string) => `/api/pool/review-queue/${encodeURIComponent(s)}/remove`,
  poolReviewQueueRestore: (s: string) => `/api/pool/review-queue/${encodeURIComponent(s)}/restore`,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/features/pool/hooks.test.ts && npm run typecheck`
Expected: PASS, no type errors

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/pool web-ui/src/lib/queryKeys.ts web-ui/src/lib/api.ts
git commit -m "feat: add pool feature types, api client, and hooks (web-ui)"
```

---

### Task 3.2: ScreenerRequest taxonomy wiring + transform

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`, `web-ui/src/features/screener/api.ts`
- Test: `web-ui/src/features/screener/types.test.ts` (or the existing transform test file)

**Interfaces:**
- Consumes: `TaxonomyFilterValues` from `features/pool/types`.
- Produces: `ScreenerRequest` gains `taxonomyFilter?: TaxonomyFilterValues` and `preset?: string`; `universe?` retained but optional/deprecated. `api.ts runScreener` serializes `taxonomyFilter` → snake_case `taxonomy_filter` and `preset`.

- [ ] **Step 1: Write the failing test**

```ts
// web-ui/src/features/screener/types.test.ts (add)
import { describe, it, expect } from 'vitest';
import { toScreenerRequestPayload } from './api';

describe('toScreenerRequestPayload', () => {
  it('serializes taxonomyFilter to snake_case', () => {
    const payload = toScreenerRequestPayload({
      top: 20,
      taxonomyFilter: { region: ['us'], marketCapTier: ['large'], indexMemberships: ['us_sp500'] },
      preset: 'us_large_cap_equities',
    });
    expect(payload.taxonomy_filter).toEqual({
      region: ['us'], market_cap_tier: ['large'], index_memberships: ['us_sp500'],
    });
    expect(payload.preset).toBe('us_large_cap_equities');
  });
});
```

> If `runScreener` currently inlines the payload object, extract a pure `toScreenerRequestPayload(request)` helper (exported) so it's unit-testable, and have `runScreener` call it. Keep the existing `force_refresh` line.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/features/screener/types.test.ts`
Expected: FAIL (`toScreenerRequestPayload` undefined)

- [ ] **Step 3: Implement**

In `features/screener/types.ts`, extend `ScreenerRequest`:

```ts
import type { TaxonomyFilterValues } from '@/features/pool/types';
// ...
export interface ScreenerRequest {
  // ... existing fields ...
  /** @deprecated use taxonomyFilter; kept as index-membership alias */
  universe?: string;
  taxonomyFilter?: TaxonomyFilterValues;
  preset?: string;
}
```

In `features/screener/api.ts`, add the exported helper and use it:

```ts
export function toScreenerRequestPayload(request: ScreenerRequest): Record<string, unknown> {
  const tf = request.taxonomyFilter;
  return {
    universe: request.universe,
    tickers: request.tickers,
    top: request.top,
    asof_date: request.asofDate,
    min_price: request.minPrice,
    max_price: request.maxPrice,
    currencies: request.currencies,
    exchange_mics: request.exchangeMics,
    include_otc: request.includeOtc,
    include_held: request.includeHeld,
    instrument_types: request.instrumentTypes,
    breakout_lookback: request.breakoutLookback,
    pullback_ma: request.pullbackMa,
    min_history: request.minHistory,
    require_weekly_uptrend: request.requireWeeklyUptrend,
    force_refresh: request.forceRefresh,
    preset: request.preset,
    taxonomy_filter: tf && {
      region: tf.region,
      market_cap_tier: tf.marketCapTier,
      sector: tf.sector,
      index_memberships: tf.indexMemberships,
      instrument_type_detail: tf.instrumentTypeDetail,
      provider: tf.provider,
      currency: tf.currency,
      exchange_mics: tf.exchangeMics,
      liquidity_tier: tf.liquidityTier,
    },
  };
}
```

> Match the existing payload keys in `api.ts` exactly — read the current body first; the snippet above mirrors the documented `ScreenerRequest`. Then `runScreener` becomes `const body = toScreenerRequestPayload(request);`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/features/screener/types.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/screener/api.ts web-ui/src/features/screener/types.test.ts
git commit -m "feat: wire taxonomyFilter/preset into screener request (web-ui)"
```

---

### Task 3.3: QuickFilterBar component

**Files:**
- Create: `web-ui/src/components/domain/screener/QuickFilterBar.tsx`, `web-ui/src/components/domain/screener/QuickFilterBar.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Test: the new test file

**Interfaces:**
- Consumes: `TaxonomyFilterValues`, `usePresets()`.
- Produces: default-exported `QuickFilterBar` with props:
  ```ts
  interface QuickFilterBarProps {
    value: TaxonomyFilterValues;
    onChange: (next: TaxonomyFilterValues) => void;
    presetId: string | null;
    onPresetChange: (presetId: string | null) => void;
    sectors: string[];           // available sector options (from pool, or static list)
    indexOptions: { id: string; label: string }[];
    disabled?: boolean;
  }
  ```
  Renders: preset `<Select>`, Region chip group, Cap-tier chip group, Type chip group (equity/etf via `instrumentTypeDetail`), Sector multi-select, Index multi-select. Editing any chip after a preset is selected calls `onPresetChange(null)` (marks custom) and `onChange` with the new values. All labels via i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// web-ui/src/components/domain/screener/QuickFilterBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { messagesEn } from '@/i18n/messages.en';
import QuickFilterBar from './QuickFilterBar';

describe('QuickFilterBar', () => {
  it('toggles a region chip and clears the preset', () => {
    const onChange = vi.fn();
    const onPresetChange = vi.fn();
    renderWithProviders(
      <QuickFilterBar
        value={{}}
        onChange={onChange}
        presetId="us_large_cap_equities"
        onPresetChange={onPresetChange}
        sectors={['Technology']}
        indexOptions={[{ id: 'us_sp500', label: 'S&P 500' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: messagesEn.screener.taxonomy.region.us }));
    expect(onChange).toHaveBeenCalledWith({ region: ['us'] });
    expect(onPresetChange).toHaveBeenCalledWith(null);
  });
});
```

> Confirm the test helper path (`@/test/renderWithProviders`) by reading an existing `*.test.tsx`; CLAUDE.md calls it `renderWithProviders()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/screener/QuickFilterBar.test.tsx`
Expected: FAIL (component + i18n keys missing)

- [ ] **Step 3: Add i18n keys**

Add under `screener:` in `messages.en.ts`:

```ts
    taxonomy: {
      preset: 'Preset',
      presetCustom: 'Custom',
      region: { label: 'Region', all: 'All', us: 'US', europe: 'Europe', asiaPacific: 'Asia-Pac' },
      capTier: { label: 'Cap', all: 'All', large: 'Large', mid: 'Mid', small: 'Small', micro: 'Micro' },
      type: { label: 'Type', all: 'All', equity: 'Equity', etf: 'ETF' },
      sector: { label: 'Sector', placeholder: 'All sectors' },
      index: { label: 'Index', placeholder: 'Any index' },
    },
```

- [ ] **Step 4: Implement the component**

Create `QuickFilterBar.tsx`. Use the existing `Select` and `Button` (or a small chip built on `Button variant="ghost"/"secondary"`). Sketch:

```tsx
import { useI18n } from '@/i18n/I18nProvider';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { usePresets } from '@/features/pool/hooks';
import type { TaxonomyFilterValues } from '@/features/pool/types';

interface QuickFilterBarProps {
  value: TaxonomyFilterValues;
  onChange: (next: TaxonomyFilterValues) => void;
  presetId: string | null;
  onPresetChange: (presetId: string | null) => void;
  sectors: string[];
  indexOptions: { id: string; label: string }[];
  disabled?: boolean;
}

const REGION_OPTIONS = ['us', 'europe', 'asia_pacific'] as const;
const CAP_OPTIONS = ['large', 'mid', 'small', 'micro'] as const;
const TYPE_OPTIONS: Array<{ key: string; details: string[] }> = [
  { key: 'equity', details: ['equity'] },
  { key: 'etf', details: ['etf_equity', 'etf_sector', 'etf_leveraged', 'etf_bond', 'etf_commodity'] },
];

export default function QuickFilterBar(props: QuickFilterBarProps) {
  const { t } = useI18n();
  const { data: presets = [] } = usePresets();

  function patch(next: Partial<TaxonomyFilterValues>) {
    props.onPresetChange(null);
    props.onChange({ ...props.value, ...next });
  }

  function toggleScalar(field: keyof TaxonomyFilterValues, item: string) {
    const current = (props.value[field] as string[] | undefined) ?? [];
    const set = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    patch({ [field]: set.length ? set : undefined } as Partial<TaxonomyFilterValues>);
  }

  // ... render preset Select (value=presetId ?? '', options from presets, onChange -> onPresetChange + apply preset.filter via onChange),
  //     region/cap chip groups (Button per option, aria-pressed, name from i18n),
  //     type chip group (maps to instrumentTypeDetail buckets),
  //     sector + index multi-selects.
  return (/* JSX */ null as any);
}
```

> Implement the render fully: each chip is a `<Button>` with `aria-pressed`, accessible name = the i18n label (so the test's `getByRole('button', { name: ... })` resolves). The preset `<Select>` first option is `taxonomy.preset` placeholder; selecting a preset calls `onPresetChange(id)` and `onChange(presetFilter)`. The "Type" group writes to `instrumentTypeDetail` using the bucket map.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/screener/QuickFilterBar.test.tsx && npm run lint`
Expected: PASS, zero lint warnings

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/domain/screener/QuickFilterBar.tsx web-ui/src/components/domain/screener/QuickFilterBar.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat: add QuickFilterBar taxonomy filter component (web-ui)"
```

---

### Task 3.4: Repurpose ScreenerForm + wire panel into the screener page

**Files:**
- Modify: `web-ui/src/components/domain/screener/ScreenerForm.tsx`, `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`, `web-ui/src/pages/Today.tsx`
- Test: `web-ui/src/components/domain/screener/ScreenerForm.test.tsx`

**Interfaces:**
- Consumes: `QuickFilterBar`, `TaxonomyFilterValues`.
- Produces: `ScreenerForm` no longer renders the universe `<Select>` or `universes`/`selectedUniverse` props. New props: `taxonomyFilter: TaxonomyFilterValues`, `setTaxonomyFilter`, `presetId`, `setPresetId`, plus the existing generic controls (`currencyFilter`, `exchangeFilter`, `includeOtc`, price, ATR if present) moved into the `CollapsibleSection`. Add a `liquidityTier` and `provider` control to the panel. The parent (`ScreenerInboxPanel`/`Today`) owns taxonomy state and builds the `ScreenerRequest` with `taxonomyFilter`/`preset` instead of `universe`.

- [ ] **Step 1: Update the form test first**

Adjust `ScreenerForm.test.tsx` to assert the universe Select is gone and the QuickFilterBar region label renders:

```tsx
it('renders the quick filter bar and no universe selector', () => {
  // render ScreenerForm with new props (taxonomyFilter={}, setTaxonomyFilter, presetId=null, ...)
  expect(screen.queryByLabelText(messagesEn.screener.controls.universe)).toBeNull();
  expect(screen.getByText(messagesEn.screener.taxonomy.region.label)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/screener/ScreenerForm.test.tsx`
Expected: FAIL

- [ ] **Step 3: Refactor ScreenerForm**

- Remove `selectedUniverse`, `setSelectedUniverse`, `universes` props and the universe `<Field>/<Select>` block (lines ~229–241) and the universe metadata panel (lines ~339–359).
- Add the new props; render `<QuickFilterBar .../>` at the top of the expanded layout (and a compact summary in collapsed mode).
- Move Currency, Venue/Exchange, OTC, plus new Liquidity tier and Provider selects into the existing `CollapsibleSection` (generic panel). Keep Top N, price, weekly-uptrend, recommended, force-refresh where they are.
- Keep `t(...)` for every label.

- [ ] **Step 4: Update parent state (ScreenerInboxPanel / Today)**

- Replace `selectedUniverse` state with `taxonomyFilter: TaxonomyFilterValues` and `presetId: string | null`.
- Drop `useUniverses()` usage for the selector (keep only if still needed elsewhere).
- When building the request for `runScreener`/`useRunScreenerMutation`, pass `{ ...generic filters, taxonomyFilter, preset: presetId ?? undefined }` and stop passing `universe`.
- Pass sectors/indexOptions to `QuickFilterBar`: derive `indexOptions` from `usePresets()`/a static list of known index ids, and `sectors` from a static Morningstar sector list (add `web-ui/src/features/pool/sectors.ts` exporting the 11 GICS-ish sector names) — or from `/api/pool/symbols` distinct sectors if cheap. Use the static list for now to avoid an extra fetch.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web-ui && npx vitest run src/components/domain/screener && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/domain/screener/ScreenerForm.tsx web-ui/src/components/domain/screener/ScreenerForm.test.tsx web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx web-ui/src/pages/Today.tsx web-ui/src/features/pool/sectors.ts
git commit -m "feat: replace universe selector with taxonomy quick filter bar (web-ui)"
```

**Phase 3 gate:** `cd web-ui && npm test && npm run typecheck && npm run lint` all green. Manually verify a screen run with a region filter returns candidates.

---

# PHASE 4 — Review queue UI

**Deliverable:** A header badge shows the review-queue count; clicking opens a drawer to remove/restore symbols.

### Task 4.1: ReviewQueueDrawer

**Files:**
- Create: `web-ui/src/components/domain/pool/ReviewQueueDrawer.tsx`, `web-ui/src/components/domain/pool/ReviewQueueDrawer.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: `useReviewQueue`, `useRemoveFromPool`, `useRestoreToPool`, `ModalShell`.
- Produces: default-exported `ReviewQueueDrawer({ open, onClose }: { open: boolean; onClose: () => void })`. Renders a `ModalShell` table: symbol, exchange, cap tier, sector, provider, failure count, last ok / last failed, reason; per row **Keep** (restore) and **Remove** buttons wired to the mutations. Empty state via i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// ReviewQueueDrawer.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { messagesEn } from '@/i18n/messages.en';
import ReviewQueueDrawer from './ReviewQueueDrawer';

// MSW handler returns one entry (AAPL). See existing MSW setup.
describe('ReviewQueueDrawer', () => {
  it('lists queued symbols', async () => {
    renderWithProviders(<ReviewQueueDrawer open onClose={() => {}} />);
    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText(messagesEn.reviewQueue.title)).toBeInTheDocument();
  });
});
```

> Add an MSW handler for `GET /api/pool/review-queue` returning `{ entries: [{ symbol: 'AAPL', failure_count: 3, first_failed_at: '...', last_failed_at: '...', reason: 'no data' }] }` in the test's handlers (follow the existing MSW handler pattern under `web-ui/src/test` or `src/mocks`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/domain/pool/ReviewQueueDrawer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add i18n + implement**

Add a top-level `reviewQueue` namespace to `messages.en.ts`:

```ts
  reviewQueue: {
    title: 'Review queue',
    empty: 'No symbols need review',
    badgeLabel: 'Symbols needing review',
    columns: {
      symbol: 'Symbol', exchange: 'Exchange', capTier: 'Cap', sector: 'Sector',
      provider: 'Provider', failures: 'Failures', lastFailed: 'Last failed', reason: 'Reason',
    },
    actions: { keep: 'Keep', remove: 'Remove' },
  },
```

Implement `ReviewQueueDrawer.tsx` using `ModalShell` (`title={t('reviewQueue.title')}`), mapping `useReviewQueue().data` to rows, with Keep → `useRestoreToPool().mutate(symbol)` and Remove → `useRemoveFromPool().mutate(symbol)`. Return null when `!open`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/domain/pool/ReviewQueueDrawer.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/pool/ReviewQueueDrawer.tsx web-ui/src/components/domain/pool/ReviewQueueDrawer.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat: add review queue drawer (web-ui)"
```

---

### Task 4.2: Header badge

**Files:**
- Modify: `web-ui/src/components/layout/Header.tsx`
- Test: `web-ui/src/components/layout/Header.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `useReviewQueue`, `Badge`, `ReviewQueueDrawer`.
- Produces: Header renders a clickable `Badge` with the queue count (hidden when 0) that opens `ReviewQueueDrawer`. `aria-label` = `t('reviewQueue.badgeLabel')`.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a review-queue badge with the count and opens the drawer', async () => {
  // MSW: review-queue returns 2 entries
  renderWithProviders(<Header />);
  const badge = await screen.findByRole('button', { name: messagesEn.reviewQueue.badgeLabel });
  expect(badge).toHaveTextContent('2');
  fireEvent.click(badge);
  expect(screen.getByText(messagesEn.reviewQueue.title)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web-ui && npx vitest run src/components/layout/Header.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement**

In `Header.tsx`, add `const { data: queue = [] } = useReviewQueue();` and `const [open, setOpen] = useState(false);`. In the right-hand section, render (count > 0) a `<button aria-label={t('reviewQueue.badgeLabel')} onClick={() => setOpen(true)}><Badge variant="warning">{queue.length}</Badge></button>` and `<ReviewQueueDrawer open={open} onClose={() => setOpen(false)} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web-ui && npx vitest run src/components/layout/Header.test.tsx && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/layout/Header.tsx web-ui/src/components/layout/Header.test.tsx
git commit -m "feat: add review-queue badge to header (web-ui)"
```

**Phase 4 gate:** `cd web-ui && npm test && npm run typecheck && npm run lint` green; `npm run test:coverage` meets thresholds.

---

## Cross-cutting docs (do at the end of each phase that touches them)

- `data/README.md` — `symbol_pool.json` and `review_queue.json` schema + migration note (Phase 1/2).
- `config/README.md` — `low_level.symbol_pool` + `taxonomy_presets.yaml` (Phase 1/2).
- `api/README.md` — five `/api/pool/*` endpoints + deprecated `universe` field (Phase 2).
- `web-ui/docs/WEB_UI_GUIDE.md` — quick filter bar + review queue (Phase 3/4).
- `docs/overview/INDEX.md` — add the spec + this plan if new docs are expected to be indexed.

---

## Self-Review

**Spec coverage:**
- Data layer (`symbol_pool.json`, `review_queue.json`, presets yaml, instrument master unchanged) → Tasks 1.1–1.7, 2.1, 2.2 ✓
- Taxonomy schema (all 13 fields incl. providers) → Tasks 1.1, 1.2, 1.5 ✓
- Screener flow Phase 1 pre-filter / Phase 2 fetch + failure tracking, no auto-enrichment → Tasks 2.3, 2.4 ✓
- API: modified `/run` + 5 new endpoints, `universe` alias → Tasks 2.2, 2.3, 2.5 ✓
- UI quick filter bar / repurposed panel / review queue badge+drawer → Tasks 3.3, 3.4, 4.1, 4.2 ✓
- Decisions: threshold=3 (config), alias kept this PR, no floor filter → Tasks 1.6, 2.2, 2.3 ✓
- Out of scope honored: pool-build UI trigger deferred (build logic + committed artifact only); no nightly cache; no auto-enrichment ✓

**Open items flagged for the executor (verify against real code before coding the step):**
1. `config_dir()` import path in `pool_service.py` — confirm in `src/swing_screener/settings/`.
2. `ScreenerService.__init__` current signature and the exact lines of the universe-resolution block — re-read before editing Task 2.3.
3. DeGiro credential-presence helper — reuse an existing one for `_resolve_available_providers`.
4. `runScreener` current payload body in `features/screener/api.ts` — mirror its exact keys when extracting `toScreenerRequestPayload`.
5. `renderWithProviders` / MSW handler locations — confirm test infra paths.
6. `review-queue/{symbol}/remove` semantics: this PR clears the queue entry only; hard removal from `symbol_pool.json` is deferred with pool mutation. Confirm acceptable or add `SymbolPoolRepository.remove`.

These are lookups, not design gaps; resolve them inline during execution.
