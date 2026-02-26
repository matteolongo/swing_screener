"""Tests for SPA static file serving in single-app deployments."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import api.main as main


@pytest.fixture
def spa_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Return a TestClient configured with an ephemeral web-ui dist folder."""
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    (dist_dir / "index.html").write_text("<!doctype html><html><body>SPA</body></html>", encoding="utf-8")
    (dist_dir / "assets").mkdir(parents=True, exist_ok=True)
    (dist_dir / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")

    monkeypatch.setenv("SERVE_WEB_UI", "1")
    monkeypatch.setattr(main, "WEB_UI_DIST_DIR", dist_dir.resolve())
    monkeypatch.setattr(main, "WEB_UI_INDEX_FILE", (dist_dir / "index.html").resolve())

    return TestClient(main.app)


def test_root_serves_spa_when_enabled(spa_client: TestClient):
    """Root should return built index.html when SPA serving is active."""
    response = spa_client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "SPA" in response.text


def test_spa_fallback_serves_index_for_client_routes(spa_client: TestClient):
    """Unknown non-API routes should fall back to index.html."""
    response = spa_client.get("/workspace/portfolio")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "SPA" in response.text


def test_static_asset_is_served_from_dist(spa_client: TestClient):
    """Built assets should be served directly from web-ui/dist."""
    response = spa_client.get("/assets/app.js")
    assert response.status_code == 200
    assert "console.log('ok')" in response.text


def test_api_paths_never_fall_back_to_spa(spa_client: TestClient):
    """Unknown /api paths should return 404 instead of HTML."""
    response = spa_client.get("/api/not-a-real-endpoint")
    assert response.status_code == 404
    assert response.json()["detail"] == "Not Found"
