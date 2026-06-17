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
  the latest bar (`execution/guidance.apply_pattern_stop`). The structural stop is
  only used when it is tighter than the existing stop, below entry, not in an
  `extended` context, and does not breach minimum R.

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
