# Index Universes via Wikipedia + yfinance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 8 missing broker indices (S&P 500, Nasdaq 100, Dow 30, DAX, CAC 40, FTSE 100, IBEX 35, EURO STOXX 50) as refreshable registry universes, populated automatically from Wikipedia constituents + yfinance metadata.

**Architecture:** A new `wikipedia_index_review` source adapter plugs into the existing `refresh_snapshot_from_source` flow. `wikipedia_sources.py` fetches and parses constituent tables; `instrument_enrichment.py` turns a Yahoo symbol into an instrument-master record via yfinance; the refresh apply-path in `universe.py` appends new symbols to `data/intelligence/instrument_master.json` (never clobbering existing curation). Spec: `docs/superpowers/specs/2026-06-12-index-universes-wikipedia-design.md`.

**Tech Stack:** Python 3.11, pandas (`read_html`), yfinance, stdlib `urllib`, pytest. Network only at build/integration time; unit tests are offline with fixtures + mocks.

---

## File Structure

- Create `src/swing_screener/data/wikipedia_sources.py` — per-index page config, fetch + parse constituent tables, normalize to Yahoo symbols.
- Create `src/swing_screener/data/instrument_enrichment.py` — `enrich_symbol()`: yfinance `.info` → instrument-master record; MIC/country/timezone tables.
- Modify `src/swing_screener/data/universe_sources.py` — add `new_master_records` to `UniverseSourceResult`; add `refresh_index_from_wikipedia()`; branch in `refresh_snapshot_from_source`.
- Modify `src/swing_screener/data/universe.py` — `refresh_package_universe` apply-path merges `new_master_records` into instrument master; add `_write_instrument_master()`.
- Modify `src/swing_screener/cli.py` — add `universes refresh --name <id> [--apply]` subcommand.
- Modify `src/swing_screener/data/universes/registry/manifest.json` — 8 new entries.
- Create `src/swing_screener/data/universes/registry/snapshots/{8 ids}.json` — seed snapshots.
- Create `tests/test_wikipedia_sources.py`, `tests/test_instrument_enrichment.py`.
- Create `tests/fixtures/wikipedia/{id}.html` — captured constituent-table HTML.
- Modify `tests/test_universe_sources.py` — adapter + dataclass regression.
- Modify `tests/test_universe.py` (or `tests/test_universe_data_management.py`) — master-merge apply-path.

**Index id / config table** (referenced by Tasks 2 & 6):

| id | benchmark | wiki slug | ticker col | company col | default suffix |
|---|---|---|---|---|---|
| `us_sp500` | `^GSPC` | `List_of_S%26P_500_companies` | `Symbol` | `Security` | `` |
| `us_nasdaq100` | `^NDX` | `Nasdaq-100` | `Ticker` | `Company` | `` |
| `us_dow30` | `^DJI` | `Dow_Jones_Industrial_Average` | `Symbol` | `Company` | `` |
| `germany_dax` | `^GDAXI` | `DAX` | `Ticker` | `Company` | `.DE` |
| `france_cac40` | `^FCHI` | `CAC_40` | `Ticker` | `Company` | `.PA` |
| `uk_ftse100` | `^FTSE` | `FTSE_100_Index` | `Ticker` | `Company` | `.L` |
| `spain_ibex35` | `^IBEX` | `IBEX_35` | `Ticker` | `Company` | `.MC` |
| `europe_eurostoxx50` | `^STOXX50E` | `EURO_STOXX_50` | `Ticker` | `Name` | `` (per-row venue) |

---

## Task 1: Add `new_master_records` to `UniverseSourceResult`

**Files:**
- Modify: `src/swing_screener/data/universe_sources.py:7` (import), `:95-101` (dataclass)
- Test: `tests/test_universe_sources.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_universe_sources.py`:

```python
from swing_screener.data.universe_sources import UniverseSourceResult


def test_universe_source_result_defaults_new_master_records_empty():
    result = UniverseSourceResult(
        source_adapter="manual_snapshot",
        source_asof="2026-01-01",
        source_documents=[],
        constituents=[],
        notes=[],
    )
    assert result.new_master_records == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_universe_sources.py::test_universe_source_result_defaults_new_master_records_empty -q`
Expected: FAIL — `TypeError`/`AttributeError` (no `new_master_records`).

- [ ] **Step 3: Implement**

In `src/swing_screener/data/universe_sources.py`, change the import line 7:

```python
from dataclasses import dataclass, field
```

Add the field to the dataclass (currently ends at `notes: list[str]`):

```python
@dataclass(frozen=True)
class UniverseSourceResult:
    source_adapter: str
    source_asof: str
    source_documents: list[dict]
    constituents: list[dict]
    notes: list[str]
    new_master_records: list[dict] = field(default_factory=list)
```

- [ ] **Step 4: Run tests to verify pass + no regression**

Run: `pytest tests/test_universe_sources.py -q`
Expected: PASS (Euronext adapter tests unaffected — they construct via keyword/positional args that don't include the new trailing field).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/universe_sources.py tests/test_universe_sources.py
git commit -m "feat(universe): add new_master_records to UniverseSourceResult"
```

---

## Task 2: `wikipedia_sources.py` — fetch + parse constituents

**Files:**
- Create: `src/swing_screener/data/wikipedia_sources.py`
- Create: `tests/fixtures/wikipedia/us_dow30.html`, `tests/fixtures/wikipedia/uk_ftse100.html`
- Test: `tests/test_wikipedia_sources.py`

- [ ] **Step 1: Capture fixtures (network, one-time)**

Run (downloads real constituent-table HTML, trimmed to keep fixtures small is optional):

```bash
python - <<'PY'
from urllib.request import Request, urlopen
import pathlib
pathlib.Path("tests/fixtures/wikipedia").mkdir(parents=True, exist_ok=True)
pages = {
  "us_dow30": "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average",
  "uk_ftse100": "https://en.wikipedia.org/wiki/FTSE_100_Index",
}
for name, url in pages.items():
    html = urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "ignore")
    pathlib.Path(f"tests/fixtures/wikipedia/{name}.html").write_text(html, encoding="utf-8")
    print(name, len(html))
PY
```

Expected: two files written, sizes printed.

- [ ] **Step 2: Write the failing tests**

Create `tests/test_wikipedia_sources.py`:

```python
from pathlib import Path

import pytest

from swing_screener.data.wikipedia_sources import (
    WIKIPEDIA_INDEX_CONFIG,
    fetch_index_constituents,
    normalize_yahoo_symbol,
)

FIXTURES = Path(__file__).parent / "fixtures" / "wikipedia"


def _fixture_fetch(name):
    def _fetch(_url):
        return (FIXTURES / f"{name}.html").read_text(encoding="utf-8")
    return _fetch


def test_config_covers_eight_indices():
    assert set(WIKIPEDIA_INDEX_CONFIG) == {
        "us_sp500", "us_nasdaq100", "us_dow30", "germany_dax",
        "france_cac40", "uk_ftse100", "spain_ibex35", "europe_eurostoxx50",
    }


def test_dow30_parses_30_us_symbols():
    rows = fetch_index_constituents("us_dow30", fetch_text=_fixture_fetch("us_dow30"))
    assert len(rows) == 30
    # US symbols carry no suffix and are upper-case
    assert all("." not in r.symbol or r.symbol.endswith(("-A", "-B")) for r in rows)
    assert any(r.source_name for r in rows)


def test_ftse100_symbols_get_london_suffix():
    rows = fetch_index_constituents("uk_ftse100", fetch_text=_fixture_fetch("uk_ftse100"))
    assert 90 <= len(rows) <= 105  # FTSE 100, allow review drift
    assert all(r.symbol.endswith(".L") for r in rows)


@pytest.mark.parametrize("raw,suffix,expected", [
    ("BRK.B", "", "BRK-B"),        # US dot -> dash
    ("AAPL", "", "AAPL"),
    ("SAP", ".DE", "SAP.DE"),      # bare EU gets suffix
    ("SAP.DE", ".DE", "SAP.DE"),   # already suffixed -> unchanged
    ("ETR: ADS", ".DE", "ADS.DE"), # strip 'EXCH:' prefix
    ("BT.A", ".L", "BT-A.L"),      # London dot -> dash then suffix
])
def test_normalize_yahoo_symbol(raw, suffix, expected):
    assert normalize_yahoo_symbol(raw, suffix) == expected


def test_empty_table_raises():
    from swing_screener.data.universe_sources import UniverseSourceError
    with pytest.raises(UniverseSourceError):
        fetch_index_constituents("us_dow30", fetch_text=lambda _u: "<html><body>no tables</body></html>")
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_wikipedia_sources.py -q`
Expected: FAIL — `ModuleNotFoundError: ... wikipedia_sources`.

- [ ] **Step 4: Implement `wikipedia_sources.py`**

Create `src/swing_screener/data/wikipedia_sources.py`:

> **Circular-import note:** `wikipedia_sources` must NOT import from `universe_sources` at module level — `universe_sources` imports `wikipedia_sources` (Task 4), and a direct `import wikipedia_sources` (the Task 2 tests) would deadlock the cycle. So this module defines its own `_fetch_text` and imports `UniverseSourceError` lazily inside the functions that raise it.

```python
from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Callable
from urllib.request import Request, urlopen

import pandas as pd

WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/"


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


@dataclass(frozen=True)
class IndexPageConfig:
    universe_id: str
    benchmark: str
    wiki_slug: str
    ticker_col: str       # substring matched case-insensitively against columns
    company_col: str
    default_suffix: str    # "" for US / per-row venue handling


WIKIPEDIA_INDEX_CONFIG: dict[str, IndexPageConfig] = {
    "us_sp500": IndexPageConfig("us_sp500", "^GSPC", "List_of_S%26P_500_companies", "symbol", "security", ""),
    "us_nasdaq100": IndexPageConfig("us_nasdaq100", "^NDX", "Nasdaq-100", "ticker", "company", ""),
    "us_dow30": IndexPageConfig("us_dow30", "^DJI", "Dow_Jones_Industrial_Average", "symbol", "company", ""),
    "germany_dax": IndexPageConfig("germany_dax", "^GDAXI", "DAX", "ticker", "company", ".DE"),
    "france_cac40": IndexPageConfig("france_cac40", "^FCHI", "CAC_40", "ticker", "company", ".PA"),
    "uk_ftse100": IndexPageConfig("uk_ftse100", "^FTSE", "FTSE_100_Index", "ticker", "company", ".L"),
    "spain_ibex35": IndexPageConfig("spain_ibex35", "^IBEX", "IBEX_35", "ticker", "company", ".MC"),
    "europe_eurostoxx50": IndexPageConfig("europe_eurostoxx50", "^STOXX50E", "EURO_STOXX_50", "ticker", "name", ""),
}

# EURO STOXX 50 spans venues; map Wikipedia 'EXCH:' prefixes / venue hints to Yahoo suffix.
_EUROSTOXX_VENUE_SUFFIX = {
    "ETR": ".DE", "FRA": ".DE", "XETRA": ".DE",
    "ENXTPA": ".PA", "EPA": ".PA", "PAR": ".PA",
    "ENXTAM": ".AS", "AMS": ".AS",
    "BIT": ".MI", "MIL": ".MI", "BME": ".MC", "MCE": ".MC",
    "ENXTBR": ".BR", "BRU": ".BR", "ISE": ".IR", "HEL": ".HE",
}


@dataclass(frozen=True)
class RawConstituent:
    symbol: str       # normalized Yahoo symbol
    source_name: str  # company name
    source_symbol: str  # bare ticker (no suffix), for snapshot provenance


def _error(msg: str) -> Exception:
    # Lazy import avoids a module-level cycle with universe_sources.
    from swing_screener.data.universe_sources import UniverseSourceError

    return UniverseSourceError(msg)


def _select_table(html: str, ticker_col: str, company_col: str) -> pd.DataFrame:
    tables = pd.read_html(io.StringIO(html))
    for table in tables:
        cols = [str(c).lower() for c in _flat_columns(table)]
        has_ticker = any(ticker_col in c for c in cols)
        has_company = any(company_col in c for c in cols)
        if has_ticker and has_company:
            return _flatten(table)
    raise _error(f"No constituent table with columns ~'{ticker_col}'/'{company_col}' found")


def _flat_columns(table: pd.DataFrame) -> list[str]:
    if isinstance(table.columns, pd.MultiIndex):
        return [" ".join(str(x) for x in tup) for tup in table.columns]
    return [str(c) for c in table.columns]


def _flatten(table: pd.DataFrame) -> pd.DataFrame:
    table = table.copy()
    table.columns = _flat_columns(table)
    return table


def _pick_col(df: pd.DataFrame, needle: str) -> str:
    for col in df.columns:
        if needle in str(col).lower():
            return col
    raise _error(f"Column matching '{needle}' vanished after selection")


def normalize_yahoo_symbol(raw: str, default_suffix: str) -> str:
    text = str(raw or "").strip()
    if ":" in text:  # strip 'ETR: ADS' / 'NYSE: AAPL'
        text = text.split(":", 1)[1].strip()
    text = re.sub(r"\s+", "", text).upper()
    if not text:
        return ""
    # already carries a Yahoo dotted suffix? keep as-is
    if "." in text and text.rsplit(".", 1)[1] in {
        "DE", "PA", "L", "MC", "MI", "AS", "BR", "IR", "HE", "SW",
    }:
        return text
    if default_suffix in ("", None):  # US
        return text.replace(".", "-")
    # London tickers like BT.A -> BT-A.L
    body = text.replace(".", "-") if default_suffix == ".L" else text
    return f"{body}{default_suffix}"


def _eurostoxx_symbol(ticker_cell: str) -> str:
    text = str(ticker_cell or "").strip()
    prefix = text.split(":", 1)[0].strip().upper() if ":" in text else ""
    suffix = _EUROSTOXX_VENUE_SUFFIX.get(prefix, "")
    return normalize_yahoo_symbol(text, suffix)


def fetch_index_constituents(
    universe_id: str,
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> list[RawConstituent]:
    cfg = WIKIPEDIA_INDEX_CONFIG.get(universe_id)
    if cfg is None:
        raise _error(f"No Wikipedia config for universe '{universe_id}'")
    html = fetch_text(WIKIPEDIA_BASE + cfg.wiki_slug)
    df = _select_table(html, cfg.ticker_col, cfg.company_col)
    tcol = _pick_col(df, cfg.ticker_col)
    ccol = _pick_col(df, cfg.company_col)

    out: list[RawConstituent] = []
    seen: set[str] = set()
    for _, row in df.iterrows():
        raw_ticker = str(row[tcol])
        name = str(row[ccol]).strip()
        if universe_id == "europe_eurostoxx50":
            symbol = _eurostoxx_symbol(raw_ticker)
        else:
            symbol = normalize_yahoo_symbol(raw_ticker, cfg.default_suffix)
        if not symbol or symbol in seen or symbol.lower() in {"nan", "—"}:
            continue
        seen.add(symbol)
        bare = symbol.split(".")[0] if cfg.default_suffix else symbol
        out.append(RawConstituent(symbol=symbol, source_name=name, source_symbol=bare))
    if not out:
        raise _error(f"Parsed zero constituents for '{universe_id}'")
    return out
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pytest tests/test_wikipedia_sources.py -q`
Expected: PASS. If `test_ftse100_symbols_get_london_suffix` count is off, adjust the fixture's expected range — do **not** loosen the suffix assertion.

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/data/wikipedia_sources.py tests/test_wikipedia_sources.py tests/fixtures/wikipedia
git commit -m "feat(universe): wikipedia constituent fetcher + symbol normalization"
```

---

## Task 3: `instrument_enrichment.py` — yfinance → master record

**Files:**
- Create: `src/swing_screener/data/instrument_enrichment.py`
- Test: `tests/test_instrument_enrichment.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_instrument_enrichment.py`:

```python
from swing_screener.data.instrument_enrichment import enrich_symbol


def _info(**kw):
    base = {"exchange": "GER", "currency": "EUR", "quoteType": "EQUITY", "fullExchangeName": "XETRA"}
    base.update(kw)
    return lambda _symbol: base


def test_enrich_german_equity():
    rec = enrich_symbol("SAP.DE", info_provider=_info())
    assert rec["symbol"] == "SAP.DE"
    assert rec["exchange_mic"] == "XETR"
    assert rec["country_code"] == "DE"
    assert rec["currency"] == "EUR"
    assert rec["timezone"] == "Europe/Berlin"
    assert rec["instrument_type"] == "equity"
    assert rec["provider_symbol_map"]["yahoo_finance"] == "SAP.DE"
    assert rec["primary_listing"] is True
    assert rec["status"] == "active"
    assert rec["source"] == "wikipedia_yfinance"


def test_enrich_us_equity_maps_nasdaq():
    rec = enrich_symbol("AAPL", info_provider=_info(exchange="NMS", currency="USD", fullExchangeName="NasdaqGS"))
    assert rec["exchange_mic"] == "XNAS"
    assert rec["country_code"] == "US"
    assert rec["timezone"] == "America/New_York"


def test_enrich_etf_type_mapped():
    rec = enrich_symbol("SPY", info_provider=_info(exchange="PCX", currency="USD", quoteType="ETF"))
    assert rec["instrument_type"] == "etf"


def test_enrich_returns_none_when_unresolved():
    assert enrich_symbol("ZZZZ.XX", info_provider=lambda _s: {}) is None
    assert enrich_symbol("ZZZZ.XX", info_provider=lambda _s: {"exchange": "WAT"}) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_instrument_enrichment.py -q`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Implement `instrument_enrichment.py`**

Create `src/swing_screener/data/instrument_enrichment.py`:

```python
from __future__ import annotations

import datetime as dt
from typing import Callable, Optional

from swing_screener.data.symbol_discovery import YAHOO_EXCHANGE_TO_MIC

# MIC -> (country_code, timezone)
MIC_TO_COUNTRY_TZ: dict[str, tuple[str, str]] = {
    "XNAS": ("US", "America/New_York"),
    "XNYS": ("US", "America/New_York"),
    "XASE": ("US", "America/New_York"),
    "ARCX": ("US", "America/New_York"),
    "BATS": ("US", "America/New_York"),
    "XOTC": ("US", "America/New_York"),
    "XETR": ("DE", "Europe/Berlin"),
    "XFRA": ("DE", "Europe/Berlin"),
    "XPAR": ("FR", "Europe/Paris"),
    "XLON": ("GB", "Europe/London"),
    "XMAD": ("ES", "Europe/Madrid"),
    "XMIL": ("IT", "Europe/Rome"),
    "XAMS": ("NL", "Europe/Amsterdam"),
    "XBRU": ("BE", "Europe/Brussels"),
    "XDUB": ("IE", "Europe/Dublin"),
    "XHEL": ("FI", "Europe/Helsinki"),
    "XSWX": ("CH", "Europe/Zurich"),
}

# Yahoo exchange codes seen on EuroStoxx venues not already in symbol_discovery's map.
_EXTRA_EXCHANGE_TO_MIC = {
    "EBS": "XSWX", "VIE": "XWBO", "HEL": "XHEL", "ISE": "XDUB", "DUB": "XDUB",
}

InfoProvider = Callable[[str], dict]


def _default_info_provider(symbol: str) -> dict:
    import yfinance as yf  # imported lazily; network at build time only

    try:
        return dict(yf.Ticker(symbol).info or {})
    except Exception:
        return {}


def _resolve_mic(exchange_code: str, full_exchange: str) -> Optional[str]:
    code = str(exchange_code or "").strip().upper()
    if code in YAHOO_EXCHANGE_TO_MIC:
        return YAHOO_EXCHANGE_TO_MIC[code]
    if code in _EXTRA_EXCHANGE_TO_MIC:
        return _EXTRA_EXCHANGE_TO_MIC[code]
    full = str(full_exchange or "").strip().upper()
    if "XETRA" in full:
        return "XETR"
    return None


def _map_type(quote_type: str) -> str:
    qt = str(quote_type or "").strip().upper()
    if qt == "EQUITY":
        return "equity"
    if qt == "ETF":
        return "etf"
    return qt.lower() or "unknown"


def enrich_symbol(
    symbol: str,
    *,
    info_provider: InfoProvider = _default_info_provider,
) -> Optional[dict]:
    """Build an instrument-master record from yfinance .info. None if unresolved."""
    sym = str(symbol or "").strip().upper()
    if not sym:
        return None
    info = info_provider(sym) or {}
    mic = _resolve_mic(info.get("exchange", ""), info.get("fullExchangeName", ""))
    currency = str(info.get("currency") or "").strip().upper()
    if not mic or not currency or mic not in MIC_TO_COUNTRY_TZ:
        return None
    country, timezone = MIC_TO_COUNTRY_TZ[mic]
    today = dt.date.today().isoformat()
    return {
        "symbol": sym,
        "exchange_mic": mic,
        "country_code": country,
        "currency": currency,
        "timezone": timezone,
        "provider_symbol_map": {"yahoo_finance": sym},
        "primary_listing": True,
        "status": "active",
        "status_reason": None,
        "replacement_symbol": None,
        "source": "wikipedia_yfinance",
        "source_asof": today,
        "last_reviewed_at": today,
        "instrument_type": _map_type(info.get("quoteType", "")),
    }
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pytest tests/test_instrument_enrichment.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/instrument_enrichment.py tests/test_instrument_enrichment.py
git commit -m "feat(universe): yfinance instrument-master enrichment"
```

---

## Task 4: Wire `wikipedia_index_review` adapter into `universe_sources.py`

**Files:**
- Modify: `src/swing_screener/data/universe_sources.py` (add function + branch in `refresh_snapshot_from_source`)
- Test: `tests/test_universe_sources.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_universe_sources.py`:

```python
from swing_screener.data.universe_sources import refresh_snapshot_from_source


def test_wikipedia_adapter_builds_constituents_and_new_records(monkeypatch):
    import swing_screener.data.universe_sources as us

    fake_rows = [
        us_raw("AAPL", "Apple Inc."),
        us_raw("MSFT", "Microsoft"),
    ]
    monkeypatch.setattr(us, "fetch_index_constituents", lambda uid, fetch_text=None: fake_rows)

    def fake_enrich(symbol, info_provider=None):
        return {"symbol": symbol, "exchange_mic": "XNAS", "currency": "USD",
                "country_code": "US", "timezone": "America/New_York",
                "instrument_type": "equity", "provider_symbol_map": {"yahoo_finance": symbol}}

    monkeypatch.setattr(us, "enrich_symbol", fake_enrich)

    snapshot = {"id": "us_sp500", "source_adapter": "wikipedia_index_review", "rules": {}}
    result = refresh_snapshot_from_source("us_sp500", snapshot, instrument_master={})

    assert result.source_adapter == "wikipedia_index_review"
    assert [c["symbol"] for c in result.constituents] == ["AAPL", "MSFT"]
    assert {r["symbol"] for r in result.new_master_records} == {"AAPL", "MSFT"}


def test_wikipedia_adapter_skips_unresolved(monkeypatch):
    import swing_screener.data.universe_sources as us
    monkeypatch.setattr(us, "fetch_index_constituents",
                        lambda uid, fetch_text=None: [us_raw("AAPL", "Apple"), us_raw("ZZZZ", "Ghost")])
    monkeypatch.setattr(us, "enrich_symbol",
                        lambda s, info_provider=None: None if s == "ZZZZ" else
                        {"symbol": s, "exchange_mic": "XNAS", "currency": "USD",
                         "country_code": "US", "timezone": "America/New_York",
                         "instrument_type": "equity", "provider_symbol_map": {"yahoo_finance": s}})
    snapshot = {"id": "us_sp500", "source_adapter": "wikipedia_index_review", "rules": {}}
    result = refresh_snapshot_from_source("us_sp500", snapshot, instrument_master={})
    assert [c["symbol"] for c in result.constituents] == ["AAPL"]
    assert any("ZZZZ" in n for n in result.notes)
```

Add this helper near the top of `tests/test_universe_sources.py` (after imports):

```python
from swing_screener.data.wikipedia_sources import RawConstituent


def us_raw(symbol, name):
    return RawConstituent(symbol=symbol, source_name=name, source_symbol=symbol.split(".")[0])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_universe_sources.py -k wikipedia -q`
Expected: FAIL — adapter returns `manual_snapshot` (no branch yet).

- [ ] **Step 3: Implement adapter**

In `src/swing_screener/data/universe_sources.py`, add module-level imports (these must stay at module scope so the Task 4 tests can monkeypatch `universe_sources.fetch_index_constituents` / `.enrich_symbol`). Neither imported module imports `universe_sources` at module level (Task 2 decoupled it; `instrument_enrichment` imports only `symbol_discovery`), so there is no cycle. Place them with the other top-of-file imports:

```python
from swing_screener.data.instrument_enrichment import enrich_symbol
from swing_screener.data.wikipedia_sources import (
    WIKIPEDIA_BASE,
    WIKIPEDIA_INDEX_CONFIG,
    fetch_index_constituents,
)
```

Add the adapter function (above `refresh_snapshot_from_source`):

```python
def refresh_index_from_wikipedia(
    universe_id: str,
    current_snapshot: dict,
    instrument_master: dict[str, dict],
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> UniverseSourceResult:
    cfg = WIKIPEDIA_INDEX_CONFIG.get(universe_id)
    if cfg is None:
        raise UniverseSourceError(f"No Wikipedia config for universe '{universe_id}'")
    rows = fetch_index_constituents(universe_id, fetch_text=fetch_text)

    constituents: list[dict] = []
    new_records: list[dict] = []
    notes: list[str] = []
    today = dt.date.today().isoformat()

    for row in rows:
        rec = instrument_master.get(row.symbol)
        if rec is None:
            rec = enrich_symbol(row.symbol)
            if rec is None:
                notes.append(f"Skipped {row.symbol} ({row.source_name}): yfinance could not resolve.")
                continue
            new_records.append(rec)
        constituents.append(
            {
                "symbol": row.symbol,
                "exchange_mic": rec.get("exchange_mic"),
                "currency": rec.get("currency"),
                "source_name": row.source_name,
                "source_symbol": row.source_symbol,
            }
        )

    if not constituents:
        raise UniverseSourceError(f"No resolvable constituents for '{universe_id}'")

    notes.insert(0, f"Built from Wikipedia '{cfg.wiki_slug}' + yfinance enrichment.")
    return UniverseSourceResult(
        source_adapter="wikipedia_index_review",
        source_asof=today,
        source_documents=[{"label": f"Wikipedia: {cfg.wiki_slug}", "url": WIKIPEDIA_BASE + cfg.wiki_slug}],
        constituents=constituents,
        notes=notes,
        new_master_records=new_records,
    )
```

Add the branch in `refresh_snapshot_from_source` (before the `manual_snapshot` fallback):

```python
    if adapter == "wikipedia_index_review":
        return refresh_index_from_wikipedia(
            universe_id, current_snapshot, instrument_master, fetch_text=fetch_text
        )
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pytest tests/test_universe_sources.py -q`
Expected: PASS (wikipedia + Euronext + dataclass tests).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/universe_sources.py tests/test_universe_sources.py
git commit -m "feat(universe): wikipedia_index_review refresh adapter"
```

---

## Task 5: Merge `new_master_records` into instrument master on apply

**Files:**
- Modify: `src/swing_screener/data/universe.py` (`refresh_package_universe` apply-path; add `_write_instrument_master`)
- Test: `tests/test_universe_data_management.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_universe_data_management.py` (uses `tmp_path` + monkeypatching the master path/cache):

```python
import json

import swing_screener.data.universe as universe_mod
from swing_screener.data.universe_sources import UniverseSourceResult


def test_refresh_apply_merges_new_master_records(monkeypatch, tmp_path):
    master_path = tmp_path / "instrument_master.json"
    master_path.write_text(json.dumps([
        {"symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD", "source": "manual"}
    ]), encoding="utf-8")

    monkeypatch.setattr(universe_mod, "_INSTRUMENT_MASTER_PATH_OVERRIDE", str(master_path), raising=False)
    universe_mod._instrument_master_cache.cache_clear()

    # stub the snapshot + source result
    snapshot = {"id": "us_sp500", "source_adapter": "wikipedia_index_review",
                "constituents": [], "rules": {}}
    monkeypatch.setattr(universe_mod, "_load_snapshot", lambda _id: dict(snapshot))
    monkeypatch.setattr(universe_mod, "get_universe_meta", lambda _id: {"id": "us_sp500", "kind": "index"})
    monkeypatch.setattr(universe_mod, "_write_snapshot", lambda _id, _snap: None)

    result = UniverseSourceResult(
        source_adapter="wikipedia_index_review", source_asof="2026-06-12",
        source_documents=[], notes=[],
        constituents=[{"symbol": "MSFT", "exchange_mic": "XNAS", "currency": "USD",
                       "source_name": "Microsoft", "source_symbol": "MSFT"}],
        new_master_records=[{"symbol": "MSFT", "exchange_mic": "XNAS", "currency": "USD",
                             "source": "wikipedia_yfinance"}],
    )
    monkeypatch.setattr(universe_mod, "refresh_snapshot_from_source", lambda *a, **k: result)

    universe_mod.refresh_package_universe("us_sp500", apply=True)

    written = json.loads(master_path.read_text(encoding="utf-8"))
    symbols = {r["symbol"]: r for r in written}
    assert "MSFT" in symbols                      # new symbol appended
    assert symbols["AAPL"]["source"] == "manual"  # existing record untouched
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_universe_data_management.py::test_refresh_apply_merges_new_master_records -q`
Expected: FAIL — `_write_instrument_master`/override attr does not exist; MSFT not written.

- [ ] **Step 3: Implement**

In `src/swing_screener/data/universe.py`:

Make `_instrument_master_cache` honor an override and capture the resolved path. Replace the body of `_instrument_master_cache` to try `_INSTRUMENT_MASTER_PATH_OVERRIDE` first:

```python
_INSTRUMENT_MASTER_PATH_OVERRIDE: str | None = None


def _instrument_master_path() -> str:
    import os
    if _INSTRUMENT_MASTER_PATH_OVERRIDE:
        return os.path.abspath(_INSTRUMENT_MASTER_PATH_OVERRIDE)
    for candidate in [
        "data/intelligence/instrument_master.json",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "intelligence", "instrument_master.json"),
    ]:
        p = os.path.abspath(candidate)
        if os.path.exists(p):
            return p
    return os.path.abspath("data/intelligence/instrument_master.json")


@lru_cache(maxsize=1)
def _instrument_master_cache() -> dict[str, dict]:
    path = _instrument_master_path()
    import os
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            records = json.load(f)
        return {r["symbol"]: r for r in records}
    return {}
```

Add a writer:

```python
def _write_instrument_master(new_records: list[dict]) -> int:
    """Append new symbols to instrument master (never overwrite). Returns count added."""
    if not new_records:
        return 0
    path = _instrument_master_path()
    with open(path, encoding="utf-8") as f:
        records = json.load(f)
    existing = {r["symbol"] for r in records}
    added = [r for r in new_records if r["symbol"] not in existing]
    if not added:
        return 0
    records.extend(added)
    records.sort(key=lambda r: str(r.get("symbol", "")))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")
    _instrument_master_cache.cache_clear()
    return len(added)
```

In `refresh_package_universe`, after computing `preview` and before the snapshot write, merge records when applying:

```python
    if apply and getattr(preview, "new_master_records", None):
        _write_instrument_master(preview.new_master_records)
```

Place this just before the existing `if apply and changed:` block so freshly added master records are present when the snapshot is validated/loaded.

- [ ] **Step 4: Run tests to verify pass**

Run: `pytest tests/test_universe_data_management.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/data/universe.py tests/test_universe_data_management.py
git commit -m "feat(universe): merge enriched records into instrument master on refresh apply"
```

---

## Task 6: Manifest entries, seed snapshots, CLI refresh subcommand

**Files:**
- Modify: `src/swing_screener/data/universes/registry/manifest.json`
- Create: 8 × `src/swing_screener/data/universes/registry/snapshots/<id>.json`
- Modify: `src/swing_screener/cli.py`
- Test: `tests/test_universe_snapshot.py`

- [ ] **Step 1: Add 8 manifest entries**

Append to the manifest array (keep array sorted by id where the file already is). Each entry:

```json
{
  "id": "us_sp500",
  "description": "S&P 500 constituents",
  "kind": "index",
  "benchmark": "^GSPC",
  "currencies": ["USD"],
  "source": "wikipedia",
  "source_asof": "2026-06-12",
  "last_reviewed_at": "2026-06-12",
  "stale_after_days": 100
}
```

Repeat for the other 7 using the id/benchmark/currency table below:

| id | description | benchmark | currencies |
|---|---|---|---|
| `us_nasdaq100` | Nasdaq-100 constituents | `^NDX` | `["USD"]` |
| `us_dow30` | Dow Jones Industrial Average constituents | `^DJI` | `["USD"]` |
| `germany_dax` | DAX 40 constituents | `^GDAXI` | `["EUR"]` |
| `france_cac40` | CAC 40 constituents | `^FCHI` | `["EUR"]` |
| `uk_ftse100` | FTSE 100 constituents | `^FTSE` | `["GBP"]` |
| `spain_ibex35` | IBEX 35 constituents | `^IBEX` | `["EUR"]` |
| `europe_eurostoxx50` | EURO STOXX 50 constituents | `^STOXX50E` | `["EUR"]` |

- [ ] **Step 2: Seed 8 snapshot files**

Create each `snapshots/<id>.json` (constituents empty — populated by Task 7's refresh). Example `us_sp500.json`:

```json
{
  "id": "us_sp500",
  "kind": "index",
  "description": "S&P 500 constituents",
  "benchmark": "^GSPC",
  "source": "wikipedia",
  "source_adapter": "wikipedia_index_review",
  "source_asof": "2026-06-12",
  "last_reviewed_at": "2026-06-12",
  "stale_after_days": 100,
  "rules": {},
  "constituents": []
}
```

Set `id`, `description`, `benchmark` per the table. `source_adapter` is `"wikipedia_index_review"` for all 8.

- [ ] **Step 3: Write the failing test**

Add to `tests/test_universe_snapshot.py`:

```python
from swing_screener.data.universe import list_package_universes, get_universe_meta

EXPECTED_INDEX_IDS = {
    "us_sp500", "us_nasdaq100", "us_dow30", "germany_dax",
    "france_cac40", "uk_ftse100", "spain_ibex35", "europe_eurostoxx50",
}


def test_new_indices_present_and_refreshable():
    names = set(list_package_universes())
    assert EXPECTED_INDEX_IDS <= names
    for uid in EXPECTED_INDEX_IDS:
        meta = get_universe_meta(uid)
        assert meta["kind"] == "index"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_universe_snapshot.py::test_new_indices_present_and_refreshable -q`
Expected: PASS (manifest + seeds present). If `list_package_universes` requires non-empty constituents to list, the seed has an empty list — confirm it still lists; if it filters empties, that is acceptable until Task 7 populates, so move this assertion's strictness to Task 7.

- [ ] **Step 5: Add CLI `universes refresh` subcommand**

In `src/swing_screener/cli.py`, in the universes subparser block (after the `doctor` parser), add:

```python
    uni_refresh = uni_sub.add_parser("refresh", help="Refresh an index universe from its source adapter")
    uni_refresh.add_argument("--name", required=True, help="Universe id to refresh")
    uni_refresh.add_argument("--apply", action="store_true", help="Write the refreshed snapshot + master records")
```

In the dispatch block (after the `doctor` handler, before `parser.error("Unknown universes command")`):

```python
        if args.uni_command == "refresh":
            from swing_screener.data.universe import refresh_package_universe

            result = refresh_package_universe(args.name, apply=args.apply)
            print(f"{args.name}: changed={result['changed']} applied={result['applied']} "
                  f"members {result['current_member_count']} -> {result['proposed_member_count']}")
            for note in result.get("notes", []):
                print(f"  note: {note}")
            return
```

- [ ] **Step 6: Run tests**

Run: `pytest tests/test_universe_snapshot.py -q && python -m swing_screener.cli universes refresh --name us_dow30 2>&1 | head`
Expected: snapshot test PASS; CLI prints a dry-run line (network fetch for Dow). If offline, the CLI prints the `UniverseSourceError` — that's fine here; population is Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/data/universes/registry/manifest.json \
        src/swing_screener/data/universes/registry/snapshots \
        src/swing_screener/cli.py tests/test_universe_snapshot.py
git commit -m "feat(universe): register 8 index universes + universes refresh CLI"
```

---

## Task 7: Populate (network), validate, lint, docs

**Files:**
- Modify (data): 8 snapshots + `data/intelligence/instrument_master.json`
- Modify (docs): `data/README.md`, `docs/engineering/MODULE_ARCHITECTURE.md`, `docs/overview/INDEX.md`

- [ ] **Step 1: Run refresh --apply for all 8 (network)**

```bash
for id in us_sp500 us_nasdaq100 us_dow30 germany_dax france_cac40 uk_ftse100 spain_ibex35 europe_eurostoxx50; do
  echo "=== $id ==="
  python -m swing_screener.cli universes refresh --name "$id" --apply
done
```

Expected: each prints `applied=True` with a non-zero proposed member count and any skip notes. yfinance enrichment may take several minutes total.

- [ ] **Step 2: Validate all snapshots**

Run: `python -m swing_screener.cli universes validate`
Expected: `OK` for every id including the 8 new ones (zero "not in instrument master" / currency / mic errors). If a constituent failed enrichment it was skipped, so validation should be clean. Investigate any FAIL before proceeding.

- [ ] **Step 3: Sanity-check member counts**

```bash
python - <<'PY'
import json, glob
for p in sorted(glob.glob("src/swing_screener/data/universes/registry/snapshots/*.json")):
    d = json.load(open(p))
    if d.get("source_adapter") == "wikipedia_index_review":
        print(d["id"], len(d["constituents"]))
PY
```

Expected ballpark: sp500 ~500, nasdaq100 ~100, dow30 30, dax ~40, cac40 ~40, ftse100 ~100, ibex35 ~35, eurostoxx50 ~50. Large shortfalls mean a parser/venue gap — fix Task 2/3 config, re-run Step 1 for that id.

- [ ] **Step 4: Full backend suite + lint**

Run: `pytest -q && ruff check . && black --check .`
Expected: all green. Run `black .` if formatting differs, then re-commit.

- [ ] **Step 5: Update docs**

- `data/README.md`: note instrument_master.json grew (~421 → actual count) via `wikipedia_yfinance` source; 8 new index snapshots; refresh via `universes refresh --name <id> --apply`.
- `docs/engineering/MODULE_ARCHITECTURE.md`: add `data/wikipedia_sources.py` and `data/instrument_enrichment.py` with one-line roles.
- `docs/overview/INDEX.md`: add the spec + this plan.

- [ ] **Step 6: Commit data + docs**

```bash
git add src/swing_screener/data/universes/registry/snapshots \
        data/intelligence/instrument_master.json \
        data/README.md docs/engineering/MODULE_ARCHITECTURE.md docs/overview/INDEX.md
git commit -m "feat(universe): populate 8 index universes + grow instrument master"
```

---

## Verification (pre-PR)

- [ ] `pytest -q` green (incl. new test files; integration tests skipped).
- [ ] `python -m swing_screener.cli universes validate` → all OK.
- [ ] `ruff check .` and `black --check .` clean.
- [ ] 8 snapshots non-empty with sane counts; `instrument_master.json` grew append-only (existing symbols byte-identical).
- [ ] Spec requirements covered: refreshable adapter (T4), enrichment (T3), master merge no-clobber (T5), 8 indices registered (T6), populated data (T7), docs (T7).

## Notes / known drift points

- Wikipedia table indices shift; selection is by column predicate, not position — if a page restructures, `_select_table` raises rather than silently mis-parsing.
- EURO STOXX 50 venue mapping (`_EUROSTOXX_VENUE_SUFFIX`) is the most fragile; user approved skip+note for any row whose venue can't be resolved.
- The `@pytest.mark.integration` live Wikipedia test for `us_dow30` is optional polish; add only if it fits — CI skips integration.
