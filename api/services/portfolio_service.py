"""Portfolio service - positions and local order management."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Optional

import pandas as pd
from sqlalchemy.exc import IntegrityError

from swing_screener.errors import ConflictError, UnprocessableError
from api.models.portfolio import (
    ClosePositionRequest,
    CreatePositionRequest,
    EarningsProximityResponse,
    PartialCloseRequest,
    Position,
    PositionMetrics,
    PositionUpdate,
    PositionsWithMetricsResponse,
    PortfolioSummary,
    UpdateStopRequest,
    UpdateTrailMethodRequest,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.positions_repo import PositionsRepository
from api.db.unit_of_work import PortfolioUnitOfWork
from api.services.portfolio import (
    PositionPricingService,
    PortfolioReadService,
    PortfolioWriteService,
    PositionStopAdvisor,
)
from swing_screener.data.providers import MarketDataProvider, get_default_provider

# Re-export module-level symbols accessed by tests
from api.services.portfolio.pricing import _eurusd_cache, _earnings_cache  # noqa: F401
from api.services.portfolio.read import _compute_r_fx_adjusted  # noqa: F401


class PortfolioService:
    def __init__(
        self,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
        config_repo: Optional[ConfigRepository] = None,
        uow: PortfolioUnitOfWork | None = None,
    ) -> None:
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()
        self._config_repo = config_repo or ConfigRepository()
        self._uow = uow

        self._pricing = PositionPricingService(self._provider)
        self._read = PortfolioReadService(
            self._positions_repo, self._pricing, self._config_repo
        )
        self._write = PortfolioWriteService(
            self._positions_repo,
            self._provider,
            self._config_repo,
            begin_write=self._uow.begin_write if self._uow is not None else None,
        )
        self._advisor = PositionStopAdvisor(
            self._positions_repo, self._provider, self._config_repo
        )

    @staticmethod
    def _idempotency_hash(
        *, subject: str, operation: str, resource: str, body: dict
    ) -> str:
        canonical = json.dumps(
            {
                "subject": subject,
                "operation": operation,
                "resource": resource,
                "body": body,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        ).encode("utf-8")
        return hashlib.sha256(canonical).hexdigest()

    def _stored_idempotent_response(
        self, *, idempotency_key: str, request_hash: str
    ) -> dict | None:
        assert self._uow is not None
        existing = self._uow.idempotency.get(idempotency_key)
        if existing is None:
            self._uow.session.rollback()
            self._uow.write_started = False
            return None
        if existing.request_hash != request_hash:
            raise ConflictError("Idempotency-Key was already used for a different request.")
        response = dict(existing.response)
        self._uow.session.rollback()
        self._uow.write_started = False
        return response

    def _recover_idempotency_race(
        self, *, idempotency_key: str, request_hash: str
    ) -> dict:
        assert self._uow is not None
        self._uow.session.rollback()
        self._uow.write_started = False
        existing = self._uow.idempotency.get(idempotency_key)
        if existing is None:
            raise ConflictError("Concurrent idempotent request could not be replayed.")
        if existing.request_hash != request_hash:
            raise ConflictError("Idempotency-Key was already used for a different request.")
        return dict(existing.response)

    def _run_idempotent_write(
        self,
        *,
        operation: str,
        resource: str,
        body: dict,
        idempotency_key: str | None,
        subject: str,
        action: Callable[[], dict],
    ) -> dict:
        if self._uow is None:
            return action()
        if not idempotency_key:
            raise UnprocessableError("Idempotency-Key is required.")
        request_hash = self._idempotency_hash(
            subject=subject, operation=operation, resource=resource, body=body
        )
        self._uow.begin_write()
        existing = self._uow.idempotency.get(idempotency_key)
        if existing is not None:
            if existing.request_hash != request_hash:
                raise ConflictError(
                    "Idempotency-Key was already used for a different request."
                )
            return dict(existing.response)
        try:
            reservation = self._uow.idempotency.add(
                operation=operation,
                key=idempotency_key,
                request_hash=request_hash,
                subject=subject,
                resource=resource,
                status_code=0,
                response={},
            )
        except IntegrityError:
            return self._recover_idempotency_race(
                idempotency_key=idempotency_key, request_hash=request_hash
            )
        response = action()
        self._uow.idempotency.complete(
            reservation, status_code=200, response=response
        )
        return response

    def fetch_recent_ohlcv(
        self, ticker: str, *, lookback_days: int = 400
    ) -> pd.DataFrame:
        return self._pricing.fetch_recent_ohlcv(ticker, lookback_days=lookback_days)

    def list_positions(
        self,
        status: Optional[str] = None,
        *,
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionsWithMetricsResponse:
        return self._read.list_positions(
            status=status,
            time_stop_days=time_stop_days,
            time_stop_min_r=time_stop_min_r,
        )

    def get_position(self, position_id: str) -> Position:
        return self._read.get_position(position_id)

    def get_position_metrics(self, position_id: str) -> PositionMetrics:
        return self._read.get_position_metrics(position_id)

    def get_portfolio_summary(
        self, account_size: float, account_size_mode: str = "equity"
    ) -> PortfolioSummary:
        return self._read.get_portfolio_summary(account_size, account_size_mode)

    def get_earnings_proximity(self, ticker: str) -> EarningsProximityResponse:
        return self._pricing.get_earnings_proximity(ticker)

    def create_position(
        self,
        request: CreatePositionRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> Position:
        response = self._run_idempotent_write(
            operation="create_position",
            resource="positions",
            body=request.model_dump(mode="json"),
            idempotency_key=idempotency_key,
            subject=subject,
            action=lambda: self._write.create_position(request).model_dump(mode="json"),
        )
        return Position.model_validate(response)

    def update_position_stop(
        self,
        position_id: str,
        request: UpdateStopRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> dict:
        body = request.model_dump(mode="json")
        if self._uow is not None and idempotency_key:
            request_hash = self._idempotency_hash(
                subject=subject,
                operation="update_position_stop",
                resource=position_id,
                body=body,
            )
            stored = self._stored_idempotent_response(
                idempotency_key=idempotency_key, request_hash=request_hash
            )
            if stored is not None:
                return stored
        prepared = self._write.prepare_position_stop(position_id, request)
        return self._run_idempotent_write(
            operation="update_position_stop",
            resource=position_id,
            body=body,
            idempotency_key=idempotency_key,
            subject=subject,
            action=lambda: self._write.apply_position_stop(prepared),
        )

    def close_position(
        self,
        position_id: str,
        request: ClosePositionRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> dict:
        return self._run_idempotent_write(
            operation="close_position",
            resource=position_id,
            body=request.model_dump(mode="json"),
            idempotency_key=idempotency_key,
            subject=subject,
            action=lambda: self._write.close_position(position_id, request),
        )

    def partial_close_position(
        self,
        position_id: str,
        request: PartialCloseRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> dict:
        return self._run_idempotent_write(
            operation="partial_close_position",
            resource=position_id,
            body=request.model_dump(mode="json"),
            idempotency_key=idempotency_key,
            subject=subject,
            action=lambda: self._write.partial_close_position(position_id, request),
        )

    def update_trail_method(
        self,
        position_id: str,
        request: UpdateTrailMethodRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> dict:
        return self._run_idempotent_write(
            operation="update_trail_method",
            resource=position_id,
            body=request.model_dump(mode="json"),
            idempotency_key=idempotency_key,
            subject=subject,
            action=lambda: self._write.update_trail_method(position_id, request),
        )

    def compute_position_stop_suggestion(
        self,
        position_payload: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        return self._advisor.compute_position_stop_suggestion(
            position_payload, manage_payload
        )

    def suggest_position_stop(self, position_id: str) -> PositionUpdate:
        return self._advisor.suggest_position_stop(position_id)

    def suggest_stop_intraday(
        self,
        position_id: str,
        price: Optional[float] = None,
    ) -> PositionUpdate:
        return self._advisor.suggest_stop_intraday(position_id, price)
