#!/usr/bin/env python
from __future__ import annotations

import argparse
from pathlib import Path

from swing_screener.intelligence.weighting.calibration import (
    collect_samples,
    render_csv,
    render_markdown,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export cached evidence ledgers for manual weight calibration."
    )
    parser.add_argument(
        "--intelligence-root",
        type=Path,
        default=None,
        help="Directory containing sweep_YYYY-MM-DD.json files. Defaults to data/intelligence.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "csv"),
        default="markdown",
        help="Output format.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Maximum samples to export.")
    parser.add_argument("--output", type=Path, default=None, help="Write output to this file.")
    args = parser.parse_args()

    samples = collect_samples(args.intelligence_root, limit=args.limit)
    rendered = render_csv(samples) if args.format == "csv" else render_markdown(samples)
    if args.output is None:
        print(rendered, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
