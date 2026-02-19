"""CSV-backed tenant membership mapping for managed auth identities."""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TenantMembershipRecord:
    provider: str
    subject: str
    email: str
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
class TenantMembershipRepository:
    path: Path

    def list_memberships(self) -> list[TenantMembershipRecord]:
        if not self.path.exists():
            return []

        rows: list[TenantMembershipRecord] = []
        with self.path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                provider = str(row.get("provider", "")).strip().lower()
                subject = str(row.get("subject", "")).strip()
                email = str(row.get("email", "")).strip().lower()
                tenant_id = str(row.get("tenant_id", "")).strip()
                role = str(row.get("role", "member")).strip() or "member"
                if not tenant_id:
                    continue
                rows.append(
                    TenantMembershipRecord(
                        provider=provider,
                        subject=subject,
                        email=email,
                        tenant_id=tenant_id,
                        role=role,
                        active=_parse_bool(row.get("active"), default=True),
                    )
                )
        return rows

    def get_by_provider_subject(self, provider: str, subject: str) -> TenantMembershipRecord | None:
        provider_key = str(provider).strip().lower()
        subject_key = str(subject).strip()
        if not provider_key or not subject_key:
            return None
        for row in self.list_memberships():
            if row.provider == provider_key and row.subject == subject_key:
                return row
        return None

    def get_by_email(self, email: str, provider: str | None = None) -> TenantMembershipRecord | None:
        email_key = str(email).strip().lower()
        provider_key = str(provider).strip().lower() if provider else ""
        if not email_key:
            return None
        for row in self.list_memberships():
            if row.email != email_key:
                continue
            if provider_key and row.provider and row.provider != provider_key:
                continue
            return row
        return None

