# Phase 3 Tenant Files Runbook

> **Status: Active.**  
> **Last Reviewed:** February 19, 2026.

## Goal
Scope file-based data by `tenant_id` when auth is enabled, so each tenant has isolated JSON state.

## What Is Tenant-Scoped
With `API_AUTH_ENABLED=true`, the API resolves tenant from bearer token claims and uses:

- `data/tenants/<tenant_id>/orders.json`
- `data/tenants/<tenant_id>/positions.json`
- `data/tenants/<tenant_id>/strategies.json`
- `data/tenants/<tenant_id>/active_strategy.json`
- `data/tenants/<tenant_id>/config.json`
- `data/tenants/<tenant_id>/intelligence/*`

## Tenant ID Rules
- Allowed characters: letters, numbers, `_`, `-`
- Length: 1-64 characters
- Invalid tenant IDs are rejected.

## Bootstrap Behavior
On first tenant access (auth enabled), the API creates missing files/directories:

- `orders.json` seeded with empty `orders`
- `positions.json` seeded with empty `positions`
- strategy files seeded with default strategy + active pointer
- `config.json` seeded from defaults with tenant file paths

## Verification Steps
1. Enable auth and configure users (`data/users.csv`).
2. Log in as two users with different `tenant_id`.
3. Create data as tenant A (e.g., create an order).
4. Query same endpoint as tenant B and confirm no tenant A data appears.
5. Confirm tenant directories/files exist under `data/tenants/`.

## Notes
- If auth is disabled, API behavior remains backward-compatible with legacy top-level files in `data/`.
- This is the intermediate file-based multi-tenant step before DB migration (Phase 5).
