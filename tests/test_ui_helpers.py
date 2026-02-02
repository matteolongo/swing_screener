import numpy as np
import pandas as pd

from ui.helpers import build_action_badge, build_degiro_entry_lines


def test_build_action_badge_buy_limit():
    row = pd.Series(
        {"suggested_order_type": "BUY_LIMIT", "suggested_order_price": 10.0}
    )
    badge = build_action_badge(row)
    assert badge["text"] == "🟢 PLACE BUY LIMIT"


def test_build_action_badge_buy_stop():
    row = pd.Series(
        {"suggested_order_type": "BUY_STOP", "suggested_order_price": 10.0}
    )
    badge = build_action_badge(row)
    assert badge["text"] == "🔵 PLACE BUY STOP"


def test_build_action_badge_skip():
    row = pd.Series({"suggested_order_type": "SKIP", "suggested_order_price": np.nan})
    badge = build_action_badge(row)
    assert badge["text"] == "⚪ SKIP TRADE"


def test_build_action_badge_incomplete():
    row = pd.Series({"suggested_order_type": "BUY_LIMIT", "suggested_order_price": np.nan})
    badge = build_action_badge(row)
    assert badge["text"] == "🟡 INCOMPLETE DATA"


def test_build_degiro_entry_lines_buy_limit():
    lines = build_degiro_entry_lines(
        order_type="BUY_LIMIT",
        order_price=10.5,
        stop_price=9.0,
        band_low=10.0,
        band_high=10.2,
        validity="day",
    )
    assert "Entry (Degiro: Limit): 10.50" in lines
    assert "Limit band: 10.00 - 10.20" in lines
    assert "Stop-loss (Degiro: Stop Loss): 9.00" in lines
    assert "Validity: DAY" in lines


def test_build_degiro_entry_lines_buy_stop():
    lines = build_degiro_entry_lines(
        order_type="BUY_STOP",
        order_price=11.0,
        stop_price=9.5,
    )
    assert "Entry (Degiro: Stop Limit): stop 11.00, limit 11.00" in lines
    assert "Stop-loss (Degiro: Stop Loss): 9.50" in lines
