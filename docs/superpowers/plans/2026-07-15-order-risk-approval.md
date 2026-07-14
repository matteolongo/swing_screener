# Authoritative Order Risk Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-authored entry permissions with signed screener context and recompute every financial gate from normalized server-side exposure.

**Architecture:** Screener output receives a versioned HMAC approval token containing immutable decision, strategy, currency, and plan context. `OrdersService` verifies that token, builds an account-currency exposure snapshot, evaluates a pure approval policy, and persists a complete audit record while the current JSON repositories remain in place.

**Tech Stack:** FastAPI, Pydantic, Python HMAC/SHA-256, React/TypeScript, pytest, Vitest.

## Global Constraints

- Branch `feat/order-risk-approval` starts from `feat/backend-auth-boundary`.
- Production requires `ORDER_APPROVAL_SIGNING_KEY` with at least 32 bytes.
- Token TTL defaults to 28,800 seconds and cannot exceed 86,400 seconds in production.
- Quote amounts convert to account currency by division by `account_to_quote_rate`.
- Quantity, entry, stop, and target remain user-editable and are always recomputed.
- Missing FX for legacy cross-currency exposure blocks approval.
- Country concentration is risk-based `WARN`, never a hard blocker.
- This PR does not replace JSON persistence or add database dependencies.

---

## File Map

**Create**

- `api/services/order_approval_token.py`: canonical payload, signing, verification, and token errors.
- `api/services/order_exposure.py`: normalized exposure snapshot and legacy FX validation.
- `api/services/order_approval.py`: effective policy and deterministic gate evaluator.
- `tests/api/test_order_approval_token.py`: tamper, expiry, and strategy contract tests.
- `tests/api/test_order_exposure.py`: currency conversion and aggregate tests.

**Modify**

- `api/security/settings.py`: approval signing key and TTL configuration.
- `api/models/screener.py`: candidate `approval_token`.
- `api/models/portfolio.py`: token-based request and richer approval audit models.
- `api/models/config.py`, `api/models/strategy.py`: explicit heat configuration.
- `api/services/screener_service.py`: issue tokens only for actionable candidates.
- `api/services/orders_service.py`: verify token and delegate to pure evaluator.
- `api/dependencies.py`: inject one cached signer.
- `tests/api/test_order_portfolio_approval.py`: authoritative service contract.
- `tests/api/test_screener_currency_contract.py`: token issuance contract.
- `web-ui/src/types/order.ts`: carry `approvalToken` to API payload.
- `web-ui/src/types/screener.ts`: deserialize `approval_token`.
- `web-ui/src/features/portfolio/api.ts`: send token in API persistence mode.
- `web-ui/src/features/persistence/portfolioService.ts`: retain local-only warning behavior without claiming server authority.
- `.env.example`, `app.json`, `api/README.md`, `config/defaults.yaml`: configuration and rollout contract.

---

### Task 1: Approval Signing Configuration and Token Codec

**Files:**
- Create: `api/services/order_approval_token.py`
- Create: `tests/api/test_order_approval_token.py`
- Modify: `api/security/settings.py`
- Modify: `tests/api/security/test_settings.py`

**Interfaces:**

```python
@dataclass(frozen=True)
class ApprovalTokenContext:
    version: int
    token_id: str
    issued_at: int
    expires_at: int
    ticker: str
    order_type: str
    setup_status: str
    trigger_status: str
    plan_status: str
    data_status: str
    data_asof: str
    strategy_id: str
    account_currency: str
    quote_currency: str
    account_to_quote_rate: float
    target_source: str
    days_to_earnings: int
    generated_entry: float
    generated_stop: float
    generated_target: float
    plan_fingerprint: str

class OrderApprovalTokenSigner:
    def issue(self, context: ApprovalTokenContext, now: int | None = None) -> str: ...
    def verify(self, token: str, now: int | None = None) -> ApprovalTokenContext: ...
```

- [ ] **Step 1: Write failing settings and codec tests**

Cover the production key requirement, TTL bounds, deterministic canonical JSON,
round-trip verification, payload/signature tamper, malformed base64/JSON,
unsupported version, and exact expiry boundary. Use a fixed 32-byte test key and
inject `now`; never sleep.

```python
def test_tampered_payload_is_rejected(signer, context):
    token = signer.issue(context, now=100)
    payload, signature = token.split(".")
    changed = ("A" if payload[0] != "A" else "B") + payload[1:]
    with pytest.raises(ApprovalTokenError, match="invalid"):
        signer.verify(f"{changed}.{signature}", now=101)
```

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_order_approval_token.py tests/api/security/test_settings.py -q`.
Expected: missing token module/settings fields.

- [ ] **Step 3: Implement settings and codec**

Encode sorted, compact UTF-8 JSON with unpadded base64url. Sign the encoded
payload bytes using `hmac.new(key, payload, sha256)` and compare signatures with
`hmac.compare_digest`. The token is `<payload>.<signature>`. `issue()` creates a
UUID token ID and derives timestamps from the injected clock. `verify()` accepts
only version `1`, finite numeric prices/rate, and `now < expires_at`.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `pytest tests/api/test_order_approval_token.py tests/api/security/test_settings.py -q`.

- [ ] **Step 5: Commit**

```bash
git add api/security/settings.py api/services/order_approval_token.py tests/api/security/test_settings.py tests/api/test_order_approval_token.py
git commit -m "Add signed order approval tokens"
```

---

### Task 2: Actionable Candidate Token Issuance

**Files:**
- Modify: `api/models/screener.py`
- Modify: `api/services/screener_service.py`
- Modify: `api/dependencies.py`
- Modify: `tests/api/test_screener_currency_contract.py`
- Modify: `tests/test_screener_service.py`

**Interfaces:**
- Consumes: `OrderApprovalTokenSigner.issue()`.
- Produces: `ScreenerCandidate.approval_token: str | None`.
- Produces: `ScreenerService(..., approval_signer: OrderApprovalTokenSigner | None = None)`.

- [ ] **Step 1: Write failing issuance tests**

Assert a recommended candidate with `setup=PASS`, `trigger=PASS`, `plan=PASS`,
current data, structural/manual target, earnings more than three days away,
positive FX, and an active strategy receives a verifiable token. Parameterize
each missing permission and assert the field is `None`.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_screener_currency_contract.py tests/test_screener_service.py -q`.

- [ ] **Step 3: Implement one issuance helper**

Add `_approval_context_for_candidate(candidate, strategy_id) -> ApprovalTokenContext | None`.
Use the recommendation decision gates and risk values, normalize ticker and
currency to uppercase, and calculate `plan_fingerprint` as SHA-256 of canonical
JSON containing ticker/order type/entry/stop/target/strategy ID. Do not sign
degraded or incomplete candidates.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `pytest tests/api/test_screener_currency_contract.py tests/test_screener_service.py -q`.

- [ ] **Step 5: Commit**

```bash
git add api/models/screener.py api/services/screener_service.py api/dependencies.py tests/api/test_screener_currency_contract.py tests/test_screener_service.py
git commit -m "Issue approvals for actionable candidates"
```

---

### Task 3: Canonical Exposure Snapshot

**Files:**
- Create: `api/services/order_exposure.py`
- Create: `tests/api/test_order_exposure.py`

**Interfaces:**

```python
@dataclass(frozen=True)
class ExposureLine:
    ticker: str
    country: str
    source: Literal["position", "pending", "proposed"]
    notional_account: Decimal
    risk_account: Decimal

@dataclass(frozen=True)
class ExposureSnapshot:
    lines: tuple[ExposureLine, ...]
    current_notional: Decimal
    current_risk: Decimal
    projected_notional: Decimal
    projected_risk: Decimal

def quote_to_account(amount: Decimal, account_currency: str, quote_currency: str, rate: Decimal | None) -> Decimal: ...
def build_exposure_snapshot(positions: Sequence[Mapping[str, object]], orders: Sequence[Mapping[str, object]], proposed: ProposedExposure) -> ExposureSnapshot: ...
```

- [ ] **Step 1: Write failing conversion and aggregate tests**

Test identity conversion despite a supplied rate, EUR/USD division convention,
open plus pending plus proposed totals, closed/cancelled exclusion, per-country
risk, and `FX_CONTEXT_MISSING` for legacy cross-currency rows without a positive
persisted rate.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_order_exposure.py -q`.

- [ ] **Step 3: Implement Decimal normalization**

Construct decimals from `str(value)`, reject booleans/nonfinite/nonpositive
currency rates, and quantize only at API/audit serialization. Use persisted
`quote_currency` and `account_to_quote_rate`/`entry_fx_rate`; infer only quote
currency for legacy rows, never a cross-currency rate.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `pytest tests/api/test_order_exposure.py -q`.

- [ ] **Step 5: Commit**

```bash
git add api/services/order_exposure.py tests/api/test_order_exposure.py
git commit -m "Normalize portfolio exposure across currencies"
```

---

### Task 4: Deterministic Policy Evaluator

**Files:**
- Create: `api/services/order_approval.py`
- Modify: `api/models/portfolio.py`
- Modify: `api/models/config.py`
- Modify: `api/models/strategy.py`
- Modify: `config/defaults.yaml`
- Modify: `tests/api/test_order_portfolio_approval.py`

**Interfaces:**

```python
@dataclass(frozen=True)
class EffectiveOrderPolicy:
    account_size: Decimal
    risk_pct: Decimal
    max_position_pct: Decimal
    max_portfolio_heat_pct: Decimal
    min_rr: Decimal
    commission_pct: Decimal
    max_fee_risk_pct: Decimal
    max_concentration_pct: Decimal
    account_currency: str
    version: str = "order-risk-v1"

def evaluate_order_approval(context: VerifiedOrderContext, submitted: SubmittedPlan, snapshot: ExposureSnapshot, policy: EffectiveOrderPolicy) -> PortfolioOrderApproval: ...
```

- [ ] **Step 1: Replace old tests with one independent test per gate**

Cover long-plan ordering, minimum RR, per-trade risk, same-symbol position cap,
cash, heat, fee/risk, earnings, and missing FX. Assert concentration at exactly
the threshold is `WARN`, does not change `approved`, and uses country risk over
total projected risk rather than notional/account size.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_order_portfolio_approval.py tests/api/test_concentration.py -q`.

- [ ] **Step 3: Implement the pure evaluator and explicit schemas**

Change `PortfolioApprovalGate.status` to `PASS | WARN | BLOCK`. Persist gates for
decision, coherence, RR, trade risk, position cap, cash, heat, fee ratio, event,
FX, and concentration plus complete current/projected totals. Add
`max_portfolio_heat_pct=0.06` to application and strategy risk schemas/defaults.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `pytest tests/api/test_order_portfolio_approval.py tests/api/test_concentration.py tests/test_strategy_config.py -q`.

- [ ] **Step 5: Commit**

```bash
git add api/models/portfolio.py api/models/config.py api/models/strategy.py api/services/order_approval.py config/defaults.yaml tests/api/test_order_portfolio_approval.py tests/api/test_concentration.py tests/test_strategy_config.py
git commit -m "Evaluate complete order risk policy"
```

---

### Task 5: Authoritative Orders Service Integration

**Files:**
- Modify: `api/services/orders_service.py`
- Modify: `api/dependencies.py`
- Modify: `api/models/portfolio.py`
- Modify: `tests/api/test_order_portfolio_approval.py`
- Modify: `tests/api/test_order_fill.py`

**Interfaces:**
- `CreateOrderRequest` for an entry consumes `approval_token`; client decision fields are ignored/removed from the API contract.
- `OrdersService` consumes signer, active strategy, exposure builder, and policy evaluator.

- [ ] **Step 1: Write failing integration tests**

Assert missing/tampered/expired/ticker-mismatched/strategy-stale tokens return
422; altered client decision keys have no effect; submitted prices and quantity
drive approval; and the order record contains token ID/fingerprint, verified
context, all policy values, normalized totals, fees, FX, and all gates.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_order_portfolio_approval.py tests/api/test_order_fill.py -q`.

- [ ] **Step 3: Replace `_approve_entry_order` orchestration**

Verify before repository mutation, compare normalized token ticker and active
strategy ID, build submitted plan from request prices/quantity, build exposure,
evaluate, and persist only the verified context. Preserve duplicate pending and
add-on checks. Store quote/account currencies and approval FX on order and carry
them to positions during fill.

- [ ] **Step 4: Run focused regressions**

Run `pytest tests/api/test_order_portfolio_approval.py tests/api/test_order_fill.py tests/api/test_same_symbol_reentry.py tests/api/test_fx_adjusted_r.py -q`.

- [ ] **Step 5: Commit**

```bash
git add api/models/portfolio.py api/services/orders_service.py api/dependencies.py tests/api/test_order_portfolio_approval.py tests/api/test_order_fill.py
git commit -m "Enforce signed server-side order approval"
```

---

### Task 6: Frontend Token Contract and Rollout

**Files:**
- Modify: `web-ui/src/types/order.ts`
- Modify: `web-ui/src/types/order.test.ts`
- Modify: `web-ui/src/types/screener.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: order form/review files that construct `CreateOrderRequest`.
- Modify: `.env.example`, `app.json`, `api/README.md`, `config/defaults.yaml`

- [ ] **Step 1: Write failing mapping/API tests**

Assert `approval_token` deserializes to `approvalToken`, API persistence sends it
and omits decision claims, and missing token prevents entry submission before a
network call. Protective orders remain token-free.

- [ ] **Step 2: Run tests and confirm RED**

Run `cd web-ui && npm test -- --run src/types/order.test.ts src/features/portfolio`.

- [ ] **Step 3: Wire token end to end**

Carry the candidate token through the order review model without decoding it in
the browser. Keep local persistence explicitly labeled as non-authoritative and
retain its current validation only for offline development compatibility.

- [ ] **Step 4: Document deployment configuration**

Declare `ORDER_APPROVAL_SIGNING_KEY` as required in `app.json`, document key
rotation invalidating outstanding tokens, TTL, conversion convention, and the
local persistence limitation.

- [ ] **Step 5: Run PR 2 verification**

```bash
APP_ENV=test AUTH_MODE=disabled pytest tests/api tests/test_screener_service.py tests/test_strategy_config.py -q
ruff check api/services/order_approval_token.py api/services/order_exposure.py api/services/order_approval.py api/services/orders_service.py
cd web-ui
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 6: Commit and review**

```bash
git add web-ui/src .env.example app.json api/README.md config/defaults.yaml
git commit -m "Send signed candidate approvals from the UI"
```

Compare `feat/backend-auth-boundary..HEAD`, resolve Critical/Important review
findings, rerun affected checks, and prepare a draft PR based on
`feat/backend-auth-boundary`.
