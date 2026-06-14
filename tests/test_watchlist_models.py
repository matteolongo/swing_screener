from api.models.watchlist import WatchlistItemView
from api.models.screener import CandlePatternOut


def test_watchlist_item_patterns_default_empty():
    item = WatchlistItemView(ticker="AAA", source="manual")
    assert item.patterns == []


def test_watchlist_item_accepts_patterns():
    item = WatchlistItemView(
        ticker="AAA",
        source="manual",
        patterns=[
            CandlePatternOut(
                bar_index=5,
                date="2024-01-01",
                name="hammer",
                direction="bullish",
                key_level=9.0,
                context="at_pullback",
            )
        ],
    )
    assert item.patterns[0].name == "hammer"
