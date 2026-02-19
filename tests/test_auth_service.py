"""Tests for temporary CSV authentication service."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from api.repositories.users_repo import UsersRepository
from api.security import hash_password
from api.services.auth_service import AuthService


def _write_users_csv(path: Path, password_hash: str) -> None:
    path.write_text(
        "email,password_hash,tenant_id,role,active\n"
        f"friend@example.com,{password_hash},tenant-demo,member,true\n",
        encoding="utf-8",
    )


def test_login_success_and_token_verification(tmp_path: Path):
    password_hash = hash_password("secret-pass")
    csv_path = tmp_path / "users.csv"
    _write_users_csv(csv_path, password_hash=password_hash)

    service = AuthService(
        users_repo=UsersRepository(csv_path),
        jwt_secret="test-secret",
        jwt_expire_minutes=10,
    )

    response = service.login(email="friend@example.com", password="secret-pass")

    assert response.user.email == "friend@example.com"
    assert response.user.tenant_id == "tenant-demo"
    assert response.expires_in_seconds == 600

    user = service.verify_token(response.access_token)
    assert user.email == "friend@example.com"
    assert user.tenant_id == "tenant-demo"


def test_login_rejects_bad_password(tmp_path: Path):
    password_hash = hash_password("secret-pass")
    csv_path = tmp_path / "users.csv"
    _write_users_csv(csv_path, password_hash=password_hash)

    service = AuthService(
        users_repo=UsersRepository(csv_path),
        jwt_secret="test-secret",
        jwt_expire_minutes=10,
    )

    with pytest.raises(HTTPException) as exc_info:
        service.login(email="friend@example.com", password="wrong-pass")
    assert exc_info.value.status_code == 401


def test_verify_token_rejects_invalid_token(tmp_path: Path):
    csv_path = tmp_path / "users.csv"
    _write_users_csv(csv_path, password_hash=hash_password("secret-pass"))
    service = AuthService(
        users_repo=UsersRepository(csv_path),
        jwt_secret="test-secret",
        jwt_expire_minutes=10,
    )

    with pytest.raises(HTTPException) as exc_info:
        service.verify_token("invalid.token.value")
    assert exc_info.value.status_code == 401

