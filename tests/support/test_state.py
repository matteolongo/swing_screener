"""Contract tests for isolated JSON portfolio state."""

import json

from tests.support.factories.portfolio import order_payload, position_payload
from tests.support.state import JsonPortfolioState


def test_json_state_writes_documents_and_installs_paths(tmp_path, monkeypatch):
    state = JsonPortfolioState(tmp_path / "positions.json", tmp_path / "orders.json")
    state.write(
        positions=[position_payload()], orders=[order_payload()], asof="2026-02-01"
    )
    state.install(monkeypatch)

    import api.dependencies as dependencies

    assert dependencies.get_positions_path() == state.positions_path
    assert dependencies.get_orders_path() == state.orders_path
    assert json.loads(state.positions_path.read_text())["asof"] == "2026-02-01"
    assert (
        json.loads(state.orders_path.read_text())["orders"][0]["order_id"] == "ORD-001"
    )
