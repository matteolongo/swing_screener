import pandas as pd

from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.risk.regime import compute_regime_risk_multiplier


def _make_benchmark_ohlcv(
    benchmark: str,
    close: pd.Series,
    high_offset: float = 10.0,
    low_offset: float = 10.0,
) -> pd.DataFrame:
    high = close + high_offset
    low = close - low_offset
    vol = pd.Series(1_000_000, index=close.index, dtype=float)

    data = {
        ("Open", benchmark): close,
        ("High", benchmark): high,
        ("Low", benchmark): low,
        ("Close", benchmark): close,
        ("Volume", benchmark): vol,
    }
    df = pd.DataFrame(data, index=close.index)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_regime_disabled_returns_one():
    idx = pd.bdate_range("2023-01-02", periods=260)
    close = pd.Series(100.0, index=idx, dtype=float)
    ohlcv = _make_benchmark_ohlcv("SPY", close)

    cfg = RiskConfig(regime_enabled=False)
    mult, meta = compute_regime_risk_multiplier(ohlcv, "SPY", cfg)

    assert mult == 1.0
    assert meta["enabled"] is False


def test_regime_applies_both_trend_and_volatility():
    idx = pd.bdate_range("2023-01-02", periods=260)
    close = pd.Series(100.0, index=idx, dtype=float)
    close.iloc[-1] = 50.0  # push below SMA200
    ohlcv = _make_benchmark_ohlcv("SPY", close, high_offset=20.0, low_offset=20.0)

    cfg = RiskConfig(
        regime_enabled=True,
        regime_trend_sma=200,
        regime_trend_multiplier=0.5,
        regime_vol_atr_window=14,
        regime_vol_atr_pct_threshold=10.0,
        regime_vol_multiplier=0.5,
    )

    mult, meta = compute_regime_risk_multiplier(ohlcv, "SPY", cfg)

    assert mult == 0.25
    assert any("SMA200" in reason for reason in meta["reasons"])
    assert any("ATR%" in reason for reason in meta["reasons"])
