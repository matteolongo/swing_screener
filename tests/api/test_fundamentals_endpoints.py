from __future__ import annotations

from fastapi.testclient import TestClient

from api.dependencies import get_fundamentals_service
from api.main import app


class _FakeFundamentalsService:
    def get_config(self):
        return {
            "enabled": True,
            "providers": ["yfinance"],
            "cache_ttl_hours": 24,
            "stale_after_days": 120,
            "compare_limit": 5,
        }

    def update_config(self, payload):
        return payload

    def get_snapshot(self, symbol: str, *, force_refresh: bool = False):
        return {
            "symbol": symbol.upper(),
            "asof_date": "2026-03-18",
            "provider": "yfinance",
            "updated_at": "2026-03-18T10:00:00",
            "instrument_type": "equity",
            "supported": True,
            "coverage_status": "supported",
            "freshness_status": "current",
            "company_name": "Apple Inc.",
            "sector": "Technology",
            "currency": "USD",
            "market_cap": 3_000_000_000_000.0,
            "revenue_growth_yoy": 0.18,
            "earnings_growth_yoy": 0.24,
            "gross_margin": 0.46,
            "operating_margin": 0.31,
            "free_cash_flow": 90_000_000_000.0,
            "free_cash_flow_margin": 0.24,
            "debt_to_equity": 45.0,
            "current_ratio": 1.4,
            "return_on_equity": 0.28,
            "trailing_pe": 28.0,
            "price_to_sales": 7.0,
            "most_recent_quarter": "2026-02-01",
            "pillars": {
                "growth": {"score": 0.9, "status": "strong", "summary": "Growth profile."},
            },
            "historical_series": {
                "revenue": {
                    "label": "Revenue",
                    "unit": "currency",
                    "direction": "improving",
                    "points": [
                        {"period_end": "2025-05-01", "value": 80_000_000_000.0},
                        {"period_end": "2025-08-01", "value": 84_000_000_000.0},
                        {"period_end": "2025-11-01", "value": 88_000_000_000.0},
                        {"period_end": "2026-02-01", "value": 94_000_000_000.0},
                    ],
                }
            },
            "red_flags": [],
            "highlights": ["Growth metrics are supportive."],
            "metric_sources": {"revenue_growth_yoy": "yfinance"},
            "error": None,
        }

    def refresh_snapshot(self, request):
        return self.get_snapshot(request.symbol, force_refresh=True)

    def compare(self, request):
        return {
            "snapshots": [self.get_snapshot(symbol, force_refresh=request.force_refresh) for symbol in request.symbols]
        }


def test_fundamentals_snapshot_endpoint():
    app.dependency_overrides[get_fundamentals_service] = lambda: _FakeFundamentalsService()
    client = TestClient(app)

    res = client.get("/api/fundamentals/snapshot/aapl")

    assert res.status_code == 200
    payload = res.json()
    assert payload["symbol"] == "AAPL"
    assert payload["coverage_status"] == "supported"
    assert payload["pillars"]["growth"]["status"] == "strong"
    assert payload["historical_series"]["revenue"]["direction"] == "improving"

    app.dependency_overrides.clear()


def test_fundamentals_compare_endpoint():
    app.dependency_overrides[get_fundamentals_service] = lambda: _FakeFundamentalsService()
    client = TestClient(app)

    res = client.post(
        "/api/fundamentals/compare",
        json={"symbols": ["AAPL", "MSFT"], "force_refresh": True},
    )

    assert res.status_code == 200
    payload = res.json()
    assert len(payload["snapshots"]) == 2
    assert payload["snapshots"][1]["symbol"] == "MSFT"

    app.dependency_overrides.clear()
