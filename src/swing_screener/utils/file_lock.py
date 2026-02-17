"""Thread-safe file locking utilities for CLI JSON operations."""
from __future__ import annotations

from pathlib import Path
import json
import logging

try:
    import portalocker
    PORTALOCKER_AVAILABLE = True
except ImportError:
    PORTALOCKER_AVAILABLE = False
    logging.warning("portalocker not available - file operations will not be locked")

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 5.0  # seconds


def locked_read_json_cli(path: Path, timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Read JSON file with file lock (CLI version).
    
    Falls back to non-locked read if portalocker unavailable.
    """
    if not PORTALOCKER_AVAILABLE:
        return json.loads(path.read_text(encoding="utf-8"))
    
    try:
        with portalocker.Lock(path, mode="r", timeout=timeout, encoding="utf-8") as fh:
            return json.load(fh)
    except portalocker.exceptions.LockException:
        logger.error(f"Lock timeout reading {path.name} after {timeout}s")
        raise RuntimeError(f"Could not acquire lock on {path.name} within {timeout}s")
    except Exception as exc:
        logger.exception(f"Error reading {path.name}")
        raise


def locked_write_json_cli(path: Path, data: dict | list, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Write JSON file with file lock (CLI version).
    
    Falls back to non-locked write if portalocker unavailable.
    
    Args:
        path: Path to write to
        data: Data to write (dict or list)
        timeout: Lock timeout in seconds
    """
    if not PORTALOCKER_AVAILABLE:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding="utf-8")
        return
    
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        
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
            fh.write('\n')
            fh.flush()
    except portalocker.exceptions.LockException:
        logger.error(f"Lock timeout writing {path.name} after {timeout}s")
        raise RuntimeError(f"Could not acquire lock on {path.name} within {timeout}s")
    except Exception as exc:
        logger.exception(f"Error writing {path.name}")
        raise
