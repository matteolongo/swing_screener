"""Transaction owner for portfolio lifecycle operations."""

from __future__ import annotations

from types import TracebackType
from typing import Self

from sqlalchemy.orm import Session, sessionmaker

from api.db.repositories import (
    SqlIdempotencyRepository,
    SqlOrdersRepository,
    SqlPositionsRepository,
)


class PortfolioUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self.session: Session
        self.orders: SqlOrdersRepository
        self.positions: SqlPositionsRepository
        self.idempotency: SqlIdempotencyRepository
        self.write_started = False

    def __enter__(self) -> Self:
        self.session = self._session_factory()
        self.orders = SqlOrdersRepository(self.session)
        self.positions = SqlPositionsRepository(self.session)
        self.idempotency = SqlIdempotencyRepository(self.session)
        return self

    def begin_write(self) -> None:
        if self.write_started:
            return
        if self.session.in_transaction():
            self.session.rollback()
        if self.session.bind is not None and self.session.bind.dialect.name == "sqlite":
            self.session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        else:
            self.session.begin()
        self.write_started = True

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        try:
            if exc_type is None:
                self.session.commit()
            else:
                self.session.rollback()
        finally:
            self.session.close()
