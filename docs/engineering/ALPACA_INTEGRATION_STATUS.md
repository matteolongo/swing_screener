# Alpaca Integration Status, Current Logic, and Completion Roadmap

Last updated: 2026-02-23

## Goal
Move the application to an Alpaca-backed operating mode where:
- Orders lifecycle is fully broker-driven (source of truth: Alpaca).
- Positions/prices used by portfolio metrics and order snapshots come from Alpaca.
- Local JSON files are optional projection/cache artifacts, not the trading truth.

## Current State (Implemented)

### 1. Execution provider abstraction exists
- `ExecutionProvider` contract and normalized models are implemented.
- Alpaca implementation exists via `alpaca-py` TradingClient.
- Factory resolution supports `SWING_SCREENER_EXECUTION_PROVIDER=local|alpaca`.

### 2. API service wiring exists
- FastAPI dependencies now resolve a singleton execution provider.
- `PortfolioService` can run in broker mode when provider is enabled.

### 3. Broker-mode portfolio/order flows are implemented
In broker mode, service methods delegate to provider for:
- List/get orders
- Create order
- Cancel order
- Fill check semantics (broker-driven)
- List positions (open)
- Close position (submit sell market)
- Update stop (cancel old broker stop orders, submit new stop)

### 4. New endpoints
- `POST /api/portfolio/sync` to sync broker state into optional local projection
- `GET /api/portfolio/export` to export current active source state

### 5. Tests
- Broker-mode service behavior is covered by `tests/api/test_portfolio_broker_mode.py`.

## Current Runtime Logic

### Mode selection
- `SWING_SCREENER_EXECUTION_PROVIDER=alpaca` enables broker execution mode.
- If not set (or set to `local`), API uses local JSON repositories.

### Source-of-truth behavior today
- Orders and open positions: broker-backed when execution provider is enabled.
- Price snapshots for order snapshot and validation paths can still use market data provider (`SWING_SCREENER_PROVIDER`, yfinance/alpaca).
- Projection files (`data/orders.json`, `data/positions.json`) are optional and only updated via explicit sync persistence.

## Gaps to Reach Alpaca-Only Orders + Prices

### Gap A: Full position history parity
- Broker mode currently exposes open positions only.
- Closed position history and realized lifecycle parity are incomplete.

### Gap B: Fractional quantity precision
- API mapping currently rounds quantities to integers in multiple paths.
- This can lose fidelity for assets/brokers supporting fractional shares.

### Gap C: Price source consistency
- Some portfolio analytics/snapshot codepaths still depend on the generic market data provider.
- For strict Alpaca-only mode, all trading-critical prices should come from Alpaca data APIs.

### Gap D: Pagination/windowing
- Order listing currently uses a static limit and no pagination loop.
- Accounts with deeper order history may have partial visibility.

### Gap E: End-to-end runtime verification
- Unit tests use a fake provider; no automated smoke/E2E run against Alpaca paper account in CI.

## Roadmap to Completion

## Phase 1: Correctness hardening (short)
1. Preserve decimal quantities end-to-end in execution mapping and portfolio metrics.
2. Add pagination/iterative fetch for broker order history.
3. Expand normalized status mapping for less common broker statuses and transitions.

Exit criteria:
- No integer truncation for quantities.
- Orders endpoint returns complete history for configured window.

## Phase 2: Alpaca-only pricing path (short)
1. Introduce a strict `broker_prices_only` mode flag.
2. Route order snapshots/portfolio price reads to Alpaca market data in broker mode.
3. Keep fallback behavior explicit and observable (metrics/logging).

Exit criteria:
- In strict mode, no yfinance reads are used for trading-critical endpoints.

## Phase 3: Lifecycle parity (medium)
1. Define closed-position projection strategy from fills/orders.
2. Implement realized P/L and fees model aligned with broker fills.
3. Expose consistent history endpoints for open/closed lifecycle.

Exit criteria:
- Closed position history can be reconstructed from broker state with deterministic logic.

## Phase 4: Operational readiness (medium)
1. Add Alpaca paper-account integration smoke tests (nightly or gated).
2. Add startup validation (credentials, account mode, capability checks).
3. Add runbook docs for failure modes, retries, and reconciliation.

Exit criteria:
- Documented and tested recovery path for broker/API outages and sync drift.

## Recommended Acceptance Definition (Target)
Integration is considered complete when:
- Orders and positions are broker-authoritative.
- Pricing for portfolio and order monitoring is broker-authoritative in strict mode.
- Local files are non-authoritative projections.
- Fractional shares and full history are supported.
- CI includes at least one Alpaca paper smoke workflow.
