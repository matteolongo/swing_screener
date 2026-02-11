"""Health check and monitoring utilities for the API."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, Any
import json

from fastapi import HTTPException


class HealthChecker:
    """Health check for API dependencies and resources."""
    
    @staticmethod
    def check_file_access() -> Dict[str, Any]:
        """Check that critical files are accessible."""
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
    """Simple in-memory metrics collector."""
    
    def __init__(self):
        self._lock_contention_count = 0
        self._validation_failure_count = 0
        self._start_time = time.time()
    
    def record_lock_contention(self):
        """Record a lock contention event."""
        self._lock_contention_count += 1
    
    def record_validation_failure(self):
        """Record a validation failure."""
        self._validation_failure_count += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        uptime_seconds = time.time() - self._start_time
        
        return {
            "uptime_seconds": round(uptime_seconds, 2),
            "lock_contention_total": self._lock_contention_count,
            "validation_failures_total": self._validation_failure_count,
        }
    
    def reset(self):
        """Reset all metrics (for testing)."""
        self._lock_contention_count = 0
        self._validation_failure_count = 0
        self._start_time = time.time()


# Global singleton instance
_metrics_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    return _metrics_collector
