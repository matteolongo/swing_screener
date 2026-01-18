from pathlib import Path
from types import SimpleNamespace
import json

import pandas as pd

from swing_screener.data.market_data import fetch_ticker_metadata


def test_fetch_ticker_metadata_uses_cache_and_updates(monkeypatch, tmp_path):
    cache_file = tmp_path / "meta.json"
    # pre-populate cache for T1
    cache_file.write_text(json.dumps({"T1": {"name": "Cached", "currency": "USD", "exchange": "NYSE"}}))

    # fake yfinance.Ticker
    def fake_ticker(symbol):
        assert symbol == "T2"
        fi = {"currency": "EUR", "exchange": "XETRA"}
        info = {"shortName": "NewName", "currency": "EUR", "exchange": "XETRA"}
        return SimpleNamespace(fast_info=fi, get_info=lambda: info)

    monkeypatch.setattr("swing_screener.data.market_data.yf", SimpleNamespace(Ticker=fake_ticker))

    df = fetch_ticker_metadata(["T1", "T2"], cache_path=str(cache_file), use_cache=True, force_refresh=False)

    assert df.loc["T1", "name"] == "Cached"
    assert df.loc["T1", "currency"] == "USD"
    assert df.loc["T1", "exchange"] == "NYSE"
    assert df.loc["T2", "name"] == "NewName"
    assert df.loc["T2", "currency"] == "EUR"
    assert df.loc["T2", "exchange"] == "XETRA"

    saved = json.loads(cache_file.read_text())
    assert "T2" in saved
    assert saved["T2"]["currency"] == "EUR"
