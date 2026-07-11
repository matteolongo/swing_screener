"""Position intelligence cache match tolerates the raw-vs-rounded storage gap."""

from types import SimpleNamespace

from api.routers.intelligence import (
    _cached_position_context_matches,
    _position_cache_context,
)


def _pos(entry_price: float, stop_price: float):
    return SimpleNamespace(
        position_id="P1",
        ticker="aapl",
        shares=100,
        entry_price=entry_price,
        stop_price=stop_price,
        entry_date="2026-01-01",
    )


def test_cache_matches_high_precision_entry_stored_raw():
    # nodes.py stores req values raw; the router builds expected rounded to 6 dp.
    pos = _pos(9.123456789, 8.987654321)
    expected = _position_cache_context(pos)
    cached = SimpleNamespace(
        inputs_used={
            "position_context": {
                "ticker": "AAPL",
                "position_id": "P1",
                "shares": 100,
                "entry_price": 9.123456789,  # raw, >6 decimals
                "stop": 8.987654321,
                "entry_date": "2026-01-01",
                "current_price": 9.5,
                "r_now": 1.2,
            }
        }
    )
    assert _cached_position_context_matches(cached, expected) is True


def test_cache_rejects_different_entry_price():
    pos = _pos(9.123456789, 8.987654321)
    expected = _position_cache_context(pos)
    cached = SimpleNamespace(
        inputs_used={
            "position_context": {
                "ticker": "AAPL",
                "position_id": "P1",
                "shares": 100,
                "entry_price": 12.5,
                "stop": 8.987654321,
                "entry_date": "2026-01-01",
            }
        }
    )
    assert _cached_position_context_matches(cached, expected) is False
