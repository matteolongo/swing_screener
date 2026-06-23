"""Event-study backtesting: replay the live signal/stop/exit decision path over history.

This module owns no trading logic of its own. It orchestrates the same production
functions the live screener and portfolio manager use, fed point-in-time data, so a
backtest validates real behaviour rather than a parallel reimplementation.
"""

from swing_screener.backtest.config import BacktestConfig
from swing_screener.backtest.ledger import Trade
from swing_screener.backtest.event_study import EventStudyResult, run_event_study

__all__ = ["BacktestConfig", "Trade", "EventStudyResult", "run_event_study"]
