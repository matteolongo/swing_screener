# Analysis Module

Pure advisory analysis engines that sit beside the screener pipeline without
changing ranking, sizing, portfolio state, or order workflows.

## Volume-Zone Analysis

`volume_zones.py` provides deterministic, single-symbol volume-zone analysis:

```python
analyze_volume_zones(
    symbol: str,
    ohlcv: pd.DataFrame,
    *,
    interval: str = "1d",
    lookback: int = 120,
    min_rr: float = 2.0,
    cfg: VolumeZoneConfig = VolumeZoneConfig(),
) -> VolumeZoneAnalysis
```

The engine consumes an in-memory OHLCV `MultiIndex(field, ticker)` frame and
returns a frozen `VolumeZoneAnalysis` with:

- data quality and warnings
- profile type (`approximate_bar_based`)
- market bias, setup type, action, and confidence score
- key levels (`price`, `poc`, `vwap`, SMAs, ATR, swings, relative volume)
- volume zones (`poc`, `hvn`, `lvn`) with role and price band
- R-multiple trade plan (`entry`, `stop`, `target`, `rr`)
- rationale and retest count

The approximate volume profile is built from OHLCV bars, not tick-level trades.
It must not be described as true order flow, delta volume, or volume-at-price
from prints. Every API response includes:

`Approximate volume profile built from OHLCV bars, not tick-level trades.`

## Config

Defaults live under `low_level.volume_zones` in `config/defaults.yaml`:

- `bins`
- `hvn_peak_ratio`
- `lvn_peak_ratio`
- `min_bars`
- `lookback`
- `swing_window`
- `proximity_atr_mult`
- `stop_buffer_atr_mult`
- `retest_tol_atr_mult`
- `min_rr`

## Boundaries

This module is advisory only. It does not affect screener ranking, selection,
position sizing, portfolio state, orders, or backtest behavior.
