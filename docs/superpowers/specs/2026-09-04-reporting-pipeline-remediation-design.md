# Reporting Pipeline Remediation Design

**Date:** 2026-09-04
**Base branch:** `main`
**Source audit:** Backend report-pipeline review completed 2026-09-04

## Objective

Repair the report pipeline's correctness, freshness, currency, order-state, and
daily-review boundaries without adding broker execution, intraday strategy
logic, machine learning, or heuristic ranking behavior. Delivery is split into
18 reviewable pull requests. Each PR must leave the repository working and must
carry its tests and documentation with the behavior it changes.

## Approved Delivery Decisions

- Use one PR per root cause, not one PR per edited file.
- Split cache freshness and currency ownership into two-PR stacks because each
  crosses independently reviewable contracts.
- Keep test corrections in the PR that changes the protected behavior.
- Preserve the manual-execution boundary and the R-multiple risk model.
- Make failures explicit and fail closed wherever a missing input could create
  an actionable recommendation or duplicate entry.
- Preserve backward compatibility unless a field is formally deprecated; do
  not silently change the meaning of an existing field.
- Update the nearest README, API/config documentation, notebooks affected by a
  public API change, and `CHANGELOG.md` for user-visible behavior.

## Target Ownership Model

| Concern | Authoritative owner |
| --- | --- |
| Structural target and reward/risk verdict | `risk/engine.py` + `risk/recommendations/engine.py` |
| Per-symbol record cache identity and provenance | `selection/eval_cache.py` |
| Market-close/final-candle determination | `selection/screening_window.py` |
| Account currency | application `ConfigRepository` |
| Supported currency codes and exchange calendars | shared data-layer registry |
| Report plan schema and blocked-plan reasons | `reporting/report.py` + `risk/position_sizing.py` |
| Pending-order permission | same-symbol evaluator with fail-closed service input |
| Daily-review classification | `DailyReviewService` action buckets |
| Snapshot persistence | explicit daily-review writer operation |
| Technical rank | selection ranking; immutable after creation |
| Final API priority rank | API decision-priority stage |
| OHLCV normalization | one validation function at pipeline ingress |
| Execution configuration | one per-run object passed through report and API stages |

## PR Map and Merge Order

| # | Branch | Base | Deliverable |
| ---: | --- | --- | --- |
| 1 | `codex/preserve-structural-targets` | `main` | Preserve caller-supplied structural targets through thesis generation. |
| 2 | `codex/version-eval-cache-provenance` | `main` | Add cache schema, candle identity, and freshness provenance. |
| 3 | `codex/prevent-partial-final-promotion` | `codex/version-eval-cache-provenance` | Refresh across market close and reject intraday cache entries in final runs. |
| 4 | `codex/centralize-currency-registry` | `main` | One supported-currency and market-calendar registry. |
| 5 | `codex/authoritative-account-currency` | `codex/centralize-currency-registry` | Inject app account currency and provide explicit FX routing/blocking. |
| 6 | `codex/stabilize-report-plan-schema` | `main` | Fixed plan schema, block reasons, safe actions, and CSV contract. |
| 7 | `codex/fail-closed-pending-orders` | `main` | Pending entries block globally; unavailable order state blocks approval. |
| 8 | `codex/separate-review-evaluation-errors` | `main` | Distinguish failed position evaluation from a true hold. |
| 9 | `codex/use-stateless-review-orders` | `codex/separate-review-evaluation-errors` | Consume caller-supplied orders in stateless review. |
| 10 | `codex/make-review-persistence-explicit` | `codex/use-stateless-review-orders` | Pure GET/compute paths and explicit atomic snapshot writes. |
| 11 | `codex/preserve-rank-provenance` | `main` | Separate rank meanings and make ties deterministic. |
| 12 | `codex/normalize-ohlcv-ingress` | `main` | Sort, deduplicate or reject, and validate OHLCV once. |
| 13 | `codex/correct-signal-history-boundaries` | `codex/normalize-ohlcv-ingress` | Correct exact breakout/pullback history boundaries. |
| 14 | `codex/harden-position-sizing-inputs` | `main` | Finite validation and execution-price-consistent risk arithmetic. |
| 15 | `codex/deprecate-usd-money-aliases` | `codex/authoritative-account-currency` | Stop presenting quote amounts as USD. |
| 16 | `codex/define-sector-concentration` | `main` | Explicit denominator, duplicates, unknowns, and threshold behavior. |
| 17 | `codex/remove-import-time-configs` | `main` | Replace constructed defaults with one per-run execution config. |
| 18 | `codex/remove-dead-report-config-paths` | `codex/remove-import-time-configs` | Remove dead config assembly and configure retained ranking policy. |

Only PRs 2→3, 4→5→15, 8→9→10, 12→13, and 17→18 are stacked. All
other PRs branch from `main` and may be reviewed independently. If an upstream
PR merges first, rebase the next PR and change its base to `main` without
combining their commits.

## Cross-PR Contracts

### Risk and plan integrity

A structural or manual target is immutable input to reward/risk validation.
Synthetic desired targets are advisory and use a separate field. Every plan
must reconcile `entry`, `stop`, `risk_per_share`, `shares`, realized risk, and
currency after execution-price normalization.

### Freshness

An evaluation cache hit requires matching cache schema, strategy inputs,
symbol, as-of date, last-candle timestamp, candle-content fingerprint, and
freshness phase. A record produced from an unclosed candle can never satisfy a
`final_close` request. Provider fallback provenance participates in actionable
data status.

### Currency

`account_to_quote_rate` means quote-currency units per one account-currency
unit. App configuration owns account currency. Same-currency conversion is
exactly `1.0`. Unsupported or unavailable cross-currency FX produces a
structured block and zero executable shares.

### Reports and APIs

The report DataFrame and CSV use a fixed ordered schema even when every plan is
blocked. Blocked candidates retain analytical features and carry a machine-
readable status/reason. Human action text requires an explicitly tradable plan.
API rank and money fields must state their units and provenance in their names.

### Portfolio and daily review

Pending/submitted entry orders block another same-symbol entry whether or not
an open position exists. Unknown order state fails closed. Position evaluation
errors use a dedicated review bucket. Pure compute routes do not write caches,
review queues, directories, or snapshots unless the request explicitly opts
into those side effects.

## Verification Policy

Every implementation PR uses test-driven development and runs its focused
tests first. Before delivery, run:

```bash
pytest -q
ruff check .
python scripts/check_release_version.py
```

Run `black --check .` when formatting was not delegated to the repository's
formatter workflow. If a PR changes Web UI types or visible behavior, also run
`cd web-ui && npm test && npm run typecheck && npm run lint && npm run build`,
and attach screenshots as required by `AGENTS.md`.

## Non-Goals

- Broker API integration or automatic order submission.
- Intraday signal generation; intraday data remains preview-only.
- Replacing the momentum strategy or R-multiple model.
- Machine learning, curve fitting, or heuristic tie-breaking.
- A general persistence rewrite beyond daily-review snapshot ownership.
- Removing deprecated money fields in a patch/minor release.
