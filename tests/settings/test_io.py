from __future__ import annotations

from pathlib import Path

from swing_screener.settings.io import CachedYamlFile, dump_yaml_file


def test_cached_yaml_file_reloads_when_file_changes(tmp_path: Path):
    path = tmp_path / "settings.yaml"
    store = CachedYamlFile(path, default_factory=dict)

    first = {"alpha": 1}
    second = {"alpha": 2, "beta": {"enabled": True}}

    store.save(first)
    assert store.load() == first

    dump_yaml_file(path, second)

    assert store.load() == second
    assert list(tmp_path.glob("*.tmp-*")) == []

