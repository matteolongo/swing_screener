from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ExitReason = Literal["stop_hit", "time_exit", "exit_signal", "open"]


@dataclass(frozen=True)
class Trade:
    """One simulated round-trip produced by the event study.

    R-multiples are per-share-normalised (``1R = entry - initial_stop``), so the
    ledger measures edge independently of position sizing or account currency.
    """

    ticker: str
    setup: str  # breakout | pullback | both
    entry_date: str
    entry_price: float
    initial_stop: float
    initial_risk: float
    target: float
    exit_date: str
    exit_price: float
    exit_reason: ExitReason
    r_multiple: float
    bars_held: int
    mfe_r: float  # max favourable excursion, in R (close-based)
    mae_r: float  # max adverse excursion, in R (close-based)
    pattern_stop_fired: bool
