import pytest

from swing_screener.data.symbol_discovery import (
    SymbolDiscoveryError,
    SymbolDiscoveryQuery,
    discover_symbols,
)


def test_yahoo_predefined_discovery_filters_and_taxonomizes_symbols():
    payload = {
        "finance": {
            "result": [
                {
                    "quotes": [
                        {
                            "symbol": "AAPL",
                            "shortName": "Apple Inc.",
                            "quoteType": "EQUITY",
                            "exchange": "NMS",
                            "fullExchangeName": "NasdaqGS",
                            "currency": "USD",
                            "region": "US",
                            "marketCap": 3_000_000_000_000,
                            "regularMarketVolume": 50_000_000,
                        },
                        {
                            "symbol": "ASML.AS",
                            "shortName": "ASML Holding",
                            "quoteType": "EQUITY",
                            "exchange": "AMS",
                            "fullExchangeName": "Amsterdam",
                            "currency": "EUR",
                            "region": "NL",
                            "marketCap": 300_000_000_000,
                            "regularMarketVolume": 1_000_000,
                        },
                        {
                            "symbol": "SPY",
                            "shortName": "SPDR S&P 500 ETF",
                            "quoteType": "ETF",
                            "exchange": "PCX",
                            "currency": "USD",
                        },
                    ]
                }
            ]
        }
    }

    result = discover_symbols(
        SymbolDiscoveryQuery(
            provider="yahoo_predefined",
            screens=("most_actives",),
            currencies=("USD",),
            exchange_mics=("XNAS",),
            limit=10,
            min_volume=10_000_000,
        ),
        fetch_json=lambda url: payload,
    )

    assert [item["symbol"] for item in result.symbols] == ["AAPL"]
    assert result.taxonomy["currency"] == {"USD": 1}
    assert result.taxonomy["exchange_mic"] == {"XNAS": 1}
    assert result.symbols[0]["source_screen"] == "most_actives"


def test_eodhd_exchange_discovery_requires_key():
    with pytest.raises(SymbolDiscoveryError, match="requires EODHD_API_KEY"):
        discover_symbols(
            SymbolDiscoveryQuery(provider="eodhd_exchange", exchanges=("NASDAQ",)),
            eodhd_api_token="",
        )


def test_eodhd_exchange_discovery_reads_csv_and_maps_metadata():
    csv_text = "\n".join(
        [
            "Code,Name,Country,Exchange,Currency,Type,Isin",
            "AAPL,Apple Inc,USA,NASDAQ,USD,Common Stock,US0378331005",
            "QQQ,Invesco QQQ,USA,NASDAQ,USD,ETF,US46090E1038",
        ]
    )

    result = discover_symbols(
        SymbolDiscoveryQuery(
            provider="eodhd_exchange",
            exchanges=("NASDAQ",),
            quote_types=("EQUITY",),
            limit=10,
        ),
        fetch_text=lambda url: csv_text,
        eodhd_api_token="demo",
    )

    assert [item["symbol"] for item in result.symbols] == ["AAPL"]
    assert result.symbols[0]["exchange_mic"] == "XNAS"
    assert result.symbols[0]["currency"] == "USD"
    assert result.taxonomy["market"] == {"USA": 1}
