"""Common helper functions used across the swing_screener module."""

from __future__ import annotations

from typing import Any, Iterable, Optional


def normalize_tickers(tickers: Iterable[str]) -> list[str]:
    """Normalize and deduplicate ticker list.
    
    Args:
        tickers: Iterable of ticker symbols
        
    Returns:
        List of normalized, deduplicated ticker symbols (uppercase, stripped)
        
    Raises:
        ValueError: If the resulting ticker list is empty
    """
    out = []
    for t in tickers:
        t = t.strip().upper()
        if t and t not in out:
            out.append(t)
    if not out:
        raise ValueError("tickers is empty.")
    return out


def get_nested_dict(payload: dict, *keys: str, default: Optional[dict] = None) -> dict:
    """Safely extract nested dictionary value from a nested structure.
    
    Args:
        payload: The dictionary to traverse
        *keys: Path of keys to follow
        default: Default value to return if path doesn't exist or isn't a dict
        
    Returns:
        The nested dictionary, or default/empty dict if not found
        
    Example:
        >>> data = {"a": {"b": {"c": 123}}}
        >>> get_nested_dict(data, "a", "b")
        {"c": 123}
    """
    out: Any = payload
    for key in keys:
        if not isinstance(out, dict):
            return default or {}
        out = out.get(key, {})
    return out if isinstance(out, dict) else (default or {})
