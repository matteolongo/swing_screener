from __future__ import annotations
import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystReport
from swing_screener.settings.paths import data_dir

logger = logging.getLogger(__name__)


class CatalystStore:
    """Persist and retrieve catalyst reports and symbol opportunity index."""

    def _safe_report_filename(self, report_id: str) -> str:
        """Sanitize report_id for filesystem use; strips directory traversal attempts."""
        safe = Path(report_id).name  # strips any ../ components
        if not safe or safe == ".":
            raise ValueError(f"Invalid report_id for filesystem use: {report_id!r}")
        return f"{safe}.json"

    def _reports_dir(self, for_date: date) -> Path:
        d = data_dir() / "intelligence" / "catalyst_reports" / for_date.isoformat()
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _latest_ptr(self) -> Path:
        p = data_dir() / "intelligence" / "catalyst_reports"
        p.mkdir(parents=True, exist_ok=True)
        return p / "latest.json"

    def _symbol_index_path(self, for_date: date) -> Path:
        p = data_dir() / "intelligence" / "catalyst_reports" / "by_symbol"
        p.mkdir(parents=True, exist_ok=True)
        return p / f"{for_date.isoformat()}.json"

    def save_report(self, report: CatalystReport) -> None:
        today = datetime.now(timezone.utc).date()
        report_path = self._reports_dir(today) / self._safe_report_filename(report.report_id)
        report_path.write_text(report.model_dump_json(indent=2))
        self._latest_ptr().write_text(json.dumps({"report_id": report.report_id, "date": today.isoformat()}))

    def load_report(self, report_id: str, for_date: date | None = None) -> CatalystReport | None:
        search_date = for_date or datetime.now(timezone.utc).date()
        # Build path without mkdir — we're reading, not writing
        report_path = (
            data_dir() / "intelligence" / "catalyst_reports" / search_date.isoformat()
            / self._safe_report_filename(report_id)
        )
        if not report_path.exists():
            return None
        try:
            return CatalystReport.model_validate_json(report_path.read_text())
        except (ValueError, OSError) as exc:
            logger.warning("Failed to load catalyst report %s: %s", report_id, exc)
            return None

    def load_latest_report(self) -> CatalystReport | None:
        ptr = self._latest_ptr()
        if not ptr.exists():
            return None
        try:
            meta = json.loads(ptr.read_text())
            report_id = meta["report_id"]
            for_date = date.fromisoformat(meta["date"])
            return self.load_report(report_id, for_date)
        except (KeyError, ValueError, OSError) as exc:
            logger.warning("Failed to load latest catalyst report: %s", exc)
            return None

    def save_symbol_index(self, for_date: date, opportunities: list[CatalystOpportunity]) -> None:
        """Merge opportunities into today's index — last updated wins per ticker."""
        path = self._symbol_index_path(for_date)
        existing: dict = {}
        if path.exists():
            try:
                existing = json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                existing = {}
        for opp in opportunities:
            existing[opp.ticker.upper()] = json.loads(opp.model_dump_json())
        path.write_text(json.dumps(existing, indent=2))

    def load_symbol_opportunity(self, ticker: str, for_date: date | None = None) -> CatalystOpportunity | None:
        target_date = for_date or datetime.now(timezone.utc).date()
        path = self._symbol_index_path(target_date)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            entry = data.get(ticker.upper())
            if entry is None:
                return None
            return CatalystOpportunity.model_validate(entry)
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            logger.warning("Failed to load catalyst opportunity for %s: %s", ticker, exc)
            return None

    def load_symbol_index(self, for_date: date | None = None) -> dict[str, CatalystOpportunity]:
        target_date = for_date or datetime.now(timezone.utc).date()
        path = self._symbol_index_path(target_date)
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text())
            result: dict[str, CatalystOpportunity] = {}
            for ticker, entry in data.items():
                try:
                    result[ticker.upper()] = CatalystOpportunity.model_validate(entry)
                except ValueError:
                    continue
            return result
        except (json.JSONDecodeError, OSError):
            return {}
