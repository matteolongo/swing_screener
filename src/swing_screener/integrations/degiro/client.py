"""Thin session wrapper around degiro_connector.trading.API.

Usage:
    client = DegiroClient(load_credentials())
    client.connect()
    data = client.api.get_company_ratios(product_isin="US0378331005", raw=True)
    client.disconnect()
"""
from __future__ import annotations

import logging

from degiro_connector.trading.api import API
from degiro_connector.trading.models.credentials import Credentials

logger = logging.getLogger(__name__)


class DegiroClient:
    def __init__(self, credentials: Credentials) -> None:
        self._credentials = credentials
        self._api: API | None = None

    @property
    def api(self) -> API:
        if self._api is None:
            raise RuntimeError("DegiroClient.connect() must be called before using .api")
        return self._api

    def connect(self) -> None:
        api = API(credentials=self._credentials)
        api.connect()
        self._api = api
        logger.debug("DeGiro session connected")

    def disconnect(self) -> None:
        if self._api is not None:
            try:
                self._api.logout()
            except Exception:
                logger.debug("DeGiro logout failed; ignoring", exc_info=True)
            self._api = None
            logger.debug("DeGiro session disconnected")
