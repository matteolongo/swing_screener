from __future__ import annotations

import json
from pathlib import Path

from scripts.check_release_version import check_release_version


def _write_release_files(
    root: Path,
    *,
    version: str,
    web_version: str | None = None,
    changelog_heading: str | None = None,
) -> None:
    resolved_web_version = web_version or version
    (root / "pyproject.toml").write_text(
        f'[project]\nname = "swing-screener"\nversion = "{version}"\n',
        encoding="utf-8",
    )
    web_directory = root / "web-ui"
    web_directory.mkdir()
    (web_directory / "package.json").write_text(
        json.dumps({"name": "swing-screener-web", "version": resolved_web_version}),
        encoding="utf-8",
    )
    (web_directory / "package-lock.json").write_text(
        json.dumps(
            {
                "name": "swing-screener-web",
                "version": resolved_web_version,
                "packages": {"": {"version": resolved_web_version}},
            }
        ),
        encoding="utf-8",
    )
    (root / "CHANGELOG.md").write_text(
        f"# Changelog\n\n{changelog_heading or f'## [{version}] - Unreleased'}\n",
        encoding="utf-8",
    )


def test_release_version_check_accepts_matching_metadata(tmp_path: Path):
    _write_release_files(tmp_path, version="9.8.7")

    assert check_release_version(tmp_path) == []


def test_release_version_check_reports_web_version_mismatch(tmp_path: Path):
    _write_release_files(tmp_path, version="9.8.7", web_version="9.8.6")

    assert check_release_version(tmp_path) == [
        "web-ui/package.json version is 9.8.6; expected 9.8.7",
        "web-ui/package-lock.json version is 9.8.6; expected 9.8.7",
        "web-ui/package-lock.json packages[''] version is 9.8.6; expected 9.8.7",
    ]
