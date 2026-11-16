"""Health check and monitoring utilities for the API."""
from __future__ import annotations

import time
import threading
from typing import Any, Dict


class MetricsCollector:
    """Simple in-memory metrics collector.
    
    Thread-safe for concurrent access within a single process.
    Note: When running with multiple workers (e.g., uvicorn --workers 4),
    each process will have its own instance with separate counters.
    """
    
    def __init__(self):
        self._lock_contention_count = 0
        self._validation_failure_count = 0
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

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        with self._lock:
            return {
                "uptime_seconds": round(time.time() - self._start_time, 2),
                "lock_contention_total": self._lock_contention_count,
                "validation_failures_total": self._validation_failure_count,
            }
    
    def reset(self):
        """Reset all metrics (for testing)."""
        with self._lock:
            self._reset_locked()

    def _reset_locked(self):
        self._lock_contention_count = 0
        self._validation_failure_count = 0
        self._start_time = time.time()


# Global singleton instance
_metrics_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    return _metrics_collector
