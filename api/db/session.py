"""Database engine and session runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker


@dataclass(frozen=True)
class DatabaseRuntime:
    engine: Engine
    session_factory: sessionmaker[Session]


def _prepare_sqlite_path(url: str) -> None:
    prefix = "sqlite:///"
    if not url.startswith(prefix) or url.endswith(":memory:"):
        return
    Path(url.removeprefix(prefix)).expanduser().parent.mkdir(
        parents=True, exist_ok=True
    )


def create_database_runtime(url: str) -> DatabaseRuntime:
    _prepare_sqlite_path(url)
    connect_args = (
        {"check_same_thread": False, "timeout": 30} if url.startswith("sqlite:") else {}
    )
    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()

    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    return DatabaseRuntime(engine=engine, session_factory=factory)
