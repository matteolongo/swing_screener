"""Tests for authentication router and protected endpoint behavior."""
from __future__ import annotations

import importlib
from pathlib import Path

from fastapi.testclient import TestClient

from api.security import hash_password


def _write_users_csv(path: Path, password_hash: str) -> None:
    path.write_text(
        "email,password_hash,tenant_id,role,active\n"
        f"friend@example.com,{password_hash},tenant-demo,member,true\n",
        encoding="utf-8",
    )


def _build_client(monkeypatch, *, auth_enabled: bool, users_csv_path: Path | None = None) -> TestClient:
    monkeypatch.setenv("API_AUTH_ENABLED", "true" if auth_enabled else "false")
    if users_csv_path is not None:
        monkeypatch.setenv("API_AUTH_USERS_CSV_PATH", str(users_csv_path))
    monkeypatch.setenv("API_AUTH_JWT_SECRET", "test-secret")
    monkeypatch.setenv("API_AUTH_JWT_EXPIRE_MINUTES", "30")

    import api.runtime_config as runtime_config
    import api.dependencies as dependencies
    import api.main as main

    importlib.reload(runtime_config)
    importlib.reload(dependencies)
    importlib.reload(main)
    return TestClient(main.app)


def test_login_and_me_when_auth_enabled(monkeypatch, tmp_path: Path):
    users_csv_path = tmp_path / "users.csv"
    _write_users_csv(users_csv_path, hash_password("secret-pass"))
    client = _build_client(monkeypatch, auth_enabled=True, users_csv_path=users_csv_path)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "friend@example.com", "password": "secret-pass"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    payload = me_response.json()
    assert payload["email"] == "friend@example.com"
    assert payload["tenant_id"] == "tenant-demo"


def test_protected_router_requires_auth_when_enabled(monkeypatch, tmp_path: Path):
    users_csv_path = tmp_path / "users.csv"
    _write_users_csv(users_csv_path, hash_password("secret-pass"))
    client = _build_client(monkeypatch, auth_enabled=True, users_csv_path=users_csv_path)

    response = client.get("/api/portfolio/orders")
    assert response.status_code == 401


def test_login_endpoint_returns_503_when_auth_disabled(monkeypatch):
    client = _build_client(monkeypatch, auth_enabled=False)

    response = client.post(
        "/api/auth/login",
        json={"email": "friend@example.com", "password": "secret-pass"},
    )
    assert response.status_code == 503

