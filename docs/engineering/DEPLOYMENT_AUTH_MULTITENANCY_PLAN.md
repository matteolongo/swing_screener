# Deployment, Auth, and Multi-Tenancy Plan

> **Status: Proposed (ready to execute).**  
> **Last Reviewed:** February 18, 2026.

## Goal
Deploy Swing Screener for external users (friends first) with a safe path from:

1. quick demo deployment,
2. temporary user management (env/CSV),
3. production-ready authentication,
4. true multi-tenant persistence.

## Non-Goals (for initial rollout)
- Full broker automation in production.
- Enterprise IAM/SSO on day one.
- Real-time websocket infrastructure.

## Phase 0: Architecture and rollout decisions
**Objective:** lock decisions before code changes.

**Deliverables**
- Hosting target selected for web and API.
- Auth provider decision for production (Supabase/Auth0/Clerk/etc.).
- Tenant model defined (`tenant_id`, user roles, default permissions).
- Environments defined: `local`, `staging`, `production`.

**Exit criteria**
- Short ADR-style note committed in repo (`docs/engineering`).
- Env var contract documented for API and web.

## Phase 1: Public demo deployment (no auth yet)
**Objective:** make the app reachable by external testers quickly.

**Backend changes**
- Make CORS origin list configurable via env in `api/main.py` (instead of localhost-only).
- Add production host/port run configuration.
- Confirm health endpoint is suitable for platform checks (`/health`).

**Frontend changes**
- Set `VITE_API_URL` in deployment environment.
- Build and deploy static web (`web-ui`) against hosted API.

**Infrastructure**
- Deploy web (e.g. Vercel/Netlify/Cloudflare Pages).
- Deploy API (e.g. Cloud Run/Render/Railway/Fly).
- Add basic monitoring checks on `/health`.

**Exit criteria**
- External user can open web URL and run read/write flows.
- No hardcoded localhost dependencies remain in deployment config.

## Phase 2: Temporary authentication (CSV users) + basic authorization
**Objective:** gate access with simple credentials while moving fast.

**Backend changes**
- Add `users.csv` loader/repository (email, password_hash, tenant_id, role, active).
- Add auth endpoints:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Implement JWT issue/verify with expiration and signing secret from env.
- Add auth dependency and protect sensitive routers (`portfolio`, `strategy`, `config`, `backtest`, `daily-review`, `intelligence`, `social`).

**Frontend changes**
- Add login page/form.
- Store access token (short-lived, refresh strategy decided in Phase 4).
- Send `Authorization: Bearer <token>` for API calls.
- Add logout and expired-session handling.

**Exit criteria**
- Anonymous requests to protected endpoints fail with `401`.
- Authorized user can complete core workflows.
- Users can be added quickly via CSV for friend testing.

## Phase 3: Tenant-scoped file persistence (intermediate multi-tenant)
**Objective:** isolate each tenant while still using JSON files.

**Backend changes**
- Extract tenant context from JWT claim (`tenant_id`).
- Update repository wiring in `api/dependencies.py`:
  - from fixed files (`data/positions.json`, `data/orders.json`)
  - to tenant paths (`data/tenants/<tenant_id>/positions.json`, `orders.json`).
- Ensure strategy/config/intelligence storage is tenant-aware where needed.
- Create tenant bootstrap files on first login or first write.

**Data model**
- Enforce path sanitization on tenant IDs.
- Keep file locking per tenant file.

**Exit criteria**
- Tenant A cannot access or mutate Tenant B data.
- Existing single-tenant local mode still works with default tenant.

## Phase 4: Production auth provider integration
**Objective:** replace temporary CSV auth with managed identity.

**Backend changes**
- Validate provider JWTs (JWKS/public keys).
- Map external identity to internal user profile and tenant membership.
- Replace local password logic with provider-based login flow.

**Frontend changes**
- Integrate provider SDK/login UI.
- Remove local credential form once migration complete.

**Exit criteria**
- New users onboard through provider auth.
- Local CSV auth disabled in production environment.

## Phase 5: Database migration for durable multi-tenant storage
**Objective:** move from JSON to relational storage for production reliability.

**Backend changes**
- Wire services to DB layer (`src/swing_screener/db.py`) behind repository interfaces.
- Add `tenant_id` to all relevant tables and indexes.
- Implement migration from JSON tenant files to DB.
- Keep compatibility mode fallback during migration window.

**Operational changes**
- Add backup/restore procedures.
- Add migration runbook and rollback plan.

**Exit criteria**
- Production reads/writes are DB-backed.
- Tenant isolation enforced in queries and repository layer.
- JSON file mode retained only for local/dev if desired.

## Phase 6: Security and reliability hardening
**Objective:** prepare for wider usage beyond friend testing.

**Hardening tasks**
- Rate limiting and brute-force protections on auth endpoints.
- Secrets rotation policy and secure env management.
- Audit logging for auth and data mutations.
- Better structured error telemetry and alerts.
- Optional per-tenant quotas/usage limits.

**Exit criteria**
- Security checklist completed and documented.
- Basic incident response/troubleshooting docs updated.

## Phase 7: Cutover and cleanup
**Objective:** finalize production posture and remove temporary scaffolding.

**Tasks**
- Remove CSV auth paths from production code.
- Remove temporary migration flags and dead code.
- Update docs (`README.md`, `api/README.md`, `docs/overview/INDEX.md`).
- Tag release and communicate rollout notes.

**Exit criteria**
- Single, documented auth flow.
- Single, documented persistence model for production.

## Suggested execution order
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7

## Implementation notes for this repo
- Existing API currently has no auth middleware and local-only CORS defaults (`api/main.py`).
- Existing repositories are file-backed and wired to global paths (`api/dependencies.py`).
- DB groundwork exists but is not wired by default (`src/swing_screener/db.py`, `docs/engineering/DATABASE_MIGRATION.md`).
- Frontend API client already supports `VITE_API_URL` (`web-ui/src/lib/api.ts`).
