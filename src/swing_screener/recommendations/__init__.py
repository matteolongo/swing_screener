"""Compatibility shim for legacy recommendation imports."""

from swing_screener.recommendations.engine import build_recommendation
from swing_screener.recommendations.thesis import build_trade_thesis, thesis_to_dict

__all__ = ["build_recommendation", "build_trade_thesis", "thesis_to_dict"]
