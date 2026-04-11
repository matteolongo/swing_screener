# Predictive And Explanation Improvement Plan

> Status: implementation-ready engineering brief.
> Last reviewed: 2026-04-11.

## 1. Purpose

This document explains how to improve the app so that:

- symbol ranking is more predictive;
- technical, fundamentals, and intelligence modules work as one coherent system;
- explanations become easier to trust and easier to read;
- the UI stops showing mixed-timestamp or mixed-logic analysis.

This is intended as a handoff document for a coding agent.

---

## 2. Current Architecture Summary

The current app is deterministic and modular, but the integration happens late.

### Technical layer

The screener currently:

1. builds technical feature tables from trend, volatility, and momentum;
2. filters the universe;
3. ranks symbols using `mom_6m`, `mom_12m`, and `rs_6m`;
4. assigns entry timing using simple breakout / pullback rules;
5. builds trade plans and a confidence score.

Relevant files:

- `src/swing_screener/selection/universe.py`
- `src/swing_screener/selection/ranking.py`
- `src/swing_screener/selection/entries.py`
- `src/swing_screener/strategy/modules/momentum.py`

### Fundamental layer

Fundamentals currently:

1. fetch or reuse a cached symbol snapshot;
2. derive missing metrics where possible;
3. score growth, profitability, balance sheet, cash flow, and valuation pillars;
4. generate highlights, red flags, freshness flags, and data-quality flags.

Relevant files:

- `src/swing_screener/fundamentals/service.py`
- `src/swing_screener/fundamentals/scoring.py`
- `src/swing_screener/fundamentals/models.py`

### Intelligence layer

Intelligence currently:

1. ingests market events and additional evidence;
2. normalizes and deduplicates evidence;
3. computes catalyst reactions against OHLCV;
4. applies peer/theme confirmation;
5. updates lifecycle state;
6. computes catalyst scores;
7. blends catalyst score with `technical_readiness` into `opportunity_score`.

Relevant files:

- `src/swing_screener/intelligence/pipeline.py`
- `src/swing_screener/intelligence/reaction.py`
- `src/swing_screener/intelligence/scoring.py`
- `src/swing_screener/intelligence/state.py`

### Current integration point

The actual combination of the three systems happens late inside the screener service:

1. screener candidates are built first;
2. cached fundamentals snapshots are loaded;
3. latest intelligence opportunities are loaded;
4. `decision_summary` is built from candidate + fundamentals + intelligence;
5. recommendation and display priority are adjusted afterwards.

Relevant files:

- `api/services/screener_service.py`
- `src/swing_screener/recommendation/decision_summary.py`

---

## 3. Main Problems To Fix

## Problem A: integration happens too late

The app chooses top technical candidates before fundamentals and intelligence matter.

Consequence:

- the system can miss symbols with mediocre raw momentum but strong catalyst + strong fundamentals;
- combined analysis mostly changes the ordering of already-selected names instead of influencing the real opportunity set.

## Problem B: intelligence is often disconnected from real technical state

The intelligence pipeline accepts `technical_readiness`, but the workspace symbol runner currently starts intelligence without passing it.

Consequence:

- intelligence often falls back to neutral `0.5` technical readiness;
- `decision_summary` can then label technical state from stale or neutral intelligence instead of the current screener setup;
- explanations become inconsistent.

Relevant files:

- `src/swing_screener/intelligence/pipeline.py`
- `web-ui/src/features/intelligence/useSymbolIntelligenceRunner.ts`

## Problem C: timestamp/provenance mismatch

The screener result, fundamentals snapshot, intelligence snapshot, and frontend-refresh patching do not guarantee one shared `asof_date`.

Consequence:

- the same symbol can be explained from mixed dates;
- users cannot tell whether the trade plan, fundamentals, and catalyst state refer to the same market close.

## Problem D: technical model is too narrow

Current ranking mostly uses:

- 6M momentum;
- 12M momentum;
- relative strength;
- simple breakout / pullback detection.

Consequence:

- strong but low-quality setups can rank too high;
- the system underuses available market structure information.

## Problem E: explanations are derived in more than one place

There is backend decision-summary logic and frontend fallback recomputation logic.

Consequence:

- explanation drift between backend and frontend;
- harder maintenance;
- harder debugging.

Relevant files:

- `src/swing_screener/recommendation/decision_summary.py`
- `web-ui/src/features/screener/decisionSummary.ts`

## Problem F: no clear measurement loop

The app currently has deterministic logic, but it does not appear to have a closed evaluation loop for:

- ranking quality;
- post-event follow-through quality;
- explanation usefulness;
- false-positive analysis.

Consequence:

- improvements are hard to validate;
- “more predictive” cannot be measured reliably.

---

## 4. Target State

The target architecture should work like this:

1. `technical analysis` decides timing and trade structure.
2. `fundamentals` decide business quality and conviction.
3. `intelligence` decides why now and event relevance.
4. `combined analysis` decides priority and action from a shared, same-date symbol snapshot.

Important rule:

- keep the layers separate in the UI and explanation;
- combine them for prioritization;
- do not collapse everything into one opaque score.

---

## 5. Implementation Priorities

The order below is deliberate. Start with consistency bugs, then integrate ranking, then enrich signals, then improve explanation quality.

## Priority 1: fix technical-readiness handoff into intelligence

### Goal

Ensure that every symbol intelligence run receives the real technical readiness from the current screener candidate when available.

### Required changes

1. Update the workspace intelligence runner to pass `technicalReadiness` for the selected ticker when a screener candidate exists.
2. Define one backend normalization rule for candidate-derived technical readiness.
3. If the screener candidate is missing, use an explicit fallback and expose that fallback in the response metadata.
4. Add tests showing that a strong screener setup does not degrade to neutral `0.5` inside intelligence.

### Suggested touchpoints

- `web-ui/src/features/intelligence/useSymbolIntelligenceRunner.ts`
- `web-ui/src/features/intelligence/api.ts`
- `api/models/intelligence.py`
- `api/services/intelligence_service.py`
- `src/swing_screener/intelligence/pipeline.py`
- tests around intelligence runs and opportunity scoring

### Acceptance criteria

- intelligence run launched from workspace sends real technical readiness when candidate exists;
- stored opportunity reflects that value;
- `decision_summary.technical_label` is no longer silently weakened by missing handoff.

---

## Priority 2: create a unified symbol analysis snapshot

### Goal

Introduce one backend object that represents the full symbol analysis at one point in time.

### Why

Right now the UI can patch fundamentals separately from the screener result. That helps freshness, but it also mixes timestamps and logic sources.

### Required changes

Create a backend aggregate such as `SymbolAnalysisSnapshot` with fields like:

- `symbol`
- `asof_date`
- `technical`
- `fundamentals`
- `intelligence`
- `decision_summary`
- `source_meta`
- `warnings`

The object should include:

- source timestamps for each submodule;
- an explicit `is_consistent_snapshot` flag;
- warnings when modules are from different dates.

### Suggested touchpoints

- `api/services/workspace_context_service.py`
- new backend model file under `api/models/` or `src/swing_screener/recommendation/`
- screener endpoints and workspace endpoints
- frontend workspace analysis types/components

### Acceptance criteria

- workspace reads one canonical symbol analysis payload;
- UI does not recompute major decision logic locally;
- stale or mixed-date conditions are visible.

---

## Priority 3: move from late overlay to two-stage combined ranking

### Goal

Allow fundamentals and intelligence to influence final ranking before the top candidates are finalized.

### Recommended design

Use two stages:

### Stage 1: technical prefilter

Keep the technical screener as the fast broad filter.

Example:

- eligible universe;
- raw technical ranking;
- keep top 3x to 5x the final desired count.

### Stage 2: combined ranking

For that reduced set, compute:

- technical readiness;
- fundamental quality score;
- valuation penalty/bonus;
- catalyst strength;
- freshness / quality penalties.

Then compute a combined priority score.

Important:

- do not replace action labels with one raw score in the UI;
- combined score is for ranking, not for explanation display.

### Suggested formula

Start simple and deterministic:

```text
combined_priority =
  0.45 * technical_readiness
  + 0.25 * fundamentals_quality
  + 0.20 * catalyst_strength
  + 0.10 * valuation_attractiveness
  - freshness_penalties
  - data_quality_penalties
```

This is only a starting point. Keep all weights configurable.

### Suggested touchpoints

- `api/services/screener_service.py`
- `src/swing_screener/recommendation/decision_summary.py`
- possibly new module: `src/swing_screener/recommendation/priority.py`
- daily review prioritization

### Acceptance criteria

- final candidate ordering reflects combined technical + fundamental + intelligence context;
- raw screener rank is still preserved for debugging;
- tests cover changes in priority when fundamentals or catalysts improve.

---

## Priority 4: improve technical readiness so it is more predictive

### Goal

Upgrade technical scoring from “momentum + simple entry signal” to a broader setup-quality model.

### Add these technical features

1. Breakout quality
- breakout above multi-week high;
- close location in range;
- breakout volume confirmation if volume exists.

2. Base quality
- consolidation tightness;
- volatility contraction before breakout;
- number of clean rejections from support.

3. Trend quality
- distance above 20/50/200 SMA;
- slope of 20/50/200 SMA;
- whether the setup is extended vs still early.

4. Relative leadership
- sector-relative strength;
- benchmark-relative strength over multiple windows.

5. Risk efficiency
- ATR relative to structure;
- distance to invalidation;
- reward/risk before and after slippage assumptions.

### Implementation note

Do not force all of this into the existing `confidence` field. Split:

- `technical_readiness`
- `setup_quality`
- `execution_quality`

### Suggested touchpoints

- `src/swing_screener/selection/universe.py`
- `src/swing_screener/selection/ranking.py`
- `src/swing_screener/selection/entries.py`
- `src/swing_screener/strategy/modules/momentum.py`
- `src/swing_screener/risk/recommendations/thesis.py`

### Acceptance criteria

- candidate payload exposes richer technical sub-scores;
- `decision_summary` can explain why a setup is strong beyond “momentum is positive”;
- tests cover breakout, pullback, extended, and low-quality-base cases.

---

## Priority 5: improve fundamentals as a conviction model, not just a snapshot

### Goal

Make fundamentals better at answering “is this a high-quality business worth conviction?”

### Recommended upgrades

1. Use trend acceleration, not just levels
- revenue acceleration / deceleration;
- operating-margin trend slope;
- FCF margin trend slope.

2. Penalize stale and partial data more explicitly
- low freshness should reduce conviction and ranking;
- partial coverage should cap conviction.

3. Separate quality from valuation more strictly
- keep valuation out of the main business-quality score;
- expose both in ranking and explanation as separate dimensions.

4. Add sector-relative heuristics
- not all sectors should use the same thresholds;
- keep the current sector-aware valuation logic and extend that idea to profitability / leverage.

5. Track estimate/revision support if data becomes available
- analyst revisions;
- earnings surprises;
- forward growth confirmation.

### Suggested touchpoints

- `src/swing_screener/fundamentals/scoring.py`
- `src/swing_screener/fundamentals/models.py`
- `src/swing_screener/fundamentals/providers/*`
- `src/swing_screener/recommendation/decision_summary.py`

### Acceptance criteria

- conviction can be reduced because of stale/partial fundamentals even if raw pillars look strong;
- fundamental explanation includes both strengths and reliability caveats;
- tests cover stale, partial, low-quality, and sector-specific cases.

---

## Priority 6: improve intelligence scoring and event usefulness

### Goal

Make intelligence better at ranking true “why now” situations and weaker at surfacing noise.

### Required improvements

1. Fix stale-event decay
- decay should use actual event age in hours, not a weak proxy.

2. Improve event relevance
- distinguish scheduled binary events from news churn;
- distinguish company-specific events from broad-theme mentions.

3. Improve evidence quality handling
- low-quality evidence should not fully suppress opportunity, but should cap confidence;
- make evidence quality visible in explanations.

4. Add follow-through features
- 1-day, 3-day, and 5-day post-event continuation statistics;
- false-catalyst diagnostics stored for later analysis.

5. Make catalyst state more actionable
- `WATCH`, `CATALYST_ACTIVE`, `TRENDING`, `COOLING_OFF` should affect ranking and wording consistently.

### Suggested touchpoints

- `src/swing_screener/intelligence/scoring.py`
- `src/swing_screener/intelligence/reaction.py`
- `src/swing_screener/intelligence/state.py`
- `src/swing_screener/intelligence/pipeline.py`
- `src/swing_screener/intelligence/evidence.py`

### Acceptance criteria

- old weak events decay properly;
- intelligence scores better differentiate fresh material catalysts from background noise;
- tests cover stale events, false catalysts, binary events, and high-confirmation events.

---

## Priority 7: make explanation logic server-owned and easier to scan

### Goal

The backend should be the single source of truth for combined explanations.

### Required changes

1. Remove or minimize frontend recomputation of decision-summary logic.
2. The backend should return one explanation contract with short structured sections.
3. Keep explanations deterministic by default.
4. Optional LLM-generated education should be additive, never the source of truth.

### Recommended explanation structure

For each symbol, return:

- `summary_line`: one sentence
- `why_it_qualified`: 2-4 bullets
- `why_now`: 1-2 bullets
- `main_risks`: 2-3 bullets
- `what_invalidates_it`: 1-2 bullets
- `next_best_action`: one sentence
- `confidence_notes`: freshness / coverage / evidence reliability

### Important rule

Do not let the UI infer explanation state from local heuristics if the backend already knows it.

### Suggested touchpoints

- `src/swing_screener/recommendation/decision_summary.py`
- `src/swing_screener/recommendation/models.py`
- `web-ui/src/features/screener/decisionSummary.ts`
- `web-ui/src/components/domain/workspace/DecisionSummaryCard.tsx`

### Acceptance criteria

- same input state always produces same explanation;
- frontend displays backend explanation directly;
- explanation includes clear caveats when data is stale, partial, or neutral.

---

## Priority 8: add measurement and regression tracking

### Goal

Do not claim “more predictive” without measurement.

### Minimum measurement framework

Track at least:

- candidate rank vs forward 5D / 10D / 20D returns;
- hit rate by action bucket;
- follow-through after catalyst event;
- false-positive rate by catalyst type;
- outcome distribution by fundamentals label;
- explanation warning frequency.

### Recommended artifacts

Persist per-symbol evaluation records with:

- date selected;
- technical/fundamental/intelligence sub-scores;
- decision action;
- realized forward returns;
- max favorable excursion;
- max adverse excursion.

### Suggested touchpoints

- new module under `src/swing_screener/reporting/` or `src/swing_screener/recommendation/`
- daily review / screener history storage
- tests around serialization and metrics generation

### Acceptance criteria

- new logic changes can be evaluated against previous behavior;
- ranking changes are measurable;
- false-positive clusters are visible.

---

## 6. Recommended Delivery Plan

Implement in this order:

1. Fix intelligence technical-readiness handoff.
2. Create unified symbol analysis snapshot and remove frontend logic duplication.
3. Introduce combined ranking after technical prefilter.
4. Expand technical readiness model.
5. Expand fundamentals conviction logic.
6. Tighten intelligence scoring and event decay.
7. Refactor explanation contract.
8. Add evaluation metrics and regression reports.

Do not try to do everything in one PR.

---

## 7. PR Breakdown

## PR 1: intelligence handoff consistency

Deliver:

- send technical readiness into intelligence run from workspace;
- add tests;
- expose fallback metadata.

## PR 2: unified symbol analysis snapshot

Deliver:

- one backend payload for symbol analysis;
- shared timestamps and warnings;
- frontend consumes canonical payload.

## PR 3: server-owned explanation contract

Deliver:

- backend explanation sections;
- simplify frontend decision-summary recomputation;
- keep UI rendering only.

## PR 4: combined ranking stage

Deliver:

- technical prefilter + combined ranking;
- preserve raw technical rank and new combined rank.

## PR 5: richer technical model

Deliver:

- expanded technical feature set;
- improved setup-quality scoring;
- tests.

## PR 6: richer fundamentals conviction model

Deliver:

- trend acceleration;
- stronger freshness penalties;
- better sector-aware quality thresholds.

## PR 7: intelligence scoring cleanup

Deliver:

- real event-age decay;
- stronger evidence-quality handling;
- improved event relevance.

## PR 8: measurement framework

Deliver:

- stored evaluation records;
- reporting helpers;
- regression-friendly tests.

---

## 8. Non-Goals

These are explicitly not required in the first round:

- replacing deterministic logic with an opaque ML model;
- using LLM output as the primary recommendation engine;
- intraday trading logic;
- automatic order placement;
- a full DCF engine.

---

## 9. Definition Of Done

The improvement project is successful when:

1. technical, fundamentals, and intelligence all contribute before final ranking is locked;
2. symbol analysis uses one consistent snapshot with visible provenance;
3. explanations come from one backend source of truth;
4. the workspace intelligence run uses real technical readiness;
5. ranking and decision changes are measurable with stored outcome metrics.

---

## 10. Instructions For The Coding Agent

When implementing this plan:

1. keep changes deterministic and testable;
2. preserve the separation of technical, fundamentals, valuation, and catalyst reasoning;
3. prefer additive changes over breaking API contracts where possible;
4. preserve raw technical rank for debugging;
5. add tests for any new scoring or state-transition rule;
6. surface freshness and data-quality caveats explicitly;
7. do not reintroduce frontend-only explanation logic once backend ownership exists.

If forced to choose, prioritize:

1. consistency of data and timestamps;
2. consistency of explanation logic;
3. ranking quality;
4. richer feature engineering.
