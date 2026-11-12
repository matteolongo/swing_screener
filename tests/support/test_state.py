"""Contract tests for isolated SQL portfolio state."""

from tests.support.factories.portfolio import order_payload, position_payload
from tests.support.state import seed_portfolio


def test_seed_portfolio_writes_rows_to_an_isolated_database(tmp_path, monkeypatch):
    state = seed_portfolio(
        monkeypatch,
        tmp_path,
        positions=[position_payload()],
        orders=[order_payload()],
        asof="2026-02-01",
    )

    import api.dependencies as dependencies
    from api.db.unit_of_work import PortfolioUnitOfWork

    assert dependencies._test_database_url == state.url
    runtime = dependencies.get_database_runtime()
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        orders, orders_asof = uow.orders.list_orders()
        positions, _ = uow.positions.list_positions()
    assert orders_asof == "2026-02-01"
    assert orders[0]["order_id"] == "ORD-001"
    assert len(positions) == 1
