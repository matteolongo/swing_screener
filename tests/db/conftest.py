from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from api.db.session import create_database_runtime


@pytest.fixture()
def database_url(tmp_path: Path) -> str:
    url = f"sqlite:///{tmp_path / 'portfolio.db'}"
    config = Config(str(Path(__file__).parents[2] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    return url


@pytest.fixture()
def runtime(database_url):
    value = create_database_runtime(database_url)
    try:
        yield value
    finally:
        value.engine.dispose()
