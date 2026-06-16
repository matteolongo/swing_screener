# Backend Architecture Assessment

> Status: proposal / draft.
> Date: 2026-06-16.
> Scope: Python backend only (`src/swing_screener`, `api`, `agent`). Frontend out of scope.
> Target architecture: **pragmatic hexagonal** (clean layering, no dogmatic full rewrite).
> Constraint: behavior change allowed only where current behavior is wrong; each such change flagged.

This document audits the backend now that the major feature surface is in place, and proposes
a ranked plan to make it more architected, extendible, and easier to reason about. Every finding
is backed by a concrete measurement taken from the current tree.

---

## 1. Verdict

The backend is in **decent shape structurally** — better than the headline LOC numbers suggest —
but has **one load-bearing architectural flaw** plus a handful of god-files and naming tangles.

What is already right (do not break):

- **Domain core has no framework leak.** `src/swing_screener` imports `fastapi` **zero** times.
- **Dependency direction inside the core is sound.** `data` is the most-imported domain (28×) and
  imports nothing upward (no `data → risk/strategy/portfolio`). Lower layers stay lower.
- **Ports exist where they matter.** `data/providers/base.py` and `fundamentals/providers/base.py`
  define provider abstractions; concrete providers (yfinance, alpaca, stooq, sec_edgar, degiro,
  finnhub) are swappable adapters.
- **Repositories already isolate persistence.** `api/repositories/*` wrap JSON/SQLite I/O behind
  classes; services depend on repos, not on file paths.
- **The fundamentals split is a model to copy.** `fundamentals/service.py` (`FundamentalsAnalysisService`,
  pure domain: snapshot/compare) vs `api/services/fundamentals_service.py` (`FundamentalsService`,
  config CRUD + warmup jobs + response models). This is exactly the right two-layer shape — it is
  **not** duplication.

So this is a tidy-and-tighten job, not a rewrite.

---

## 2. The central flaw: the application layer lives inside the HTTP adapter

`api/services/*` is, in effect, the **application/use-case layer**. But:

1. It physically lives inside the `api` package (the FastAPI adapter).
2. It is **coupled to HTTP**: services raise `fastapi.HTTPException` directly —
   `portfolio_service` (29×), `orders_service` (12×), `screener_service` (13×),
   `strategy_service` (8×), `fundamentals_service` (6×), `daily_review_service` (3×).
3. The **non-HTTP CLI depends on it**: `agent/cli.py` imports `api.services.PortfolioService`,
   `api.services.OrdersService`, `api.services.StrategyService` and `api.repositories.*` directly.

Consequence: the CLI runtime path — documented as "Agent CLI → Services → Core, no HTTP hop" —
**transitively pulls FastAPI into a context that has nothing to do with HTTP**, and any 4xx/5xx
decision is hard-coded as an `HTTPException` instead of a domain error the CLI could render its own way.

This is the single highest-leverage thing to fix. The pragmatic-hexagonal target:

```
        ┌─────────────────────────────────────────────┐
        │  adapters (driving)                           │
        │   api/  (FastAPI routers + models + DI)        │
        │   agent/cli.py, swing_screener/cli.py          │
        └───────────────┬───────────────────────────────┘
                        │ depends on
        ┌───────────────▼───────────────────────────────┐
        │  application layer  (framework-free)            │
        │   services/  ← MOVED OUT of api/, raises domain  │
        │   errors, not HTTPException                      │
        └───────────────┬───────────────────────────────┘
                        │ depends on
        ┌───────────────▼───────────────────────────────┐
        │  domain core   src/swing_screener/*  (pure)     │
        └─────────────────────────────────────────────────┘
        repositories/providers = driven adapters behind ports
```

Minimum viable version of this (low risk): keep services where they are for now, but
(a) replace `raise HTTPException(status, detail)` with a small domain exception hierarchy
(`NotFoundError`, `ValidationError`, `ConflictError`, …), and (b) translate those to HTTP in a
single FastAPI exception handler in `api/main.py`. The CLI then catches the same domain errors.
This removes the FastAPI coupling without moving a single file.

---

## 3. God-files

| File | LOC | Problem | Action |
|------|-----|---------|--------|
| `api/services/screener_service.py` | 1321 | `run_screener` is **one 535-line method** (747→1282). ~30 module-level private helpers (currency resolution, date math, price-history shaping, fundamentals context, decision-summary stitching, ranking, safe-casts) are crammed into the service file but are **pure functions that belong in the core**. | Split (see §5). Highest priority god-file. |
| `api/services/portfolio_service.py` | 1030 | Single class owns read-model (list/metrics/summary), write-model (create/close/partial-close/stop), pricing, FX, and stop-suggestion. Too many responsibilities. | Split read vs write vs pricing. |
| `src/swing_screener/recommendation/decision_summary.py` | 900 | One builder with ~20 private formatting/normalization helpers. | Extract a `formatting`/`labels` submodule. |
| `src/swing_screener/fundamentals/scoring.py` | 951 | Large but cohesive (scoring rules). | Lower priority; review for sub-rule extraction. |

`run_screener` is the worst offender: a 535-line method cannot be unit-tested in pieces, can't be
reasoned about in one screen, and forces every screener change through the same blast radius.

---

## 4. Domain boundary tangles

### 4.1 "recommendation" is overloaded across four locations

| Location | Produces | Meaning |
|----------|----------|---------|
| `recommendation/` (top-level, singular) | `build_decision_summary` → `DecisionSummary` | The unified "what to do / why" decision view (recent feature). |
| `risk/recommendations/engine.py` | `build_recommendation` → `RecommendationPayload` | Risk/cost/education/checklist-gate payload. |
| `risk/recommendations/thesis.py` | `TradeThesis`, `calculate_setup_score` | Setup scoring + classification. |
| `risk/engine.py` | `evaluate_recommendation` | Risk-engine entry point. |
| `api/models/recommendation.py` | `Recommendation` | API response model. |

These are genuinely different concepts, but the **names collide** and the **top-level
`recommendation/` vs nested `risk/recommendations/` split is confusing** — both read as "the
recommendations package". `MODULE_ARCHITECTURE.md` even says canonical recommendations live under
`risk/recommendations`, while the larger, more-used `decision_summary` lives in top-level
`recommendation/`. Decide one home and one vocabulary (proposal in §5).

### 4.2 The architecture doc is stale

`docs/engineering/MODULE_ARCHITECTURE.md` lists 10 canonical domains but the tree has **14**.
Undocumented live domains: `fundamentals`, `integrations`, `recommendation`, `settings`.
The "canonical module list" is the contract; it currently lies.

### 4.3 Two CLIs with different layering

- `agent/cli.py` → imports `api.services.*` (user workflow CLI: screen/positions/orders/chat).
- `src/swing_screener/cli.py` → imports core directly (admin CLI: `universes refresh`, reports).

Both are intentional, but the boundary is undocumented and `agent/cli.py`'s dependency on `api`
is the coupling from §2. After the application layer is extracted, both CLIs depend on
`services/` + core, never on the FastAPI package.

---

## 5. What to delete / merge / split (explicit)

**Split**

- `screener_service.run_screener` → orchestrator method that calls extracted, individually-tested steps:
  `resolve_screening_window` (currency/asof/freshness math), `fetch_and_shape_ohlcv`,
  `build_candidates`, `enrich_with_fundamentals`, `apply_decision_summary`, `rank_and_priority`.
  Move the ~30 pure helpers **out of the service into core** (`selection/`, `data/`, `recommendation/`).
- `portfolio_service` → `PortfolioReadService` (list/metrics/summary/concentration) +
  `PortfolioWriteService` (create/close/partial/stop) + a `pricing` helper (live price + FX).
- `recommendation/decision_summary.py` → keep the builder, extract its formatting/normalization
  helpers into `recommendation/formatting.py`.

**Merge / rename (boundary cleanup)**

- The `recommendation/` → `decision/` rename is **deferred** (decision 2026-06-16). The
  singular-vs-plural collision is documented but not acted on in this round to avoid churn; revisit
  separately.

**Delete (after verification — do not delete blind)**

- **`db.py`** (orphaned SQLAlchemy ORM, see `CODE_HEALTH.md` §2) is confirmed for deletion
  (decision 2026-06-16): JSON + `portalocker` is the single source of truth and the ORM is never
  imported. Remove it and its `CODE_HEALTH.md` entry.

- Run a real dead-code pass (`ruff --select F401,F811` already on; add a `vulture` sweep) before
  removing anything. The ad-hoc grep used during this audit produced false positives and is **not**
  a basis for deletion. No confirmed dead modules are claimed here.
- Known-orphan candidates are already tracked in `CODE_HEALTH.md` (e.g. the unused SQLAlchemy
  `db.py`, the legacy `data/market_data.py` wrapper). Reconcile that doc with this one rather than
  re-listing; `CODE_HEALTH.md` is last-reviewed 2026-03-08 and should be refreshed in phase 9.

---

## 6. Error handling & logging

This is **not** a stray-`print` problem — `api/services` has zero stray prints; the 98 `print()`
matches are almost all in `cli.py` (40, legitimate CLI output) and notebooks/READMEs. The real
issues:

- **Broad exception handling.** 125 `except Exception` and 19 `except …: pass` (bare swallow) across
  `src`+`api` (non-test). Silent-failure paths hide provider/data errors.
- **Warning-heavy, thin logging.** Of 111 log calls, 51 are `logger.warning` vs 15 `info` / 16
  `exception` — consistent with "catch broadly, log a warning, continue", which produces noisy logs
  that don't tell you what actually happened.
- **Inconsistent logger coverage.** 11/14 services use `getLogger`, but only 12/96 core files do.

Target: a thin logging convention (module-level `logger = logging.getLogger(__name__)`; `info` for
use-case boundaries, `warning` only for recoverable degradation with the reason, `exception` in the
`except` that owns the failure), and replace bare `except: pass` with either a typed catch + reason
log or a re-raise. Tie this to §2's domain-error hierarchy.

---

## 7. DI & testability

`api/dependencies.py` is mostly clean hand-rolled FastAPI `Depends` factories — good. Two seams to fix:

- **Test hooks bleed into production code.** Module-global monkeypatch path aliases
  (`_positions_path`, `_orders_path`) accessed via `import api.dependencies as _self`. Tests redirect
  I/O by mutating these globals. Replace with overridable settings/env or FastAPI
  `dependency_overrides` so production code carries no test scaffolding.
- **Import-time side effect.** The Finnhub client is constructed at module import from
  `os.environ["FINNHUB_API_KEY"]`. Make it lazy/injected so import order and env presence don't
  decide wiring.

After the application layer moves out of `api/`, the DI wiring split cleanly: `api/dependencies.py`
keeps the FastAPI `Depends` graph; a small framework-free factory builds services for the CLI.

---

## 8. Ranked refactor plan

Ordered by value/risk. Decisions taken 2026-06-16: phase 7 **in scope**; recommendation rename
**dropped**; PRs are **bundled** as noted; logging is allowed to change observable error behavior;
`db.py` deletion folded into the dead-code phase.

| PR | Phases | Why | Effort | Risk | Behavior change |
|----|--------|-----|--------|------|-----------------|
| **A** | **1** domain-error hierarchy + single HTTP translator · **2** refresh `MODULE_ARCHITECTURE.md` (14 domains + two-CLI boundary) · **4** logging convention + kill bare `except: pass` | Removes the §2 HTTP coupling, makes the arch doc honest, and adds observability — all low-risk, and they make the splits below safe. | L | Low | Phase 4 may surface errors previously swallowed (accepted). |
| **B** | **3** split `run_screener` into orchestrator + extracted core steps; move pure helpers into core | Biggest readability/testability win. | L | Med | None. |
| **C** | **5** split `portfolio_service` into read/write/pricing · **8** DI seam cleanup (test-path globals, import-time Finnhub) | Second god-file + remove test scaffolding from prod. | M | Med | None. |
| **D** | **7** extract the application layer out of `api/` into top-level `services/` (CLIs + API depend on it, not on FastAPI) | Completes the hexagon. Depends on PR A (services must be framework-free first). | L | Med | None. |
| **E** | **9** `vulture` dead-code pass; **delete `db.py`** (confirmed orphan) and refresh `CODE_HEALTH.md` | Shrink surface safely. | S | Low | None. |

Sequencing: **A → B/C (parallel) → D → E.** A must land first because phase 7 (PR D) only makes
sense once services no longer raise `HTTPException`.

---

## 9. Open questions

(Listed for the user to answer before a plan is written — see chat.)
