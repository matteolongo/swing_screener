"""Health check and monitoring utilities for the API."""
from __future__ import annotations

import time
import threading
from typing import Dict, Any


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
