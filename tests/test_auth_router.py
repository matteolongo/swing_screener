"""Tests for authentication router and protected endpoint behavior."""
from __future__ import annotations

import importlib
from pathlib import Path

from fastapi.testclient import TestClient

from api.security import hash_password


def _write_users_csv(path: Path, rows: list[tuple[str, str, str, str, str]]) -> None:
    lines = ["email,password_hash,tenant_id,role,active"]
    for email, password_hash, tenant_id, role, active in rows:
        lines.append(f"{email},{password_hash},{tenant_id},{role},{active}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _build_client(
    monkeypatch,
    *,
    auth_enabled: bool,
    users_csv_path: Path | None = None,
    tenants_dir: Path | None = None,
) -> TestClient:
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
    if tenants_dir is not None:
        dependencies.TENANTS_DIR = tenants_dir
    importlib.reload(main)
    return TestClient(main.app)


def test_login_and_me_when_auth_enabled(monkeypatch, tmp_path: Path):
    users_csv_path = tmp_path / "users.csv"
    _write_users_csv(
        users_csv_path,
        [("friend@example.com", hash_password("secret-pass"), "tenant-demo", "member", "true")],
    )
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
    _write_users_csv(
        users_csv_path,
        [("friend@example.com", hash_password("secret-pass"), "tenant-demo", "member", "true")],
    )
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


def test_tenant_order_files_are_isolated(monkeypatch, tmp_path: Path):
    users_csv_path = tmp_path / "users.csv"
    _write_users_csv(
        users_csv_path,
        [
            ("alice@example.com", hash_password("alice-pass"), "tenant-a", "member", "true"),
            ("bob@example.com", hash_password("bob-pass"), "tenant-b", "member", "true"),
        ],
    )
    tenants_dir = tmp_path / "tenants"
    client = _build_client(
        monkeypatch,
        auth_enabled=True,
        users_csv_path=users_csv_path,
        tenants_dir=tenants_dir,
    )

    alice_login = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "alice-pass"})
    bob_login = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "bob-pass"})
    assert alice_login.status_code == 200
    assert bob_login.status_code == 200
    alice_token = alice_login.json()["access_token"]
    bob_token = bob_login.json()["access_token"]

    create_order_payload = {
        "ticker": "AAPL",
        "order_type": "LIMIT",
        "quantity": 10,
        "limit_price": 100.0,
        "order_kind": "entry",
    }
    create_response = client.post(
        "/api/portfolio/orders",
        json=create_order_payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert create_response.status_code == 200

    alice_orders = client.get("/api/portfolio/orders", headers={"Authorization": f"Bearer {alice_token}"})
    bob_orders = client.get("/api/portfolio/orders", headers={"Authorization": f"Bearer {bob_token}"})
    assert alice_orders.status_code == 200
    assert bob_orders.status_code == 200
    assert len(alice_orders.json().get("orders", [])) == 1
    assert len(bob_orders.json().get("orders", [])) == 0

    assert (tenants_dir / "tenant-a" / "orders.json").exists()
    assert (tenants_dir / "tenant-b" / "orders.json").exists()


def test_tenant_position_files_are_isolated(monkeypatch, tmp_path: Path):
    users_csv_path = tmp_path / "users.csv"
    _write_users_csv(
        users_csv_path,
        [
            ("alice@example.com", hash_password("alice-pass"), "tenant-a", "member", "true"),
            ("bob@example.com", hash_password("bob-pass"), "tenant-b", "member", "true"),
        ],
    )
    tenants_dir = tmp_path / "tenants"
    client = _build_client(
        monkeypatch,
        auth_enabled=True,
        users_csv_path=users_csv_path,
        tenants_dir=tenants_dir,
    )

    alice_login = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "alice-pass"})
    bob_login = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "bob-pass"})
    assert alice_login.status_code == 200
    assert bob_login.status_code == 200
    alice_token = alice_login.json()["access_token"]
    bob_token = bob_login.json()["access_token"]

    alice_positions = client.get("/api/portfolio/positions", headers={"Authorization": f"Bearer {alice_token}"})
    bob_positions = client.get("/api/portfolio/positions", headers={"Authorization": f"Bearer {bob_token}"})
    assert alice_positions.status_code == 200
    assert bob_positions.status_code == 200
    assert alice_positions.json() != bob_positions.json() or alice_positions.json().get("positions", []) == []

    assert (tenants_dir / "tenant-a" / "positions.json").exists()
    assert (tenants_dir / "tenant-b" / "positions.json").exists()


def test_sanitize_tenant_id_rejects_invalid_values(monkeypatch, tmp_path: Path):
    import api.dependencies as dependencies

    import importlib
    import api.runtime_config as runtime_config
    importlib.reload(runtime_config)
    importlib.reload(dependencies)

    from fastapi import HTTPException

    invalid_cases = [
        "",
        "   ",
        "../etc/passwd",
        "/absolute",
        "tenant with spaces",
        "tenant@bad",
        "a" * 65,
    ]
    for bad_id in invalid_cases:
        try:
            dependencies._sanitize_tenant_id(bad_id)
            raise AssertionError(f"Expected HTTPException for tenant_id={bad_id!r}")
        except HTTPException as exc:
            assert exc.status_code in (400,), f"Expected 400 for {bad_id!r}, got {exc.status_code}"

    valid_cases = ["tenant-a", "tenant_b", "TenantC1", "a", "A" * 64]
    for good_id in valid_cases:
        result = dependencies._sanitize_tenant_id(good_id)
        assert result == good_id.strip()
