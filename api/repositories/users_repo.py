"""CSV-backed users repository for temporary authentication."""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class UserRecord:
    email: str
    password_hash: str
    tenant_id: str
    role: str
    active: bool


def _parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    return default


@dataclass
class UsersRepository:
    path: Path

    def list_users(self) -> list[UserRecord]:
        if not self.path.exists():
            return []

        users: list[UserRecord] = []
        with self.path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                email = str(row.get("email", "")).strip().lower()
                password_hash = str(row.get("password_hash", "")).strip()
                tenant_id = str(row.get("tenant_id", "")).strip()
                role = str(row.get("role", "member")).strip() or "member"
                if not email or not password_hash or not tenant_id:
                    continue

                users.append(
                    UserRecord(
                        email=email,
                        password_hash=password_hash,
                        tenant_id=tenant_id,
                        role=role,
                        active=_parse_bool(row.get("active"), default=True),
                    )
                )
        return users

    def get_by_email(self, email: str) -> UserRecord | None:
        lookup = email.strip().lower()
        for user in self.list_users():
            if user.email == lookup:
                return user
        return None

