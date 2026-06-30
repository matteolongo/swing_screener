"""Unit tests for pool admin diff, rebuild, refresh-all, and enrich jobs."""

from __future__ import annotations

import json
import time

import pytest

from api.repositories.symbol_pool_repo import SymbolPoolRepository
from api.services import pool_admin_service as svc
from api.services.pool_enrich_run_manager import PoolEnrichRunManager


def test_compute_pool_diff_additions_removals_modifications():
    old = [
        {"symbol": "AAPL", "sector": "Tech", "region": "us"},
        {"symbol": "TWTR", "sector": "Tech", "region": "us"},
    ]
    new = [
        {"symbol": "AAPL", "sector": "Healthcare", "region": "us"},
        {"symbol": "NVDA", "sector": "Tech", "region": "us"},
    ]
    diff = svc.compute_pool_diff(old, new, ("sector", "region"))

    assert [a["symbol"] for a in diff["additions"]] == ["NVDA"]
    assert [r["symbol"] for r in diff["removals"]] == ["TWTR"]
    assert diff["modifications"] == [
        {
            "symbol": "AAPL",
            "changes": [{"field": "sector", "before": "Tech", "after": "Healthcare"}],
        }
    ]
    assert diff["summary"] == {"added": 1, "removed": 1, "modified": 1, "unchanged": 0}


def test_compute_pool_diff_ignores_untracked_fields():
    old = [{"symbol": "AAPL", "sector": "Tech", "taxonomy_refreshed_at": "2026-01-01"}]
    new = [{"symbol": "AAPL", "sector": "Tech", "taxonomy_refreshed_at": "2026-06-30"}]
    diff = svc.compute_pool_diff(old, new, ("sector",))
    assert diff["modifications"] == []


def test_compute_pool_diff_list_field_is_order_insensitive():
    old = [{"symbol": "AAPL", "index_memberships": ["us_sp500", "us_nasdaq100"]}]
    new = [{"symbol": "AAPL", "index_memberships": ["us_nasdaq100", "us_sp500"]}]
    diff = svc.compute_pool_diff(old, new, ("index_memberships",))
    assert diff["modifications"] == []


def test_rebuild_pool_preserves_enrichment_and_diffs(tmp_path, monkeypatch):
    from swing_screener.data.symbol_pool import PoolSymbol

    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "asof": "2026-06-30",
                "symbols": [
                    {
                        "symbol": "AAPL",
                        "region": "us",
                        "sector": "Technology",
                        "market_cap_tier": "large",
                        "index_memberships": ["us_sp500"],
                    },
                    {
                        "symbol": "TWTR",
                        "region": "us",
                        "index_memberships": ["us_sp500"],
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    repo = SymbolPoolRepository(pool_path)

    def fake_base():
        return [
            PoolSymbol(
                symbol="AAPL",
                region="us",
                index_memberships=["us_sp500", "us_nasdaq100"],
            ),
            PoolSymbol(symbol="NVDA", region="us", index_memberships=["us_sp500"]),
        ]

    monkeypatch.setattr(svc, "build_pool_base", fake_base)

    result = svc.rebuild_pool(repo)

    written = json.loads(pool_path.read_text())
    by_sym = {s["symbol"]: s for s in written["symbols"]}
    assert by_sym["AAPL"]["sector"] == "Technology"
    assert by_sym["AAPL"]["market_cap_tier"] == "large"
    assert by_sym["NVDA"]["sector"] is None
    assert "TWTR" not in by_sym

    assert result["summary"]["added"] == 1
    assert result["summary"]["removed"] == 1
    assert [m["symbol"] for m in result["modifications"]] == ["AAPL"]


def test_rebuild_pool_raises_when_a_pool_op_is_running(tmp_path):
    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps({"schema_version": 1, "asof": "2026-06-30", "symbols": []}),
        encoding="utf-8",
    )
    repo = SymbolPoolRepository(pool_path)

    acquired = svc._POOL_WRITE_LOCK.acquire(blocking=False)
    assert acquired
    try:
        with pytest.raises(svc.PoolBusyError):
            svc.rebuild_pool(repo)
    finally:
        svc._POOL_WRITE_LOCK.release()


def test_refresh_all_aggregates_and_survives_partial_failure(monkeypatch):
    monkeypatch.setattr(
        svc,
        "list_package_universe_entries",
        lambda: [{"id": "us_sp500"}, {"id": "us_nasdaq100"}, {"id": "broken"}],
    )

    def fake_refresh(uid, apply):
        if uid == "broken":
            raise RuntimeError("source down")
        if uid == "us_sp500":
            return {
                "applied": True,
                "changed": True,
                "current_member_count": 503,
                "proposed_member_count": 504,
                "additions": ["SMCI"],
                "removals": [],
                "notes": [],
            }
        return {
            "applied": False,
            "changed": False,
            "current_member_count": 100,
            "proposed_member_count": 100,
            "additions": [],
            "removals": [],
            "notes": [],
        }

    monkeypatch.setattr(svc, "refresh_package_universe", fake_refresh)

    out = svc.refresh_all_universes()
    by_id = {u["id"]: u for u in out["universes"]}
    assert out["total_additions"] == 1
    assert out["total_changed"] == 1
    assert by_id["broken"]["error"] == "source down"
    assert by_id["us_sp500"]["additions"] == ["SMCI"]


def test_refresh_all_skips_auto_universes(monkeypatch):
    monkeypatch.setattr(
        svc,
        "list_package_universe_entries",
        lambda: [
            {"id": "us_sp500", "kind": "official"},
            {"id": "auto_liquid_supported", "kind": "auto"},
        ],
    )
    calls: list[str] = []

    def fake_refresh(uid, apply):
        calls.append(uid)
        return {
            "applied": True,
            "changed": False,
            "current_member_count": 1,
            "proposed_member_count": 1,
            "additions": [],
            "removals": [],
            "notes": [],
        }

    monkeypatch.setattr(svc, "refresh_package_universe", fake_refresh)

    out = svc.refresh_all_universes()
    assert calls == ["us_sp500"]  # auto id never passed to refresh_package_universe
    assert out["skipped_auto"] == 1
    assert {u["id"] for u in out["universes"]} == {"us_sp500"}


def _wait_terminal(get_status, job_id):
    for _ in range(100):
        status = get_status(job_id)
        if status and status["status"] in ("done", "failed"):
            return status
        time.sleep(0.02)
    return get_status(job_id)


def test_enrich_job_lifecycle(tmp_path, monkeypatch):
    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "asof": "2026-06-30",
                "symbols": [
                    {"symbol": "AAPL", "instrument_type": "equity"},
                    {"symbol": "BADSYM", "instrument_type": "equity"},
                ],
            }
        ),
        encoding="utf-8",
    )
    repo = SymbolPoolRepository(pool_path)

    manager = PoolEnrichRunManager(jobs_dir=tmp_path / "enrich_jobs")
    monkeypatch.setattr(svc, "get_pool_enrich_run_manager", lambda: manager)

    def fake_info(symbol):
        if symbol == "AAPL":
            return {"sector": "Technology", "marketCap": 3_000_000_000_000}
        return None  # BADSYM fails enrichment

    job_id = svc.start_enrich_job(repo, info_fn=fake_info)
    status = _wait_terminal(svc.get_enrich_status, job_id)

    assert status["status"] == "done"
    assert status["progress"]["total"] == 2
    assert status["progress"]["processed"] == 2
    assert status["progress"]["failed"] == 1
    assert "BADSYM" in status["diff"]["failed_symbols"]
    assert {m["symbol"] for m in status["diff"]["modified"]} == {"AAPL"}
    # Lock must be released so a subsequent op can run.
    assert svc._POOL_WRITE_LOCK.acquire(blocking=False)
    svc._POOL_WRITE_LOCK.release()


def test_enrich_unknown_job_returns_none(tmp_path, monkeypatch):
    manager = PoolEnrichRunManager(jobs_dir=tmp_path / "enrich_jobs")
    monkeypatch.setattr(svc, "get_pool_enrich_run_manager", lambda: manager)
    assert svc.get_enrich_status("does-not-exist") is None


def test_enrich_manager_recovers_interrupted_running_job(tmp_path):
    jobs_dir = tmp_path / "enrich_jobs"
    jobs_dir.mkdir(parents=True)
    (jobs_dir / "abc123.json").write_text(
        json.dumps(
            {
                "job_id": "abc123",
                "status": "running",
                "processed": 10,
                "total": 100,
                "failed": 0,
                "error": None,
                "result": None,
                "created_at": "2026-06-30T00:00:00",
                "updated_at": "2026-06-30T00:00:00",
            }
        ),
        encoding="utf-8",
    )

    manager = PoolEnrichRunManager(jobs_dir=jobs_dir)
    job = manager.get_job("abc123")
    assert job is not None
    assert job.status == "failed"
    assert "interrupted" in (job.error or "").lower()
