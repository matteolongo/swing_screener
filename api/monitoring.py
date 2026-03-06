"""Health check and monitoring utilities for the API."""
from __future__ import annotations

import time
import threading
from pathlib import Path
from typing import Dict, Any
import json


class HealthChecker:
    """Health check for API dependencies and resources."""
    
    @staticmethod
    def check_file_access() -> Dict[str, Any]:
        """Check that critical files are accessible.
        
        Note: This method has a side effect - it will create positions.json
        and orders.json with empty list content if they don't exist.
        """
        # Use hardcoded paths instead of importing (avoid circular deps)
        positions_file = Path("positions.json")
        orders_file = Path("orders.json")
        
        issues = []
        
        # Check positions.json
        try:
            if not positions_file.exists():
                # File doesn't exist yet - that's ok, will be created
                positions_file.parent.mkdir(parents=True, exist_ok=True)
                positions_file.write_text("[]")
            
            # Try to read
            with open(positions_file, "r") as f:
                json.load(f)
            
            positions_status = "ok"
        except PermissionError:
            positions_status = "error"
            issues.append("positions.json: permission denied")
        except json.JSONDecodeError:
            positions_status = "warning"
            issues.append("positions.json: invalid JSON")
        except Exception as exc:
            positions_status = "error"
            issues.append(f"positions.json: {type(exc).__name__}")
        
        # Check orders.json
        try:
            if not orders_file.exists():
                orders_file.parent.mkdir(parents=True, exist_ok=True)
                orders_file.write_text("[]")
            
            with open(orders_file, "r") as f:
                json.load(f)
            
            orders_status = "ok"
        except PermissionError:
            orders_status = "error"
            issues.append("orders.json: permission denied")
        except json.JSONDecodeError:
            orders_status = "warning"
            issues.append("orders.json: invalid JSON")
        except Exception as exc:
            orders_status = "error"
            issues.append(f"orders.json: {type(exc).__name__}")
        
        overall_status = "healthy" if not issues else ("degraded" if "error" not in str(issues) else "unhealthy")
        
        return {
            "status": overall_status,
            "positions_file": positions_status,
            "orders_file": orders_status,
            "issues": issues if issues else None,
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
