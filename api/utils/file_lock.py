"""Thread-safe file locking utilities for JSON operations."""
from __future__ import annotations

from pathlib import Path
import json
import logging
import re
from typing import Any, Callable

from fastapi import HTTPException
from swing_screener.utils.file_lock import (
    DEFAULT_TIMEOUT,
    FileLockTimeoutError,
    read_json_with_lock,
    update_json_with_lock,
    write_json_with_lock,
)

logger = logging.getLogger(__name__)


def _record_lock_contention():
    """Record a lock contention event in metrics."""
    try:
        from api.monitoring import get_metrics_collector

        get_metrics_collector().record_lock_contention()
    except Exception:
        # Don't fail if metrics aren't available
        pass


def _normalize_json_text(text: str) -> str:
    return re.sub(r"\bNaN\b", "null", text)


def locked_read_json(path: Path, timeout: float = DEFAULT_TIMEOUT) -> dict[str, Any]:
    """Read JSON file with a shared file lock."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")

    try:
        payload = read_json_with_lock(path, timeout=timeout, text_filter=_normalize_json_text)
        if not isinstance(payload, dict):
            logger.error(f"Invalid JSON root type in {path.name}: {type(payload).__name__}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON in {path.name}",
            )
        return payload
    except FileLockTimeoutError:
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
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"Unexpected error reading {path.name}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {path.name}"
        )


def locked_write_json(
    path: Path,
    data: dict[str, Any],
    timeout: float = DEFAULT_TIMEOUT,
) -> None:
    """Write JSON file with an exclusive file lock."""
    try:
        write_json_with_lock(path, data, timeout=timeout)
    except FileLockTimeoutError:
        _record_lock_contention()
        logger.error(f"Lock timeout writing {path.name} after {timeout}s")
        raise HTTPException(
            status_code=503,
            detail=f"Service temporarily unavailable - file locked: {path.name}"
        )
    except Exception:
        logger.exception(f"Unexpected error writing {path.name}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write file: {path.name}"
        )


def locked_read_modify_write(
    path: Path,
    modify_fn: Callable[[dict[str, Any]], dict[str, Any]],
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Atomic read-modify-write operation with one exclusive file lock."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")

    try:
        payload = update_json_with_lock(
            path,
            modify_fn,
            timeout=timeout,
            text_filter=_normalize_json_text,
        )
        if not isinstance(payload, dict):
            logger.error(f"Invalid JSON root type in {path.name}: {type(payload).__name__}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON in {path.name}",
            )
        return payload
    except FileLockTimeoutError:
        _record_lock_contention()
        logger.error(f"Lock timeout updating {path.name} after {timeout}s")
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
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"Unexpected error updating {path.name}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update file: {path.name}"
        )
