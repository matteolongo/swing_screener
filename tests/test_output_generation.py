import pandas as pd

from swing_screener.portfolio.state import Position, PositionUpdate, save_positions
from ui.flows.manage import run_manage
import ui.app as ui_app
from ui.helpers import load_positions_to_dataframe


def _make_ohlcv(tickers: list[str], periods: int = 260) -> pd.DataFrame:
    idx = pd.bdate_range("2023-01-02", periods=periods)

    data = {}
    for i, ticker in enumerate(tickers):
        base = 100 + i * 20
        close = pd.Series(range(base, base + periods), index=idx, dtype=float)
        close.iloc[-1] = close.iloc[-2] + 30
        open_ = close
        high = close + 1.0
        low = close - 1.0
        vol = pd.Series(1_000_000, index=idx, dtype=float)

        data[("Open", ticker)] = open_
        data[("High", ticker)] = high
        data[("Low", ticker)] = low
        data[("Close", ticker)] = close
        data[("Volume", ticker)] = vol

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_run_manage_writes_outputs(tmp_path, monkeypatch):
    positions_path = tmp_path / "positions.json"
    manage_csv_path = tmp_path / "manage.csv"
    md_path = tmp_path / "degiro_actions.md"

    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-10",
        entry_price=100.0,
        stop_price=95.0,
        shares=10,
    )
    save_positions(positions_path, [pos], asof="2026-02-01")
    edited_df = load_positions_to_dataframe(str(positions_path))

    updates = [
        PositionUpdate(
            ticker="AAA",
            status="open",
            last=110.0,
            entry=100.0,
            stop_old=95.0,
            stop_suggested=100.0,
            shares=10,
            r_now=1.0,
            action="MOVE_STOP_UP",
            reason="test",
        )
    ]

    def _stub_fetch_ohlcv(tickers, config, use_cache, force_refresh):
        return _make_ohlcv([t.upper() for t in tickers], periods=260)

    def _stub_evaluate_positions(ohlcv, positions, cfg):
        return updates, positions

    monkeypatch.setattr("ui.flows.manage.fetch_ohlcv", _stub_fetch_ohlcv)
    monkeypatch.setattr("ui.flows.manage.evaluate_positions", _stub_evaluate_positions)

    df, md_text = run_manage(
        positions_path=str(positions_path),
        edited_df=edited_df,
        apply_updates=False,
        use_cache=True,
        force_refresh=False,
        manage_csv_path=str(manage_csv_path),
        md_path=str(md_path),
    )

    assert not df.empty
    assert manage_csv_path.exists()
    assert md_path.exists()

    csv_df = pd.read_csv(manage_csv_path)
    assert {"ticker", "action", "stop_suggested"}.issubset(set(csv_df.columns))
    assert "# Degiro Actions" in md_text
    assert "## 1) MOVE STOP" in md_text


def test_run_screener_writes_report_csv(tmp_path, monkeypatch):
    report_path = tmp_path / "report.csv"

    def _stub_universe(universe, cfg):
        return ["AAA", "SPY"]

    def _stub_fetch_ohlcv(tickers, config, use_cache, force_refresh):
        return _make_ohlcv([t.upper() for t in tickers], periods=260)

    def _stub_meta(tickers, cache_path, use_cache, force_refresh):
        tickers = [t.upper() for t in tickers]
        return pd.DataFrame(
            {
                "name": ["SPY ETF" if t == "SPY" else f"{t} Inc" for t in tickers],
                "currency": ["USD" for _ in tickers],
                "exchange": ["NYSE" for _ in tickers],
            },
            index=tickers,
        )

    monkeypatch.setattr(ui_app, "load_universe_from_package", _stub_universe)
    monkeypatch.setattr(ui_app, "fetch_ohlcv", _stub_fetch_ohlcv)
    monkeypatch.setattr(ui_app, "fetch_ticker_metadata", _stub_meta)

    report, _ = ui_app._run_screener(
        universe="mega",
        top_n=10,
        account_size=100_000,
        risk_pct=1.0,
        k_atr=2.0,
        max_position_pct=0.60,
        use_cache=True,
        force_refresh=False,
        report_path=str(report_path),
        min_price=1.0,
        max_price=1_000.0,
        max_atr_pct=100.0,
        require_trend_ok=False,
    )

    assert not report.empty
    assert report_path.exists()

    report_df = pd.read_csv(report_path, index_col=0)
    assert {"signal", "entry", "stop"}.issubset(set(report_df.columns))
    assert {"name", "currency", "exchange"}.issubset(set(report_df.columns))
