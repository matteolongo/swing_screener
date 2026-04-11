"""Screener history repository — tracks which tickers appear each day."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from api.utils.file_lock import locked_read_json, locked_write_json

@dataclass
class ScreenerHistoryRepository:
    path: Path  # data/screener_history.json

    def _read(self) -> dict[str, list[str]]:
        """Returns {date_str: [ticker, ...]} dict."""
        if not self.path.exists():
            return {}
        payload = locked_read_json(self.path)
        if not isinstance(payload, dict):
            return {}
        return payload.get("history", {})

    def record_run(self, run_date: str, tickers: list[str]) -> None:
        """Record tickers seen on a given date (idempotent, merges with existing)."""
        history = self._read()
        existing = set(history.get(run_date, []))
        existing.update(t.upper() for t in tickers)
        history[run_date] = sorted(existing)
        # Keep only last 90 days
        all_dates = sorted(history.keys())
        if len(all_dates) > 90:
            for old_date in all_dates[:-90]:
                del history[old_date]
        locked_write_json(self.path, {"history": history})

    def get_recurrence(self) -> list[dict]:
        """Return per-ticker appearance stats: ticker, days_seen, streak, last_seen."""
        history = self._read()
        if not history:
            return []
        sorted_dates = sorted(history.keys())
        ticker_dates: dict[str, list[str]] = {}
        for d, tickers in history.items():
            for ticker in tickers:
                ticker_dates.setdefault(ticker, []).append(d)

        results = []
        today = date.today().isoformat()
        for ticker, dates in ticker_dates.items():
            dates_sorted = sorted(dates)
            days_seen = len(dates_sorted)
            last_seen = dates_sorted[-1]
            # Compute streak: consecutive days ending at last_seen
            streak = 0
            for d in reversed(sorted_dates):
                if ticker in history.get(d, []):
                    streak += 1
                else:
                    break
            results.append({
                "ticker": ticker,
                "days_seen": days_seen,
                "streak": streak,
                "last_seen": last_seen,
            })
        return sorted(results, key=lambda x: (-x["streak"], x["ticker"]))
