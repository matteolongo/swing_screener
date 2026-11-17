"""Transaction owner for portfolio lifecycle operations."""

from __future__ import annotations

import logging
from types import TracebackType
from typing import Any, Self

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from api.db.models import PortfolioStateRow
from api.db.repositories import (
    SqlIdempotencyRepository,
    SqlOrdersRepository,
    SqlPositionsRepository,
)

logger = logging.getLogger("swing_screener.audit")


class PortfolioUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self.session: Session
        self.orders: SqlOrdersRepository
        self.positions: SqlPositionsRepository
        self.idempotency: SqlIdempotencyRepository
        self.write_started = False
        self._audit_events: list[tuple[str, dict[str, Any]]] = []

    def audit(self, action: str, **fields: Any) -> None:
        """Queue a portfolio mutation to be logged once its transaction resolves.

        Events are logged as committed only after ``commit()`` succeeds, so the
        audit trail never claims a change that was rolled back.
        """
        self._audit_events.append((action, fields))

    @staticmethod
    def _format_fields(fields: dict[str, Any]) -> str:
        return " ".join(f"{key}={value}" for key, value in fields.items() if value is not None)

    def _log_audit(self, outcome: str, level: int) -> None:
        for action, fields in self._audit_events:
            logger.log(level, "portfolio %s %s %s", action, outcome, self._format_fields(fields))
        self._audit_events.clear()

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

    def lock_portfolio_state(self) -> None:
        state = self.session.scalar(
            select(PortfolioStateRow)
            .where(PortfolioStateRow.id == 1)
            .with_for_update()
        )
        if state is None:
            raise RuntimeError("Portfolio state row is missing.")

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        try:
            if exc_type is None:
                try:
                    self.session.commit()
                except Exception:
                    self._log_audit("rolled_back", logging.ERROR)
                    raise
                self._log_audit("committed", logging.INFO)
            else:
                self.session.rollback()
                self._log_audit("rolled_back", logging.WARNING)
        finally:
            self.session.close()
