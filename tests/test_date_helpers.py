"""Tests for swing_screener.utils.date_helpers (previously untested)."""
from datetime import datetime

import numpy as np
import pandas as pd

from swing_screener.utils.date_helpers import (
    get_default_history_start,
    get_lookback_start_date,
    get_ytd_start_date,
    to_iso_date,
)


def test_lookback_start_subtracts_365_days_per_year():
    ref = datetime(2026, 2, 16)
    assert get_lookback_start_date(1, from_date=ref) == "2025-02-16"
    assert get_lookback_start_date(2, from_date=ref) == "2024-02-17"  # 2024 leap year


def test_default_history_start_delegates_to_lookback():
    ref = datetime(2026, 2, 16)
    assert get_default_history_start() == get_lookback_start_date(1)
    # default years is 1
    assert get_lookback_start_date(1, from_date=ref) == "2025-02-16"


def test_ytd_start_is_jan_first_of_reference_year():
    assert get_ytd_start_date(from_date=datetime(2026, 6, 12)) == "2026-01-01"
    assert get_ytd_start_date(from_date=datetime(2024, 12, 31)) == "2024-01-01"


def test_to_iso_date_handles_each_input_type():
    assert to_iso_date(datetime(2026, 2, 16, 9, 30)) == "2026-02-16"
    assert to_iso_date("2026-02-16") == "2026-02-16"
    assert to_iso_date(pd.Timestamp("2026-02-16T15:00:00")) == "2026-02-16"


def test_to_iso_date_returns_none_for_missing_values():
    assert to_iso_date(None) is None
    assert to_iso_date(float("nan")) is None
    assert to_iso_date(np.nan) is None
