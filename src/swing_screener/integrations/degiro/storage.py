"""Persist DeGiro audit runs to disk as markdown + JSON artifacts."""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from swing_screener.integrations.degiro.models import DegiroAuditRecord, DegiroAuditRun


def _record_to_dict(record: DegiroAuditRecord) -> dict:
    return {
        "product_id": record.product_id,
        "isin": record.isin,
        "vwd_id": record.vwd_id,
        "name": record.name,
        "exchange": record.exchange,
        "currency": record.currency,
        "symbol": record.symbol,
        "has_quote": record.has_quote,
        "has_chart": record.has_chart,
        "has_profile": record.has_profile,
        "has_ratios": record.has_ratios,
        "has_statements": record.has_statements,
        "has_estimates": record.has_estimates,
        "has_agenda": record.has_agenda,
        "has_news": record.has_news,
        "resolution_confidence": record.resolution_confidence,
        "resolution_notes": record.resolution_notes,
    }


def _build_summary_md(run: DegiroAuditRun) -> str:
    lines = [
        f"# DeGiro Capability Audit — {run.audit_id}",
        "",
        f"**Created:** {run.created_at}",
        f"**Symbols:** {', '.join(run.symbols)}",
        "",
        "## Summary Counts",
        "",
    ]
    for key, val in sorted(run.summary_counts.items()):
        lines.append(f"- **{key}**: {val}")

    lines += [
        "",
        "## Per-Symbol Results",
        "",
        "| Symbol | Name | ISIN | Exchange | Currency | Quote | Profile | Statements | News | Confidence |",
        "|--------|------|------|----------|----------|-------|---------|------------|------|------------|",
    ]
    for r in run.results:
        def yn(v: bool) -> str:
            return "✓" if v else "✗"
        lines.append(
            f"| {r.symbol or '?'} | {r.name} | {r.isin or '—'} | {r.exchange or '—'} "
            f"| {r.currency or '—'} | {yn(r.has_quote)} | {yn(r.has_profile)} "
            f"| {yn(r.has_statements)} | {yn(r.has_news)} | {r.resolution_confidence} |"
        )

    return "\n".join(lines) + "\n"


def save_audit_run(run: DegiroAuditRun, base_path: str | Path) -> dict[str, str]:
    """Write audit artifacts to *base_path* and return a dict of artifact paths."""
    out_dir = Path(base_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    summary_path = out_dir / f"{run.audit_id}_summary.md"
    json_path = out_dir / f"{run.audit_id}_normalized.json"

    summary_path.write_text(_build_summary_md(run), encoding="utf-8")

    payload = {
        "audit_id": run.audit_id,
        "created_at": run.created_at,
        "symbols": list(run.symbols),
        "summary_counts": run.summary_counts,
        "results": [_record_to_dict(r) for r in run.results],
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "summary_md": str(summary_path),
        "normalized_json": str(json_path),
    }
