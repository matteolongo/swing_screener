"""DeGiro credential loader — reads from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DegiroCredentials:
    username: str
    password: str
    int_account: Optional[int]
    totp_secret_key: Optional[str]
    one_time_password: Optional[str]


def load_credentials() -> DegiroCredentials:
    """Read DeGiro credentials from environment variables.

    Raises ValueError with actionable guidance if required vars are missing.
    """
    missing: list[str] = []

    username = os.environ.get("DEGIRO_USERNAME", "").strip()
    if not username:
        missing.append("DEGIRO_USERNAME")

    password = os.environ.get("DEGIRO_PASSWORD", "").strip()
    if not password:
        missing.append("DEGIRO_PASSWORD")

    if missing:
        raise ValueError(
            f"Missing required DeGiro environment variables: {', '.join(missing)}. "
            "Copy .env.example, fill in your DeGiro credentials, and reload the environment. "
            "Install the optional dependency with: pip install -e '.[degiro]'"
        )

    int_account_raw = os.environ.get("DEGIRO_INT_ACCOUNT", "").strip()
    int_account: Optional[int] = None
    if int_account_raw:
        try:
            int_account = int(int_account_raw)
        except ValueError:
            raise ValueError(
                f"DEGIRO_INT_ACCOUNT must be an integer, got: {int_account_raw!r}"
            )

    totp_secret_key = os.environ.get("DEGIRO_TOTP_SECRET_KEY", "").strip() or None
    one_time_password = os.environ.get("DEGIRO_ONE_TIME_PASSWORD", "").strip() or None

    return DegiroCredentials(
        username=username,
        password=password,
        int_account=int_account,
        totp_secret_key=totp_secret_key,
        one_time_password=one_time_password,
    )
