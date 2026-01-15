import numpy as np
import pandas as pd

from ui.helpers import build_action_badge


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
