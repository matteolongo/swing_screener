from __future__ import annotations

from typing import Protocol

from swing_screener.fundamentals.models import ProviderFundamentalsRecord


class FundamentalsProvider(Protocol):
    name: str

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        ...
