from datetime import datetime
import json

from swing_screener.social.cache import SocialCache


def test_load_run_metadata_returns_none_for_empty_file(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    metadata_path = tmp_path / "metadata.json"
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text("", encoding="utf-8")

    assert cache.load_run_metadata() is None


def test_update_symbol_run_recovers_from_corrupt_metadata(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    metadata_path = tmp_path / "metadata.json"
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text("{not-json", encoding="utf-8")

    payload = {"last_execution_at": datetime(2026, 2, 14, 23, 10, 0).isoformat()}
    cache.update_symbol_run("reddit", "tsla", payload)

    restored = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert restored["symbol_runs"]["reddit"]["TSLA"] == payload
    assert cache.get_symbol_run("reddit", "TSLA") == payload
