import pandas as pd


def is_na_scalar(val) -> bool:
    if val is None:
        return True
    if isinstance(val, (list, tuple, set, dict)):
        return False
    try:
        return bool(pd.isna(val))
    except (TypeError, ValueError):
        return False


def safe_float(val, default=0.0):
    if is_na_scalar(val):
        return default
    return float(val)


def safe_optional_float(val):
    if is_na_scalar(val):
        return None
    return float(val)


def safe_optional_int(val):
    if is_na_scalar(val):
        return None
    try:
        return int(val)
    except (TypeError, ValueError, OverflowError):
        return None


def safe_list(val):
    if is_na_scalar(val):
        return []
    if isinstance(val, list):
        return [str(v) for v in val if not is_na_scalar(v)]
    if isinstance(val, str):
        if not val.strip():
            return []
        sep = ";" if ";" in val else "," if "," in val else None
        if sep:
            return [v.strip() for v in val.split(sep) if v.strip()]
        return [val]
    return [str(val)]
