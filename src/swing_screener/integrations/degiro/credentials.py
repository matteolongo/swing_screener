"""Load DeGiro credentials from environment variables.

Required env vars:
  DEGIRO_USERNAME   — DeGiro account username / email
  DEGIRO_PASSWORD   — DeGiro account password

Optional:
  DEGIRO_INT_ACCOUNT  — numeric int_account id (speeds up first connect)
  DEGIRO_TOTP_SECRET  — base32 TOTP secret for 2FA accounts
"""
from __future__ import annotations

import os
from typing import Optional

from degiro_connector.trading.models.credentials import Credentials

_ENV_USERNAME = "DEGIRO_USERNAME"
_ENV_PASSWORD = "DEGIRO_PASSWORD"
_ENV_INT_ACCOUNT = "DEGIRO_INT_ACCOUNT"
_ENV_TOTP_SECRET = "DEGIRO_TOTP_SECRET"


def credentials_configured() -> bool:
    return bool(os.getenv(_ENV_USERNAME)) and bool(os.getenv(_ENV_PASSWORD))


def load_credentials() -> Credentials:
    username = os.getenv(_ENV_USERNAME)
    password = os.getenv(_ENV_PASSWORD)
    if not username or not password:
        raise EnvironmentError(
            f"DeGiro credentials not configured. Set {_ENV_USERNAME} and {_ENV_PASSWORD}."
        )
    int_account: Optional[int] = None
    raw_int = os.getenv(_ENV_INT_ACCOUNT)
    if raw_int:
        try:
            int_account = int(raw_int)
        except ValueError:
            pass

    totp_secret: Optional[str] = os.getenv(_ENV_TOTP_SECRET) or None

    return Credentials(
        username=username,
        password=password,
        int_account=int_account,
        totp_secret_key=totp_secret,
    )
