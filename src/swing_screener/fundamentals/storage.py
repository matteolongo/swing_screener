from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from swing_screener.fundamentals.models import FundamentalSnapshot
from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli


def _coerce_datetime(value: str | None) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


class FundamentalsStorage:
    def __init__(self, root_dir: str | Path = "data/fundamentals") -> None:
        self.root_dir = Path(root_dir)
        self.snapshots_dir = self.root_dir / "snapshots"
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

    def snapshot_path(self, symbol: str) -> Path:
        return self.snapshots_dir / f"{symbol.strip().upper()}.json"

    def load_snapshot(self, symbol: str) -> FundamentalSnapshot | None:
        path = self.snapshot_path(symbol)
        if not path.exists():
            return None
        try:
            payload = locked_read_json_cli(path)
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        return FundamentalSnapshot.from_dict(payload)

    def save_snapshot(self, snapshot: FundamentalSnapshot) -> Path:
        path = self.snapshot_path(snapshot.symbol)
        locked_write_json_cli(path, snapshot.to_dict())
        return path

    def is_snapshot_expired(self, snapshot: FundamentalSnapshot, ttl_hours: int) -> bool:
        updated_at = _coerce_datetime(snapshot.updated_at)
        if updated_at is None:
            return True
        now = datetime.now(timezone.utc if updated_at.tzinfo else None)
        age_seconds = (now - updated_at).total_seconds()
        return age_seconds > max(1, int(ttl_hours)) * 3600
