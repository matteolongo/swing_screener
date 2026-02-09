from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import pandas as pd

from swing_screener.social.cache import SocialCache


ExportFormat = Literal["parquet", "csv"]
ExportScope = Literal["events", "metrics", "both"]


def _read_json_list(path: Path) -> list[dict]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return []


def load_events_df(cache: SocialCache, provider: str = "reddit") -> pd.DataFrame:
    root = cache._root()  # local cache root
    events_dir = root / "events" / provider
    if not events_dir.exists():
        return pd.DataFrame()

    rows: list[dict] = []
    for path in sorted(events_dir.glob("*.json")):
        day = path.stem
        for item in _read_json_list(path):
            row = dict(item)
            row["cache_date"] = day
            rows.append(row)

    return pd.DataFrame(rows)


def load_metrics_df(cache: SocialCache) -> pd.DataFrame:
    root = cache._root()
    metrics_dir = root / "metrics"
    if not metrics_dir.exists():
        return pd.DataFrame()

    rows: list[dict] = []
    for path in sorted(metrics_dir.glob("*.json")):
        day = path.stem
        for item in _read_json_list(path):
            row = dict(item)
            row["cache_date"] = day
            rows.append(row)

    return pd.DataFrame(rows)


def _normalize_for_parquet(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    for col in df.columns:
        if df[col].map(lambda v: isinstance(v, (dict, list))).any():
            df[col] = df[col].apply(
                lambda v: json.dumps(v, sort_keys=True) if isinstance(v, (dict, list)) else v
            )
    return df


def export_social_cache(
    cache: SocialCache,
    out_dir: Path,
    fmt: ExportFormat = "parquet",
    scope: ExportScope = "both",
    provider: str = "reddit",
) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    saved: dict[str, str] = {}

    if scope in ("events", "both"):
        df = load_events_df(cache, provider=provider)
        if not df.empty:
            path = out_dir / f"social_events.{fmt}"
            if fmt == "parquet":
                df = _normalize_for_parquet(df)
                df.to_parquet(path, index=False)
            else:
                df.to_csv(path, index=False)
            saved["events"] = str(path)

    if scope in ("metrics", "both"):
        df = load_metrics_df(cache)
        if not df.empty:
            path = out_dir / f"social_metrics.{fmt}"
            if fmt == "parquet":
                df = _normalize_for_parquet(df)
                df.to_parquet(path, index=False)
            else:
                df.to_csv(path, index=False)
            saved["metrics"] = str(path)

    return saved
