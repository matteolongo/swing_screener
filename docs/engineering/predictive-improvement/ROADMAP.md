# Predictive and Explanation Improvement — Roadmap

> Branch strategy: each PR branches from `feature/ux-revamp` (current main-line) unless noted.
> All PRs target `feature/ux-revamp` as base.
> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Delivery order

| # | PR | Focus | Status | Branch |
|---|---|---|---|---|
| 1 | [PR1 — Intelligence handoff](PR1_intelligence_handoff.md) | Pass real technical readiness into intelligence runs | `[ ]` | `fix/intelligence-handoff` |
| 2 | [PR2 — Unified snapshot](PR2_unified_snapshot.md) | One backend object per symbol with shared timestamps | `[ ]` | `feat/unified-snapshot` |
| 3 | [PR3 — Explanation contract](PR3_explanation_contract.md) | Structured server-owned explanation; remove frontend recomputation | `[ ]` | `feat/explanation-contract` |
| 4 | [PR4 — Combined ranking](PR4_combined_ranking.md) | Two-stage pipeline: technical prefilter + combined priority score | `[ ]` | `feat/combined-ranking` |
| 5 | [PR5 — Richer technical model](PR5_richer_technical_model.md) | Setup quality, SMA slope, sector RS, volume confirmation | `[ ]` | `feat/richer-technical-model` |
| 6 | [PR6 — Fundamentals conviction](PR6_fundamentals_conviction.md) | Trend acceleration, freshness penalty, quality/valuation split | `[~]` | `feat/fundamentals-conviction` |
| 7 | [PR7 — Intelligence scoring](PR7_intelligence_scoring.md) | Event-type weights, evidence quality cap, state multipliers | `[ ]` | `feat/intelligence-scoring` |
| 8 | [PR8 — Measurement framework](PR8_measurement_framework.md) | EvaluationRecord, forward returns, hit-rate metrics | `[ ]` | `feat/measurement-framework` |

---

## Dependency graph

```
PR1 (handoff)
  └─► PR2 (snapshot)
        └─► PR3 (explanation)
              └─► PR4 (combined ranking)
                    ├─► PR5 (technical model)  ──┐
                    ├─► PR6 (fundamentals)     ──┤── PR8 (measurement)
                    └─► PR7 (intelligence)     ──┘
```

PRs 1–3 fix consistency. PRs 4–7 improve prediction quality. PR 8 closes the feedback loop.

PRs 5, 6, 7 can be worked in parallel once PR 4 is merged.

---

## Guiding rules (do not drift from these)

1. Keep technical, fundamentals, and intelligence layers separate in the explanation.
2. Combine them only for prioritization — never collapse into one opaque score.
3. Preserve `raw_technical_rank` on every candidate for debugging.
4. All weights and thresholds go through the settings system — never hardcoded.
5. Frontend renders backend explanations; it does not recompute them.
6. Every new scoring rule has at least one deterministic unit test.
7. Additive changes only — do not break existing API contracts before PR 3 is merged.

---

## Definition of done

The project is complete when:

- [ ] Technical, fundamentals, and intelligence all contribute before final ranking is locked (PR4)
- [ ] Symbol analysis uses one consistent snapshot with visible provenance (PR2)
- [ ] Explanations come from one backend source of truth (PR3)
- [ ] Workspace intelligence runs use real technical readiness (PR1)
- [ ] Ranking and decision changes are measurable with stored outcome metrics (PR8)
