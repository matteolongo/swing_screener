"""Bounded in-memory fixed-window request limiting."""
from __future__ import annotations

import math
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

from api.security.settings import AuthSettings


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int
    remaining: int


@dataclass
class _Window:
    started_at: float
    count: int


class FixedWindowRateLimiter:
    def __init__(self, *, max_buckets: int, window_seconds: int = 60) -> None:
        self._max_buckets = max_buckets
        self._window_seconds = window_seconds
        self._windows: OrderedDict[str, _Window] = OrderedDict()
        self._lock = threading.Lock()

    def check(
        self, key: str, limit: int, now: float | None = None
    ) -> RateLimitDecision:
        current = time.monotonic() if now is None else now
        with self._lock:
            expired = [
                existing_key
                for existing_key, window in self._windows.items()
                if window.started_at + self._window_seconds <= current
            ]
            for existing_key in expired:
                self._windows.pop(existing_key, None)

            window = self._windows.get(key)
            if window is None:
                if len(self._windows) >= self._max_buckets:
                    next_expiry = min(
                        item.started_at + self._window_seconds
                        for item in self._windows.values()
                    )
                    return RateLimitDecision(
                        allowed=False,
                        retry_after_seconds=max(1, math.ceil(next_expiry - current)),
                        remaining=0,
                    )
                self._windows[key] = _Window(started_at=current, count=1)
                return RateLimitDecision(True, 0, max(0, limit - 1))

            self._windows.move_to_end(key)
            retry_after = max(
                1,
                math.ceil(window.started_at + self._window_seconds - current),
            )
            if window.count >= limit:
                return RateLimitDecision(False, retry_after, 0)
            window.count += 1
            return RateLimitDecision(True, 0, max(0, limit - window.count))


def rate_policy(path: str, method: str, settings: AuthSettings) -> int:
    if path == "/api/intelligence/sweep":
        return settings.rate_limit_sweep_per_minute
    if path.startswith(
        ("/api/screener", "/api/backtest", "/api/intelligence")
    ):
        return settings.rate_limit_expensive_per_minute
    if method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        return settings.rate_limit_mutation_per_minute
    return settings.rate_limit_default_per_minute
