"""Thread-safe file locking utilities for JSON and text operations."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import json
import logging
from typing import Any, Callable, Iterator, Literal, TextIO

try:
    import portalocker

    PORTALOCKER_AVAILABLE = True
except ImportError:
    PORTALOCKER_AVAILABLE = False
    logging.warning("portalocker not available - file operations will not be locked")

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 5.0  # seconds
LockKind = Literal["shared", "exclusive"]
TextFilter = Callable[[str], str]
JsonModifier = Callable[[Any], Any]


class FileLockTimeoutError(RuntimeError):
    """Raised when a file lock cannot be acquired before the timeout."""

    def __init__(self, path: Path, timeout: float) -> None:
        self.path = Path(path)
        self.timeout = float(timeout)
        super().__init__(f"Could not acquire lock on {self.path.name} within {self.timeout}s")


def _lock_flags(lock_kind: LockKind) -> int:
    if not PORTALOCKER_AVAILABLE:
        return 0
    if lock_kind == "shared":
        return portalocker.LOCK_SH | portalocker.LOCK_NB
    return portalocker.LOCK_EX | portalocker.LOCK_NB


def _prepare_path(path: Path, mode: str, *, create_file: bool) -> None:
    if any(token in mode for token in ("+", "a", "w")):
        path.parent.mkdir(parents=True, exist_ok=True)
        if create_file and not path.exists():
            path.touch(exist_ok=True)


@contextmanager
def open_locked_text(
    path: Path,
    *,
    mode: str,
    timeout: float = DEFAULT_TIMEOUT,
    lock_kind: LockKind,
    create_file: bool = False,
) -> Iterator[TextIO]:
    """Open a text file under a non-blocking lock with retry semantics."""
    _prepare_path(path, mode, create_file=create_file)

    if not PORTALOCKER_AVAILABLE:
        with path.open(mode, encoding="utf-8") as fh:
            yield fh
        return

    try:
        with portalocker.Lock(
            path,
            mode=mode,
            timeout=timeout,
            encoding="utf-8",
            flags=_lock_flags(lock_kind),
        ) as fh:
            yield fh
    except portalocker.exceptions.LockException as exc:
        raise FileLockTimeoutError(path, timeout) from exc


def _load_json(fh: TextIO, *, text_filter: TextFilter | None = None) -> Any:
    text = fh.read()
    if text_filter is not None:
        text = text_filter(text)
    return json.loads(text)


def _dump_json(fh: TextIO, data: Any) -> None:
    fh.seek(0)
    fh.truncate()
    json.dump(data, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
    fh.flush()


def read_json_with_lock(
    path: Path,
    timeout: float = DEFAULT_TIMEOUT,
    *,
    text_filter: TextFilter | None = None,
) -> Any:
    """Read JSON using a shared file lock."""
    with open_locked_text(path, mode="r", timeout=timeout, lock_kind="shared") as fh:
        return _load_json(fh, text_filter=text_filter)


def write_json_with_lock(path: Path, data: dict | list, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Write JSON using an exclusive file lock."""
    with open_locked_text(
        path,
        mode="r+",
        timeout=timeout,
        lock_kind="exclusive",
        create_file=True,
    ) as fh:
        _dump_json(fh, data)


def update_json_with_lock(
    path: Path,
    modify_fn: JsonModifier,
    timeout: float = DEFAULT_TIMEOUT,
    *,
    text_filter: TextFilter | None = None,
) -> Any:
    """Apply a JSON read/modify/write cycle under one exclusive lock."""
    with open_locked_text(
        path,
        mode="r+",
        timeout=timeout,
        lock_kind="exclusive",
        create_file=False,
    ) as fh:
        payload = _load_json(fh, text_filter=text_filter)
        updated = modify_fn(payload)
        _dump_json(fh, updated)
        return updated


def write_text_with_lock(path: Path, text: str, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Write plain text using an exclusive file lock."""
    with open_locked_text(
        path,
        mode="r+",
        timeout=timeout,
        lock_kind="exclusive",
        create_file=True,
    ) as fh:
        fh.seek(0)
        fh.truncate()
        fh.write(text)
        fh.flush()


def locked_read_json_cli(path: Path, timeout: float = DEFAULT_TIMEOUT) -> Any:
    """Read JSON file with file lock (CLI version)."""
    try:
        return read_json_with_lock(path, timeout=timeout)
    except FileLockTimeoutError as exc:
        logger.error(f"Lock timeout reading {path.name} after {timeout}s")
        raise RuntimeError(str(exc)) from exc
    except Exception:
        logger.exception(f"Error reading {path.name}")
        raise


def locked_write_json_cli(path: Path, data: dict | list, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Write JSON file with file lock (CLI version)."""
    try:
        write_json_with_lock(path, data, timeout=timeout)
    except FileLockTimeoutError as exc:
        logger.error(f"Lock timeout writing {path.name} after {timeout}s")
        raise RuntimeError(str(exc)) from exc
    except Exception:
        logger.exception(f"Error writing {path.name}")
        raise


def locked_write_text_cli(path: Path, text: str, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Write plain text with file lock (CLI version)."""
    try:
        write_text_with_lock(path, text, timeout=timeout)
    except FileLockTimeoutError as exc:
        logger.error(f"Lock timeout writing {path.name} after {timeout}s")
        raise RuntimeError(str(exc)) from exc
    except Exception:
        logger.exception(f"Error writing {path.name}")
        raise
