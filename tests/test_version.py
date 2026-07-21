from pathlib import Path

from swing_screener.version import get_version


def test_get_version_reads_project_metadata(tmp_path: Path):
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "swing-screener"\nversion = "9.8.7"\n',
        encoding="utf-8",
    )

    assert get_version(tmp_path) == "9.8.7"
