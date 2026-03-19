from __future__ import annotations

import httpx

from swing_screener.fundamentals.providers.sec_edgar import SecEdgarFundamentalsProvider


def test_sec_edgar_provider_builds_quarterly_record(monkeypatch):
    ticker_map_payload = {
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
    }
    companyfacts_payload = {
        "entityName": "Apple Inc.",
        "facts": {
            "us-gaap": {
                "Revenues": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": 1000.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": 1200.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "NetIncomeLoss": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": 100.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": 140.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "GrossProfit": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": 450.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": 600.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "OperatingIncomeLoss": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": 220.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": 300.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "NetCashProvidedByUsedInOperatingActivities": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": 180.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": 250.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "PaymentsToAcquirePropertyPlantAndEquipment": {
                    "units": {
                        "USD": [
                            {
                                "start": "2025-01-01",
                                "end": "2025-03-31",
                                "val": -40.0,
                                "fy": 2025,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2025-05-01",
                            },
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": -50.0,
                                "fy": 2026,
                                "fp": "Q1",
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            },
                        ]
                    }
                },
                "StockholdersEquity": {
                    "units": {
                        "USD": [
                            {
                                "end": "2026-03-31",
                                "val": 800.0,
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            }
                        ]
                    }
                },
                "AssetsCurrent": {
                    "units": {
                        "USD": [
                            {
                                "end": "2026-03-31",
                                "val": 500.0,
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            }
                        ]
                    }
                },
                "LiabilitiesCurrent": {
                    "units": {
                        "USD": [
                            {
                                "end": "2026-03-31",
                                "val": 250.0,
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            }
                        ]
                    }
                },
            },
            "dei": {
                "EntityCommonStockSharesOutstanding": {
                    "units": {
                        "shares": [
                            {
                                "end": "2026-03-31",
                                "val": 100.0,
                                "form": "10-Q",
                                "filed": "2026-05-01",
                            }
                        ]
                    }
                }
            },
        },
    }

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url):
            if url.endswith("/files/company_tickers.json"):
                return httpx.Response(200, json=ticker_map_payload, request=httpx.Request("GET", url))
            if url.endswith("/api/xbrl/companyfacts/CIK0000320193.json"):
                return httpx.Response(200, json=companyfacts_payload, request=httpx.Request("GET", url))
            raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("swing_screener.fundamentals.providers.sec_edgar.httpx.Client", _Client)

    provider = SecEdgarFundamentalsProvider()
    record = provider.fetch_record("AAPL")

    assert record.provider == "sec_edgar"
    assert record.company_name == "Apple Inc."
    assert record.instrument_type == "equity"
    assert record.revenue_growth_yoy == 0.2
    assert record.earnings_growth_yoy == 0.4
    assert record.gross_margin == 0.5
    assert record.current_ratio == 2.0
    assert record.shares_outstanding == 100.0
    assert record.total_equity == 800.0
    assert record.most_recent_quarter == "2026-03-31"
    assert record.historical_series["revenue"].frequency == "quarterly"
    assert record.historical_series["free_cash_flow"].points[-1].value == 200.0
    assert record.historical_series["free_cash_flow_margin"].points[-1].value == 200.0 / 1200.0
