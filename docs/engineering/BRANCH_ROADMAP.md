# Branch Roadmap (Deployment/Auth/Multi-Tenant)

> **Status: Active.**  
> **Last Reviewed:** February 18, 2026.

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
- Branch: `codex/phase-1-deployment-docs`
- Phase: 1 (Public demo deployment readiness)
- Scope:
  - Add phased implementation docs.
  - Add branch roadmap doc.
  - Prepare docs index for navigation.
- Status: In progress

## Next Branch (Planned)
- Branch: `codex/phase-2-csv-auth`
- Phase: 2 (Temporary CSV auth + authorization)
- Planned scope:
  - Add `users.csv`-backed auth repository.
  - Add login/me endpoints with JWT.
  - Protect sensitive routers.
  - Add login flow in web UI and auth header injection.

## Update Rules For Next Branch
When creating the next branch:

1. Move current branch entry to "Completed Branches".
2. Set new "Current Branch" with exact branch name and phase scope.
3. Update "Next Branch (Planned)" to the following phase.
4. Update `Last Reviewed` date.

## Completed Branches
- None yet.
