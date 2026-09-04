# Currency Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one currency registry, one authoritative account currency, and unambiguous monetary API fields.

**Architecture:** Currency metadata lives in the data layer and is consumed by scheduling, FX, risk, and API code. Account currency comes from application configuration; quote-currency values and converted account-currency values are named separately.

**Tech Stack:** Python 3, FastAPI, Pydantic, React/TypeScript contracts, pytest, Vitest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Unknown suffixes/currencies are explicit errors, never silent USD defaults.
- Missing required FX conversion blocks an actionable plan.
- PRs 4, 5, and 15 merge in that order.

---

### Task 1 (PR 4): Centralize the supported-currency registry

**Branch:** `codex/centralize-currency-registry` from `main`

**Files:**

- Create: `src/swing_screener/data/currencies.py`
- Modify: `src/swing_screener/data/currency.py`
- Modify: `src/swing_screener/selection/screening_window.py`
- Modify: `api/models/screener.py`
- Modify: `tests/data/test_currency.py`
- Modify: `tests/test_screening_window.py`
- Modify: `tests/test_screener_models.py`
- Modify: `src/swing_screener/data/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Lock the contract with failing tests**

Assert all currently supported codes resolve through one registry, their market
timezones and close times agree with screening-window behavior, and an unknown
suffix raises/returns `unknown` instead of USD. Assert API currency validation
accepts exactly registry codes.

- [ ] **Step 2: Create the registry**

Add frozen `CurrencyDefinition(code, timezone, close_time)` records and public
helpers `get_currency_definition(code)` and `supported_currency_codes()`. Move
the existing supported codes and session metadata into this module.

- [ ] **Step 3: Replace duplicated constants**

Make ticker inference, screening-window calculation, and Pydantic validation
consume the registry. Preserve explicit per-symbol metadata overrides before
suffix inference.

- [ ] **Step 4: Document and verify**

Run `pytest tests/data/test_currency.py tests/test_screening_window.py tests/test_screener_models.py -q`
and `ruff check src/swing_screener/data src/swing_screener/selection/screening_window.py api/models/screener.py tests`.
Document registry ownership and commit with `Centralize currency and market-session metadata`.

---

### Task 2 (PR 5): Make account currency and FX conversion authoritative

**Branch:** `codex/authoritative-account-currency` from `codex/centralize-currency-registry`

**Files:**

- Create: `api/services/screener_fx.py`
- Modify: `api/services/screener_service.py`
- Modify: `api/repositories/config_repo.py`
- Modify: `api/models/screener.py`
- Modify: `tests/api/test_screener_currency_contract.py`
- Modify: `tests/test_screener_service.py`
- Modify: `api/README.md`
- Modify: `config/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add failing cross-currency tests**

Configure a non-USD account, screen same-currency and foreign-currency symbols,
and assert the account currency comes from the app config repository—not a
strategy default. Assert direct, inverse, and missing FX paths; missing FX must
produce a blocked recommendation with an explicit reason.

- [ ] **Step 2: Isolate FX resolution**

Create a deterministic resolver that returns `1.0` for equal currencies, tries
the configured direct pair, then its inverse, validates finite positive rates,
and returns a typed unavailable result rather than silently omitting the rate.

- [ ] **Step 3: Inject authoritative configuration**

Inject `ConfigRepository` into `ScreenerService`, read account currency once per
run, validate it through the registry, and remove local/account-currency fallbacks
from strategy configuration. Pass an explicit conversion result into risk and
candidate serialization.

- [ ] **Step 4: Publish the failure contract**

Expose quote currency, account currency, FX status, rate/as-of when available,
and a machine-readable block reason when unavailable. Update OpenAPI models and
API/config docs together.

- [ ] **Step 5: Verify and commit**

Run `pytest tests/api/test_screener_currency_contract.py tests/test_screener_service.py tests/test_risk_currency.py -q`
and `ruff check api src/swing_screener/risk tests/api/test_screener_currency_contract.py`.
Commit with `Use configured account currency for screener FX`.

---

### Task 3 (PR 15): Deprecate ambiguous USD monetary aliases

**Branch:** `codex/deprecate-usd-money-aliases` from `codex/authoritative-account-currency`

**Files:**

- Modify: `api/models/screener.py`
- Modify: `api/services/screener_service.py`
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/screener/api.ts`
- Modify: `web-ui/src/features/screener/api.test.ts`
- Modify: `tests/api/test_screener_currency_contract.py`
- Modify: `api/README.md`
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Define explicit replacement fields**

Add failing backend/frontend contract tests for fields suffixed with
`_quote` and `_account` plus their currency codes. Mark legacy `_usd` aliases
deprecated in OpenAPI. For non-USD values, do not place mislabeled amounts into
the aliases; use `null` unless the value is genuinely USD.

- [ ] **Step 2: Serialize explicit amounts**

Populate entry/stop/target and per-share risk as quote-currency values; populate
position value and total risk in account currency only after successful FX.
Keep deprecated aliases read-only for the compatibility window.

- [ ] **Step 3: Migrate Web UI consumers**

Update types and boundary transforms to consume explicit fields. Update visible
currency labels through existing i18n keys if any displayed field changes; add
component coverage and capture PR screenshots only if rendered UI changes.

- [ ] **Step 4: Document and verify**

Run focused backend tests, then `cd web-ui; npm test -- --run` and
`npm run typecheck`. Run Ruff on changed Python files. Document deprecation and
removal policy, then commit with `Name screener monetary fields by currency`.
