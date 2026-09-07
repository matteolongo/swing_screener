# Reporting Pipeline Remediation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all 18 reporting-pipeline remediation PRs in dependency-safe order.

**Architecture:** Seven subsystem plans own risk, freshness, currency, reporting, order/daily-review, ranking/data/signals, and configuration cleanup. This roadmap is the merge coordinator; implementation details live in the linked subsystem plans.

**Tech Stack:** Python 3, pandas, FastAPI, Pydantic, pytest, Ruff, YAML configuration.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Preserve deterministic end-of-day manual execution and R-multiple sizing.
- Every behavior change includes regression tests and nearest documentation.
- Cross-layer API/model changes remain in the same PR.
- PR 1 targets `main`; every later PR targets the immediately preceding branch.
- Preserve one root-cause commit per PR while rebasing the linear stack.

---

## Subsystem Plans

| Plan | PRs | Required order |
| --- | --- | --- |
| [`risk-plan-correctness`](2026-09-04-risk-plan-correctness.md) | 1, 14 | Global order 1 → 14 |
| [`cache-freshness`](2026-09-04-cache-freshness.md) | 2, 3 | Global order 2 → 3 |
| [`currency-contract`](2026-09-04-currency-contract.md) | 4, 5, 15 | Global order 4 → 5 → 15 |
| [`reporting-contract`](2026-09-04-reporting-contract.md) | 6, 16 | Global order 6 → 16 |
| [`order-daily-review`](2026-09-04-order-daily-review.md) | 7, 8, 9, 10 | Global order 7 → 8 → 9 → 10 |
| [`ranking-data-signals`](2026-09-04-ranking-data-signals.md) | 11, 12, 13 | Global order 11 → 12 → 13 |
| [`configuration-cleanup`](2026-09-04-configuration-cleanup.md) | 17, 18 | Global order 17 → 18 |

## Implementation Progress

| PR | Status | Branch | Pull request |
| --- | --- | --- | --- |
| 1 | Implemented; awaiting merge | `codex/preserve-structural-targets` | [#445](https://github.com/matteolongo/swing_screener/pull/445) |
| 2 | Implemented; awaiting PR 1 | `codex/version-eval-cache-provenance` | [#446](https://github.com/matteolongo/swing_screener/pull/446) |
| 3 | Implemented; awaiting PR 2 | `codex/prevent-partial-final-promotion` | [#447](https://github.com/matteolongo/swing_screener/pull/447) |
| 4 | Implemented; awaiting PR 3 | `codex/centralize-currency-registry` | [#448](https://github.com/matteolongo/swing_screener/pull/448) |
| 5 | Implemented; awaiting PR 4 | `codex/authoritative-account-currency` | [#449](https://github.com/matteolongo/swing_screener/pull/449) |
| 6 | Implemented; awaiting PR 5 | `codex/stabilize-report-plan-schema` | [#450](https://github.com/matteolongo/swing_screener/pull/450) |
| 7 | Implemented; awaiting PR 6 | `codex/fail-closed-pending-orders` | [#451](https://github.com/matteolongo/swing_screener/pull/451) |
| 8 | Implemented; awaiting PR 7 | `codex/separate-review-evaluation-errors` | [Open PR](https://github.com/matteolongo/swing_screener/compare/codex/fail-closed-pending-orders...codex/separate-review-evaluation-errors?expand=1) |
| 9–18 | Not started | See subsystem plans | — |

## Linear Stack Coordinator Checklist

- [ ] **Step 1: Build and merge PRs 1–3**

Implement structural-target safety, then evaluation-cache identity, then the
final-close freshness boundary. Each PR targets the branch directly below it.

- [ ] **Step 2: Build and merge PRs 4–6**

Add the currency registry, account-currency FX ownership, and stable report-plan
schema in sequence. Run their combined integration tests at PR 6.

- [ ] **Step 3: Build and merge PRs 7–10**

Implement pending-order safety, typed evaluation errors, authoritative stateless
state, and explicit persistence. At PR 10, verify compute paths perform no writes.

- [ ] **Step 4: Build and merge PRs 11–13**

Preserve rank provenance, normalize OHLCV ingress, and correct signal boundaries.
Run selection, provider, report, API, and affected Web UI tests together.

- [ ] **Step 5: Build and merge PRs 14–16**

Harden sizing, migrate ambiguous money fields, and define concentration math.
Confirm legacy aliases contain only genuine USD values before PR 15 advances.

- [ ] **Step 6: Build and merge PRs 17–18**

Remove import-time config instances, then consolidate configuration ownership.
Verify in-process overrides and run the release-version check.

- [ ] **Step 7: Rebase after each merge**

When the bottom PR merges, retarget the next PR to `main`, rebase every remaining
descendant in numeric order, and never squash two remediation points together.

- [ ] **Step 8: Run final integration verification**

Run `pytest -q`, `ruff check .`, `python scripts/check_release_version.py`, and
the Web UI commands required by any cross-layer PR. Confirm documentation no
longer describes silent FX omission, unchanged pattern-stop shares, no-suffix
USD fallback, or write-free computation where writes remain.
