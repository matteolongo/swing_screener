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
            "shares_outstanding": 14_900_000_000.0,
            "total_equity": 74_500_000_000.0,
            "book_value_per_share": 5.0,
            "price_to_book": 5.6,
            "book_to_price": 0.1786,
            "most_recent_quarter": "2026-02-01",
            "pillars": {
                "growth": {"score": 0.9, "status": "strong", "summary": "Growth profile."},
            },
            "historical_series": {
                "revenue": {
                    "label": "Revenue",
                    "unit": "currency",
                    "frequency": "quarterly",
                    "direction": "improving",
                    "source": "yfinance.quarterly_income_stmt",
                    "points": [
                        {"period_end": "2025-05-01", "value": 80_000_000_000.0},
                        {"period_end": "2025-08-01", "value": 84_000_000_000.0},
                        {"period_end": "2025-11-01", "value": 88_000_000_000.0},
                        {"period_end": "2026-02-01", "value": 94_000_000_000.0},
                    ],
                }
            },
            "metric_context": {
                "revenue_growth_yoy": {
                    "source": "yfinance.info.revenueGrowth",
                    "cadence": "snapshot",
                    "derived": False,
                    "derived_from": [],
                    "period_end": "2026-02-01",
                },
                "operating_margin": {
                    "source": "yfinance.quarterly_income_stmt",
                    "cadence": "quarterly",
                    "derived": True,
                    "derived_from": [
                        "yfinance.quarterly_income_stmt",
                        "yfinance.quarterly_income_stmt",
                    ],
                    "period_end": "2026-02-01",
                },
            },
            "data_quality_status": "medium",
            "data_quality_flags": [
                "Revenue YoY mixes snapshot metric data with quarterly history.",
            ],
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

    def start_warmup(self, request):
        return {
            "job_id": "warmup-1",
            "status": "queued",
            "source": request.source,
            "force_refresh": request.force_refresh,
            "total_symbols": len(request.symbols) if request.source == "symbols" else 2,
            "created_at": "2026-03-19T10:00:00",
            "updated_at": "2026-03-19T10:00:00",
        }

    def get_warmup_status(self, job_id: str):
        return {
            "job_id": job_id,
            "status": "running",
            "source": "watchlist",
            "force_refresh": False,
            "total_symbols": 2,
            "completed_symbols": 1,
            "coverage_counts": {
                "supported": 1,
                "partial": 0,
                "insufficient": 0,
                "unsupported": 0,
            },
            "freshness_counts": {
                "current": 1,
                "stale": 0,
                "unknown": 0,
            },
            "error_count": 0,
            "last_completed_symbol": "AAPL",
            "error_sample": None,
            "created_at": "2026-03-19T10:00:00",
            "updated_at": "2026-03-19T10:00:03",
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
    assert payload["historical_series"]["revenue"]["frequency"] == "quarterly"
    assert payload["historical_series"]["revenue"]["source"] == "yfinance.quarterly_income_stmt"
    assert payload["metric_context"]["revenue_growth_yoy"]["cadence"] == "snapshot"
    assert payload["book_value_per_share"] == 5.0
    assert payload["price_to_book"] == 5.6
    assert payload["book_to_price"] == 0.1786
    assert payload["data_quality_status"] == "medium"
    assert payload["data_quality_flags"] == ["Revenue YoY mixes snapshot metric data with quarterly history."]

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


def test_fundamentals_warmup_launch_endpoint():
    app.dependency_overrides[get_fundamentals_service] = lambda: _FakeFundamentalsService()
    client = TestClient(app)

    res = client.post(
        "/api/fundamentals/warmup",
        json={"source": "symbols", "symbols": ["AAPL", "MSFT"], "force_refresh": True},
    )

    assert res.status_code == 200
    payload = res.json()
    assert payload["job_id"] == "warmup-1"
    assert payload["source"] == "symbols"
    assert payload["force_refresh"] is True
    assert payload["total_symbols"] == 2

    app.dependency_overrides.clear()


def test_fundamentals_warmup_status_endpoint():
    app.dependency_overrides[get_fundamentals_service] = lambda: _FakeFundamentalsService()
    client = TestClient(app)

    res = client.get("/api/fundamentals/warmup/warmup-1")

    assert res.status_code == 200
    payload = res.json()
    assert payload["job_id"] == "warmup-1"
    assert payload["status"] == "running"
    assert payload["coverage_counts"]["supported"] == 1
    assert payload["last_completed_symbol"] == "AAPL"

    app.dependency_overrides.clear()
