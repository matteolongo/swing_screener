from api.models.datasources import (
    SourceDescriptorOut, ProbeResultOut, FallbackEventOut, DataSourcesInventoryOut,
)


def test_inventory_model_serializes_snake_case():
    inv = DataSourcesInventoryOut(
        sources=[
            SourceDescriptorOut(
                id="yfinance", display_name="Yahoo Finance", domain="market_data",
                role="primary", requires=None, configured=True, probeable=True,
                canary_market="us", note=None, last_probe=None,
            )
        ]
    )
    payload = inv.model_dump()
    assert payload["sources"][0]["display_name"] == "Yahoo Finance"
    assert payload["sources"][0]["last_probe"] is None


def test_probe_result_model():
    r = ProbeResultOut(id="stooq", status="ok", latency_ms=12.0, detail="1 bar", sample={"x": 1}, error=None)
    assert r.model_dump()["status"] == "ok"
