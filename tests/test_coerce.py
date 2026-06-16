import math
import pandas as pd
from swing_screener.utils.coerce import (
    is_na_scalar, safe_float, safe_optional_float, safe_optional_int, safe_list,
)


def test_is_na_scalar_detects_none_and_nan():
    assert is_na_scalar(None) is True
    assert is_na_scalar(float("nan")) is True
    assert is_na_scalar(1.5) is False


def test_safe_float_defaults_on_na():
    assert safe_float(None) == 0.0
    assert safe_float(float("nan")) == 0.0
    assert safe_float("2.5") == 2.5


def test_safe_optional_float_returns_none_on_na():
    assert safe_optional_float(None) is None
    assert safe_optional_float(3) == 3.0


def test_safe_optional_int_returns_none_on_na():
    assert safe_optional_int(None) is None
    assert safe_optional_int(4.0) == 4


def test_safe_list_wraps_and_filters():
    assert safe_list(None) == []
    assert safe_list([1, 2]) == ["1", "2"]
