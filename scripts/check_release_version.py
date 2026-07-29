#!/usr/bin/env python
"""Verify that release metadata matches the canonical project version."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from swing_screener.version import get_version  # noqa: E402


def _read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("JSON root must be an object")
    return value


def check_release_version(project_root: Path) -> list[str]:
    """Return every mismatch among release-version metadata surfaces."""
    version = get_version(project_root)
    errors: list[str] = []

    package_path = project_root / "web-app" / "package.json"
    package = _read_json(package_path)
    package_version = package.get("version")
    if package_version != version:
        errors.append(
            f"web-app/package.json version is {package_version}; expected {version}"
        )

    lock_path = project_root / "web-app" / "package-lock.json"
    lock = _read_json(lock_path)
    lock_version = lock.get("version")
    if lock_version != version:
        errors.append(
            f"web-app/package-lock.json version is {lock_version}; expected {version}"
        )
    lock_root_version = lock.get("packages", {}).get("", {}).get("version")
    if lock_root_version != version:
        errors.append(
            "web-app/package-lock.json packages[''] version is "
            f"{lock_root_version}; expected {version}"
        )

    changelog = (project_root / "CHANGELOG.md").read_text(encoding="utf-8")
    heading = re.compile(
        rf"^## \[{re.escape(version)}\] - (?:Unreleased|\d{{4}}-\d{{2}}-\d{{2}})$",
        re.MULTILINE,
    )
    if heading.search(changelog) is None:
        errors.append(
            f"CHANGELOG.md is missing a release heading for {version}"
        )
    return errors


def main() -> int:
    errors = check_release_version(PROJECT_ROOT)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Release version check passed: {get_version(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
