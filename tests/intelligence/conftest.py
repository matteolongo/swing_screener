from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_intelligence_data_dir(tmp_path, monkeypatch):
    """Point SWING_SCREENER_DATA_DIR at a tmp dir so analyzer trace/cache/history
    writes never touch the real repo tree. Tests that set their own tmp data dir
    simply override this with their own value."""
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    yield
