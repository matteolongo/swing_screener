"""Tests for tenant-scoped strategy repository mode."""
from __future__ import annotations

from pathlib import Path

from api.repositories.strategy_repo import StrategyRepository


def test_tenant_strategy_repo_bootstraps_default_files(tmp_path: Path):
    tenant_dir = tmp_path / "tenant-a"
    repo = StrategyRepository(data_dir=tenant_dir)

    strategies = repo.list_strategies()

    assert len(strategies) >= 1
    assert any(item.get("id") == "default" for item in strategies)
    assert (tenant_dir / "strategies.json").exists()
    assert (tenant_dir / "active_strategy.json").exists()


def test_tenant_strategy_repo_isolated_between_tenants(tmp_path: Path):
    tenant_a_repo = StrategyRepository(data_dir=tmp_path / "tenant-a")
    tenant_b_repo = StrategyRepository(data_dir=tmp_path / "tenant-b")

    strategies_a = tenant_a_repo.list_strategies()
    default_strategy = next(item for item in strategies_a if item.get("id") == "default")

    custom = dict(default_strategy)
    custom["id"] = "custom-a"
    custom["name"] = "Custom A"
    custom["is_default"] = False
    strategies_a.append(custom)
    tenant_a_repo.save_strategies(strategies_a)
    tenant_a_repo.set_active_strategy_id("custom-a")

    tenant_a_ids = {item.get("id") for item in tenant_a_repo.list_strategies()}
    tenant_b_ids = {item.get("id") for item in tenant_b_repo.list_strategies()}

    assert "custom-a" in tenant_a_ids
    assert "custom-a" not in tenant_b_ids
    assert tenant_a_repo.get_active_strategy_id() == "custom-a"
    assert tenant_b_repo.get_active_strategy_id() == "default"

