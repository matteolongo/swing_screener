# Backend Authentication Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the deployed API with provider-neutral OIDC sessions, claim-based viewer/admin authorization, CSRF checks, bounded rate limits, and a frontend authentication gate.

**Architecture:** A typed security configuration feeds an OIDC service and a Starlette middleware stack. Session middleware runs outermost, authentication/authorization runs next, rate limiting runs after a principal is resolved, and CORS remains innermost. The React application uses one authenticated transport and an `AuthProvider` so credentials and CSRF handling cannot drift between feature clients.

**Tech Stack:** FastAPI, Starlette sessions, Authlib OIDC client, Pydantic, React 18, TanStack Query, Vitest, pytest.

## Global Constraints

- Production uses OIDC authorization-code flow and refuses to start with authentication disabled or incomplete configuration.
- Role/group claims map to `viewer` and `admin`; identities without an allowed value are denied.
- `AUTH_MODE=disabled` is valid only for `APP_ENV=development|test` and resolves to a local admin principal.
- Static UI files, OIDC flow endpoints, and `GET /health/live` are public; business APIs, readiness, metrics, and enabled docs are protected.
- Unsafe business methods require admin and a session-bound CSRF token.
- The current one-worker deployment uses a bounded in-memory fixed-window limiter; no distributed limiter is introduced.
- Intelligence sweeps are rejected above the configured symbol cap before analyzer or provider work starts.
- This PR does not change order risk formulas, order persistence, or broker behavior.

---

## File Map

**Create**

- `api/security/settings.py`: typed environment parsing and production validation.
- `api/security/models.py`: principal, role, session response, and stable security error types.
- `api/security/oidc.py`: OIDC client protocol, Authlib adapter, nonce/session lifecycle, and claim-to-role mapping.
- `api/security/context.py`: request principal/session helpers and public-path classification.
- `api/security/middleware.py`: authentication, authorization, CSRF, and rate-limit middleware.
- `api/security/rate_limit.py`: bounded fixed-window store and route policy selection.
- `api/security/openapi.py`: cookie security scheme and protected-operation annotation.
- `api/security/__init__.py`: public security interfaces.
- `api/routers/auth.py`: login, callback, session, and logout endpoints.
- `tests/api/security/test_settings.py`: environment contract tests.
- `tests/api/security/test_oidc.py`: role mapping and OIDC flow tests.
- `tests/api/security/test_boundary.py`: route/role/CSRF/session/OpenAPI integration tests.
- `tests/api/security/test_rate_limit.py`: pure limiter and endpoint policy tests.
- `web-ui/src/features/auth/types.ts`: frontend session/principal types.
- `web-ui/src/features/auth/AuthProvider.tsx`: session bootstrap and auth state.
- `web-ui/src/features/auth/LoginGate.tsx`: loading, login, and authenticated render states.
- `web-ui/src/features/auth/AuthProvider.test.tsx`: auth state tests.
- `web-ui/src/features/auth/LoginGate.test.tsx`: gate interaction tests.
- `web-ui/src/lib/apiFetch.ts`: credentialed transport, CSRF injection, and expiry event.
- `web-ui/src/lib/apiFetch.test.ts`: transport tests.

**Modify**

- `pyproject.toml`, `uv.lock`: add Authlib and explicit `itsdangerous` runtime dependencies.
- `api/main.py`: register auth router, middleware in the required order, live/readiness split, and secure OpenAPI.
- `api/routers/intelligence.py`: enforce the configurable sweep cap at model validation.
- `tests/conftest.py`: set explicit test auth environment before importing API modules and reset security caches.
- `tests/test_monitoring.py`: update live/readiness expectations.
- `web-ui/src/lib/api.ts`: add auth endpoint constants.
- `web-ui/src/lib/fetchJson.ts`: delegate to `apiFetch`.
- `web-ui/src/features/screener/api.ts`, `web-ui/src/features/screener/recurrenceApi.ts`, `web-ui/src/features/backtest/api.ts`, `web-ui/src/features/portfolio/api.ts`, `web-ui/src/features/intelligence/catalysts/api.ts`: remove direct raw `fetch` usage.
- `web-ui/src/App.tsx`: install `AuthProvider` and `LoginGate` before business routes.
- `web-ui/src/components/layout/Header.tsx`: display identity/role and logout command.
- `web-ui/src/test/mocks/handlers.ts`: add authenticated-session/logout handlers.
- `.env.example`, `app.json`, `docker-compose.yml`, `api/README.md`, `config/README.md`: document and wire the security contract.

---

### Task 1: Typed Security Configuration

**Files:**
- Create: `api/security/settings.py`
- Create: `tests/api/security/test_settings.py`
- Modify: `tests/conftest.py`

**Interfaces:**
- Produces: `AuthSettings.from_env(environ: Mapping[str, str] | None = None) -> AuthSettings`
- Produces: `AuthSettings.validate_runtime() -> None`
- Produces: `get_auth_settings() -> AuthSettings` and `reset_auth_settings_cache() -> None`
- Raises: `SecurityConfigurationError` with a secret-free message.

- [ ] **Step 1: Make test mode explicit before API imports**

Add these statements at the top of `tests/conftest.py`, before `pytest` imports API modules through fixtures:

```python
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_MODE", "disabled")
```

- [ ] **Step 2: Write failing environment-contract tests**

Create tests covering the exact defaults and failures:

```python
def test_production_defaults_to_oidc_and_requires_complete_configuration():
    settings = AuthSettings.from_env({"APP_ENV": "production"})
    assert settings.auth_mode == "oidc"
    with pytest.raises(SecurityConfigurationError, match="OIDC_DISCOVERY_URL"):
        settings.validate_runtime()


def test_disabled_auth_is_rejected_in_production():
    settings = AuthSettings.from_env({
        "APP_ENV": "production",
        "AUTH_MODE": "disabled",
    })
    with pytest.raises(SecurityConfigurationError, match="disabled"):
        settings.validate_runtime()


def test_test_mode_allows_disabled_auth_and_resolves_limits():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})
    settings.validate_runtime()
    assert settings.session_cookie_secure is False
    assert settings.rate_limit_max_buckets == 10_000
    assert settings.intelligence_sweep_max_symbols == 20
```

Also cover invalid enum values, short `SESSION_SECRET`, insecure production cookies, empty role sets, non-integer/negative limits, sweep cap outside `1..100`, and comma-separated role normalization.

- [ ] **Step 3: Run the settings tests and confirm RED**

Run:

```bash
pytest tests/api/security/test_settings.py -q
```

Expected: collection fails because `api.security.settings` does not exist.

- [ ] **Step 4: Implement immutable typed settings**

Implement an ASCII-only dataclass and helpers. The public shape must be:

```python
AppEnvironment = Literal["development", "test", "production"]
AuthMode = Literal["disabled", "oidc"]

@dataclass(frozen=True)
class AuthSettings:
    app_env: AppEnvironment
    auth_mode: AuthMode
    oidc_discovery_url: str
    oidc_client_id: str
    oidc_client_secret: str
    oidc_redirect_uri: str
    oidc_role_claim: str
    oidc_admin_values: frozenset[str]
    oidc_viewer_values: frozenset[str]
    session_secret: str
    session_ttl_seconds: int
    session_cookie_secure: bool
    trust_proxy_headers: bool
    rate_limit_default_per_minute: int
    rate_limit_mutation_per_minute: int
    rate_limit_expensive_per_minute: int
    rate_limit_sweep_per_minute: int
    rate_limit_max_buckets: int
    intelligence_sweep_max_symbols: int

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "AuthSettings": ...
    def validate_runtime(self) -> None: ...
```

Use a development-only session secret only when auth is disabled. Never include secret values in validation errors or `repr` output. Cache `get_auth_settings()` with `lru_cache(maxsize=1)`.

- [ ] **Step 5: Run settings tests and confirm GREEN**

Run:

```bash
pytest tests/api/security/test_settings.py -q
```

Expected: all settings tests pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add tests/conftest.py tests/api/security/test_settings.py api/security/settings.py
git commit -m "Add fail-closed auth settings"
```

---

### Task 2: Principal, Session, and Role Mapping

**Files:**
- Create: `api/security/models.py`
- Create: `api/security/context.py`
- Create: `tests/api/security/test_oidc.py`

**Interfaces:**
- Produces: `Role = Literal["viewer", "admin"]`
- Produces: `Principal(subject: str, email: str | None, display_name: str | None, role: Role)`
- Produces: `resolve_role(claims: Mapping[str, object], settings: AuthSettings) -> Role | None`
- Produces: `principal_from_session(request: Request, settings: AuthSettings, now: int | None = None) -> Principal | None`
- Produces: `establish_session(request: Request, principal: Principal, settings: AuthSettings, now: int | None = None) -> str`

- [ ] **Step 1: Write failing role/session tests**

Cover scalar/list claims, admin precedence, no-role denial, expiry, malformed session dictionaries, local disabled-mode admin, session rotation, and CSRF length:

```python
def test_admin_claim_takes_precedence_over_viewer(settings):
    claims = {"roles": ["viewer", "admin"]}
    assert resolve_role(claims, settings) == "admin"


def test_establish_session_discards_pre_auth_values(request, settings):
    request.session.update({"state": "old", "nonce": "old"})
    csrf = establish_session(request, Principal("sub-1", None, None, "viewer"), settings, now=100)
    assert request.session == {
        "subject": "sub-1",
        "email": None,
        "display_name": None,
        "role": "viewer",
        "issued_at": 100,
        "expires_at": 100 + settings.session_ttl_seconds,
        "csrf_token": csrf,
    }
    assert len(csrf) >= 32
```

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/security/test_oidc.py -q`.

Expected: imports fail for missing models/context modules.

- [ ] **Step 3: Implement security models and session helpers**

Use Pydantic response models for `/api/auth/session` and a frozen dataclass for
the internal principal. Session parsing must reject booleans/nonnumeric times,
unknown roles, missing subject, and expired values; rejection clears the session.
Use `secrets.token_urlsafe(32)` for CSRF.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `pytest tests/api/security/test_oidc.py -q`.

- [ ] **Step 5: Commit Task 2**

```bash
git add api/security/models.py api/security/context.py tests/api/security/test_oidc.py
git commit -m "Add authenticated session principals"
```

---

### Task 3: OIDC Adapter and Auth Router

**Files:**
- Create: `api/security/oidc.py`
- Create: `api/routers/auth.py`
- Modify: `api/security/__init__.py`
- Modify: `pyproject.toml`
- Modify: `uv.lock`
- Extend: `tests/api/security/test_oidc.py`

**Interfaces:**
- Consumes: `AuthSettings`, `Principal`, `resolve_role`, `establish_session`.
- Produces protocol:

```python
class OIDCClient(Protocol):
    async def authorization_redirect(self, request: Request, redirect_uri: str, nonce: str) -> Response: ...
    async def authorize_access_token(self, request: Request, nonce: str) -> Mapping[str, object]: ...
```

- Produces: `get_oidc_client(request: Request) -> OIDCClient`.
- Produces router endpoints under `/api/auth`.

- [ ] **Step 1: Add failing router tests with a fake OIDC client**

Use a fake implementing the protocol; do not contact a provider. Assert:

```python
def test_callback_denies_identity_without_allowed_role(client, fake_oidc):
    fake_oidc.claims = {"sub": "u-1", "roles": ["unknown"]}
    response = client.get("/api/auth/callback?code=x&state=expected")
    assert response.status_code == 403
    assert response.json()["code"] == "OIDC_ROLE_DENIED"


def test_callback_establishes_minimal_session(client, fake_oidc):
    fake_oidc.claims = {"sub": "u-1", "email": "u@example.test", "roles": ["viewer"]}
    response = client.get("/api/auth/callback?code=x&state=expected", follow_redirects=False)
    assert response.status_code == 303
    session = client.get("/api/auth/session").json()
    assert session["user"]["subject"] == "u-1"
    assert session["role"] == "viewer"
    assert "access_token" not in session
```

Also test login nonce creation, state/nonce/provider exceptions, missing `sub`,
logout clearing the cookie, and disabled-mode session response.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run `pytest tests/api/security/test_oidc.py -q`.

- [ ] **Step 3: Add dependencies**

Add these runtime constraints:

```toml
"authlib>=1.3,<2",
"itsdangerous>=2.2,<3",
```

Run `uv lock` and inspect that only required transitive dependencies change.

- [ ] **Step 4: Implement the Authlib adapter and router**

Register Authlib with `server_metadata_url`, client ID/secret, and scopes
`openid profile email`. Generate and store nonce before redirect. On callback,
let Authlib validate discovery metadata, issuer, signature, audience, state, and
ID-token claims; pass the stored nonce to ID-token parsing. Convert known auth
failures to stable 401/403 errors without `str(exc)` in responses and log the
exception server-side.

`GET /api/auth/session` returns `authenticated: false` with HTTP 200 when no
session exists so the frontend can bootstrap without treating login as an API
failure. `POST /api/auth/logout` returns 204.

- [ ] **Step 5: Run tests and dependency checks**

```bash
uv lock --check
pytest tests/api/security/test_settings.py tests/api/security/test_oidc.py -q
```

Expected: all pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add pyproject.toml uv.lock api/security api/routers/auth.py tests/api/security
git commit -m "Add OIDC session endpoints"
```

---

### Task 4: API Authorization, CSRF, and Secure OpenAPI

**Files:**
- Create: `api/security/middleware.py`
- Create: `api/security/openapi.py`
- Create: `tests/api/security/test_boundary.py`
- Modify: `api/main.py`
- Modify: `tests/test_monitoring.py`

**Interfaces:**
- Consumes: `principal_from_session()` and `AuthSettings`.
- Produces: `SecurityBoundaryMiddleware`.
- Produces: `install_security_openapi(app: FastAPI, cookie_name: str) -> None`.
- Request state: `request.state.principal: Principal` for protected handlers.

- [ ] **Step 1: Write failing boundary tests**

Build test apps in `APP_ENV=test` with OIDC mode and seed signed session cookies
through a test-only helper. Cover public paths, authenticated reads, viewer
mutation denial, admin mutation CSRF, session expiry, metrics/readiness
protection, and public liveness:

```python
def test_viewer_cannot_mutate_config(viewer_client):
    response = viewer_client.put("/api/config", json={})
    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


def test_admin_mutation_requires_matching_csrf(admin_client):
    response = admin_client.post("/api/cache/clear/market_data")
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_INVALID"


def test_only_liveness_is_public(client):
    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code == 401
    assert client.get("/metrics").status_code == 401
```

OpenAPI tests must assert `apiSession` exists in `securitySchemes`, protected
operations contain `{"apiSession": []}`, and auth/live operations contain an
empty security list.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/security/test_boundary.py tests/test_monitoring.py -q`.

- [ ] **Step 3: Implement middleware and health split**

Classify paths exactly:

```python
PUBLIC_PREFIXES = ("/api/auth/", "/assets/")
PUBLIC_EXACT = {"/", "/api/auth/session", "/health/live", "/favicon.ico"}
PROTECTED_EXACT = {"/api", "/health", "/health/ready", "/metrics"}
```

Static SPA paths pass through. Any `/api` path not public requires a principal.
Unsafe protected methods require admin and constant-time CSRF comparison.
Security responses use `{detail, code}`. Do not expose session contents.

Refactor the existing health implementation into an internal readiness helper,
serve it from authenticated `/health` and `/health/ready`, and add a minimal
public `/health/live` response.

Install middleware in this call order so effective wrapping is
`Session -> SecurityBoundary -> CORS -> app`:

```python
app.add_middleware(CORSMiddleware, ...)
app.add_middleware(SecurityBoundaryMiddleware, settings=settings)
app.add_middleware(SessionMiddleware, secret_key=..., https_only=..., same_site="lax")
```

Add `X-CSRF-Token` to allowed CORS headers and register `auth.router` before the
SPA fallback.

- [ ] **Step 4: Install secure OpenAPI behavior**

Disable docs/openapi URLs in production unless `API_DOCS_ENABLED=true`. In
enabled modes, annotate all protected operations with the cookie scheme and
leave auth/live explicitly public. Do not claim OAuth bearer-token behavior.

- [ ] **Step 5: Run boundary and existing API smoke tests**

```bash
pytest tests/api/security/test_boundary.py tests/test_monitoring.py tests/api/test_config_api.py -q
```

Expected: all pass with test-mode bypass for existing tests.

- [ ] **Step 6: Commit Task 4**

```bash
git add api/main.py api/security/middleware.py api/security/openapi.py api/routers/auth.py tests/api/security/test_boundary.py tests/test_monitoring.py
git commit -m "Protect API routes with roles and CSRF"
```

---

### Task 5: Bounded Rate Limiting and Sweep Cap

**Files:**
- Create: `api/security/rate_limit.py`
- Create: `tests/api/security/test_rate_limit.py`
- Modify: `api/security/middleware.py`
- Modify: `api/main.py`
- Modify: `api/routers/intelligence.py`
- Modify: `tests/api/test_intelligence_api.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int
    remaining: int

class FixedWindowRateLimiter:
    def check(self, key: str, limit: int, now: float | None = None) -> RateLimitDecision: ...

def rate_policy(path: str, method: str, settings: AuthSettings) -> int: ...
```

- [ ] **Step 1: Write failing pure limiter tests**

Test first request, exact boundary, recovery after 60 seconds, independent
subjects, expired-bucket cleanup, and full-store behavior. A new key when
`max_buckets` contains only active windows must be denied rather than evicting
an active subject.

- [ ] **Step 2: Write failing endpoint tests**

Assert `Retry-After`, per-subject separation, untrusted forwarded headers, and
that an over-cap sweep returns 422 without calling `_get_analyzer`.

- [ ] **Step 3: Run tests and confirm RED**

```bash
pytest tests/api/security/test_rate_limit.py tests/api/test_intelligence_api.py -q
```

- [ ] **Step 4: Implement limiter and route policy**

Use an `OrderedDict[str, Window]` guarded by `threading.Lock`. Remove expired
entries before capacity checks. Key authenticated requests as `sub:{subject}`;
key unauthenticated auth requests as `ip:{client}`. Honor proxy headers only
when `AUTH_TRUST_PROXY_HEADERS=true`.

Policy precedence is sweep, expensive screener/backtest/intelligence, unsafe
mutation, default. Register middleware in call order `CORS`, `RateLimit`,
`SecurityBoundary`, `Session` so effective wrapping is
`Session -> SecurityBoundary -> RateLimit -> CORS -> app` and the limiter can
read the authenticated principal.

Implement sweep cap with a Pydantic `model_validator` reading the configured cap
through a small dependency-free helper; tests reset the settings cache between
values.

- [ ] **Step 5: Run focused and regression tests**

```bash
pytest tests/api/security tests/api/test_intelligence_api.py tests/api/test_screener_endpoints.py -q
```

- [ ] **Step 6: Commit Task 5**

```bash
git add api/security api/main.py api/routers/intelligence.py tests/api/security tests/api/test_intelligence_api.py
git commit -m "Bound API request and sweep rates"
```

---

### Task 6: Credentialed Frontend Transport

**Files:**
- Create: `web-ui/src/lib/apiFetch.ts`
- Create: `web-ui/src/lib/apiFetch.test.ts`
- Modify: `web-ui/src/lib/fetchJson.ts`
- Modify: `web-ui/src/lib/fetchJson.test.ts`
- Modify direct-fetch feature files listed in the file map.

**Interfaces:**
- Produces:

```typescript
export function setCsrfToken(token: string | null): void;
export function subscribeAuthExpired(listener: () => void): () => void;
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response>;
```

- [ ] **Step 1: Write failing transport tests**

Assert full URL resolution, `credentials: 'include'`, CSRF only on unsafe
methods, caller-header preservation, no unsafe retries, and one expiry event for
a burst of 401 responses.

- [ ] **Step 2: Run tests and confirm RED**

Run `cd web-ui && npm test -- --run src/lib/apiFetch.test.ts`.

- [ ] **Step 3: Implement `apiFetch` and delegate `fetchJson`**

Use a module-local CSRF token and listener set. Normalize the method to uppercase
and add `X-CSRF-Token` only for `POST|PUT|PATCH|DELETE`. Preserve explicitly
provided credentials/headers only where they do not disable the security
contract: force credentials to `include`.

- [ ] **Step 4: Migrate all raw fetch calls**

Replace every production `fetch(apiUrl(...))` and `${API_BASE_URL}` call with
`apiFetch(endpoint, init)`. Confirm with:

```bash
rg -n "\bfetch\(" web-ui/src --glob '!**/*.test.*' --glob '!**/test/**'
```

Expected: only the single native `fetch` inside `apiFetch.ts` remains.

- [ ] **Step 5: Run frontend transport tests and typecheck**

```bash
cd web-ui
npm test -- --run src/lib/apiFetch.test.ts src/lib/fetchJson.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit Task 6**

```bash
git add web-ui/src/lib web-ui/src/features
git commit -m "Centralize authenticated API transport"
```

---

### Task 7: Frontend Login Gate and Session Controls

**Files:**
- Create auth feature files listed in the file map.
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/App.tsx`
- Modify: `web-ui/src/components/layout/Header.tsx`
- Modify: `web-ui/src/test/mocks/handlers.ts`

**Interfaces:**
- Produces:

```typescript
interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  role: 'viewer' | 'admin' | null;
  login(): void;
  logout(): Promise<void>;
}

export function useAuth(): AuthContextValue;
```

- [ ] **Step 1: Write failing provider and gate tests**

Cover loading, anonymous login link, authenticated child render, viewer/admin
role display, CSRF installation, 401 expiry transition, and logout.

- [ ] **Step 2: Run tests and confirm RED**

```bash
cd web-ui
npm test -- --run src/features/auth/AuthProvider.test.tsx src/features/auth/LoginGate.test.tsx
```

- [ ] **Step 3: Implement provider and gate**

Fetch `/api/auth/session` once at bootstrap with `apiFetch`. On authenticated
responses install the CSRF token. `login()` assigns
`window.location.href = apiUrl('/api/auth/login')`. `logout()` calls the POST
endpoint, clears the token/query cache, and moves to anonymous state. Subscribe
to the transport expiry event and make the transition idempotent.

The login gate is a compact application access screen, not a marketing page. It
contains the product name, one OIDC login command, and a concise access-error
state. It must be usable at mobile and desktop widths.

- [ ] **Step 4: Wire application and header**

Wrap the router content in `AuthProvider` and `LoginGate` so portfolio queries
cannot run before authentication. Add identity, role, and logout to `Header`
using existing layout/button/icon conventions. Viewer UI may display data but
mutation controls remain server-enforced; disabling viewer mutation controls is
optional presentation polish, not the security boundary.

- [ ] **Step 5: Run auth UI tests, typecheck, lint, and build**

```bash
cd web-ui
npm test -- --run src/features/auth src/lib/apiFetch.test.ts src/lib/fetchJson.test.ts
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 6: Commit Task 7**

```bash
git add web-ui/src/App.tsx web-ui/src/components/layout/Header.tsx web-ui/src/features/auth web-ui/src/lib/api.ts web-ui/src/test/mocks/handlers.ts
git commit -m "Gate the web app behind OIDC session state"
```

---

### Task 8: Deployment Contract and PR 1 Verification

**Files:**
- Modify: `.env.example`
- Modify: `app.json`
- Modify: `docker-compose.yml`
- Modify: `api/README.md`
- Modify: `config/README.md`
- Modify: `.github/workflows/tests.yml`

- [ ] **Step 1: Add deployment configuration**

Set `APP_ENV=production`, `AUTH_MODE=oidc`, and secure-cookie behavior in
`app.json` without committing secrets. Declare required OIDC/session config
descriptions. Set `APP_ENV=development` and `AUTH_MODE=disabled` in
`docker-compose.yml`. Add every variable and a provider registration example to
`.env.example`.

Add `feat/**` to push triggers and make `pull_request` run for every target
branch. This is required for the three stacked PRs because PR 2 and PR 3 do not
target `main` directly.

- [ ] **Step 2: Document routes and operator checks**

Document login/callback/logout/session, role-claim mapping, CSRF, public vs
protected health, rate limits, sweep cap, and the one-worker limiter constraint.
Remove statements implying CORS provides security.

- [ ] **Step 3: Run complete PR 1 verification**

Use writable runtime/cache roots to avoid the pre-existing host `.cache`
ownership issue:

```bash
APP_ENV=test AUTH_MODE=disabled \
SWING_SCREENER_PROJECT_ROOT="$PWD" \
SWING_SCREENER_DATA_DIR=/tmp/swing-auth-test-data \
pytest tests/api tests/test_monitoring.py -q

ruff check api/security api/routers/auth.py api/main.py api/routers/intelligence.py tests/api/security

cd web-ui
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass. Record any unrelated baseline failure separately;
do not weaken security tests to accommodate it.

- [ ] **Step 4: Inspect the security surface**

Run an OpenAPI inventory and assert only `/api/auth/*` and `/health/live` are
public. Search for raw frontend fetch calls and unexpected exception-string
responses in the new auth code. Confirm no secrets appear in git diff.

- [ ] **Step 5: Commit documentation/CI changes**

```bash
git add .env.example app.json docker-compose.yml api/README.md config/README.md .github/workflows/tests.yml
git commit -m "Document secure API deployment"
```

- [ ] **Step 6: Request code review and prepare stack transition**

Compare `feat/intelligence-decision-workflow..HEAD`. Resolve every Critical or
Important review finding, rerun focused checks, and leave the branch ready for
a draft PR whose base is `feat/intelligence-decision-workflow`.
