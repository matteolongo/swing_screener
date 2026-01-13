import pytest
from swing_screener.data.universe import (
    normalize_tickers,
    apply_universe_config,
    UniverseConfig,
)


def test_normalize_tickers_dedup_and_upper():
    t = normalize_tickers([" aapl ", "AAPL", "msft", "", "  "])
    assert t == ["AAPL", "MSFT"]


def test_normalize_tickers_rejects_bad_symbol():
    with pytest.raises(ValueError):
        normalize_tickers(["AAPL", "BAD$TICKER"])


def test_apply_universe_config_adds_benchmark():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True)
    out = apply_universe_config(["AAPL", "MSFT"], cfg)
    assert "SPY" in out


def test_apply_universe_config_caps_and_keeps_benchmark():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=2)
    out = apply_universe_config(["AAPL", "MSFT", "NVDA"], cfg)
    assert len(out) == 2
    assert "SPY" in out
