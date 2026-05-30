"""Thin session wrapper around degiro-connector's Trading class.

All imports of degiro_connector are lazy (inside methods/functions) so that
a missing installation raises a clear 503 from the API layer, not an
import-time crash.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Optional

from swing_screener.integrations.degiro.credentials import DegiroCredentials

if TYPE_CHECKING:
    # Only used for type hints — never executed at import time.
    from degiro_connector.trading.api import API as TradingAPI  # noqa: F401

logger = logging.getLogger(__name__)


class DegiroClient:
    """Manages a single authenticated DeGiro session."""

    def __init__(self, credentials: DegiroCredentials) -> None:
        self._creds = credentials
        self._api: Optional[Any] = None

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Open and authenticate a DeGiro session."""
        try:
            from degiro_connector.trading.api import API as TradingAPI
            from degiro_connector.trading.models.credentials import Credentials
        except ImportError as exc:
            raise ImportError(
                "degiro-connector is not installed. "
                "Install it with: pip install -e '.[degiro]'"
            ) from exc

        creds_kwargs: dict[str, Any] = {
            "username": self._creds.username,
            "password": self._creds.password,
        }
        if self._creds.int_account is not None:
            creds_kwargs["int_account"] = self._creds.int_account
        if self._creds.totp_secret_key:
            creds_kwargs["totp_secret_key"] = self._creds.totp_secret_key
        elif self._creds.one_time_password:
            creds_kwargs["one_time_password"] = self._creds.one_time_password

        connector_creds = Credentials(**creds_kwargs)
        self._api = TradingAPI(credentials=connector_creds)
        self._api.connect()
        logger.info("DeGiro session established for user %s", self._creds.username)

    def disconnect(self) -> None:
        """Close the current session, if open."""
        if self._api is not None:
            try:
                self._api.logout()
            except Exception:
                logger.debug("DeGiro logout raised (session may already be closed)", exc_info=True)
            finally:
                self._api = None

    @property
    def api(self) -> Any:
        if self._api is None:
            raise RuntimeError("DeGiro session is not connected. Call connect() first.")
        return self._api

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> "DegiroClient":
        self.connect()
        return self

    def __exit__(self, *_: Any) -> None:
        self.disconnect()

    # ------------------------------------------------------------------
    # Order reads
    # ------------------------------------------------------------------

    def get_orders(self) -> list[dict]:
        """Fetch current pending orders from DeGiro."""
        try:
            from degiro_connector.trading.models.account import UpdateOption, UpdateRequest
        except ImportError as exc:
            raise ImportError(
                "degiro-connector is not installed. "
                "Install it with: pip install -e '.[degiro]'"
            ) from exc

        update = self.api.get_update(
            request_list=[UpdateRequest(option=UpdateOption.ORDERS, last_updated=0)],
            raw=True,
        ) or {}
        return update.get("orders", {}).get("value", [])

    def get_order_history(self, from_date: str, to_date: str) -> list[dict]:
        """Fetch order history (filled/cancelled) from DeGiro for the given date range.

        Args:
            from_date: Start date as ISO string (YYYY-MM-DD).
            to_date: End date as ISO string (YYYY-MM-DD).

        Returns:
            List of raw order dicts from the DeGiro API.
        """
        try:
            from datetime import date
            from degiro_connector.trading.models.order import HistoryRequest
        except ImportError as exc:
            raise ImportError(
                "degiro-connector is not installed. "
                "Install it with: pip install -e '.[degiro]'"
            ) from exc

        from_dt = date.fromisoformat(from_date)
        to_dt = date.fromisoformat(to_date)
        result = self.api.get_orders_history(
            history_request=HistoryRequest(from_date=from_dt, to_date=to_dt),
            raw=True,
        ) or {}
        return result.get("data", [])
