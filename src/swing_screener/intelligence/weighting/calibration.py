from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from swing_screener.intelligence.weighting.models import EvidenceLedger
from swing_screener.settings.paths import data_dir


@dataclass(frozen=True)
class CalibrationSample:
    sweep_date: str
    ticker: str
    action: str
    conviction: str
    summary_line: str
    ledger: EvidenceLedger

    @property
    def balance_label(self) -> str:
        return self.ledger.balance_label

    @property
    def bull_weight(self) -> float:
        return self.ledger.bull_weight

    @property
    def bear_weight(self) -> float:
        return self.ledger.bear_weight

    @property
    def net(self) -> float:
        return self.ledger.net

    @property
    def top_bullish(self) -> str:
        return _top_contributions(self.ledger, positive=True)

    @property
    def top_bearish(self) -> str:
        return _top_contributions(self.ledger, positive=False)


def collect_samples(
    intelligence_root: Path | None = None,
    *,
    limit: int | None = None,
) -> list[CalibrationSample]:
    """Collect ledger-bearing sweep entries, newest sweep file first."""
    root = intelligence_root or data_dir() / "intelligence"
    samples: list[CalibrationSample] = []
    for path in sorted(root.glob("sweep_*.json"), reverse=True):
        sweep_date = _date_from_sweep(path)
        payload = _load_json_object(path)
        if payload is None:
            continue
        for ticker in sorted(payload):
            entry = payload.get(ticker)
            if not isinstance(entry, dict):
                continue
            ledger = _ledger_from_entry(entry)
            if ledger is None:
                continue
            samples.append(
                CalibrationSample(
                    sweep_date=sweep_date,
                    ticker=ticker.upper(),
                    action=str(entry.get("action") or ""),
                    conviction=str(entry.get("conviction") or ""),
                    summary_line=str(entry.get("summary_line") or ""),
                    ledger=ledger,
                )
            )
            if limit is not None and len(samples) >= limit:
                return samples
    return samples


def render_csv(samples: list[CalibrationSample]) -> str:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=_CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    for sample in samples:
        writer.writerow(_row(sample))
    return out.getvalue()


def render_markdown(samples: list[CalibrationSample]) -> str:
    lines = [
        "# Evidence Ledger Calibration Sample",
        "",
        "Use `Human read` and `Notes` while reviewing whether the ledger label matches the setup.",
        "",
        "| Date | Ticker | Action | Conviction | Label | Net | Top bullish | Top bearish | Human read | Notes |",
        "| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |",
    ]
    for sample in samples:
        lines.append(
            "| {date} | {ticker} | {action} | {conviction} | {label} | {net} | {bull} | {bear} |  |  |".format(
                date=_md(sample.sweep_date),
                ticker=_md(sample.ticker),
                action=_md(sample.action),
                conviction=_md(sample.conviction),
                label=_md(sample.balance_label),
                net=_format_number(sample.net),
                bull=_md(sample.top_bullish),
                bear=_md(sample.top_bearish),
            )
        )
    if not samples:
        lines.append("|  |  |  |  |  |  |  |  |  |  |")
    lines.append("")
    return "\n".join(lines)


_CSV_FIELDS = [
    "sweep_date",
    "ticker",
    "action",
    "conviction",
    "balance_label",
    "bull_weight",
    "bear_weight",
    "net",
    "top_bullish",
    "top_bearish",
    "summary_line",
    "human_read",
    "notes",
]


def _row(sample: CalibrationSample) -> dict[str, str]:
    return {
        "sweep_date": sample.sweep_date,
        "ticker": sample.ticker,
        "action": sample.action,
        "conviction": sample.conviction,
        "balance_label": sample.balance_label,
        "bull_weight": _format_number(sample.bull_weight),
        "bear_weight": _format_number(sample.bear_weight),
        "net": _format_number(sample.net),
        "top_bullish": sample.top_bullish,
        "top_bearish": sample.top_bearish,
        "summary_line": sample.summary_line,
        "human_read": "",
        "notes": "",
    }


def _load_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _ledger_from_entry(entry: dict[str, Any]) -> EvidenceLedger | None:
    raw = entry.get("evidence_ledger")
    if not isinstance(raw, dict):
        return None
    try:
        return EvidenceLedger.model_validate(raw)
    except ValueError:
        return None


def _date_from_sweep(path: Path) -> str:
    stem = path.stem
    return stem.removeprefix("sweep_")


def _top_contributions(ledger: EvidenceLedger, *, positive: bool) -> str:
    contributions = [
        signal for signal in ledger.contributions
        if (signal.contribution > 0 if positive else signal.contribution < 0)
    ]
    contributions.sort(key=lambda signal: abs(signal.contribution), reverse=True)
    return "; ".join(
        f"{signal.key}:{_signed_number(signal.contribution)}"
        for signal in contributions[:3]
    )


def _format_number(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _signed_number(value: float) -> str:
    formatted = _format_number(value)
    return formatted if value < 0 else f"+{formatted}"


def _md(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")
