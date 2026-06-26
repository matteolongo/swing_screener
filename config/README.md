# Configuration Directory

This directory contains configuration files for the Swing Screener application.

## Files

### `defaults.yaml`

Low-level shared defaults for the system:
- runtime paths
- app config defaults
- strategy seed defaults
- intelligence defaults
- backend provider catalogs and operational fallback values

Candlestick pattern + structural-stop settings live under `low_level`:

- `low_level.candles` — thresholds for the deterministic candlestick engine
  (`indicators/candles.py`): `lookback`, `doji_body_ratio`,
  `hammer_lower_wick_mult`, `hammer_max_opposite_wick_ratio`,
  `extension_threshold_pct`, `breakout_lookback`, `pullback_ma`.
- `low_level.execution.pattern_stop_enabled` / `pattern_stop_atr_buffer` —
  toggle and ATR buffer for the structural stop derived from a bullish pattern on
  the latest bar (`execution/guidance.apply_pattern_stop`). When available it
  becomes the candidate's entry stop (the recommendation's target, R:R and risk
  are recomputed from it; share count is unchanged), so 1R reflects the setup's
  invalidation level instead of a wide ATR multiple. It is only applied when it is
  tighter than the ATR stop, below entry, not in an `extended` context, and does
  not breach minimum R.
- `low_level.data_providers.probe_canary` — canary symbols used by data source
  diagnostics (Data Sources page probes). Contains region-keyed symbols: `us` (US
  market canary, default AAPL) and `eu` (EU market canary, default ASML.AS). Used
  by the `DatasourcesService` to test provider health without requiring a real
  universe.
- `low_level.data_providers.yfinance.same_day_cache_ttl_minutes` (default: `480`) —
  How long a cached file is reused when the request end date is today or later.
  Set to 480 (8 hours) so that EU tickers — whose markets close ~6–8 hours before
  a typical post-US-close screener run — are served from cache rather than
  re-fetched. Override to a lower value (e.g. `30`) if you need fresher data
  during US market hours.

### `user.yaml`

Shared user-facing configuration that affects UI and system behavior without carrying secrets:
- `/api/config` compatibility payload under `app_config`
- API serving settings
- browser/app behavior defaults that are shared outside `localStorage`

### `strategies.yaml`

Authoritative strategy storage:
- `active_strategy_id`
- persisted strategy definitions

### `intelligence.yaml`

Dedicated intelligence configuration envelope:
- sanitized intelligence config
- bootstrap metadata
- last update timestamp

`config.llm.web_search_max_tokens` is `4000` (raised from 2000) to fit the multi-hop
news + forward-catalyst search the intelligence prompt now performs.

The symbol analyzer runs two calls: `config.llm.web_search_model` (default `gpt-4o`) does
the web-search write-up, then a tool-free `config.llm.format_model` (default `gpt-4o-mini`)
structures that write-up into the schema via the Responses structured-output API. Decoupling
search from formatting keeps the structured output from truncating mid-JSON.

Key LLM settings (under `config.llm`):

| Key | Default | Purpose |
|-----|---------|---------|
| `web_search_model` | `gpt-4o` | Call 1: web search + prose narrative |
| `format_model` | `gpt-4o-mini` | Call 2: tool-free structured output (`responses.parse`) |
| `web_search_max_tokens` | `4000` | Token budget for call 1 |
| `request_timeout_seconds` | `60` | Per-call HTTP timeout |
| `max_retries` | `2` | Retry count for transient errors |
| `analyzer_enabled` | `true` | Kill-switch: `false` → `/intelligence/*` endpoints return 503 |

`config.evidence` controls the evidence collector pipeline:

| Key | Default | Purpose |
|-----|---------|---------|
| `enabled_sources` | `[sec_edgar_catalysts]` | Collectors to fan-out to (SEC EDGAR only) |
| `recency_window_days` | `30` | Discard items older than this many days |
| `max_items_per_symbol` | `8` | Max curated items returned per ticker |
| `sec_forms` | `[8-K, 6-K, SC 13D, SC 13G, 424B, DEF 14A]` | SEC form prefixes kept (prefix match: `424B` catches `424B5`, `SC 13D` catches `SC 13D/A`) |
| `http.user_agent` | `swing-screener-intelligence-bot/1.0 (email)` | User-Agent sent by all collectors; must declare a contact email per SEC EDGAR policy |
| `http.connect_timeout_seconds` | `5.0` | TCP connect timeout |
| `http.read_timeout_seconds` | `20.0` | Read/response timeout |

`config.analysis_history` controls per-symbol analysis memory:

| Key | Default | Purpose |
|-----|---------|---------|
| `max_entries` | `50` | Per-symbol history entries kept on disk (`data/intelligence/history/{TICKER}.json`) |
| `digest_size` | `5` | Most-recent runs fed back to the LLM as the thesis-drift digest (must be `<= max_entries`) |

`config.pre_open` controls the pre-open gap-outlook window (US equities):

| Key | Default | Purpose |
|-----|---------|---------|
| `enabled` | `true` | Master switch for pre-open mode |
| `timezone` | `America/New_York` | Exchange timezone used to evaluate the window |
| `market_open` | `"09:30"` | ET regular-session open; pre-open window ends here |
| `window_start` | `"00:00"` | ET lower bound of the pre-open window (overnight tape) |
| `session_close` | `"16:00"` | ET regular-session close; bounds the overnight news window |

### `mcp.yaml`

MCP feature flags and server metadata.

Edit this file to enable or disable MCP features:

```yaml
features:
  portfolio:
    enabled: true
    tools:
      - list_positions
      - close_position
```

Changes require MCP server restart.

## Runtime Path Keys

Runtime path keys are defined under `paths` in `defaults.yaml` and control where the application writes cache and data files.

| Key | Default | Purpose |
|-----|---------|---------|
| `eval_cache_dir` | `.cache/eval` | Root directory for the per-symbol evaluation cache. Parquets are stored at `{eval_cache_dir}/{strategy_sig}/{asof_date}/{SYMBOL}.parquet`. Files older than 24 h are pruned automatically on each run. |

## Notes

- New configurable behavior should be added to the existing YAML configuration surfaces in this directory instead of being hardcoded in Python, TypeScript, or prompts.
- Choose the config file that matches the scope of the setting:
  - `defaults.yaml` for shared system defaults
  - `user.yaml` for user-facing app and API behavior
  - `strategies.yaml` for strategy definitions and strategy-level tuning
  - `intelligence.yaml` for intelligence runtime settings and prompts
  - `mcp.yaml` for MCP feature flags and server metadata
- `docker-compose.yml` is the repo's local orchestration config. Use it for container/runtime wiring only, not for application defaults that belong in `config/*.yaml`.
- This directory is for **configuration files only**
- Do not store runtime artifacts or temporary files here
- Config files should be versioned (committed to git)
- Sensitive credentials should use environment variables, not config files
