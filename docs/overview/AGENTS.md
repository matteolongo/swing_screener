# AGENTS.md — Swing Screener (Behavioral Coach Edition)

Project scope, constraints, and conventions for code changes.

---

## Identity

This project is a **Desktop-First Behavioral Swing Trading Coach**.

It is not a trading terminal.
It is not a screener dashboard.
It is not a strategy laboratory.

It is a structured, end-of-day decision coach.

---

## Scope

- End-of-day swing-trading workflows
- Manual order execution
- Deterministic, testable logic
- Behavioral discipline reinforcement
- Explicit risk management
- Desktop-only UI

---

## Non-goals

- Live trading / broker execution
- Intraday logic
- ML or curve-fitting
- Hidden state or heuristic tuning
- Mobile UI support
- Expert-level configuration surfaces exposed by default
- Global state that changes app behavior invisibly

---

## Core Concepts

- OHLCV data uses a MultiIndex DataFrame (field, ticker).
- Risk is expressed in R-multiples: `1R = entry - stop`.
- Position sizing and risk rules are first-class.
- Detection is automated.
- Decision is ritualized.
- Configuration is rare, contextual, and controlled.

---

## Architectural Principles

- Prefer deletion over abstraction.
- Prefer single source of truth.
- Avoid global state unless strictly necessary.
- Avoid "spooky action at a distance".
- Sidebar must be navigation-only.
- No mobile-specific layout branches.
- No duplicated UI primitives.
- Configuration must not compete with decision flow.
- Education must be contextual, not separate.

---

## Repo Layout

- `api/`: FastAPI service
- `src/swing_screener/`: core library
- `web-ui/`: React frontend (desktop-only)
- `data/`: runtime JSON data
- `docs/`: documentation

---

## Frontend Conventions

- Desktop-only layout.
- Remove responsive/mobile-specific logic.
- Standardize UI primitives:
    - Section
    - DataTable (desktop-only)
    - Modal
    - FormControl
    - Badge
- Avoid duplicate Card/Table implementations.
- Avoid conditionals tied to global toggles.

---

## State Management

- Minimize Zustand stores.
- One single source of truth for active strategy.
- No global Beginner/Advanced toggle.
- Prefer local state when scope is page-level.
- No URL-driven action orchestration (no query param hacks).

---

## API & Contract Rules

- Backend: snake_case, explicit types.
- Frontend: camelCase, transform at API boundary.
- Cross-layer contract changes must update API models and corresponding Web UI types in the same change.
- Deterministic logic only.

---

## Testing

- Update tests when behavior changes.
- Keep behavior deterministic.
- Behavior changes require deterministic automated tests in the touched layer(s).
- No visual-only PR without smoke checklist.

---

## Documentation

- Keep module docs close to code.
- When changing a module, update its nearest `README.md`.
- Schema changes in persisted `data/*.json` require migration/backfill notes.
- Update `docs/overview/INDEX.md` when adding/removing docs.
- Architectural changes must update this file.

---

## Refactor Discipline Rules

When refactoring:

- Delete unused code immediately.
- Remove unused imports.
- Remove orphan routes.
- Remove mobile-specific logic.
- Remove duplicated state.
- Validate build + lint + typecheck + tests.
- Validate smoke checklist manually.

If a change increases complexity, reconsider it.