from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from api.db.settings import DatabaseConfigurationError, DatabaseSettings


def _config(database_url: str) -> Config:
    config = Config(str(Path(__file__).parents[2] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_database_settings_default_and_postgres_normalization():
    assert DatabaseSettings.from_env({"APP_ENV": "test"}).url == (
        "sqlite:///data/swing_screener.db"
    )
    settings = DatabaseSettings.from_env(
        {"APP_ENV": "production", "DATABASE_URL": "postgresql://u:p@db/app"}
    )
    assert settings.url == "postgresql+psycopg://u:p@db/app"
    settings.validate_runtime()
    legacy_settings = DatabaseSettings.from_env(
        {"APP_ENV": "production", "DATABASE_URL": "postgres://u:p@db/app"}
    )
    assert legacy_settings.url == "postgresql+psycopg://u:p@db/app"
    legacy_settings.validate_runtime()


def test_production_requires_database_url_and_rejects_sqlite_by_default():
    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL"):
        DatabaseSettings.from_env({"APP_ENV": "production"}).validate_runtime()

    with pytest.raises(DatabaseConfigurationError, match="SQLite"):
        DatabaseSettings.from_env(
            {"APP_ENV": "production", "DATABASE_URL": "sqlite:///prod.db"}
        ).validate_runtime()

    DatabaseSettings.from_env(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "sqlite:///prod.db",
            "ALLOW_PRODUCTION_SQLITE": "true",
        }
    ).validate_runtime()


def test_upgrade_downgrade_upgrade_creates_relational_schema(tmp_path):
    url = f"sqlite:///{tmp_path / 'portfolio.db'}"
    config = _config(url)

    command.upgrade(config, "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    assert {
        "portfolio_orders",
        "portfolio_positions",
        "idempotency_records",
        "legacy_imports",
        "legacy_import_lock",
        "alembic_version",
    } <= set(inspector.get_table_names())

    order_columns = {
        column["name"]: column for column in inspector.get_columns("portfolio_orders")
    }
    position_columns = {
        column["name"]: column
        for column in inspector.get_columns("portfolio_positions")
    }
    for name in ("limit_price", "stop_price", "target_price", "approval_fx_rate"):
        assert "NUMERIC" in str(order_columns[name]["type"]).upper()
    for name in ("entry_price", "stop_price", "target_price", "entry_fx_rate"):
        assert "NUMERIC" in str(position_columns[name]["type"]).upper()
    assert {
        "ticker",
        "status",
        "quantity",
        "quote_currency",
        "account_currency",
        "payload",
    } <= set(order_columns)
    assert {
        "ticker",
        "status",
        "shares",
        "quote_currency",
        "account_currency",
        "payload",
    } <= set(position_columns)
    idempotency_uniques = inspector.get_unique_constraints("idempotency_records")
    assert any(
        constraint["column_names"] == ["key"]
        for constraint in idempotency_uniques
    )

    command.downgrade(config, "base")
    assert "portfolio_orders" not in inspect(engine).get_table_names()
    command.upgrade(config, "head")
    assert "portfolio_positions" in inspect(engine).get_table_names()
    engine.dispose()
