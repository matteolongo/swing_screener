"""Health check and monitoring utilities for the API."""
from __future__ import annotations

import time
import threading
import tempfile
from pathlib import Path
from typing import Dict, Any
import json


class HealthChecker:
    """Health check for API dependencies and resources."""

    @staticmethod
    def _configured_state_files() -> dict[str, Path]:
        """Return the state files used by the configured repositories."""
        from swing_screener.settings import get_settings_manager

        manager = get_settings_manager()
        app_config = manager.get_app_config_payload()
        return {
            "positions": manager.resolve_runtime_path(
                "positions_file",
                app_config.get("positions_file", "data/positions.json"),
            ),
            "orders": manager.resolve_runtime_path(
                "orders_file",
                app_config.get("orders_file", "data/orders.json"),
            ),
        }

    @staticmethod
    def _check_json_state_file(path: Path) -> tuple[str, str | None]:
        """Check that a JSON state file is readable and its location writable."""
        parent = path.parent
        try:
            if not parent.is_dir():
                return "error", f"{path}: parent directory not found"

            if path.exists():
                json.loads(path.read_text(encoding="utf-8"))
                # Opening an existing file for append validates file-level write
                # access without changing its contents.
                with path.open("a", encoding="utf-8"):
                    pass

            # Repository writes also need to create lock/temporary files beside the
            # state file. Probe the directory without creating the state file itself.
            with tempfile.NamedTemporaryFile(dir=parent, prefix=".health-", delete=True):
                pass
        except json.JSONDecodeError:
            return "warning", f"{path}: invalid JSON"
        except PermissionError:
            return "error", f"{path}: permission denied"
        except OSError as exc:
            return "error", f"{path}: {type(exc).__name__}"
        return "ok", None

    @staticmethod
    def check_file_access(
        positions_file: Path | None = None,
        orders_file: Path | None = None,
    ) -> Dict[str, Any]:
        """Check configured position and order storage without mutating it."""
        configured = (
            HealthChecker._configured_state_files()
            if positions_file is None or orders_file is None
            else {}
        )
        files = {
            "positions": positions_file or configured["positions"],
            "orders": orders_file or configured["orders"],
        }

        statuses: dict[str, str] = {}
        issues: list[str] = []
        for name, path in files.items():
            status, issue = HealthChecker._check_json_state_file(path)
            statuses[name] = status
            if issue is not None:
                issues.append(issue)

        if "error" in statuses.values():
            overall_status = "unhealthy"
        elif "warning" in statuses.values():
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return {
            "status": overall_status,
            "positions_file": statuses["positions"],
            "orders_file": statuses["orders"],
            "issues": issues or None,
        }

    @staticmethod
    def check_data_directory() -> Dict[str, Any]:
        """Check that data directory is accessible."""
        try:
            data_dir = Path("data")
            if not data_dir.exists():
                return {"status": "warning", "message": "data/ directory not found"}

            # Check if we can list files
            list(data_dir.iterdir())

            return {"status": "ok"}
        except PermissionError:
            return {"status": "error", "message": "Permission denied"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}


class MetricsCollector:
    """Simple in-memory metrics collector.
    
    Thread-safe for concurrent access within a single process.
    Note: When running with multiple workers (e.g., uvicorn --workers 4),
    each process will have its own instance with separate counters.
    """
    
    def __init__(self):
        self._lock_contention_count = 0
        self._validation_failure_count = 0
        self._intelligence_deduped_events_total = 0
        self._intelligence_ingested_events_total: Dict[str, int] = {}
        self._intelligence_source_errors_total: Dict[str, int] = {}
        self._intelligence_source_blocked_total: Dict[str, int] = {}
        self._intelligence_mean_confidence: Dict[str, float] = {}
        self._intelligence_coverage_ratio: Dict[str, float] = {}
        self._start_time = time.time()
        self._lock = threading.Lock()
    
    def record_lock_contention(self):
        """Record a lock contention event."""
        with self._lock:
            self._lock_contention_count += 1
    
    def record_validation_failure(self):
        """Record a validation failure."""
        with self._lock:
            self._validation_failure_count += 1

    def record_intelligence_metrics(self, *, source_health: Dict[str, Dict[str, Any]], deduped_count: int) -> None:
        with self._lock:
            self._intelligence_deduped_events_total += max(0, int(deduped_count))
            for source, payload in source_health.items():
                key = str(source).strip().lower()
                if not key or not isinstance(payload, dict):
                    continue
                self._intelligence_ingested_events_total[key] = (
                    self._intelligence_ingested_events_total.get(key, 0)
                    + max(0, int(payload.get("event_count", 0)))
                )
                self._intelligence_source_errors_total[key] = (
                    self._intelligence_source_errors_total.get(key, 0)
                    + max(0, int(payload.get("error_count", 0)))
                )
                blocked_reasons = payload.get("blocked_reasons", [])
                blocked_count = int(payload.get("blocked_count", 0))
                if isinstance(blocked_reasons, list) and blocked_reasons:
                    for reason in blocked_reasons:
                        reason_key = str(reason).strip().lower()
                        if not reason_key:
                            continue
                        metrics_key = f"{key}:{reason_key}"
                        self._intelligence_source_blocked_total[metrics_key] = (
                            self._intelligence_source_blocked_total.get(metrics_key, 0) + max(1, blocked_count)
                        )
                elif blocked_count > 0:
                    metrics_key = f"{key}:unknown"
                    self._intelligence_source_blocked_total[metrics_key] = (
                        self._intelligence_source_blocked_total.get(metrics_key, 0) + blocked_count
                    )
                self._intelligence_mean_confidence[key] = float(payload.get("mean_confidence", 0.0))
                self._intelligence_coverage_ratio[key] = float(payload.get("coverage_ratio", 0.0))
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        uptime_seconds = time.time() - self._start_time
        
        return {
            "uptime_seconds": round(uptime_seconds, 2),
            "lock_contention_total": self._lock_contention_count,
            "validation_failures_total": self._validation_failure_count,
            "intelligence_ingested_events_total": dict(self._intelligence_ingested_events_total),
            "intelligence_deduped_events_total": self._intelligence_deduped_events_total,
            "intelligence_source_errors_total": dict(self._intelligence_source_errors_total),
            "intelligence_source_blocked_total": dict(self._intelligence_source_blocked_total),
            "intelligence_mean_confidence": dict(self._intelligence_mean_confidence),
            "intelligence_coverage_ratio": dict(self._intelligence_coverage_ratio),
        }
    
    def reset(self):
        """Reset all metrics (for testing)."""
        self._lock_contention_count = 0
        self._validation_failure_count = 0
        self._intelligence_deduped_events_total = 0
        self._intelligence_ingested_events_total = {}
        self._intelligence_source_errors_total = {}
        self._intelligence_source_blocked_total = {}
        self._intelligence_mean_confidence = {}
        self._intelligence_coverage_ratio = {}
        self._start_time = time.time()


# Global singleton instance
_metrics_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    return _metrics_collector
