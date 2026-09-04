# Configuration Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove import-time configuration capture and eliminate dead or hardcoded report configuration paths.

**Architecture:** Runtime-facing functions resolve defaults at call time, while one request-scoped `ReportConfig` is assembled and passed through the pipeline. Operator-tunable confidence behavior moves to validated YAML-backed config.

**Tech Stack:** Python 3, dataclasses, YAML, pytest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Defaults remain deterministic and backward compatible when no override exists.
- Operator-tunable values live in YAML, not source literals.
- PR 18 is stacked on PR 17.

---

### Task 1 (PR 17): Remove import-time config instances

**Branch:** `codex/remove-import-time-configs` from `main`

**Files:**

- Modify: `src/swing_screener/reporting/report.py`
- Modify: `src/swing_screener/strategy/orchestrator.py`
- Modify: `src/swing_screener/strategy/modules/momentum.py`
- Modify: `src/swing_screener/selection/ranking.py`
- Modify: `src/swing_screener/selection/entries.py`
- Modify: `src/swing_screener/selection/universe.py`
- Modify: `src/swing_screener/risk/position_sizing.py`
- Modify: `src/swing_screener/execution/guidance.py`
- Modify: `src/swing_screener/strategy/report_config.py`
- Modify: `tests/test_report.py`
- Modify: `tests/test_strategy_config.py`
- Modify: `config/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prove runtime override failure**

Change a settings override after module import and assert the next public call
sees it. Cover representative reporting, entry, sizing, and guidance functions.
The tests should fail while signatures capture `Config()` instances as defaults.

- [ ] **Step 2: Replace instance defaults**

Change public signatures from `cfg: Config = Config()` to
`cfg: Config | None = None`, resolving the appropriate config inside the call.
Do not mutate caller-supplied config objects.

- [ ] **Step 3: Carry execution config in request scope**

Add `execution: ExecutionConfig` to `ReportConfig` and pass the same request-
scoped instance through report generation, momentum guidance, and API pattern-
stop calculation. Remove independent `ExecutionConfig()` construction on those
paths.

- [ ] **Step 4: Check public API documentation**

Update nearest READMEs and any notebooks whose demonstrated signatures or
configuration ownership changed. Run affected notebooks end-to-end when their
public examples change.

- [ ] **Step 5: Verify and commit**

Run config, report, momentum, ranking, entries, sizing, guidance, and screener
tests plus Ruff. Commit with `Resolve runtime configuration at call time`.

---

### Task 2 (PR 18): Remove dead report config paths and literals

**Branch:** `codex/remove-dead-report-config-paths` from `codex/remove-import-time-configs`

**Files:**

- Modify: `src/swing_screener/strategy/report_config.py`
- Modify: `api/services/screener_service.py`
- Modify: `config/defaults.yaml`
- Modify: `config/README.md`
- Modify: `tests/test_strategy_config.py`
- Modify: `tests/test_screener_service.py`
- Modify: `src/swing_screener/strategy/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add ownership tests**

Assert changing confidence weights and signal-strength contributions in YAML
changes confidence output without source edits. Add a test that constructs a
report config through the one supported builder and reaches the API path.

- [ ] **Step 2: Delete or adopt the dead builder**

Make one `build_report_config(...)` function the sole assembly path if it can
represent repository and request overrides; otherwise remove it and document
the granular builders as canonical. Do not leave two apparently authoritative
paths.

- [ ] **Step 3: Move confidence literals to validated config**

Add a frozen `ConfidenceConfig` under the reporting config section with score,
signal, trend, and volatility weights plus named signal-strength contributions.
Validate finite non-negative weights and a positive total, then inject it into
confidence calculation.

- [ ] **Step 4: Verify and commit**

Run `pytest tests/test_strategy_config.py tests/test_screener_service.py -q`,
`ruff check src/swing_screener/strategy api/services/screener_service.py tests`,
and `python scripts/check_release_version.py`. Update strategy/config docs and
commit with `Consolidate report configuration ownership`.
