from api.models.fundamentals import FundamentalSnapshotResponse


def test_response_exposes_finnhub_signals():
    resp = FundamentalSnapshotResponse.model_validate(
        {
            "symbol": "AAPL",
            "asof_date": "2026-06-15",
            "provider": "yfinance",
            "updated_at": "2026-06-15T00:00:00Z",
            "insider_net_shares_90d": -1200,
            "insider_transaction_count_90d": 5,
            "forward_eps_estimate": 2.10,
            "analyst_upgrade_downgrade_net_30d": 3,
            "net_margin": 0.25,
        }
    )
    assert resp.insider_net_shares_90d == -1200
    assert resp.insider_transaction_count_90d == 5
    assert resp.forward_eps_estimate == 2.10
    assert resp.analyst_upgrade_downgrade_net_30d == 3
    assert resp.net_margin == 0.25
