"""Contracts for browser-owned trading-state snapshots."""

from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.models.portfolio import TradingStateCommandRequest, TradingStateSnapshot
from api.repositories.in_memory_trading_state import InMemoryTradingState
from swing_screener.errors import ConflictError


@pytest.fixture
def command_api(monkeypatch):
    from api import dependencies
    from api.main import register_domain_error_handler
    from api.repositories.config_repo import ConfigRepository
    from api.routers.portfolio import router
    from api.services.order_approval_token import OrderApprovalTokenSigner

    app = FastAPI()
    app.include_router(router, prefix="/api/portfolio")
    register_domain_error_handler(app)
    strategy = _strategy()
    config = ConfigRepository.get_defaults().model_copy(deep=True)
    signer = OrderApprovalTokenSigner(b"s" * 32)
    app.dependency_overrides[dependencies.get_config_repo] = lambda: SimpleNamespace(
        get=lambda: config
    )
    app.dependency_overrides[dependencies.get_strategy_repo] = lambda: SimpleNamespace(
        get_active_strategy=lambda: deepcopy(strategy)
    )
    app.dependency_overrides[dependencies.get_order_approval_signer] = lambda: signer

    def forbidden_database():
        pytest.fail("stateless command opened the server portfolio database")

    monkeypatch.setattr(dependencies, "get_database_runtime", forbidden_database)
    return SimpleNamespace(
        client=TestClient(app), strategy=strategy, config=config, signer=signer
    )


def _context():
    return {
        "effective_at": "2026-09-09T20:00:00Z",
        "new_position_id": "POS-STABLE-001",
        "market_price": {
            "ticker": "AAPL",
            "price": 210,
            "observed_at": "2026-09-09T19:59:00Z",
            "data_status": "current",
        },
    }


def test_stateless_metrics_projects_only_supplied_positions_without_writes(
    command_api, monkeypatch
):
    from api.repositories.in_memory_trading_state import InMemoryPositionsRepository
    from api.services import portfolio_service

    monkeypatch.setattr(
        portfolio_service,
        "get_market_data_provider",
        lambda: SimpleNamespace(fetch_latest_price=lambda ticker: 220),
    )
    monkeypatch.setattr(
        InMemoryPositionsRepository,
        "update",
        lambda *args: pytest.fail("projection wrote state"),
    )
    command_api.config.risk.account_currency = "USD"
    command_api.config.risk.account_size = 10000
    snapshot = _snapshot().model_dump(mode="json")
    original = deepcopy(snapshot)
    response = command_api.client.post("/api/portfolio/state/metrics", json=snapshot)
    assert response.status_code == 200, response.text
    result = response.json()
    assert snapshot == original
    assert len(result["positions"]) == 1
    assert result["positions"][0]["position_id"] == "POS-AAPL-001"
    assert result["positions"][0]["pnl"] == 200
    assert result["positions"][0]["r_now"] == 2
    assert result["summary"]["total_positions"] == 1
    assert result["summary"]["total_value"] == 2200
    assert result["summary"]["available_capital"] == 7800


def test_stateless_metrics_empty_snapshot_does_not_load_persisted_holdings(command_api):
    response = command_api.client.post(
        "/api/portfolio/state/metrics", json=_empty_snapshot().model_dump(mode="json")
    )
    assert response.status_code == 200, response.text
    assert response.json()["positions"] == []
    assert response.json()["summary"]["total_positions"] == 0


def _post_command(api, snapshot, operation, payload, expected_revision=None):
    return api.client.post(
        "/api/portfolio/state/commands",
        json={
            "snapshot": snapshot.model_dump(mode="json"),
            "expected_revision": (
                snapshot.revision if expected_revision is None else expected_revision
            ),
            "command": {"operation": operation, "payload": payload},
            "context": _context(),
        },
    )


@pytest.mark.parametrize(
    "operation",
    ["create_order", "fill_order", "close_position", "partial_close", "update_stop"],
)
def test_identical_commands_produce_identical_full_responses_despite_ambient_changes(
    command_api, monkeypatch, operation
):
    import pandas as pd

    from api.services import orders_service, portfolio_service
    from api.services.portfolio import write

    snapshot = _empty_snapshot() if operation == "create_order" else _snapshot()
    payloads = {
        "create_order": _entry_payload(command_api),
        "fill_order": {
            "order_id": "ORD-MSFT-001",
            "filled_price": 400,
            "filled_date": "2026-09-09",
        },
        "close_position": {"position_id": "POS-AAPL-001", "exit_price": 220},
        "partial_close": {
            "position_id": "POS-AAPL-001",
            "price": 220,
            "shares_closed": 3,
        },
        "update_stop": {"position_id": "POS-AAPL-001", "new_stop": 200},
    }
    responses = []
    for date, close in [("2026-09-09", 210), ("2026-09-10", 199)]:
        monkeypatch.setattr(orders_service, "get_today_str", lambda date=date: date)
        monkeypatch.setattr(write, "get_today_str", lambda date=date: date)
        provider = SimpleNamespace(
            fetch_ohlcv=lambda *args, close=close, **kwargs: pd.DataFrame(
                [[close]], columns=pd.MultiIndex.from_tuples([("Close", "AAPL")])
            )
        )
        monkeypatch.setattr(
            portfolio_service,
            "get_market_data_provider",
            lambda provider=provider: provider,
        )
        response = _post_command(command_api, snapshot, operation, payloads[operation])
        assert response.status_code == 200, response.text
        responses.append(response.json())
    assert responses[0] == responses[1]
    if operation == "fill_order":
        assert responses[0]["positions"][1]["position_id"] == "POS-STABLE-001"
    if operation == "close_position":
        assert responses[0]["positions"][0]["exit_date"] == "2026-09-09"


@pytest.mark.parametrize(
    "missing", ["context", "effective_at", "new_position_id", "market_price"]
)
def test_stateless_commands_fail_closed_without_required_deterministic_inputs(
    command_api, missing
):
    operation = "fill_order" if missing == "new_position_id" else "update_stop"
    payload = (
        {"order_id": "ORD-MSFT-001", "filled_price": 400, "filled_date": "2026-09-09"}
        if operation == "fill_order"
        else {"position_id": "POS-AAPL-001", "new_stop": 200}
    )
    body = {
        "snapshot": _snapshot().model_dump(mode="json"),
        "expected_revision": 4,
        "command": {"operation": operation, "payload": payload},
        "context": _context(),
    }
    if missing == "context":
        body.pop("context")
    else:
        body["context"].pop(missing)
    response = command_api.client.post("/api/portfolio/state/commands", json=body)
    assert response.status_code == 422, response.text


def test_configured_concentration_threshold_changes_warning_only_assessment(
    command_api,
):
    snapshot = _snapshot()
    snapshot.orders = []
    position = snapshot.positions[0]
    position.ticker = "ASML.AS"
    position.quote_currency = position.account_currency = "EUR"
    position.entry_fx_rate = 1
    assessments = []
    for threshold in [30, 40]:
        command_api.config.risk.max_concentration_pct = threshold
        response = _post_command(
            command_api, snapshot, "create_order", _entry_payload(command_api)
        )
        assert response.status_code == 200, response.text
        approval = response.json()["orders"][0]["portfolio_approval"]
        assert approval["approved"] is True
        assert approval["concentration"]["limit"] == threshold
        assert approval["concentration"]["projected"] == pytest.approx(33.333333)
        assessments.append(approval["concentration"]["status"])
    assert assessments == ["WARN", "PASS"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("ticker", "MSFT"),
        ("price", 0),
        ("price", "NaN"),
        ("observed_at", "2026-09-09T20:01:00Z"),
        ("observed_at", "2026-09-07T20:00:00Z"),
        ("observed_at", "2026-09-09T19:59:00"),
        ("data_status", "stale"),
    ],
)
def test_stop_observation_requires_valid_matching_fresh_price(
    command_api, market_price, field, value
):
    context = _context()
    context["market_price"][field] = value
    response = command_api.client.post(
        "/api/portfolio/state/commands",
        json={
            "snapshot": _snapshot().model_dump(mode="json"),
            "expected_revision": 4,
            "command": {
                "operation": "update_stop",
                "payload": {"position_id": "POS-AAPL-001", "new_stop": 200},
            },
            "context": context,
        },
    )
    assert response.status_code == 422, response.text


def test_new_fill_identity_cannot_overwrite_an_existing_position(command_api):
    context = _context()
    context["new_position_id"] = "POS-AAPL-001"
    response = command_api.client.post(
        "/api/portfolio/state/commands",
        json={
            "snapshot": _snapshot().model_dump(mode="json"),
            "expected_revision": 4,
            "command": {
                "operation": "fill_order",
                "payload": {
                    "order_id": "ORD-MSFT-001",
                    "filled_price": 400,
                    "filled_date": "2026-09-09",
                },
            },
            "context": context,
        },
    )
    assert response.status_code == 409, response.text


def test_historical_effective_time_cannot_replay_expired_approval_token(
    command_api, monkeypatch
):
    from api.services import orders_service

    payload = _entry_payload(command_api)
    token = command_api.signer.verify(payload["approval_token"])
    first = _post_command(command_api, _empty_snapshot(), "create_order", payload)
    assert first.status_code == 200, first.text
    monkeypatch.setattr(orders_service.time, "time", lambda: token.expires_at + 1)
    response = _post_command(command_api, _empty_snapshot(), "create_order", payload)
    assert response.status_code == 422, response.text
    assert "expired" in response.text


def _entry_payload(api, *, claims=None, **updates):
    from api.services.order_approval_token import ApprovalTokenClaims, strategy_revision

    token = api.signer.issue(
        ApprovalTokenClaims(
            **{
                "ticker": "NVDA",
                "order_type": "BUY_LIMIT",
                "setup_status": "PASS",
                "trigger_status": "PASS",
                "plan_status": "PASS",
                "data_status": "current",
                "data_asof": "2026-09-08",
                "strategy_id": api.strategy["id"],
                "strategy_revision": strategy_revision(api.strategy),
                "account_currency": "EUR",
                "quote_currency": "EUR",
                "account_to_quote_rate": 1,
                "target_source": "structural",
                "days_to_earnings": 20,
                "generated_entry": 100,
                "generated_stop": 95,
                "generated_target": 112,
                **(claims or {}),
            }
        )
    )
    return {
        "ticker": "NVDA",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": 100,
        "stop_price": 95,
        "target_price": 112,
        "approval_token": token,
        **updates,
    }


def _empty_snapshot():
    return TradingStateSnapshot(revision=4, strategy=_strategy())


def test_create_order_uses_signed_backend_policy_and_returns_isolated_next_snapshot(
    command_api,
):
    snapshot = _empty_snapshot()
    before = snapshot.model_dump()
    response = _post_command(
        command_api, snapshot, "create_order", _entry_payload(command_api)
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["revision"] == 5
    assert result["affected_order_ids"] == ["ORD-NVDA-001"]
    assert result["affected_position_ids"] == []
    order = result["orders"][0]
    assert order["status"] == "pending"
    assert order["quantity"] == 10
    assert order["portfolio_approval"]["projected_risk"] == 50
    assert order["portfolio_approval"]["concentration"]["status"] == "WARN"
    assert order["decision_context"]["setup_status"] == "PASS"
    assert snapshot.model_dump() == before


@pytest.mark.parametrize(
    ("operation", "status"),
    [("submit_order", "submitted"), ("cancel_order", "cancelled")],
)
def test_order_status_commands_match_canonical_lifecycle(
    command_api, operation, status
):
    snapshot = _snapshot()
    response = _post_command(
        command_api, snapshot, operation, {"order_id": "ORD-MSFT-001"}
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["orders"][0]["status"] == status
    assert result["positions"] == snapshot.model_dump(mode="json")["positions"]
    assert result["affected_order_ids"] == ["ORD-MSFT-001"]
    assert result["affected_position_ids"] == []


def test_revision_conflict_precedes_lifecycle_work(command_api):
    response = _post_command(
        command_api,
        _snapshot(),
        "submit_order",
        {"order_id": "missing"},
        expected_revision=3,
    )
    assert response.status_code == 409, response.text
    assert "revision" in response.text


@pytest.mark.parametrize(
    ("fee", "fx"), [(None, None), (2.5, 1.12)], ids=["regular", "degiro"]
)
def test_entry_fill_creates_position_with_canonical_risk_and_broker_metadata(
    command_api, fee, fx
):
    snapshot = _snapshot()
    snapshot.orders[0].quote_currency = "USD"
    snapshot.orders[0].account_currency = "EUR"
    snapshot.orders[0].approval_fx_rate = 1.1
    before = snapshot.model_dump()
    response = _post_command(
        command_api,
        snapshot,
        "fill_order",
        {
            "order_id": "ORD-MSFT-001",
            "filled_price": 402,
            "filled_date": "2026-09-09",
            "fee_eur": fee,
            "fill_fx_rate": fx,
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    filled = result["orders"][0]
    position = result["positions"][1]
    assert filled["status"] == "filled"
    assert filled["entry_price"] == 402
    assert filled["fee_eur"] == fee
    assert filled["fill_fx_rate"] == fx
    assert position["entry_price"] == 402
    assert position["stop_price"] == 390
    assert position["shares"] == 10
    assert position["initial_risk"] == 12
    assert position["entry_fee_eur"] == fee
    assert position["entry_fx_rate"] == (1.1 if fx is None else 1.12)
    assert position["source_order_id"] == "ORD-MSFT-001"
    assert position["entry_date"] == "2026-09-09"
    assert result["affected_order_ids"] == ["ORD-MSFT-001"]
    assert result["affected_position_ids"] == [position["position_id"]]
    assert snapshot.model_dump() == before


def _add_on_snapshot():
    snapshot = _snapshot()
    snapshot.positions[0].quote_currency = "USD"
    snapshot.positions[0].account_currency = "EUR"
    snapshot.positions[0].entry_fx_rate = 1.1
    snapshot.positions[0].entry_fee_eur = 2
    snapshot.orders[0].ticker = "AAPL"
    snapshot.orders[0].position_id = "POS-AAPL-001"
    snapshot.orders[0].quote_currency = "USD"
    snapshot.orders[0].account_currency = "EUR"
    snapshot.orders[0].stop_price = 190
    return snapshot


def test_add_on_fill_blends_entry_fx_and_fees_while_retaining_live_stop(command_api):
    response = _post_command(
        command_api,
        _add_on_snapshot(),
        "fill_order",
        {
            "order_id": "ORD-MSFT-001",
            "filled_price": 220,
            "filled_date": "2026-09-09",
            "fee_eur": 3,
            "fill_fx_rate": 1.2,
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert len(result["positions"]) == 1
    position = result["positions"][0]
    assert position["shares"] == 20
    assert position["entry_price"] == 210
    assert position["stop_price"] == 190
    assert position["initial_risk"] == 20
    assert position["entry_fee_eur"] == 5
    assert position["entry_fx_rate"] == pytest.approx(1.150207468879668)
    assert result["affected_position_ids"] == ["POS-AAPL-001"]


def test_failed_add_on_fill_keeps_input_snapshot_and_service_reusable(command_api):
    from api.services.stateless_trading_service import StatelessTradingService
    from swing_screener.errors import UnprocessableError

    snapshot = _add_on_snapshot()
    snapshot.orders[0].quote_currency = "EUR"
    before = snapshot.model_dump()
    service = StatelessTradingService(
        SimpleNamespace(get=lambda: command_api.config),
        SimpleNamespace(get_active_strategy=lambda: command_api.strategy),
        command_api.signer,
    )
    request = TradingStateCommandRequest(
        snapshot=snapshot,
        expected_revision=4,
        context=_context(),
        command={
            "operation": "fill_order",
            "payload": {
                "order_id": "ORD-MSFT-001",
                "filled_price": 220,
                "filled_date": "2026-09-09",
                "fill_fx_rate": 1.2,
            },
        },
    )
    with pytest.raises(UnprocessableError, match="currency context"):
        service.execute(request)
    assert request.snapshot.model_dump() == before
    request.snapshot.orders[0].quote_currency = "USD"
    result = service.execute(request)
    assert result.revision == 5
    assert result.positions[0].shares == 20


@pytest.fixture
def market_price(monkeypatch):
    import pandas as pd

    from api.services import portfolio_service

    provider = SimpleNamespace(
        fetch_ohlcv=lambda tickers, **kwargs: pd.DataFrame(
            [[210.0]],
            columns=pd.MultiIndex.from_tuples([("Close", "AAPL")]),
            index=pd.to_datetime(["2026-09-09"]),
        )
    )
    monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda: provider)


def test_stop_update_preserves_initial_risk_and_appends_reason(
    command_api, market_price
):
    snapshot = _snapshot()
    snapshot.positions[0].initial_risk = 10
    response = _post_command(
        command_api,
        snapshot,
        "update_stop",
        {
            "position_id": "POS-AAPL-001",
            "new_stop": 200.125,
            "reason": "Protect profit",
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    position = result["positions"][0]
    assert position["stop_price"] == 200.13
    assert position["initial_risk"] == 10
    assert "Protect profit" in position["notes"]
    assert result["orders"] == snapshot.model_dump(mode="json")["orders"]
    assert result["affected_position_ids"] == ["POS-AAPL-001"]
    assert result["affected_order_ids"] == []


@pytest.mark.parametrize("new_stop", [189, 211])
def test_stop_update_rejects_lower_stop_and_stop_above_market(
    command_api, market_price, new_stop
):
    snapshot = _snapshot()
    before = snapshot.model_dump()
    response = _post_command(
        command_api,
        snapshot,
        "update_stop",
        {"position_id": "POS-AAPL-001", "new_stop": new_stop},
    )
    assert response.status_code == 400, response.text
    assert snapshot.model_dump() == before


def test_partial_then_final_close_preserves_risk_and_realized_legs(
    command_api, market_price
):
    snapshot = _snapshot()
    snapshot.positions[0].initial_risk = 10
    snapshot.positions[0].stop_price = 205
    partial = _post_command(
        command_api,
        snapshot,
        "partial_close",
        {
            "position_id": "POS-AAPL-001",
            "shares_closed": 4,
            "price": 220,
            "fee_eur": 2,
            "fx_rate": 1.15,
        },
    )
    assert partial.status_code == 200, partial.text
    result = partial.json()
    position = result["positions"][0]
    assert position["shares"] == 6
    assert position["status"] == "open"
    assert position["partial_closes"][0]["r_at_close"] == 2
    assert position["partial_closes"][0]["fee_eur"] == 2
    assert position["partial_closes"][0]["fx_rate"] == 1.15
    final = _post_command(
        command_api,
        TradingStateSnapshot.model_validate(result),
        "close_position",
        {
            "position_id": "POS-AAPL-001",
            "exit_price": 230,
            "fee_eur": 3,
            "exit_fx_rate": 1.2,
            "reason": "Target reached",
            "lesson": "Follow plan",
            "tags": ["winner"],
        },
    )
    assert final.status_code == 200, final.text
    result = final.json()
    closed = result["positions"][0]
    assert result["revision"] == 6
    assert closed["status"] == "closed"
    assert closed["shares"] == 6
    assert closed["exit_price"] == 230
    assert closed["exit_fee_eur"] == 3
    assert closed["exit_fx_rate"] == 1.2
    assert closed["lesson"] == "Follow plan"
    assert closed["tags"] == ["winner"]
    assert closed["partial_closes"] == position["partial_closes"]
    assert result["affected_position_ids"] == ["POS-AAPL-001"]
    assert result["affected_order_ids"] == []


def test_partial_close_rejects_full_quantity(command_api, market_price):
    response = _post_command(
        command_api,
        _snapshot(),
        "partial_close",
        {"position_id": "POS-AAPL-001", "shares_closed": 10, "price": 220},
    )
    assert response.status_code == 400, response.text
    assert "use close_position" in response.text


def test_final_close_without_partial_leg(command_api, market_price):
    response = _post_command(
        command_api,
        _snapshot(),
        "close_position",
        {"position_id": "POS-AAPL-001", "exit_price": 180},
    )
    assert response.status_code == 200, response.text
    position = response.json()["positions"][0]
    assert position["status"] == "closed"
    assert position["shares"] == 10
    assert position["exit_price"] == 180
    assert position["partial_closes"] == []


@pytest.mark.parametrize(
    ("policy", "value", "gate"),
    [
        ("risk_pct", 0.004, "trade_risk"),
        ("max_position_pct", 0.05, "position"),
        ("max_portfolio_heat_pct", 0.004, "heat"),
        ("commission_pct", 0.02, "fees"),
        ("min_rr", 3, "reward_risk"),
    ],
)
def test_create_uses_configured_policy_even_when_browser_strategy_is_more_permissive(
    command_api, policy, value, gate
):
    snapshot = _empty_snapshot()
    snapshot.strategy.risk.account_size = 1_000_000
    command_api.strategy["risk"][policy] = value
    before = snapshot.model_dump()
    response = _post_command(
        command_api, snapshot, "create_order", _entry_payload(command_api)
    )
    assert response.status_code == 422, response.text
    assert gate in response.text
    assert snapshot.model_dump() == before


def test_create_counts_browser_holdings_against_configured_capital(command_api):
    snapshot = _snapshot()
    snapshot.orders = []
    position = snapshot.positions[0]
    position.entry_price = 990
    position.stop_price = 989
    position.quote_currency = position.account_currency = "EUR"
    position.entry_fx_rate = 1
    response = _post_command(
        command_api, snapshot, "create_order", _entry_payload(command_api)
    )
    assert response.status_code == 422, response.text
    assert "cash" in response.text


def test_create_blocks_earnings_from_signed_context_even_when_payload_claims_safe(
    command_api,
):
    response = _post_command(
        command_api,
        _empty_snapshot(),
        "create_order",
        _entry_payload(
            command_api, claims={"days_to_earnings": 2}, days_to_earnings=30
        ),
    )
    assert response.status_code == 422, response.text
    assert "event" in response.text


def test_create_blocks_missing_fx_on_existing_browser_exposure(command_api):
    snapshot = _snapshot()
    snapshot.orders = []
    snapshot.positions[0].quote_currency = "USD"
    snapshot.positions[0].account_currency = "EUR"
    response = _post_command(
        command_api, snapshot, "create_order", _entry_payload(command_api)
    )
    assert response.status_code == 422, response.text
    assert "FX" in response.text


def test_create_uses_signed_fx_to_calculate_account_exposure(command_api):
    response = _post_command(
        command_api,
        _empty_snapshot(),
        "create_order",
        _entry_payload(
            command_api,
            claims={"quote_currency": "USD", "account_to_quote_rate": 1.25},
            account_to_quote_rate=9,
        ),
    )
    assert response.status_code == 200, response.text
    order = response.json()["orders"][0]
    assert order["portfolio_approval"]["projected_notional"] == 800
    assert order["portfolio_approval"]["projected_risk"] == 40
    assert order["approval_fx_rate"] == 1.25


@pytest.mark.parametrize(
    ("ticker", "message"), [("AAPL", "open position"), ("MSFT", "pending entry")]
)
def test_create_blocks_duplicate_browser_exposure(command_api, ticker, message):
    response = _post_command(
        command_api,
        _snapshot(),
        "create_order",
        _entry_payload(command_api, ticker=ticker, claims={"ticker": ticker}),
    )
    assert response.status_code == 409, response.text
    assert message in response.text


def test_create_add_on_references_open_position(command_api):
    snapshot = _add_on_snapshot()
    snapshot.orders = []
    command_api.strategy["risk"]["max_position_pct"] = 0.6
    response = _post_command(
        command_api,
        snapshot,
        "create_order",
        _entry_payload(
            command_api,
            ticker="AAPL",
            entry_mode="ADD_ON",
            position_id="POS-AAPL-001",
            claims={
                "ticker": "AAPL",
                "quote_currency": "USD",
                "account_to_quote_rate": 1.1,
            },
        ),
    )
    assert response.status_code == 200, response.text
    assert response.json()["orders"][0]["position_id"] == "POS-AAPL-001"


@pytest.mark.parametrize("token", [None, "tampered"])
def test_create_requires_valid_signed_approval(command_api, token):
    response = _post_command(
        command_api,
        _empty_snapshot(),
        "create_order",
        _entry_payload(command_api, approval_token=token),
    )
    assert response.status_code == 422, response.text
    assert "approval token" in response.text


@pytest.mark.parametrize("operation", ["submit_order", "cancel_order", "fill_order"])
def test_terminal_order_cannot_be_transitioned(command_api, operation):
    snapshot = _snapshot()
    snapshot.orders[0].status = "filled"
    payload = {"order_id": "ORD-MSFT-001"}
    if operation == "fill_order":
        payload.update(filled_price=400, filled_date="2026-09-09")
    response = _post_command(command_api, snapshot, operation, payload)
    assert response.status_code == 409, response.text


def test_fill_failure_after_position_mutation_discards_entire_command(
    command_api, monkeypatch
):
    from api.repositories.in_memory_trading_state import InMemoryOrdersRepository
    from api.services.stateless_trading_service import StatelessTradingService

    service = StatelessTradingService(
        SimpleNamespace(get=lambda: command_api.config),
        SimpleNamespace(get_active_strategy=lambda: command_api.strategy),
        command_api.signer,
    )
    request = TradingStateCommandRequest(
        snapshot=_snapshot(),
        expected_revision=4,
        context=_context(),
        command={
            "operation": "fill_order",
            "payload": {
                "order_id": "ORD-MSFT-001",
                "filled_price": 400,
                "filled_date": "2026-09-09",
            },
        },
    )
    before = request.model_dump()
    original = InMemoryOrdersRepository.update_order

    def fail_update(*args, **kwargs):
        raise RuntimeError("injected order write failure")

    monkeypatch.setattr(InMemoryOrdersRepository, "update_order", fail_update)
    with pytest.raises(RuntimeError, match="injected order write failure"):
        service.execute(request)
    assert request.model_dump() == before
    monkeypatch.setattr(InMemoryOrdersRepository, "update_order", original)
    result = service.execute(request)
    assert result.revision == 5
    assert len(result.positions) == 2
    assert result.orders[0].status == "filled"


def _strategy() -> dict:
    return {
        "id": "swing-v1",
        "name": "Swing v1",
        "universe": {
            "trend": {"sma_fast": 20, "sma_mid": 50, "sma_long": 200},
            "vol": {"atr_window": 14},
            "mom": {
                "lookback_6m": 126,
                "lookback_12m": 252,
                "benchmark": "SPY",
            },
            "filt": {"min_price": 5.0, "max_price": 500.0, "max_atr_pct": 15.0},
        },
        "ranking": {"w_mom_6m": 0.45, "w_mom_12m": 0.35, "w_rs_6m": 0.2, "top_n": 100},
        "signals": {"breakout_lookback": 50, "pullback_ma": 20, "min_history": 252},
        "risk": {
            "account_size": 10_000,
            "risk_pct": 0.01,
            "max_position_pct": 0.2,
            "min_shares": 1,
            "k_atr": 2.0,
        },
        "manage": {},
        "created_at": "2026-09-08T00:00:00",
        "updated_at": "2026-09-08T00:00:00",
    }


def _snapshot() -> TradingStateSnapshot:
    return TradingStateSnapshot(
        revision=4,
        strategy=_strategy(),
        positions=[
            {
                "position_id": "POS-AAPL-001",
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2026-09-08",
                "entry_price": 200.0,
                "stop_price": 190.0,
                "shares": 10,
            }
        ],
        orders=[
            {
                "order_id": "ORD-MSFT-001",
                "ticker": "MSFT",
                "status": "pending",
                "order_type": "BUY_LIMIT",
                "order_kind": "entry",
                "quantity": 10,
                "limit_price": 400.0,
                "stop_price": 390.0,
                "order_date": "2026-09-08",
            }
        ],
    )


def test_trading_state_snapshot_round_trips_through_in_memory_repositories() -> None:
    state = InMemoryTradingState(_snapshot())

    assert state.strategy_repo.get_active_strategy()["id"] == "swing-v1"
    position = state.positions_repo.list_positions(status="open")[0][0]
    assert {
        "position_id": position["position_id"],
        "ticker": position["ticker"],
        "status": position["status"],
        "entry_price": position["entry_price"],
        "stop_price": position["stop_price"],
        "shares": position["shares"],
    } == {
        "position_id": "POS-AAPL-001",
        "ticker": "AAPL",
        "status": "open",
        "entry_price": 200.0,
        "stop_price": 190.0,
        "shares": 10,
    }
    order = state.orders_repo.list_orders(status="pending")[0][0]
    assert {
        "order_id": order["order_id"],
        "ticker": order["ticker"],
        "status": order["status"],
        "order_type": order["order_type"],
        "quantity": order["quantity"],
    } == {
        "order_id": "ORD-MSFT-001",
        "ticker": "MSFT",
        "status": "pending",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
    }

    state.orders_repo.submit_order("ORD-MSFT-001")
    state.positions_repo.update(
        lambda data: {
            **data,
            "positions": [
                {**data["positions"][0], "stop_price": 195.0},
            ],
        }
    )

    result = state.commit(
        expected_revision=4,
        affected_order_ids=["ORD-MSFT-001"],
        affected_position_ids=["POS-AAPL-001"],
    )

    assert result.revision == 5
    assert result.strategy.model_dump(mode="json") == _snapshot().strategy.model_dump(
        mode="json"
    )
    assert result.orders[0].status == "submitted"
    assert result.positions[0].stop_price == 195.0
    assert result.affected_order_ids == ["ORD-MSFT-001"]
    assert result.affected_position_ids == ["POS-AAPL-001"]
    round_trip = TradingStateSnapshot.model_validate(result.model_dump())
    assert round_trip.revision == 5
    assert round_trip.positions[0].stop_price == 195.0
    assert round_trip.orders[0].status == "submitted"


def test_trading_state_commit_rejects_stale_revision_without_advancing_state() -> None:
    state = InMemoryTradingState(_snapshot())

    with pytest.raises(
        ConflictError, match="expected revision 3, current revision is 4"
    ):
        state.commit(expected_revision=3)

    assert state.snapshot.revision == 4
    assert state.snapshot.orders[0].status == "pending"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("strategy", {}),
        ("positions", [{"ticker": "AAPL"}]),
        ("orders", [{"order_id": "ORD-AAPL-001"}]),
    ],
)
def test_trading_state_snapshot_rejects_malformed_canonical_records(
    field: str, value: object
) -> None:
    payload = _snapshot().model_dump(mode="json")
    payload[field] = value

    with pytest.raises(ValidationError):
        TradingStateSnapshot.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("ticker", "   "),
        ("entry_price", "NaN"),
        ("stop_price", -1.0),
        ("shares", 0),
    ],
)
def test_trading_state_snapshot_rejects_invalid_persisted_position_values(
    field: str, value: object
) -> None:
    payload = _snapshot().model_dump(mode="json")
    payload["positions"][0][field] = value

    with pytest.raises(ValidationError):
        TradingStateSnapshot.model_validate(payload)


@pytest.mark.parametrize(
    ("record_type", "field", "value"),
    [
        ("strategy", "id", "   "),
        ("strategy", "name", ""),
        ("orders", "limit_price", 0.0),
        ("orders", "stop_price", -1.0),
    ],
)
def test_trading_state_snapshot_rejects_invalid_strategy_and_order_values(
    record_type: str, field: str, value: object
) -> None:
    payload = _snapshot().model_dump(mode="json")
    record = (
        payload[record_type] if record_type == "strategy" else payload[record_type][0]
    )
    record[field] = value

    with pytest.raises(ValidationError):
        TradingStateSnapshot.model_validate(payload)


@pytest.mark.parametrize(
    "command",
    [
        {
            "operation": "create_order",
            "payload": {"ticker": "", "order_type": "BUY_LIMIT", "quantity": 0},
        },
        {"operation": "submit_order", "payload": {"order_id": ""}},
        {"operation": "cancel_order", "payload": {"order_id": ""}},
        {
            "operation": "fill_order",
            "payload": {
                "order_id": "ORD-MSFT-001",
                "filled_price": "NaN",
                "filled_date": "2026-09-09",
            },
        },
        {
            "operation": "update_stop",
            "payload": {"position_id": "", "new_stop": 0},
        },
        {
            "operation": "partial_close",
            "payload": {
                "position_id": "POS-AAPL-001",
                "shares_closed": 0,
                "price": 205.0,
            },
        },
        {
            "operation": "close_position",
            "payload": {"position_id": "POS-AAPL-001", "exit_price": "NaN"},
        },
    ],
)
def test_trading_command_request_rejects_invalid_operation_payloads(
    command: dict,
) -> None:
    with pytest.raises(ValidationError):
        TradingStateCommandRequest.model_validate(
            {
                "snapshot": _snapshot().model_dump(mode="json"),
                "expected_revision": 4,
                "command": command,
                "context": _context(),
            }
        )


def test_trading_command_request_normalizes_valid_create_order_payload() -> None:
    request = TradingStateCommandRequest.model_validate(
        {
            "snapshot": _snapshot().model_dump(mode="json"),
            "expected_revision": 4,
            "context": _context(),
            "command": {
                "operation": "create_order",
                "payload": {
                    "ticker": " msft ",
                    "order_type": " buy_limit ",
                    "quantity": 10,
                    "limit_price": 400.0,
                    "stop_price": 390.0,
                },
            },
        }
    )

    assert request.snapshot.orders[0].ticker == "MSFT"
    assert request.command.payload.ticker == "MSFT"
    assert request.command.payload.order_type == "BUY_LIMIT"
