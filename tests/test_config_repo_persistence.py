"""Tests for file-backed config repository mode."""
from __future__ import annotations

from pathlib import Path

from api.repositories.config_repo import ConfigRepository


def test_config_repo_persists_updates_to_file(tmp_path: Path):
    config_path = tmp_path / "tenant-a" / "config.json"
    repo = ConfigRepository(path=config_path)

    config = repo.get()
    config.risk.account_size = 123456
    repo.update(config)

    reloaded = ConfigRepository(path=config_path)
    assert reloaded.get().risk.account_size == 123456
    assert config_path.exists()

