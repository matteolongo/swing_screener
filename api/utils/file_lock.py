"""Thread-safe file locking utilities for JSON operations."""
from __future__ import annotations

from pathlib import Path
import json
import re
import logging
from typing import Any

import portalocker
from fastapi import HTTPException

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 5.0  # seconds


def _record_lock_contention():
    """Record a lock contention event in metrics."""
    try:
        from api.monitoring import get_metrics_collector
        get_metrics_collector().record_lock_contention()
    except Exception:
        # Don't fail if metrics aren't available
        pass



def locked_read_json(path: Path, timeout: float = DEFAULT_TIMEOUT) -> dict[str, Any]:
    """Read JSON file with exclusive file lock.
    
    Args:
        path: Path to JSON file
        timeout: Maximum seconds to wait for lock acquisition
        
    Returns:
        Parsed JSON data as dict
        
    Raises:
        HTTPException: 404 if file not found, 503 if lock timeout, 500 for other errors
    """
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    
    try:
        with portalocker.Lock(path, mode="r", timeout=timeout, encoding="utf-8") as fh:
            text = fh.read()
            # Handle NaN values in JSON (convert to null)
            text = re.sub(r"\bNaN\b", "null", text)
            return json.loads(text)
    except portalocker.exceptions.LockException:
        _record_lock_contention()
        logger.error(f"Lock timeout reading {path.name} after {timeout}s")
        raise HTTPException(
            status_code=503,
            detail=f"Service temporarily unavailable - file locked: {path.name}"
        )
    except json.JSONDecodeError as exc:
        logger.error(f"Invalid JSON in {path.name}: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in {path.name}"
        )
    except Exception as exc:
        logger.exception(f"Unexpected error reading {path.name}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {path.name}"
        )


def locked_write_json(
    path: Path,
    data: dict[str, Any],
    timeout: float = DEFAULT_TIMEOUT
) -> None:
    """Write JSON file with exclusive file lock.
    
    Args:
        path: Path to JSON file
        data: Dictionary to write as JSON
        timeout: Maximum seconds to wait for lock acquisition
        
    Raises:
        HTTPException: 503 if lock timeout, 500 for other errors
    """
    try:
        # Ensure parent directory exists
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write with exclusive lock using 'r+' to avoid truncation
        # Create file if it doesn't exist
        if not path.exists():
            path.touch()
        
        with portalocker.Lock(
            path,
            mode="r+",
            timeout=timeout,
            encoding="utf-8",
            flags=portalocker.LOCK_EX
        ) as fh:
            # Truncate and write
            fh.seek(0)
            fh.truncate()
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write('\n')  # Trailing newline
            fh.flush()
            
    except portalocker.exceptions.LockException:
        _record_lock_contention()
        logger.error(f"Lock timeout writing {path.name} after {timeout}s")
        raise HTTPException(
            status_code=503,
            detail=f"Service temporarily unavailable - file locked: {path.name}"
        )
    except Exception as exc:
        logger.exception(f"Unexpected error writing {path.name}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write file: {path.name}"
        )


def locked_read_modify_write(
    path: Path,
    modify_fn: callable,
    timeout: float = DEFAULT_TIMEOUT
) -> dict[str, Any]:
    """Atomic read-modify-write operation with exclusive lock.
    
    Args:
        path: Path to JSON file
        modify_fn: Function that takes data dict and returns modified dict
        timeout: Maximum seconds to wait for lock acquisition
        
    Returns:
        Modified data that was written
        
    Raises:
        HTTPException: 404, 503, or 500 depending on error
    """
    data = locked_read_json(path, timeout=timeout)
    modified_data = modify_fn(data)
    locked_write_json(path, modified_data, timeout=timeout)
    return modified_data
