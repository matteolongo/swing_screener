from __future__ import annotations

from pathlib import Path

import pandas as pd

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.portfolio.state import (
    load_positions,
    evaluate_positions,
    updates_to_dataframe,
    apply_stop_updates,
    render_degiro_actions_md,
    save_positions,
    ManageConfig,
)
from ui.helpers import dataframe_to_positions, ensure_parent_dir


def _dedup_keep_order(items: list[str]) -> list[str]:
    out: list[str] = []
    for x in items:
        x = x.strip().upper()
        if x and x not in out:
            out.append(x)
    return out


def run_manage(
    positions_path: str,
    edited_df: pd.DataFrame,
    apply_updates: bool,
    use_cache: bool,
    force_refresh: bool,
    manage_csv_path: str,
    md_path: str,
) -> tuple[pd.DataFrame, str]:
    existing_positions = load_positions(positions_path)
    positions = dataframe_to_positions(edited_df, existing_positions)

    open_tickers = [p.ticker for p in positions if p.status == "open"]
    if not open_tickers:
        save_positions(positions_path, positions, asof=str(pd.Timestamp.now().date()))
        return pd.DataFrame(), render_degiro_actions_md([])

    tickers = _dedup_keep_order(open_tickers)
    if "SPY" not in tickers:
        tickers.append("SPY")

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    updates, new_positions = evaluate_positions(ohlcv, positions, ManageConfig())

    if apply_updates:
        new_positions = apply_stop_updates(new_positions, updates)

    save_positions(positions_path, new_positions, asof=str(pd.Timestamp.now().date()))

    df = updates_to_dataframe(updates)
    ensure_parent_dir(manage_csv_path)
    df.to_csv(manage_csv_path)

    md_text = render_degiro_actions_md(updates)
    ensure_parent_dir(md_path)
    Path(md_path).write_text(md_text, encoding="utf-8")

    return df, md_text
