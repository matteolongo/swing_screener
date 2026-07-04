from __future__ import annotations

import csv
import json
from pathlib import Path

from swing_screener.intelligence.weighting.calibration import (
    collect_samples,
    render_csv,
    render_markdown,
)


def _ledger(label: str = "bullish", net: float = 16.0) -> dict:
    return {
        "contributions": [
            {
                "key": "sma_trend",
                "label": "Price above SMA trend",
                "category": "technical",
                "direction": "bullish",
                "weight": 6.0,
                "contribution": 6.0,
                "source": "OHLCV SMAs",
            },
            {
                "key": "insider_activity",
                "label": "Net insider selling",
                "category": "positioning",
                "direction": "bearish",
                "weight": 10.0,
                "contribution": -10.0,
                "source": "Finnhub insider 90d",
            },
        ],
        "bull_weight": 6.0,
        "bear_weight": 10.0,
        "net": net,
        "balance_label": label,
    }


def _write_sweep(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_collect_samples_reads_sweeps_and_skips_entries_without_ledgers(tmp_path):
    root = tmp_path / "intelligence"
    root.mkdir()
    _write_sweep(
        root / "sweep_2026-07-01.json",
        {
            "AAPL": {
                "action": "WATCH",
                "conviction": "MEDIUM",
                "summary_line": "Setup is constructive.",
                "evidence_ledger": _ledger(),
            },
            "MSFT": {"action": "WAIT", "summary_line": "Old cache without ledger."},
        },
    )
    _write_sweep(
        root / "sweep_2026-07-02.json",
        {
            "TSLA": {
                "action": "AVOID",
                "conviction": "LOW",
                "summary_line": "Mixed tape.",
                "evidence_ledger": _ledger("mixed", 0.0),
            }
        },
    )

    samples = collect_samples(root)

    assert [sample.ticker for sample in samples] == ["TSLA", "AAPL"]
    assert samples[0].sweep_date == "2026-07-02"
    assert samples[0].balance_label == "mixed"
    assert samples[1].top_bullish == "sma_trend:+6"
    assert samples[1].top_bearish == "insider_activity:-10"


def test_render_csv_includes_review_columns(tmp_path):
    root = tmp_path / "intelligence"
    root.mkdir()
    _write_sweep(
        root / "sweep_2026-07-01.json",
        {
            "AAPL": {
                "action": "WATCH",
                "conviction": "MEDIUM",
                "summary_line": "Setup is constructive.",
                "evidence_ledger": _ledger(),
            }
        },
    )

    rows = list(csv.DictReader(render_csv(collect_samples(root)).splitlines()))

    assert rows == [
        {
            "sweep_date": "2026-07-01",
            "ticker": "AAPL",
            "action": "WATCH",
            "conviction": "MEDIUM",
            "balance_label": "bullish",
            "bull_weight": "6",
            "bear_weight": "10",
            "net": "16",
            "top_bullish": "sma_trend:+6",
            "top_bearish": "insider_activity:-10",
            "summary_line": "Setup is constructive.",
            "human_read": "",
            "notes": "",
        }
    ]


def test_render_markdown_groups_review_ready_rows(tmp_path):
    root = tmp_path / "intelligence"
    root.mkdir()
    _write_sweep(
        root / "sweep_2026-07-01.json",
        {
            "AAPL": {
                "action": "WATCH",
                "conviction": "MEDIUM",
                "summary_line": "Setup is constructive.",
                "evidence_ledger": _ledger(),
            }
        },
    )

    rendered = render_markdown(collect_samples(root))

    assert "Evidence Ledger Calibration Sample" in rendered
    assert "| 2026-07-01 | AAPL | WATCH | MEDIUM | bullish | 16 |" in rendered
    assert "Human read" in rendered
