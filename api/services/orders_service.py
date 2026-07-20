"""Orders service - local order lifecycle management."""

from __future__ import annotations

import uuid
import hashlib
import json
import logging
import math
import time
from decimal import Decimal
from typing import Callable, Optional

from sqlalchemy.exc import IntegrityError

from swing_screener.errors import (
    NotFoundError,
    ConflictError,
    UnprocessableError,
)

from api.models.portfolio import (
    CreateOrderRequest,
    FillOrderRequest,
    FillOrderResponse,
    Position,
    PortfolioApprovalGate,
    PortfolioOrderApproval,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.utils.files import get_today_str
from api.services.order_approval import (
    EffectiveOrderPolicy,
    SubmittedPlan,
    evaluate_order_approval,
)
from api.services.order_approval_token import (
    ApprovalTokenError,
    OrderApprovalTokenSigner,
    VerifiedApprovalToken,
    strategy_revision,
)
from api.services.order_exposure import (
    ExposureContextError,
    ProposedExposure,
    build_exposure_snapshot,
)
from api.db.unit_of_work import PortfolioUnitOfWork

logger = logging.getLogger(__name__)


def _resolve_isin(ticker: str) -> Optional[str]:
    return None


class OrdersService:
    def __init__(
        self,
        orders_repo: OrdersRepository,
        positions_repo: PositionsRepository,
        config_repo: ConfigRepository | None = None,
        strategy_repo: StrategyRepository | None = None,
        approval_signer: OrderApprovalTokenSigner | None = None,
        approval_now: Callable[[], int] | None = None,
        uow: PortfolioUnitOfWork | None = None,
    ) -> None:
        self._orders_repo = orders_repo
        self._positions_repo = positions_repo
        self._config_repo = config_repo
        self._strategy_repo = strategy_repo
        self._approval_signer = approval_signer
        self._approval_now = approval_now or (lambda: int(time.time()))
        self._uow = uow

    @staticmethod
    def _country(ticker: str) -> str:
        suffix = ticker.upper().rsplit(".", 1)[-1] if "." in ticker else "US"
        return {
            "AS": "NL",
            "DE": "DE",
            "PA": "FR",
            "MI": "IT",
            "MC": "ES",
            "L": "UK",
            "SW": "CH",
            "ST": "SE",
            "CO": "DK",
            "OL": "NO",
        }.get(suffix, "US")

    def _risk_policy(self) -> dict:
        strategy = (
            self._strategy_repo.get_active_strategy() if self._strategy_repo else {}
        )
        risk = dict(strategy.get("risk") or {})
        if self._config_repo is not None:
            configured = self._config_repo.get().risk
            risk.setdefault("account_size", configured.account_size)
            risk.setdefault("risk_pct", configured.risk_pct)
            risk.setdefault("max_position_pct", configured.max_position_pct)
            risk.setdefault("max_fee_risk_pct", configured.max_fee_risk_pct)
            risk.setdefault("max_portfolio_heat_pct", configured.max_portfolio_heat_pct)
            risk.setdefault("max_concentration_pct", configured.max_concentration_pct)
            risk.setdefault("account_currency", configured.account_currency)
        risk.setdefault("account_size", 0.0)
        risk.setdefault("risk_pct", 0.01)
        risk.setdefault("min_rr", 2.0)
        risk.setdefault("max_position_pct", 0.60)
        risk.setdefault("commission_pct", 0.0)
        risk.setdefault("max_fee_risk_pct", 0.20)
        risk.setdefault("max_portfolio_heat_pct", 0.06)
        risk.setdefault("max_concentration_pct", 60.0)
        risk.setdefault("account_currency", "EUR")
        return risk

    def _approve_signed_entry_order(
        self, request: CreateOrderRequest, orders: list[dict], positions: list[dict]
    ) -> tuple[PortfolioOrderApproval, VerifiedApprovalToken]:
        if not request.approval_token:
            raise UnprocessableError("Order blocked: approval token is required.")
        assert self._approval_signer is not None
        try:
            context = self._approval_signer.verify(
                request.approval_token, now=self._approval_now()
            )
        except ApprovalTokenError as exc:
            raise UnprocessableError(f"Order blocked: {exc}.") from exc
        ticker = request.ticker.upper()
        if context.ticker != ticker:
            raise UnprocessableError("Order blocked: approval token ticker mismatch.")
        if context.order_type != request.order_type.upper():
            raise UnprocessableError(
                "Order blocked: approval token order type mismatch."
            )

        strategy = (
            self._strategy_repo.get_active_strategy() if self._strategy_repo else {}
        )
        active_strategy_id = str(strategy.get("id") or "")
        if not active_strategy_id and self._strategy_repo is not None:
            getter = getattr(self._strategy_repo, "get_active_strategy_id", None)
            if callable(getter):
                active_strategy_id = str(getter())
        active_strategy_revision = strategy_revision(strategy)
        if (
            not active_strategy_id
            or context.strategy_id != active_strategy_id
            or context.strategy_revision != active_strategy_revision
        ):
            raise UnprocessableError("Order blocked: approval token strategy is stale.")

        entry = Decimal(str(self._entry_price(request)))
        if request.stop_price is None or request.target_price is None:
            raise UnprocessableError(
                "Order blocked: entry, stop, and target are required."
            )
        stop = Decimal(str(request.stop_price))
        target = Decimal(str(request.target_price))
        rate = (
            Decimal("1")
            if context.account_currency == context.quote_currency
            else Decimal(str(context.account_to_quote_rate))
        )
        proposed = ProposedExposure(
            ticker=ticker,
            quantity=request.quantity,
            entry=entry,
            stop=stop,
            account_currency=context.account_currency,
            quote_currency=context.quote_currency,
            account_to_quote_rate=rate,
        )
        try:
            snapshot = build_exposure_snapshot(positions, orders, proposed)
        except ExposureContextError as exc:
            raise UnprocessableError(f"Order blocked: {exc}") from exc

        raw = self._risk_policy()
        policy = EffectiveOrderPolicy(
            account_size=Decimal(str(raw["account_size"])),
            risk_pct=Decimal(str(raw["risk_pct"])),
            max_position_pct=Decimal(str(raw["max_position_pct"])),
            max_portfolio_heat_pct=Decimal(str(raw["max_portfolio_heat_pct"])),
            min_rr=Decimal(str(raw["min_rr"])),
            commission_pct=Decimal(str(raw["commission_pct"])),
            max_fee_risk_pct=Decimal(str(raw["max_fee_risk_pct"])),
            max_concentration_pct=Decimal(str(raw["max_concentration_pct"])),
            account_currency=context.account_currency,
        )
        approval = evaluate_order_approval(
            context,
            SubmittedPlan(ticker, request.quantity, entry, stop, target),
            snapshot,
            policy,
        )
        if not approval.approved:
            gate_names = (
                "decision",
                "coherence",
                "reward_risk",
                "trade_risk",
                "position",
                "cash",
                "heat",
                "fees",
                "event",
                "fx",
            )
            blockers = [
                name
                for name in gate_names
                if getattr(approval, name) is not None
                and getattr(approval, name).status == "BLOCK"
            ]
            raise UnprocessableError(
                "Order blocked by portfolio approval: " + ", ".join(blockers)
            )
        return approval, context

    @staticmethod
    def _entry_price(request: CreateOrderRequest) -> float:
        price = request.limit_price
        if price is None or not math.isfinite(price) or price <= 0:
            raise UnprocessableError(
                "A finite planned entry price is required for portfolio approval."
            )
        return float(price)

    def _approve_entry_order(
        self, request: CreateOrderRequest, orders: list[dict], positions: list[dict]
    ) -> PortfolioOrderApproval:
        if request.setup_status != "PASS" or request.trigger_status != "PASS":
            raise UnprocessableError(
                "Order blocked: setup and observed entry-trigger gates must both pass."
            )
        if request.data_status != "current" or not request.data_asof:
            raise UnprocessableError(
                "Order blocked: critical market data is stale, intraday, or unknown."
            )
        if request.target_source not in {"structural", "manual"}:
            raise UnprocessableError(
                "Order blocked: target is not independently validated."
            )

        entry = self._entry_price(request)
        stop = request.stop_price
        target = request.target_price
        if stop is None or target is None or stop >= entry or target <= entry:
            raise UnprocessableError(
                "Order blocked: entry, stop, and target do not form a coherent long plan."
            )

        policy = self._risk_policy()
        min_rr = float(policy["min_rr"])
        rr = (target - entry) / (entry - stop)
        if rr < min_rr:
            raise UnprocessableError(
                f"Order blocked: structural reward/risk {rr:.2f} is below {min_rr:.2f}."
            )

        rate = request.account_to_quote_rate or 1.0
        notional = request.quantity * entry / rate
        risk = request.quantity * (entry - stop) / rate
        account_size = float(policy["account_size"])

        position_notional = sum(
            float(p.get("entry_price") or 0) * int(p.get("shares") or 0)
            for p in positions
            if p.get("status") == "open"
        )
        position_risk = sum(
            max(0.0, float(p.get("entry_price") or 0) - float(p.get("stop_price") or 0))
            * int(p.get("shares") or 0)
            for p in positions
            if p.get("status") == "open"
        )
        pending = [
            order
            for order in orders
            if order.get("status") in {"pending", "submitted"}
            and order.get("order_kind") == "entry"
        ]
        pending_notional = sum(
            float(o.get("limit_price") or 0) * int(o.get("quantity") or 0)
            for o in pending
        )
        pending_risk = sum(
            max(0.0, float(o.get("limit_price") or 0) - float(o.get("stop_price") or 0))
            * int(o.get("quantity") or 0)
            for o in pending
        )

        available = account_size - position_notional - pending_notional
        cash_pass = notional <= available + 1e-9
        heat_limit = account_size * float(policy["max_portfolio_heat_pct"])
        projected_heat = position_risk + pending_risk + risk
        heat_pass = projected_heat <= heat_limit + 1e-9

        country = self._country(request.ticker)
        country_notional = sum(
            float(p.get("entry_price") or 0) * int(p.get("shares") or 0)
            for p in positions
            if p.get("status") == "open"
            and self._country(str(p.get("ticker") or "")) == country
        ) + sum(
            float(o.get("limit_price") or 0) * int(o.get("quantity") or 0)
            for o in pending
            if self._country(str(o.get("ticker") or "")) == country
        )
        projected_concentration = (
            (country_notional + notional) / account_size * 100.0
            if account_size > 0
            else 100.0
        )
        concentration_limit = float(policy["max_concentration_pct"])
        concentration_pass = projected_concentration <= concentration_limit + 1e-9

        event_pass = (
            request.days_to_earnings is not None and request.days_to_earnings > 3
        )
        approval = PortfolioOrderApproval(
            approved=cash_pass and heat_pass and concentration_pass and event_pass,
            cash=PortfolioApprovalGate(
                status="PASS" if cash_pass else "BLOCK",
                explanation="Sufficient unreserved capital."
                if cash_pass
                else "Insufficient capital after open and pending exposure.",
                current=round(available, 2),
                projected=round(available - notional, 2),
                limit=0.0,
            ),
            heat=PortfolioApprovalGate(
                status="PASS" if heat_pass else "BLOCK",
                explanation="Projected portfolio heat is within policy."
                if heat_pass
                else "Projected portfolio heat exceeds policy.",
                current=round(position_risk + pending_risk, 2),
                projected=round(projected_heat, 2),
                limit=round(heat_limit, 2),
            ),
            concentration=PortfolioApprovalGate(
                status="PASS" if concentration_pass else "BLOCK",
                explanation=f"Projected {country} risk concentration is within policy."
                if concentration_pass
                else f"Projected {country} risk concentration exceeds policy.",
                projected=round(projected_concentration, 2),
                limit=round(concentration_limit, 2),
            ),
            event=PortfolioApprovalGate(
                status="PASS" if event_pass else "BLOCK",
                explanation=(
                    f"Earnings are {request.days_to_earnings} days away."
                    if request.days_to_earnings is not None and event_pass
                    else "Earnings are inside the three-day risk window."
                    if request.days_to_earnings is not None
                    else "Earnings status is unknown."
                ),
            ),
            projected_risk=round(risk, 2),
            projected_notional=round(notional, 2),
        )
        if not approval.approved:
            blockers = [
                name
                for name, gate in (
                    ("cash", approval.cash),
                    ("heat", approval.heat),
                    ("concentration", approval.concentration),
                    ("event", approval.event),
                )
                if gate.status == "BLOCK"
            ]
            raise UnprocessableError(
                "Order blocked by portfolio approval: " + ", ".join(blockers)
            )
        return approval

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

    def _recover_idempotency_race(
        self, idempotency_key: str, request_hash: str
    ):
        assert self._uow is not None
        self._uow.session.rollback()
        self._uow.write_started = False
        existing = self._uow.idempotency.get(idempotency_key)
        if existing is None:
            raise ConflictError("Concurrent idempotent request could not be replayed.")
        if existing.request_hash != request_hash:
            raise ConflictError(
                "Idempotency-Key was already used for a different request."
            )
        return existing

    def create_order(
        self,
        request: CreateOrderRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> dict:
        if self._uow is None:
            return self._create_order_impl(request)
        if not idempotency_key:
            raise UnprocessableError("Idempotency-Key is required.")
        self._uow.begin_write()
        operation = "create_order"
        request_hash = self._idempotency_hash(
            subject=subject,
            operation=operation,
            resource="orders",
            body=request.model_dump(mode="json"),
        )
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
                resource="orders",
                status_code=0,
                response={},
            )
        except IntegrityError:
            existing = self._recover_idempotency_race(
                idempotency_key, request_hash
            )
            return dict(existing.response)
        self._uow.lock_portfolio_state()
        try:
            response = self._create_order_impl(request)
        except IntegrityError as exc:
            raise ConflictError(
                "Order conflicts with concurrently committed portfolio state."
            ) from exc
        self._uow.idempotency.complete(
            reservation, status_code=201, response=response
        )
        return response

    def _create_order_impl(self, request: CreateOrderRequest) -> dict:
        ticker = request.ticker.upper()
        orders, _ = self._orders_repo.list_orders()

        if request.order_kind == "entry":
            pending_entry = any(
                o.get("ticker") == ticker
                and o.get("status") in ("pending", "submitted")
                and o.get("order_kind") == "entry"
                for o in orders
            )
            if pending_entry:
                raise ConflictError(f"{ticker}: pending entry order already exists.")

            positions, _ = self._positions_repo.list_positions(status="open")
            open_position = next(
                (p for p in positions if p.get("ticker") == ticker), None
            )

            if request.entry_mode == "ADD_ON":
                if not open_position:
                    raise ConflictError(
                        f"{ticker}: no open position found for add-on order."
                    )
            elif open_position:
                raise ConflictError(
                    f"{ticker}: open position already exists. Create this as an ADD_ON order instead.",
                )
            if self._approval_signer is None:
                raise UnprocessableError(
                    "Order blocked: approval token signer is not configured."
                )
            approval, verified_context = self._approve_signed_entry_order(
                request, orders, positions
            )
        else:
            approval = None
            verified_context = None

        existing_ids = {o.get("order_id", "") for o in orders}
        base = f"ORD-{ticker}"
        n = 1
        order_id = f"{base}-{n:03d}"
        while order_id in existing_ids:
            n += 1
            order_id = f"{base}-{n:03d}"

        isin = request.isin or _resolve_isin(ticker)
        order = {
            "order_id": order_id,
            "ticker": ticker,
            "status": "pending",
            "order_type": request.order_type,
            "quantity": request.quantity,
            "limit_price": request.limit_price,
            "stop_price": request.stop_price,
            "target_price": request.target_price,
            "order_date": get_today_str(),
            "filled_date": None,
            "entry_price": None,
            "notes": request.notes.strip(),
            "order_kind": request.order_kind,
            "parent_order_id": None,
            "position_id": request.position_id
            if request.entry_mode == "ADD_ON"
            else None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": isin,
            "thesis": request.thesis,
            "quote_currency": verified_context.quote_currency
            if verified_context
            else request.currency,
            "account_currency": verified_context.account_currency
            if verified_context
            else None,
            "approval_fx_rate": verified_context.account_to_quote_rate
            if verified_context
            else request.account_to_quote_rate,
            "decision_context": verified_context.model_dump(mode="json")
            if verified_context
            else {
                "setup_status": request.setup_status,
                "trigger_status": request.trigger_status,
                "data_status": request.data_status,
                "data_asof": request.data_asof,
                "target_source": request.target_source,
                "strategy_id": request.strategy_id,
            },
            "portfolio_approval": approval.model_dump(mode="json")
            if approval
            else None,
        }
        self._orders_repo.append_order(order)
        return order

    def list_local_orders(self, status: Optional[str] = None) -> dict:
        orders, asof = self._orders_repo.list_orders(status=status)
        return {"orders": orders, "asof": asof}

    def submit_order(self, order_id: str) -> dict:
        if self._uow is not None:
            self._uow.begin_write()
        order = self._orders_repo.submit_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") != "submitted":
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")
        return {"order_id": order_id, "status": "submitted"}

    def cancel_order(self, order_id: str) -> dict:
        if self._uow is not None:
            self._uow.begin_write()
        order = self._orders_repo.cancel_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") != "cancelled":
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")
        return {"order_id": order_id, "status": "cancelled"}

    def fill_order(
        self,
        order_id: str,
        request: FillOrderRequest,
        *,
        idempotency_key: str | None = None,
        subject: str = "local",
    ) -> FillOrderResponse:
        if self._uow is None:
            return self._fill_order_impl(order_id, request)
        if not idempotency_key:
            raise UnprocessableError("Idempotency-Key is required.")
        self._uow.begin_write()
        operation = "fill_order"
        request_hash = self._idempotency_hash(
            subject=subject,
            operation=operation,
            resource=order_id,
            body=request.model_dump(mode="json"),
        )
        existing = self._uow.idempotency.get(idempotency_key)
        if existing is not None:
            if existing.request_hash != request_hash:
                raise ConflictError(
                    "Idempotency-Key was already used for a different request."
                )
            return FillOrderResponse.model_validate(existing.response)
        try:
            reservation = self._uow.idempotency.add(
                operation=operation,
                key=idempotency_key,
                request_hash=request_hash,
                subject=subject,
                resource=order_id,
                status_code=0,
                response={},
            )
        except IntegrityError:
            existing = self._recover_idempotency_race(
                idempotency_key, request_hash
            )
            return FillOrderResponse.model_validate(existing.response)
        response = self._fill_order_impl(order_id, request)
        self._uow.idempotency.complete(
            reservation,
            status_code=201,
            response=response.model_dump(mode="json"),
        )
        return response

    def _fill_order_impl(
        self, order_id: str, request: FillOrderRequest
    ) -> FillOrderResponse:
        order = self._orders_repo.get_order(
            order_id, for_update=True
        ) if self._uow is not None else self._orders_repo.get_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") not in ("pending", "submitted"):
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")

        ticker = order["ticker"]
        stop_price = (
            request.stop_price
            if request.stop_price is not None
            else order.get("stop_price")
        )
        if not stop_price or stop_price <= 0:
            raise UnprocessableError(f"No valid stop price for order {order_id}")
        if stop_price >= request.filled_price:
            raise UnprocessableError("stop_price must be below filled_price")

        updates = {
            "status": "filled",
            "entry_price": request.filled_price,
            "filled_date": request.filled_date,
            "fee_eur": request.fee_eur,
            "fill_fx_rate": request.fill_fx_rate,
            "stop_price": stop_price,
        }
        add_shares = int(order["quantity"])
        target_position_id = order.get("position_id")

        # ADD_ON fill: merge into the referenced open position (weighted-average
        # entry, keep the existing stop) instead of creating a duplicate lot.
        if target_position_id:
            def _merge(data: dict) -> dict:
                for pos in data.get("positions", []):
                    if pos.get("position_id") == target_position_id:
                        if pos.get("status") != "open":
                            raise ConflictError(
                                f"Position {target_position_id} is not open for add-on."
                            )
                        old_shares = int(pos.get("shares", 0))
                        old_entry = float(pos.get("entry_price", 0.0))
                        new_shares = old_shares + add_shares
                        position_quote = str(pos.get("quote_currency") or "").upper()
                        position_account = str(
                            pos.get("account_currency") or ""
                        ).upper()
                        order_quote = str(order.get("quote_currency") or "").upper()
                        order_account = str(order.get("account_currency") or "").upper()
                        if (
                            not position_quote
                            or not position_account
                            or position_quote != order_quote
                            or position_account != order_account
                        ):
                            raise UnprocessableError(
                                "Add-on currency context does not match the open position."
                            )
                        old_rate = float(pos.get("entry_fx_rate") or 0.0)
                        new_rate = float(
                            request.fill_fx_rate or order.get("approval_fx_rate") or 0.0
                        )
                        if position_quote == position_account:
                            old_rate = new_rate = 1.0
                        if old_rate <= 0 or new_rate <= 0:
                            raise UnprocessableError(
                                "Add-on FX context must contain positive persisted rates."
                            )
                        existing_stop = float(pos.get("stop_price", 0.0))
                        if existing_stop <= 0:
                            raise UnprocessableError(
                                f"No valid existing stop price for position {target_position_id}"
                            )
                        new_entry = old_entry
                        if new_shares > 0:
                            new_entry = (
                                old_entry * old_shares
                                + request.filled_price * add_shares
                            ) / new_shares
                        if existing_stop >= new_entry:
                            raise UnprocessableError(
                                "existing stop_price must be below blended entry_price"
                            )
                        pos["entry_price"] = round(new_entry, 6)
                        pos["shares"] = new_shares
                        combined_quote_cost = (
                            old_entry * old_shares + request.filled_price * add_shares
                        )
                        combined_account_cost = (
                            old_entry * old_shares / old_rate
                            + request.filled_price * add_shares / new_rate
                        )
                        pos["entry_fx_rate"] = (
                            combined_quote_cost / combined_account_cost
                        )
                        pos["quote_currency"] = position_quote
                        pos["account_currency"] = position_account
                        pos["initial_risk"] = round(
                            pos["entry_price"] - existing_stop, 4
                        )
                        if request.fee_eur is not None:
                            prior_fee = pos.get("entry_fee_eur") or 0.0
                            pos["entry_fee_eur"] = float(prior_fee) + float(
                                request.fee_eur
                            )
                        data["asof"] = get_today_str()
                        return data
                raise NotFoundError(
                    f"Position not found for add-on: {target_position_id}"
                )

            updated_positions = self._positions_repo.update(_merge)
            self._orders_repo.update_order(order_id, updates)
            updated_position = next(
                position
                for position in updated_positions["positions"]
                if position.get("position_id") == target_position_id
            )
            return FillOrderResponse(
                order_id=order_id, position=Position(**updated_position)
            )

        isin = order.get("isin") or _resolve_isin(ticker)
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = round(request.filled_price - stop_price, 4)

        new_position: dict = {
            "position_id": position_id,
            "ticker": ticker,
            "status": "open",
            "entry_date": request.filled_date,
            "entry_price": request.filled_price,
            "stop_price": stop_price,
            "target_price": order.get("target_price"),
            "shares": add_shares,
            "initial_risk": initial_risk,
            "source_order_id": order_id,
            "isin": isin,
            "thesis": order.get("thesis"),
            "notes": order.get("notes", ""),
            "entry_fee_eur": request.fee_eur,
            "entry_fx_rate": request.fill_fx_rate or order.get("approval_fx_rate"),
            "quote_currency": order.get("quote_currency"),
            "account_currency": order.get("account_currency"),
        }

        def _append(data: dict) -> dict:
            positions = data.get("positions", [])
            positions.append(new_position)
            data["positions"] = positions
            data["asof"] = get_today_str()
            return data

        self._positions_repo.update(_append)
        self._orders_repo.update_order(order_id, updates)

        return FillOrderResponse(order_id=order_id, position=Position(**new_position))
