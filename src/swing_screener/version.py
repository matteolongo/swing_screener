"""Canonical application version access."""

from __future__ import annotations

from pathlib import Path
import re


_PROJECT_VERSION = re.compile(
    r'^version\s*=\s*"(?P<version>[^"]+)"\s*$', re.MULTILINE
)


def get_version(project_root: Path | None = None) -> str:
    """Read the application version from the canonical project metadata."""
    root = project_root or Path(__file__).resolve().parents[2]
    project_file = root / "pyproject.toml"
    match = _PROJECT_VERSION.search(project_file.read_text(encoding="utf-8"))
    if match is None:
        raise RuntimeError("Project version is missing from pyproject.toml")
    return match.group("version")
