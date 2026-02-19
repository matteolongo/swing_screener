# Phase 4 Managed Auth Runbook

> **Status: Active.**  
> **Last Reviewed:** February 19, 2026.

## Goal
Use provider-issued tokens for authentication and map identities to tenant membership, while retaining CSV mode for local/dev fallback.

## Modes
- `API_AUTH_MODE=csv`: legacy CSV email/password login (`/api/auth/login`)
- `API_AUTH_MODE=managed`: managed provider token flow (`/api/auth/exchange`)

## Managed Mode Setup
Set:

- `API_AUTH_ENABLED=true`
- `API_AUTH_MODE=managed`
- `API_AUTH_MANAGED_PROVIDER=oidc` (or your provider key)
- `API_AUTH_MANAGED_JWT_SECRET=<provider-signing-secret>`
- `API_AUTH_MEMBERSHIPS_CSV_PATH=data/tenant_memberships.csv`

Optional claim mapping overrides:
- `API_AUTH_MANAGED_SUBJECT_CLAIM`
- `API_AUTH_MANAGED_EMAIL_CLAIM`
- `API_AUTH_MANAGED_TENANT_CLAIM`
- `API_AUTH_MANAGED_ROLE_CLAIM`
- `API_AUTH_MANAGED_ACTIVE_CLAIM`

## Tenant Membership Mapping
Create `data/tenant_memberships.csv`:

```csv
provider,subject,email,tenant_id,role,active
oidc,user-123,friend@example.com,demo-tenant,member,true
```

Template:
- `data/tenant_memberships.example.csv`

Resolution order:
1. provider + subject lookup
2. provider + email lookup
3. fallback to tenant/role claims in provider token (if present and active)

## API Flow
1. Client receives provider token externally.
2. Client calls `POST /api/auth/exchange` with `provider_token`.
3. API validates provider token and returns app bearer token.
4. Client uses returned bearer token for protected routes.

## Web Flow
Set `VITE_AUTH_MODE=managed` and `VITE_AUTH_MANAGED_PROVIDER_LABEL=<name>` so login page uses token exchange UI.

## Validation Checklist
1. `POST /api/auth/exchange` succeeds for mapped provider identity.
2. `GET /api/auth/me` returns tenant-specific user.
3. Protected routes reject unauthenticated requests.
4. Tenant-scoped files continue to resolve under `data/tenants/<tenant_id>/`.
