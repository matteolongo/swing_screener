# Branch Roadmap (Deployment/Auth/Multi-Tenant)

> **Status: Active.**  
> **Last Reviewed:** February 19, 2026.

## Purpose
Track implementation progress by branch, aligned to:

- `docs/engineering/DEPLOYMENT_AUTH_MULTITENANCY_PLAN.md`

This file is updated on every new implementation branch.

## Branch Sequence
1. `codex/phase-1-deployment-docs`
2. `codex/phase-2-csv-auth`
3. `codex/phase-3-tenant-files`
4. `codex/phase-4-managed-auth`
5. `codex/phase-5-db-migration`
6. `codex/phase-6-security-hardening`
7. `codex/phase-7-cutover-cleanup`

## Current Branch
- Branch: `codex/phase-3-tenant-files`
- Phase: 3 (Tenant-scoped file persistence)
- Scope:
  - Resolve orders/positions paths by authenticated `tenant_id`.
  - Isolate strategy/config/intelligence storage under tenant directories.
  - Add tenant file bootstrap for first access.
  - Add tenant isolation tests (cross-tenant data visibility checks).
- Status: Completed

## Next Branch (Planned)
- Branch: `codex/phase-4-managed-auth`
- Phase: 4 (Managed auth provider integration)
- Planned scope:
  - Replace CSV login with managed provider token validation.
  - Map provider identities to tenant membership.
  - Keep temporary CSV path only for local/dev fallback (if needed).

## Update Rules For Next Branch
When creating the next branch:

1. Move current branch entry to "Completed Branches".
2. Set new "Current Branch" with exact branch name and phase scope.
3. Update "Next Branch (Planned)" to the following phase.
4. Update `Last Reviewed` date.

## Completed Branches
- `codex/phase-1-deployment-docs` (docs + deployment env/CORS readiness)
- `codex/phase-2-csv-auth` (temporary CSV auth, JWT, protected routes, web login flow)
- `codex/phase-3-tenant-files` (tenant-scoped orders/positions/strategy/config/intelligence files)
