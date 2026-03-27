"""Tests for DeGiro portfolio reconciliation / sync service (Phase 2)."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from swing_screener.integrations.degiro.models import DegiroSyncRaw
from swing_screener.integrations.degiro.sync import normalize, preview, apply


# ---------------------------------------------------------------------------
# Matching tests
# ---------------------------------------------------------------------------

class TestOrderMatching:
    def _local_order(self, **kwargs) -> dict:
        base = {
            "order_id": "local-1",
            "ticker": "AAPL",
            "status": "filled",
            "order_type": "BUY_LIMIT",
            "quantity": 10,
            "order_date": "2026-03-01",
            "broker_order_id": None,
            "broker_product_id": None,
            "isin": None,
        }
        return {**base, **kwargs}

    def _broker_order(self, **kwargs) -> dict:
        base = {
            "orderId": "broker-abc",
            "productId": "99999",
            "quantity": 10,
            "buysell": 1,
            "date": "2026-03-01",
            "isin": "US0378331005",
        }
        return {**base, **kwargs}

    def _make_sync_raw(self, broker_orders: list[dict], transactions: list[dict] = None) -> DegiroSyncRaw:
        return DegiroSyncRaw(
            positions=[],
            pending_orders=[],
            order_history=broker_orders,
            transactions=transactions or [],
            cash=[],
        )

    def test_exact_broker_order_id_match(self):
        local = [self._local_order(broker_order_id="broker-abc")]
        broker_orders = [self._broker_order(orderId="broker-abc")]
        sync_raw = self._make_sync_raw(broker_orders)

        result = preview(sync_raw, local, [])

        assert len(result.orders_to_update) == 1
        assert result.orders_to_update[0].confidence == "exact"

    def test_fuzzy_field_match(self):
        local = [self._local_order(broker_product_id="99999")]
        broker_orders = [self._broker_order(orderId="NEW-BROKER-ID")]  # no broker_order_id in local
        sync_raw = self._make_sync_raw(broker_orders)

        result = preview(sync_raw, local, [])

        # Should match via product_id + side + qty + date
        update_or_create = list(result.orders_to_update) + list(result.orders_to_create)
        assert len(update_or_create) >= 1

    def test_ambiguous_stays_in_ambiguous(self):
        # Two local orders with same product_id, same qty/date/side → ambiguous
        local = [
            self._local_order(order_id="local-1", broker_product_id="99999"),
            self._local_order(order_id="local-2", broker_product_id="99999"),
        ]
        broker_orders = [self._broker_order(orderId="broker-xyz")]
        sync_raw = self._make_sync_raw(broker_orders)

        result = preview(sync_raw, local, [])

        assert len(result.ambiguous) == 1

    def test_unmatched_goes_to_unmatched(self):
        local = []
        broker_orders = [self._broker_order(orderId="broker-xyz", productId="11111", isin="")]
        sync_raw = self._make_sync_raw(broker_orders)

        result = preview(sync_raw, local, [])

        # No local orders → should be "create" (broker records we don't know about)
        assert len(result.orders_to_create) >= 1 or len(result.unmatched) >= 1


# ---------------------------------------------------------------------------
# Fee resolution
# ---------------------------------------------------------------------------

class TestFeeResolution:
    def test_fee_resolved_from_transaction(self):
        local = [{"order_id": "local-1", "ticker": "AAPL", "status": "filled",
                  "order_type": "BUY_LIMIT", "quantity": 10, "order_date": "2026-03-01",
                  "broker_order_id": "broker-fee-1", "broker_product_id": None, "isin": None}]
        broker_order = {
            "orderId": "broker-fee-1",
            "productId": "88888",
            "quantity": 10,
            "buysell": 1,
            "date": "2026-03-01",
        }
        transaction = {
            "orderId": "broker-fee-1",
            "feeInBaseCurrency": 2.50,
        }
        sync_raw = DegiroSyncRaw(
            positions=[],
            pending_orders=[],
            order_history=[broker_order],
            transactions=[transaction],
            cash=[],
        )

        result = preview(sync_raw, local, [])

        assert result.fees_applied == 1
        matched = list(result.orders_to_update)
        assert len(matched) == 1
        assert matched[0].fields.get("fee_eur") == 2.50

    def test_fee_unresolved_stays_none(self):
        local = [{"order_id": "local-1", "ticker": "AAPL", "status": "filled",
                  "order_type": "BUY_LIMIT", "quantity": 10, "order_date": "2026-03-01",
                  "broker_order_id": "broker-no-fee", "broker_product_id": None, "isin": None}]
        broker_order = {"orderId": "broker-no-fee", "productId": "77777", "quantity": 10,
                        "buysell": 1, "date": "2026-03-01"}
        sync_raw = DegiroSyncRaw(
            positions=[], pending_orders=[], order_history=[broker_order],
            transactions=[], cash=[],
        )

        result = preview(sync_raw, local, [])

        assert result.fees_applied == 0
        matched = list(result.orders_to_update)
        assert matched[0].fields.get("fee_eur") is None

    def test_multi_currency_fee_preserved(self):
        """fee_eur from transaction is stored as-is; fx_rate is not applied here."""
        local = [{"order_id": "local-1", "ticker": "SHEL", "status": "filled",
                  "order_type": "BUY_LIMIT", "quantity": 5, "order_date": "2026-03-10",
                  "broker_order_id": "broker-fx", "broker_product_id": None, "isin": None}]
        broker_order = {"orderId": "broker-fx", "productId": "55555", "quantity": 5,
                        "buysell": 1, "date": "2026-03-10"}
        transaction = {"orderId": "broker-fx", "totalFeesInBaseCurrency": 1.75}
        sync_raw = DegiroSyncRaw(
            positions=[], pending_orders=[], order_history=[broker_order],
            transactions=[transaction], cash=[],
        )

        result = preview(sync_raw, local, [])

        matched = list(result.orders_to_update)
        assert matched[0].fields.get("fee_eur") == 1.75


# ---------------------------------------------------------------------------
# apply() idempotency
# ---------------------------------------------------------------------------

class TestApplyIdempotency:
    def _make_sync_raw_with_update(self) -> DegiroSyncRaw:
        return DegiroSyncRaw(
            positions=[],
            pending_orders=[],
            order_history=[{
                "orderId": "broker-idem",
                "productId": "66666",
                "quantity": 3,
                "buysell": 1,
                "date": "2026-03-05",
            }],
            transactions=[{"orderId": "broker-idem", "feeInBaseCurrency": 1.00}],
            cash=[],
        )

    def _local_orders_json(self, tmp_path: Path) -> Path:
        orders_path = tmp_path / "orders.json"
        orders_path.write_text(json.dumps({
            "asof": "2026-03-05",
            "orders": [{
                "order_id": "local-idem",
                "ticker": "TEST",
                "status": "filled",
                "order_type": "BUY_LIMIT",
                "quantity": 3,
                "order_date": "2026-03-05",
                "broker_order_id": "broker-idem",
                "broker_product_id": None,
                "isin": None,
                "fee_eur": None,
            }]
        }))
        return orders_path

    def test_apply_twice_no_duplicates(self, tmp_path):
        orders_path = self._local_orders_json(tmp_path)
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({"asof": "2026-03-05", "positions": []}))

        sync_raw = self._make_sync_raw_with_update()
        local_orders = json.loads(orders_path.read_text())["orders"]
        prev = preview(sync_raw, local_orders, [])

        apply(prev, orders_path, positions_path)
        apply(prev, orders_path, positions_path)

        final = json.loads(orders_path.read_text())["orders"]
        assert len(final) == 1
        assert final[0]["fee_eur"] == 1.00

    def test_apply_updates_fee_on_existing_order(self, tmp_path):
        orders_path = self._local_orders_json(tmp_path)
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({"asof": "2026-03-05", "positions": []}))

        sync_raw = self._make_sync_raw_with_update()
        local_orders = json.loads(orders_path.read_text())["orders"]
        prev = preview(sync_raw, local_orders, [])

        result = apply(prev, orders_path, positions_path)

        assert result.orders_updated == 1
        assert result.fees_applied == 1


# ---------------------------------------------------------------------------
# Stale broker-managed local state reconciliation
# ---------------------------------------------------------------------------

class TestStaleBrokerReconciliation:
    def test_apply_cancels_missing_broker_managed_pending_order(self, tmp_path):
        orders_path = tmp_path / "orders.json"
        orders_path.write_text(json.dumps({
            "asof": "2026-03-25",
            "orders": [{
                "order_id": "local-pending",
                "ticker": "EXAS",
                "status": "pending",
                "order_type": "BUY_LIMIT",
                "quantity": 1,
                "order_date": "2026-03-20",
                "broker_order_id": "degiro-old-1",
                "broker_synced_at": "2026-03-24T10:00:00+00:00",
                "notes": "",
            }],
        }))
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({"asof": "2026-03-25", "positions": []}))

        local_orders = json.loads(orders_path.read_text())["orders"]
        prev = preview(
            DegiroSyncRaw(positions=[], pending_orders=[], order_history=[], transactions=[], cash=[]),
            local_orders,
            [],
        )

        assert any(
            diff.local_id == "local-pending" and diff.fields.get("status") == "cancelled"
            for diff in prev.orders_to_update
        )

        apply(prev, orders_path, positions_path)

        final = json.loads(orders_path.read_text())["orders"]
        assert final[0]["status"] == "cancelled"
        assert "no longer active at broker" in final[0]["notes"]

    def test_apply_preserves_local_only_pending_order(self, tmp_path):
        orders_path = tmp_path / "orders.json"
        orders_path.write_text(json.dumps({
            "asof": "2026-03-25",
            "orders": [{
                "order_id": "local-draft",
                "ticker": "EXAS",
                "status": "pending",
                "order_type": "BUY_LIMIT",
                "quantity": 1,
                "order_date": "2026-03-20",
                "notes": "",
            }],
        }))
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({"asof": "2026-03-25", "positions": []}))

        local_orders = json.loads(orders_path.read_text())["orders"]
        prev = preview(
            DegiroSyncRaw(positions=[], pending_orders=[], order_history=[], transactions=[], cash=[]),
            local_orders,
            [],
        )

        assert not any(diff.local_id == "local-draft" for diff in prev.orders_to_update)

        apply(prev, orders_path, positions_path)

        final = json.loads(orders_path.read_text())["orders"]
        assert final[0]["status"] == "pending"

    def test_apply_closes_missing_broker_managed_position_and_linked_order(self, tmp_path):
        orders_path = tmp_path / "orders.json"
        orders_path.write_text(json.dumps({
            "asof": "2026-03-25",
            "orders": [{
                "order_id": "stop-1",
                "ticker": "REP.MC",
                "status": "pending",
                "order_type": "SELL_STOP",
                "quantity": 23,
                "position_id": "pos-1",
                "order_date": "2026-03-15",
                "notes": "",
            }],
        }))
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({
            "asof": "2026-03-25",
            "positions": [{
                "position_id": "pos-1",
                "ticker": "REP.MC",
                "status": "open",
                "entry_date": "2026-03-10",
                "entry_price": 21.40,
                "stop_price": 21.85,
                "shares": 23,
                "broker_product_id": "prod-123",
                "broker_synced_at": "2026-03-24T10:00:00+00:00",
                "notes": "",
            }],
        }))

        local_orders = json.loads(orders_path.read_text())["orders"]
        local_positions = json.loads(positions_path.read_text())["positions"]
        sync_raw = DegiroSyncRaw(
            positions=[],
            pending_orders=[],
            order_history=[],
            transactions=[{
                "productId": "prod-123",
                "date": "2026-03-25T14:30:00",
                "price": 23.62,
                "quantity": -23,
                "buysell": "S",
                "feeInBaseCurrency": 1.25,
            }],
            cash=[],
        )

        prev = preview(sync_raw, local_orders, local_positions)

        assert any(
            diff.local_id == "pos-1" and diff.fields.get("status") == "closed"
            for diff in prev.positions_to_update
        )
        assert any(
            diff.local_id == "stop-1" and diff.fields.get("status") == "cancelled"
            for diff in prev.orders_to_update
        )

        apply(prev, orders_path, positions_path)

        final_positions = json.loads(positions_path.read_text())["positions"]
        final_orders = json.loads(orders_path.read_text())["orders"]
        assert final_positions[0]["status"] == "closed"
        assert final_positions[0]["exit_date"] == "2026-03-25"
        assert final_positions[0]["exit_price"] == 23.62
        assert final_positions[0]["exit_fee_eur"] == 1.25
        assert "position no longer open at broker" in final_positions[0]["notes"]
        assert final_orders[0]["status"] == "cancelled"
        assert "linked position no longer open at broker" in final_orders[0]["notes"]

    def test_apply_closes_missing_isin_only_open_position(self, tmp_path):
        orders_path = tmp_path / "orders.json"
        orders_path.write_text(json.dumps({"asof": "2026-03-25", "orders": []}))
        positions_path = tmp_path / "positions.json"
        positions_path.write_text(json.dumps({
            "asof": "2026-03-25",
            "positions": [{
                "position_id": "pos-isin-only",
                "ticker": "REP.MC",
                "status": "open",
                "entry_date": "2026-03-01",
                "entry_price": 21.40,
                "stop_price": 21.85,
                "shares": 23,
                "isin": "ES0173516115",
                "notes": "",
            }],
        }))

        local_positions = json.loads(positions_path.read_text())["positions"]
        prev = preview(
            DegiroSyncRaw(positions=[], pending_orders=[], order_history=[], transactions=[], cash=[]),
            [],
            local_positions,
        )

        assert any(
            diff.local_id == "pos-isin-only" and diff.fields.get("status") == "closed"
            for diff in prev.positions_to_update
        )

        apply(prev, orders_path, positions_path)

        final_positions = json.loads(positions_path.read_text())["positions"]
        assert final_positions[0]["status"] == "closed"
        assert "position no longer open at broker" in final_positions[0]["notes"]


# ---------------------------------------------------------------------------
# Pending order sync
# ---------------------------------------------------------------------------

class TestPendingOrderSync:
    def test_pending_order_included_in_preview(self):
        pending = {
            "orderId": "pending-001",
            "productId": "55555",
            "quantity": 2,
            "buysell": 1,
            "date": "2026-03-18",
        }
        sync_raw = DegiroSyncRaw(
            positions=[],
            pending_orders=[pending],
            order_history=[],
            transactions=[],
            cash=[],
        )

        result = preview(sync_raw, [], [])

        all_orders = (
            list(result.orders_to_create)
            + list(result.orders_to_update)
            + list(result.ambiguous)
            + list(result.unmatched)
        )
        broker_ids = [d.broker_id for d in all_orders]
        assert "pending-001" in broker_ids


# ---------------------------------------------------------------------------
# API preview/apply endpoints (fake client)
# ---------------------------------------------------------------------------

class TestSyncEndpoints:
    def test_status_endpoint_reports_optional_degiro_when_library_missing(self, monkeypatch):
        import importlib.util
        from fastapi.testclient import TestClient

        original_find_spec = importlib.util.find_spec

        def patched(name, *args, **kwargs):
            if name == "degiro_connector":
                return None
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched)

        try:
            from main import app
        except Exception:
            pytest.skip("Could not import main app")

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/portfolio/degiro/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is False
        assert data["mode"] == "missing_library"
        assert "rest of the app still works" in data["detail"]

    def test_preview_endpoint_503_without_library(self, monkeypatch):
        import importlib.util
        from fastapi.testclient import TestClient

        original_find_spec = importlib.util.find_spec

        def patched(name, *args, **kwargs):
            if name == "degiro_connector":
                return None
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched)

        try:
            from main import app
        except Exception:
            pytest.skip("Could not import main app")

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/portfolio/sync/degiro/preview",
            json={"from_date": "2026-01-01", "to_date": "2026-03-20"},
        )
        assert resp.status_code == 503

    def test_apply_endpoint_503_without_credentials(self, monkeypatch):
        import importlib.util
        from fastapi.testclient import TestClient

        fake_spec = MagicMock()
        original_find_spec = importlib.util.find_spec

        def patched(name, *args, **kwargs):
            if name == "degiro_connector":
                return fake_spec
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched)
        monkeypatch.delenv("DEGIRO_USERNAME", raising=False)
        monkeypatch.delenv("DEGIRO_PASSWORD", raising=False)

        try:
            from main import app
        except Exception:
            pytest.skip("Could not import main app")

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/portfolio/sync/degiro/apply",
            json={"from_date": "2026-01-01", "to_date": "2026-03-20"},
        )
        assert resp.status_code == 503
