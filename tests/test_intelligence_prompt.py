from swing_screener.intelligence.models import SymbolIntelligenceRequest


def test_request_accepts_raw_fundamentals_fields():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="breakout",
        trailing_pe=22.5,
        revenue_growth_yoy=0.18,
        gross_margin=0.46,
        net_margin=0.21,
        return_on_equity=0.30,
        debt_to_equity=0.8,
    )
    assert req.trailing_pe == 22.5
    assert req.revenue_growth_yoy == 0.18
    assert req.gross_margin == 0.46
    assert req.net_margin == 0.21
    assert req.return_on_equity == 0.30
    assert req.debt_to_equity == 0.8
