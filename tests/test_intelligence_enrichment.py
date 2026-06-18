from types import SimpleNamespace

from api.services.intelligence_enrichment import enrich_intelligence_request
from swing_screener.intelligence.models import SymbolIntelligenceRequest


class _FakeFundamentals:
    def __init__(self, snapshot):
        self._snapshot = snapshot
        self.calls = []

    def get_snapshot(self, symbol):
        self.calls.append(symbol)
        return self._snapshot


def _snapshot(**over):
    base = dict(
        sector="Technology",
        trailing_pe=20.0,
        revenue_growth_yoy=0.15,
        gross_margin=0.44,
        net_margin=0.22,
        return_on_equity=0.31,
        debt_to_equity=0.7,
        insider_net_shares_90d=-500,
        insider_transaction_count_90d=4,
        forward_eps_estimate=2.05,
        analyst_upgrade_downgrade_net_30d=2,
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_enricher_fills_missing_fundamentals_and_finnhub():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    fund = _FakeFundamentals(_snapshot())
    out = enrich_intelligence_request("AAPL", req, fundamentals=fund, earnings=lambda t: (5, "2026-06-20"))
    assert out.trailing_pe == 20.0
    assert out.gross_margin == 0.44
    assert out.insider_net_shares_90d == -500
    assert out.forward_eps_estimate == 2.05
    assert out.days_to_earnings == 5
    assert out.next_earnings_date == "2026-06-20"
    assert fund.calls == ["AAPL"]


def test_enricher_does_not_overwrite_provided_values():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout", trailing_pe=99.0, days_to_earnings=1)
    fund = _FakeFundamentals(_snapshot())
    out = enrich_intelligence_request("AAPL", req, fundamentals=fund, earnings=lambda t: (5, "2026-06-20"))
    assert out.trailing_pe == 99.0
    assert out.days_to_earnings == 1
    assert out.gross_margin == 0.44


def test_enricher_is_resilient_to_provider_errors():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")

    class _Boom:
        def get_snapshot(self, symbol):
            raise RuntimeError("provider down")

    def _earn_boom(_t):
        raise RuntimeError("earnings down")

    out = enrich_intelligence_request("AAPL", req, fundamentals=_Boom(), earnings=_earn_boom)
    assert out.trailing_pe is None
    assert out.days_to_earnings is None


def _synthetic_ohlcv(ticker="AAA", n=300):
    import numpy as np
    import pandas as pd

    idx = pd.bdate_range(end="2026-06-01", periods=n)
    close = pd.Series(np.linspace(100.0, 200.0, n), index=idx)
    cols = pd.MultiIndex.from_product(
        [["Open", "High", "Low", "Close", "Volume"], [ticker]]
    )
    df = pd.DataFrame(index=idx, columns=cols, dtype=float)
    df[("Open", ticker)] = close.shift(1).fillna(close.iloc[0]).values
    df[("High", ticker)] = (close * 1.01).values
    df[("Low", ticker)] = (close * 0.99).values
    df[("Close", ticker)] = close.values
    df[("Volume", ticker)] = 1_000_000.0
    return df


def test_enrich_with_technicals_fills_indicators():
    from api.services.intelligence_enrichment import enrich_with_technicals

    req = SymbolIntelligenceRequest(close=200.0, signal="hold")
    out = enrich_with_technicals("AAA", req, _synthetic_ohlcv())

    assert out.sma_20 is not None
    assert out.sma_200 is not None
    assert out.momentum_6m is not None
    assert out.momentum_12m is not None
    assert out.atr is not None
    assert out.dist_52w_high_pct is not None
    # rising series sits at its 52w high
    assert out.near_52w_high is True
    # benchmark-relative fields are intentionally left unset on this single-symbol path
    assert out.rel_strength is None


def test_enrich_with_technicals_degrades_on_empty_frame():
    import pandas as pd

    from api.services.intelligence_enrichment import enrich_with_technicals

    req = SymbolIntelligenceRequest(close=200.0, signal="hold")
    out = enrich_with_technicals("AAA", req, pd.DataFrame())
    assert out.sma_20 is None
    assert out is req


def test_enrich_with_technicals_does_not_overwrite_existing():
    from api.services.intelligence_enrichment import enrich_with_technicals

    req = SymbolIntelligenceRequest(close=200.0, signal="hold", sma_20=123.0)
    out = enrich_with_technicals("AAA", req, _synthetic_ohlcv())
    assert out.sma_20 == 123.0
