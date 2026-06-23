from __future__ import annotations

from dataclasses import dataclass, field

from swing_screener.backtest.ledger import Trade


@dataclass(frozen=True)
class BacktestMetrics:
    """Aggregate R-distribution summary for a set of simulated trades.

    All edge metrics are in R-multiples so they are comparable across symbols
    and config variants regardless of price level or position size.
    """

    n_trades: int
    win_rate: float
    expectancy_r: float  # mean R per trade
    total_r: float
    profit_factor: float  # sum(win R) / abs(sum(loss R)); inf when no losses
    avg_win_r: float
    avg_loss_r: float
    avg_bars_held: float
    max_drawdown_r: float  # worst peak-to-trough drop of the cumulative-R curve
    exit_reason_counts: dict[str, int] = field(default_factory=dict)
    by_setup: dict[str, "BacktestMetrics"] = field(default_factory=dict)


def _zeroed() -> BacktestMetrics:
    return BacktestMetrics(
        n_trades=0,
        win_rate=0.0,
        expectancy_r=0.0,
        total_r=0.0,
        profit_factor=0.0,
        avg_win_r=0.0,
        avg_loss_r=0.0,
        avg_bars_held=0.0,
        max_drawdown_r=0.0,
        exit_reason_counts={},
        by_setup={},
    )


def compute_metrics(trades: list[Trade], *, _nested: bool = False) -> BacktestMetrics:
    """Summarise a trade list. Pass ``_nested`` internally to skip per-setup splits."""
    if not trades:
        return _zeroed()

    rs = [t.r_multiple for t in trades]
    wins = [r for r in rs if r > 0]
    losses = [r for r in rs if r < 0]
    n = len(trades)

    gross_win = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = (
        float("inf")
        if gross_loss == 0 and gross_win > 0
        else (gross_win / gross_loss if gross_loss > 0 else 0.0)
    )

    exit_counts: dict[str, int] = {}
    for t in trades:
        exit_counts[t.exit_reason] = exit_counts.get(t.exit_reason, 0) + 1

    by_setup: dict[str, BacktestMetrics] = {}
    if not _nested:
        setups: dict[str, list[Trade]] = {}
        for t in trades:
            setups.setdefault(t.setup, []).append(t)
        by_setup = {k: compute_metrics(v, _nested=True) for k, v in setups.items()}

    return BacktestMetrics(
        n_trades=n,
        win_rate=len(wins) / n,
        expectancy_r=sum(rs) / n,
        total_r=sum(rs),
        profit_factor=profit_factor,
        avg_win_r=(gross_win / len(wins)) if wins else 0.0,
        avg_loss_r=(sum(losses) / len(losses)) if losses else 0.0,
        avg_bars_held=sum(t.bars_held for t in trades) / n,
        max_drawdown_r=_max_drawdown_r(rs),
        exit_reason_counts=exit_counts,
        by_setup=by_setup,
    )


def _max_drawdown_r(rs: list[float]) -> float:
    """Largest peak-to-trough drop of the cumulative-R equity curve, in R."""
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for r in rs:
        equity += r
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    return max_dd
