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
- Stacked PRs target the branch immediately below them until that branch merges.
- No implementation PR may depend on an unlisted stack edge.

---

## Subsystem Plans

| Plan | PRs | Required order |
| --- | --- | --- |
| [`risk-plan-correctness`](2026-09-04-risk-plan-correctness.md) | 1, 14 | Independent |
| [`cache-freshness`](2026-09-04-cache-freshness.md) | 2, 3 | 2 → 3 |
| [`currency-contract`](2026-09-04-currency-contract.md) | 4, 5, 15 | 4 → 5 → 15 |
| [`reporting-contract`](2026-09-04-reporting-contract.md) | 6, 16 | Independent |
| [`order-daily-review`](2026-09-04-order-daily-review.md) | 7, 8, 9, 10 | 8 → 9 → 10; PR 7 independent |
| [`ranking-data-signals`](2026-09-04-ranking-data-signals.md) | 11, 12, 13 | PR 11 independent; 12 → 13 |
| [`configuration-cleanup`](2026-09-04-configuration-cleanup.md) | 17, 18 | 17 → 18 |

## Merge Coordinator Checklist

- [ ] **Step 1: Merge immediate safety fixes**

Merge PRs 1, 7, and 8 after focused and full backend verification. These close
incorrect recommendation, duplicate-order, and hidden position-error paths.

- [ ] **Step 2: Merge cache stack**

Merge PR 2 before PR 3. After rebasing PR 3 onto updated `main`, rerun provider,
evaluation-cache, screener-service, and screening-window tests together.

- [ ] **Step 3: Merge currency stack**

Merge PRs 4, 5, and 15 in order. Before PR 15 merges, confirm existing clients
still receive deprecated aliases and new code consumes explicitly labelled
quote/account fields.

- [ ] **Step 4: Merge report contracts**

Merge PRs 6 and 16 independently. Verify report CSV fixtures and action text do
not depend on concentration-warning order.

- [ ] **Step 5: Merge daily-review stack**

Rebase PR 9 after PR 8, then PR 10 after PR 9. Verify pure-compute tests with
filesystem writes instrumented to fail if called.

- [ ] **Step 6: Merge ranking and data contracts**

Merge PR 11 independently. Merge PR 12 before PR 13, then run the report,
selection, provider, and API screener suites together to catch ordering drift.

- [ ] **Step 7: Merge sizing and configuration cleanup**

Merge PR 14 independently. Merge PR 17 before PR 18 and verify runtime settings
overrides are visible within one process.

- [ ] **Step 8: Run final integration verification**

Run `pytest -q`, `ruff check .`, `python scripts/check_release_version.py`, and
the Web UI commands required by any cross-layer PR. Confirm documentation no
longer describes silent FX omission, unchanged pattern-stop shares, no-suffix
USD fallback, or write-free computation where writes remain.
