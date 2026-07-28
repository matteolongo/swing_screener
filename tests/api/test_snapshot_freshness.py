import datetime as dt

import pytest
from pydantic import ValidationError

from api.models.config import AppConfig
from api.repositories.config_repo import ConfigRepository
from api.services.snapshot_freshness import snapshot_freshness


def test_snapshot_freshness_uses_configured_calendar_age() -> None:
    today = dt.date(2026, 7, 28)

    assert snapshot_freshness("2026-07-27", stale_after_days=1, today=today) == "fresh"
    assert snapshot_freshness("2026-07-26", stale_after_days=1, today=today) == "stale"


def test_app_config_rejects_negative_snapshot_freshness_age() -> None:
    defaults = ConfigRepository.get_defaults()
    assert defaults.portfolio_snapshot_stale_after_days == 1

    with pytest.raises(ValidationError):
        AppConfig.model_validate(
            {
                **defaults.model_dump(),
                "portfolio_snapshot_stale_after_days": -1,
            }
        )
