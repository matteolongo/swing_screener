# Phase 2 Auth Runbook (CSV + JWT)

> **Status: Active.**  
> **Last Reviewed:** February 19, 2026.

## Goal
Enable temporary login/authz for friend testing before managed auth integration.

## 1. Enable Auth
Set these API environment variables:

- `API_AUTH_ENABLED=true`
- `API_AUTH_USERS_CSV_PATH=data/users.csv`
- `API_AUTH_JWT_SECRET=<secure-random-secret>`
- `API_AUTH_JWT_EXPIRE_MINUTES=480`

## 2. Prepare `users.csv`
Create `data/users.csv` with headers:

```csv
email,password_hash,tenant_id,role,active
friend@example.com,pbkdf2_sha256$120000$<salt_hex>$<hash_hex>,demo-tenant,member,true
```

Template:
- `data/users.example.csv`

Generate hash locally:

```bash
python -c "from api.security import hash_password; print(hash_password('your-password'))"
```

## 3. Verify API Protection
With auth enabled:

1. `POST /api/auth/login` should return `access_token`.
2. `GET /api/auth/me` with bearer token should return user context.
3. Protected routes without token (for example `GET /api/portfolio/orders`) should return `401`.

## 4. Verify Web Login
1. Open web app and confirm unauthenticated user is redirected to `/login`.
2. Sign in with CSV credentials.
3. Confirm core pages load after login.
4. Click `Logout` in header and confirm redirect to `/login`.

## Notes
- This is transitional auth for Phase 2 only.
- Tenant claim (`tenant_id`) is included in token for upcoming Phase 3 tenant-scoped persistence.
