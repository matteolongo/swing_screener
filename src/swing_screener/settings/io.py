from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import threading
import uuid
from typing import Any, Callable

import yaml


def load_yaml_file(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)
    return payload


def dump_yaml_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
    with open(tmp_path, "w", encoding="utf-8") as handle:
        yaml.safe_dump(
            payload,
            handle,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
        )
    tmp_path.replace(path)


class CachedYamlFile:
    def __init__(
        self,
        path: Path,
        *,
        default_factory: Callable[[], Any],
        fallback_path: Path | None = None,
    ) -> None:
        self.path = path
        self._default_factory = default_factory
        self._fallback_path = fallback_path
        self._lock = threading.Lock()
        self._mtime_ns: int | None = None
        self._cached: Any = None

    def _read_uncached(self) -> Any:
        if self.path.exists():
            payload = load_yaml_file(self.path)
            return deepcopy(payload if payload is not None else self._default_factory())
        if self._fallback_path is not None and self._fallback_path.exists():
            payload = load_yaml_file(self._fallback_path)
            return deepcopy(payload if payload is not None else self._default_factory())
        return deepcopy(self._default_factory())

    def load(self) -> Any:
        with self._lock:
            current_mtime = self.path.stat().st_mtime_ns if self.path.exists() else None
            if current_mtime is not None and self._mtime_ns == current_mtime and self._cached is not None:
                return deepcopy(self._cached)
            payload = self._read_uncached()
            self._cached = deepcopy(payload)
            self._mtime_ns = current_mtime
            return payload

    def save(self, payload: Any) -> Any:
        with self._lock:
            dump_yaml_file(self.path, payload)
            self._mtime_ns = self.path.stat().st_mtime_ns
            self._cached = deepcopy(payload)
            return deepcopy(payload)
