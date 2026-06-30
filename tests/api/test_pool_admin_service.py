"""Unit tests for pool admin diff, rebuild, refresh-all, and enrich jobs."""

from __future__ import annotations

import json
import time

from api.repositories.symbol_pool_repo import SymbolPoolRepository
from api.services import pool_admin_service as svc


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
    assert diff["summary"] == {
        "added": 1,
        "removed": 1,
        "modified": 1,
        "unchanged": 0,
    }


def test_compute_pool_diff_ignores_untracked_fields():
    old = [{"symbol": "AAPL", "sector": "Tech", "taxonomy_refreshed_at": "2026-01-01"}]
    new = [{"symbol": "AAPL", "sector": "Tech", "taxonomy_refreshed_at": "2026-06-30"}]
    diff = svc.compute_pool_diff(old, new, ("sector",))
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
    # Enrichment carried over for surviving symbol.
    assert by_sym["AAPL"]["sector"] == "Technology"
    assert by_sym["AAPL"]["market_cap_tier"] == "large"
    # New symbol present with null enrichment.
    assert by_sym["NVDA"]["sector"] is None
    # TWTR removed.
    assert "TWTR" not in by_sym

    assert result["summary"]["added"] == 1
    assert result["summary"]["removed"] == 1
    assert [m["symbol"] for m in result["modifications"]] == ["AAPL"]


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


def test_enrich_job_lifecycle(tmp_path):
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

    def fake_info(symbol):
        if symbol == "AAPL":
            return {"sector": "Technology", "marketCap": 3_000_000_000_000}
        return None  # BADSYM fails enrichment

    job_id = svc.start_enrich_job(repo, info_fn=fake_info)

    for _ in range(50):
        job = svc.get_enrich_job(job_id)
        if job.status in ("done", "failed"):
            break
        time.sleep(0.05)

    job = svc.get_enrich_job(job_id)
    assert job.status == "done"
    assert job.total == 2
    assert job.processed == 2
    assert job.failed == 1
    assert "BADSYM" in job.diff["failed_symbols"]
    mods = {m["symbol"] for m in job.diff["modified"]}
    assert "AAPL" in mods
