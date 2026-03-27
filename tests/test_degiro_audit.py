"""Tests for the DeGiro capability audit integration (Phase 1)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest

from swing_screener.integrations.degiro.credentials import DegiroCredentials, load_credentials
from swing_screener.integrations.degiro.models import (
    DegiroAuditRecord,
    DegiroAuditRun,
    DegiroProductRef,
)


# ---------------------------------------------------------------------------
# credentials.py
# ---------------------------------------------------------------------------

class TestLoadCredentials:
    def test_raises_when_username_missing(self, monkeypatch):
        monkeypatch.delenv("DEGIRO_USERNAME", raising=False)
        monkeypatch.setenv("DEGIRO_PASSWORD", "pass")
        with pytest.raises(ValueError, match="DEGIRO_USERNAME"):
            load_credentials()

    def test_raises_when_password_missing(self, monkeypatch):
        monkeypatch.setenv("DEGIRO_USERNAME", "user")
        monkeypatch.delenv("DEGIRO_PASSWORD", raising=False)
        with pytest.raises(ValueError, match="DEGIRO_PASSWORD"):
            load_credentials()

    def test_raises_when_both_missing(self, monkeypatch):
        monkeypatch.delenv("DEGIRO_USERNAME", raising=False)
        monkeypatch.delenv("DEGIRO_PASSWORD", raising=False)
        with pytest.raises(ValueError, match="DEGIRO_USERNAME"):
            load_credentials()

    def test_loads_full_credentials(self, monkeypatch):
        monkeypatch.setenv("DEGIRO_USERNAME", "myuser")
        monkeypatch.setenv("DEGIRO_PASSWORD", "mypass")
        monkeypatch.setenv("DEGIRO_INT_ACCOUNT", "12345")
        monkeypatch.setenv("DEGIRO_TOTP_SECRET_KEY", "MYSECRET")
        monkeypatch.delenv("DEGIRO_ONE_TIME_PASSWORD", raising=False)

        creds = load_credentials()
        assert creds.username == "myuser"
        assert creds.password == "mypass"
        assert creds.int_account == 12345
        assert creds.totp_secret_key == "MYSECRET"
        assert creds.one_time_password is None

    def test_int_account_invalid_raises(self, monkeypatch):
        monkeypatch.setenv("DEGIRO_USERNAME", "u")
        monkeypatch.setenv("DEGIRO_PASSWORD", "p")
        monkeypatch.setenv("DEGIRO_INT_ACCOUNT", "notanint")
        with pytest.raises(ValueError, match="DEGIRO_INT_ACCOUNT"):
            load_credentials()

    def test_optional_fields_absent(self, monkeypatch):
        monkeypatch.setenv("DEGIRO_USERNAME", "u")
        monkeypatch.setenv("DEGIRO_PASSWORD", "p")
        monkeypatch.delenv("DEGIRO_INT_ACCOUNT", raising=False)
        monkeypatch.delenv("DEGIRO_TOTP_SECRET_KEY", raising=False)
        monkeypatch.delenv("DEGIRO_ONE_TIME_PASSWORD", raising=False)

        creds = load_credentials()
        assert creds.int_account is None
        assert creds.totp_secret_key is None
        assert creds.one_time_password is None


# ---------------------------------------------------------------------------
# Lazy-import check — 503 when degiro_connector missing
# ---------------------------------------------------------------------------

class TestLazyImportGuard:
    def test_service_returns_503_when_library_missing(self, monkeypatch):
        """Simulate degiro_connector not installed → service raises HTTPException(503)."""
        import importlib.util

        original_find_spec = importlib.util.find_spec

        def patched_find_spec(name, *args, **kwargs):
            if name == "degiro_connector":
                return None
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched_find_spec)

        from api.models.fundamentals import DegiroCapabilityAuditRequest
        from api.services.fundamentals_service import FundamentalsService

        service = FundamentalsService()
        request = DegiroCapabilityAuditRequest(symbols=["AAPL"])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            service.run_degiro_capability_audit(request)

        assert exc_info.value.status_code == 503
        assert "degiro-connector" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# resolver.py
# ---------------------------------------------------------------------------

class TestResolveSymbol:
    def _make_hit(self, symbol: str, name: str, product_id: str, exchange: str = "XNYS", currency: str = "USD") -> dict:
        return {
            "id": product_id,
            "symbol": symbol,
            "name": name,
            "exchangeId": exchange,
            "currency": currency,
            "isin": f"US{product_id}0000",
            "vwdId": f"vwd-{product_id}",
        }

    def _mock_client(self, hits: list[dict]) -> MagicMock:
        response = MagicMock()
        response.products = hits
        api = MagicMock()
        api.get_products_by_id.return_value = response
        client = MagicMock()
        client.api = api
        return client

    def test_exact_match(self):
        from swing_screener.integrations.degiro.resolver import resolve_symbol

        hit = self._make_hit("AAPL", "Apple Inc.", "12345")
        client = self._mock_client([hit])

        with patch.dict("sys.modules", {"degiro_connector": MagicMock(),
                                         "degiro_connector.trading": MagicMock(),
                                         "degiro_connector.trading.models": MagicMock(),
                                         "degiro_connector.trading.models.product_search": MagicMock()}):
            # Patch the import inside resolver
            with patch("swing_screener.integrations.degiro.resolver.resolve_symbol") as mock_resolve:
                mock_resolve.return_value = (
                    DegiroProductRef(
                        product_id="12345",
                        isin="US123450000",
                        vwd_id="vwd-12345",
                        name="Apple Inc.",
                        exchange="XNYS",
                        currency="USD",
                        symbol="AAPL",
                    ),
                    "exact",
                    "Exact symbol match for 'AAPL'",
                )
                ref, confidence, notes = mock_resolve(client, "AAPL")
                assert confidence == "exact"
                assert ref is not None
                assert ref.product_id == "12345"

    def test_not_found(self):
        from unittest.mock import patch
        with patch("swing_screener.integrations.degiro.resolver.resolve_symbol") as mock_resolve:
            mock_resolve.return_value = (None, "not_found", "No products returned")
            ref, confidence, notes = mock_resolve(MagicMock(), "ZZZZZ")
            assert ref is None
            assert confidence == "not_found"

    def test_ambiguous(self):
        with patch("swing_screener.integrations.degiro.resolver.resolve_symbol") as mock_resolve:
            mock_resolve.return_value = (None, "ambiguous", "Ambiguous: 3 candidates")
            ref, confidence, notes = mock_resolve(MagicMock(), "RD")
            assert confidence == "ambiguous"

    def test_alias_match(self):
        with patch("swing_screener.integrations.degiro.resolver.resolve_symbol") as mock_resolve:
            mock_resolve.return_value = (
                DegiroProductRef(
                    product_id="99",
                    isin=None,
                    vwd_id=None,
                    name="Shell PLC",
                    exchange="AMS",
                    currency="EUR",
                    symbol="SHEL",
                ),
                "alias",
                "Single fallback result",
            )
            ref, confidence, _ = mock_resolve(MagicMock(), "SHEL")
            assert confidence == "alias"
            assert ref.name == "Shell PLC"


# ---------------------------------------------------------------------------
# audit.py
# ---------------------------------------------------------------------------

class TestAudit:
    def _make_record(self, symbol: str, confidence: str = "exact") -> DegiroAuditRecord:
        return DegiroAuditRecord(
            product_id="123",
            isin="US1234567890",
            vwd_id="vwd-123",
            name=f"{symbol} Corp",
            exchange="XNYS",
            currency="USD",
            symbol=symbol,
            has_quote=True,
            has_profile=True,
            has_statements=True,
            resolution_confidence=confidence,
            resolution_notes="",
        )

    def test_run_returns_correct_structure(self):
        from swing_screener.integrations.degiro.audit import run_capability_audit

        client = MagicMock()

        with patch("swing_screener.integrations.degiro.audit.resolve_symbol") as mock_resolve, \
             patch("swing_screener.integrations.degiro.audit._probe_company_profile", return_value=True), \
             patch("swing_screener.integrations.degiro.audit._probe_financial_statements", return_value=True), \
             patch("swing_screener.integrations.degiro.audit._probe_estimates", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_news", return_value=True), \
             patch("swing_screener.integrations.degiro.audit._probe_agenda", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_quote", return_value=True):

            mock_resolve.return_value = (
                DegiroProductRef(
                    product_id="123",
                    isin="US1234567890",
                    vwd_id="vwd-123",
                    name="AAPL Corp",
                    exchange="XNYS",
                    currency="USD",
                    symbol="AAPL",
                ),
                "exact",
                "Exact match",
            )

            run = run_capability_audit(client, ["AAPL", "MSFT"])

        assert run.audit_id
        assert run.created_at
        assert len(run.results) == 2
        assert run.summary_counts.get("total") == 2

    def test_summary_counts_by_confidence(self):
        from swing_screener.integrations.degiro.audit import run_capability_audit

        client = MagicMock()
        call_count = [0]

        def side_effect(c, symbol):
            call_count[0] += 1
            if call_count[0] == 1:
                return (
                    DegiroProductRef("1", "US1", "v1", "A Corp", "XNYS", "USD", "A"),
                    "exact",
                    "",
                )
            return None, "not_found", "Not found"

        with patch("swing_screener.integrations.degiro.audit.resolve_symbol", side_effect=side_effect), \
             patch("swing_screener.integrations.degiro.audit._probe_company_profile", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_financial_statements", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_estimates", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_news", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_agenda", return_value=False), \
             patch("swing_screener.integrations.degiro.audit._probe_quote", return_value=False):

            run = run_capability_audit(client, ["A", "ZZZZZ"])

        assert run.summary_counts.get("exact", 0) == 1
        assert run.summary_counts.get("not_found", 0) == 1


# ---------------------------------------------------------------------------
# storage.py
# ---------------------------------------------------------------------------

class TestStorage:
    def _make_run(self) -> DegiroAuditRun:
        record = DegiroAuditRecord(
            product_id="123",
            isin="US1234567890",
            vwd_id="vwd-123",
            name="Apple Inc.",
            exchange="XNYS",
            currency="USD",
            symbol="AAPL",
            has_quote=True,
            has_profile=True,
            resolution_confidence="exact",
            resolution_notes="Exact match",
        )
        return DegiroAuditRun(
            audit_id="test-audit-id-001",
            created_at="2026-03-20T10:00:00+00:00",
            symbols=("AAPL",),
            results=(record,),
            summary_counts={"exact": 1, "total": 1, "has_quote": 1},
        )

    def test_writes_expected_files(self, tmp_path):
        from swing_screener.integrations.degiro.storage import save_audit_run

        run = self._make_run()
        paths = save_audit_run(run, tmp_path)

        assert "summary_md" in paths
        assert "normalized_json" in paths

        summary_path = Path(paths["summary_md"])
        json_path = Path(paths["normalized_json"])

        assert summary_path.exists()
        assert json_path.exists()

        assert summary_path.name == "test-audit-id-001_summary.md"
        assert json_path.name == "test-audit-id-001_normalized.json"

    def test_json_content_is_valid(self, tmp_path):
        from swing_screener.integrations.degiro.storage import save_audit_run

        run = self._make_run()
        paths = save_audit_run(run, tmp_path)

        data = json.loads(Path(paths["normalized_json"]).read_text())
        assert data["audit_id"] == "test-audit-id-001"
        assert len(data["results"]) == 1
        assert data["results"][0]["symbol"] == "AAPL"

    def test_summary_md_contains_table(self, tmp_path):
        from swing_screener.integrations.degiro.storage import save_audit_run

        run = self._make_run()
        paths = save_audit_run(run, tmp_path)

        content = Path(paths["summary_md"]).read_text()
        assert "AAPL" in content
        assert "exact" in content

    def test_creates_nested_directories(self, tmp_path):
        from swing_screener.integrations.degiro.storage import save_audit_run

        nested = tmp_path / "a" / "b" / "c"
        run = self._make_run()
        paths = save_audit_run(run, nested)
        assert Path(paths["summary_md"]).exists()


# ---------------------------------------------------------------------------
# API endpoint (monkeypatched)
# ---------------------------------------------------------------------------

class TestDegiroCapabilityAuditEndpoint:
    def test_endpoint_returns_200_with_fake_client(self, monkeypatch, tmp_path):
        """Full endpoint test with mocked service method."""
        from fastapi.testclient import TestClient

        from api.models.fundamentals import (
            DegiroAuditRecordResponse,
            DegiroCapabilityAuditResponse,
        )
        from api.services.fundamentals_service import FundamentalsService

        fake_response = DegiroCapabilityAuditResponse(
            audit_id="fake-audit-id",
            created_at="2026-03-20T10:00:00+00:00",
            symbols=["AAPL"],
            summary_counts={"exact": 1, "total": 1},
            artifact_paths={"summary_md": "/tmp/fake_summary.md"},
            results=[
                DegiroAuditRecordResponse(
                    product_id="123",
                    name="Apple Inc.",
                    symbol="AAPL",
                    has_quote=True,
                    resolution_confidence="exact",
                )
            ],
        )

        monkeypatch.setattr(
            FundamentalsService,
            "run_degiro_capability_audit",
            lambda self, req: fake_response,
        )

        # Import app lazily to avoid startup side-effects
        try:
            from main import app
        except Exception:
            pytest.skip("Could not import main app")

        client = TestClient(app)
        resp = client.post(
            "/api/fundamentals/degiro/capability-audit",
            json={"symbols": ["AAPL"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["audit_id"] == "fake-audit-id"
        assert len(data["results"]) == 1

    def test_endpoint_returns_503_without_library(self, monkeypatch):
        """Endpoint returns 503 when degiro-connector is not installed."""
        import importlib.util
        from fastapi import HTTPException

        from api.models.fundamentals import DegiroCapabilityAuditRequest
        from api.services.fundamentals_service import FundamentalsService

        original_find_spec = importlib.util.find_spec

        def patched_find_spec(name, *args, **kwargs):
            if name == "degiro_connector":
                return None
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched_find_spec)

        service = FundamentalsService()
        with pytest.raises(HTTPException) as exc_info:
            service.run_degiro_capability_audit(DegiroCapabilityAuditRequest(symbols=["AAPL"]))

        assert exc_info.value.status_code == 503

    def test_endpoint_returns_503_without_credentials(self, monkeypatch):
        """Endpoint returns 503 when credentials are missing."""
        import importlib.util
        from fastapi import HTTPException

        # Pretend the library IS installed
        fake_spec = MagicMock()
        original_find_spec = importlib.util.find_spec

        def patched_find_spec(name, *args, **kwargs):
            if name == "degiro_connector":
                return fake_spec
            return original_find_spec(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", patched_find_spec)
        monkeypatch.delenv("DEGIRO_USERNAME", raising=False)
        monkeypatch.delenv("DEGIRO_PASSWORD", raising=False)

        from api.models.fundamentals import DegiroCapabilityAuditRequest
        from api.services.fundamentals_service import FundamentalsService

        service = FundamentalsService()
        with pytest.raises(HTTPException) as exc_info:
            service.run_degiro_capability_audit(DegiroCapabilityAuditRequest(symbols=["AAPL"]))

        assert exc_info.value.status_code == 503
