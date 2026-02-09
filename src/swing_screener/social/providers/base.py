from __future__ import annotations

from datetime import datetime
from typing import Protocol

from swing_screener.social.models import SocialRawEvent


class SocialProvider(Protocol):
    name: str

    def fetch_events(
        self,
        start_dt: datetime,
        end_dt: datetime,
        symbols: list[str],
    ) -> list[SocialRawEvent]:
        ...
