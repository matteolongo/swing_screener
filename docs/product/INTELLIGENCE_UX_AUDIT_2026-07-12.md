# Swing Screener Intelligence and UX Audit

Date: 2026-07-12

Scope: Intelligence module, trading decision logic, configuration, navigation, and core UI journeys

Method: repository trace, live API inspection against the locally running app, persisted-output review, and automated test verification
Change policy: audit only; no application source or configuration was changed

## Executive summary

The application has a substantial and generally well-factored foundation: deterministic EOD screening, ATR-based sizing, a portfolio lifecycle, fundamentals enrichment, source collectors, a two-call LLM pipeline, durable history/traces, and a React workspace that tries to bring daily actions and symbol analysis together.

Its primary product problem is not lack of information. It is failure to preserve the boundaries between four different questions:

1. Is this stock an interesting setup?
2. Has the entry condition actually triggered?
3. Is the proposed trade internally coherent?
4. Can this portfolio safely take the trade now?

The current system can collapse these into one action label and one `RECOMMENDED` verdict. A conditional `WAIT_FOR_BREAKOUT` or `BUY_ON_PULLBACK` can be promoted into an active signal; a 2R target passes because it was constructed to equal 2R; and recommendations are made without aggregate cash, heat, pending-order, sector, or correlation approval. In the live state inspected on 2026-07-12, the portfolio reported negative available capital while the active strategy allowed a single position to consume 100% of account equity.

The Intelligence module repeats the same ownership problem. It mixes deterministic facts, retrieved evidence, model interpretation, and model confidence without a complete provenance contract. Citations are requested but not programmatically grounded. Cache identity is only date+ticker, while the singleton analyzer captures the strategy/model at first construction. A strategy switch can therefore appear active while a cached or already-constructed analysis still reflects old inputs or policy.

The UX has improved components and reasonable local patterns, but the overall experience remains chaotic because the information architecture is organized around implementation buckets—Today, Calendar, Book, Universes, Data Sources, Settings—and nested tabs rather than the trader's decision sequence. The Today screen alone combines daily actions, screener, watchlist, six analysis tabs, position review, strategic review, intelligence chat, and technical traces in a fixed two-column workspace.

The recommended direction is a decision-gated workflow:

`Market readiness → Discover → Qualify → Analyze → Validate risk → Queue order / Watch / Reject → Manage → Review`

The first implementation phase should correct trading and AI trust boundaries before any broad visual redesign.

## 1. How the system currently works

### Screening and trade planning

1. The API resolves the selected strategy/universe, fetches daily OHLCV plus benchmark/sector context, and constructs trend, ATR, momentum, relative-strength, setup, and pattern features.
2. The eligible universe is filtered and ranked primarily by cross-sectional 6m momentum, 12m momentum, and 6m relative strength.
3. Entry labels are generated from a close above the maximum prior close or a one-day SMA reclaim.
4. Each candidate is sized independently from the current close and an ATR stop.
5. A recommendation checklist, heuristic confidence, cached fundamentals, earnings proximity, and decision summary are added.
6. Candidates are ranked repeatedly: technical rank, confidence, combined priority, then decision action/conviction.
7. The UI lets the user inspect a symbol, watch it, or proceed toward an order.

Evidence: `api/services/screener_service.py:455-557,900-1111,1191-1265`; `src/swing_screener/selection/universe.py:45-198`; `src/swing_screener/selection/ranking.py:33-102`; `src/swing_screener/selection/entries.py:24-154`; `src/swing_screener/risk/position_sizing.py:90-279`; `api/services/decision_context.py:211-235`.

### Intelligence

1. `POST /api/intelligence/{ticker}` checks active-strategy enablement and the same-day ticker cache.
2. Missing fundamentals, calendar items, and configured evidence are fetched; Polygon can overwrite price/technical inputs when configured.
3. A linear LangGraph resolves context, assembles inputs, builds a prompt, performs OpenAI web search, formats the prose into a Pydantic schema, computes an advisory evidence ledger, assembles the result, and persists cache/history/metrics.
4. A follow-up chat uses cached intelligence. A separate deterministic strategic overlay summarizes cached signals and optional refreshed evidence.

Evidence: `api/routers/intelligence.py:356-404`; `src/swing_screener/intelligence/graph/build.py:19-29`; `src/swing_screener/intelligence/graph/nodes.py:137-351`; `src/swing_screener/intelligence/symbol_analyzer.py:45-187,673-760`.

### Current UI

The app routes to Today by default. Primary navigation is Today, Calendar, Book, Universes, Data Sources, and Settings. Today is a fixed 7/12 + 5/12 workspace: the left side switches among Today, Screener, and Watchlist; the right side contains symbol analysis with Overview, Fundamentals, Intelligence, Order, Backtest, and Volume Zones tabs.

Evidence: `web-ui/src/App.tsx:43-55`; `web-ui/src/components/layout/Sidebar.tsx:20-32`; `web-ui/src/pages/Today.tsx:80-149`; `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx:178-187,222-460`.

## 2. Ranked findings

### F01 — Conditional setups can become executable recommendations

- Severity: Critical / P0
- Evidence: `WAIT_FOR_BREAKOUT` and `BUY_ON_PULLBACK` count as `signal_active` in `src/swing_screener/risk/recommendations/engine.py:136-145`; all passing gates produce `RECOMMENDED` at `:411-413`. A failed raw signal is rebuilt from the higher-level decision action in `api/services/decision_context.py:160-205`.
- Why it matters: “interesting setup,” “wait for condition,” and “enter now” become interchangeable. This can lead to premature orders.
- Recommended solution: Create independent states: `setup_status`, `trigger_status`, `plan_status`, and `portfolio_approval`. Only an observed and current entry trigger can produce `READY_TO_ORDER`; conditional setups must remain `WAITING`.
- Expected impact: Prevents the most direct false-action failure and gives the entire UX a stable decision model.
- Effort: Medium.
- Acceptance criteria:
  - `WAIT_FOR_BREAKOUT` and `BUY_ON_PULLBACK` never pass an `entry_triggered` gate without observed price/volume conditions.
  - API and UI expose candidate status separately from execution status.
  - “Create order” is unavailable until trigger, coherent plan, freshness, and portfolio gates pass.

### F02 — Reward/risk validation is tautological

- Severity: Critical / P0
- Evidence: target is constructed as `entry + rr_target × risk`, then RR is recomputed from that target in `src/swing_screener/risk/recommendations/engine.py:204-229`. Active config sets both `min_rr` and `rr_target` to 2 in `config/strategies.yaml:36-45`.
- Why it matters: a valid stop mechanically produces a passing 2R plan even when resistance, volume zones, or the 52-week high make that target implausible.
- Recommended solution: Separate `desired_target` from `validated_target`. Validate achievable reward against independently derived structure; absent reliable structure, show RR as unknown rather than passed.
- Expected impact: Removes false validation from every trade thesis.
- Effort: Medium–Large.
- Acceptance criteria:
  - The RR gate uses an independently derived or validated target.
  - A structural target below 2R fails the gate.
  - Missing target evidence yields `UNKNOWN`, not an automatic 2R pass.

### F03 — Trigger, stop, target, shares, and risk can use different price anchors

- Severity: Critical / P0
- Evidence: sizing anchors entry to current `last` in `src/swing_screener/risk/position_sizing.py:216-256`; execution guidance can substitute a different suggested price in `src/swing_screener/execution/guidance.py:180-213`; the candidate retains the original plan and a separate suggested price in `api/services/screener_service.py:1077-1111`; the decision trade plan combines them in `src/swing_screener/recommendation/decision_summary.py:820-883`.
- Why it matters: placing the suggested order can create a different per-share risk, size, target, and R than the screen displays.
- Recommended solution: Make each order scenario an immutable, internally reconciled plan. Any trigger change must recompute stop interpretation, share count, target, costs, and account risk.
- Expected impact: Prevents silent risk drift between analysis and order preparation.
- Effort: Medium.
- Acceptance criteria:
  - For every plan, `shares × (trigger - stop)`, account risk, target, and RR reconcile within rounding.
  - Changing the trigger recomputes all dependent values.
  - The order review displays one canonical plan ID and source timestamp.

### F04 — No aggregate portfolio permission gate

- Severity: Critical / P0
- Evidence: active strategy permits `max_position_pct: 1.0`, 1.5% per-trade risk, and disables regime scaling at `config/strategies.yaml:36-52`. Sizing is per candidate only in `src/swing_screener/risk/position_sizing.py:99-132`; portfolio handling in the screener is same-symbol suppression rather than aggregate exposure at `api/services/screener_service.py:1124-1189`.
- Live evidence: on 2026-07-12 `/api/portfolio/summary` reported `available_capital: -23.36` for a €1,000 base account, two open positions, and 100% country-risk concentration, while the strategy validation returned `100 / 100 beginner-safe`.
- Why it matters: multiple individually valid candidates can reserve the same cash and stack correlated downside.
- Recommended solution: Add a mandatory pre-trade portfolio approval using available cash, open and pending risk, sector/country/currency exposure, gap/event risk, and a configurable correlation/cluster cap. Reduce the default single-position cap.
- Expected impact: Converts sizing from isolated arithmetic into portfolio risk management.
- Effort: Large.
- Acceptance criteria:
  - Projected cash, heat, pending-order risk, and concentration are shown before order creation.
  - Orders are blocked above configured hard limits.
  - Pending orders reserve capital/risk so candidates cannot reuse it.
  - Tests cover same-sector, same-country, cross-currency, and correlated-name scenarios.

### F05 — Position Intelligence is not deterministically forced to manage-only

- Severity: Critical / P0
- Evidence: the prompt instructs `MANAGE_ONLY` at `src/swing_screener/intelligence/symbol_analyzer.py:64-73`, but result assembly only overrides the draft when `req.decision_action` is canonical at `src/swing_screener/intelligence/graph/nodes.py:282-289`. Position requests normally do not set that field in `api/routers/intelligence.py:431-442`.
- Why it matters: a model can escape the prompt constraint and frame a held position as a new entry.
- Recommended solution: Force `action=MANAGE_ONLY` whenever position context is present and validate/regenerate entry language.
- Expected impact: Removes a dangerous model-control dependency.
- Effort: Small.
- Acceptance criteria:
  - Every position result is `MANAGE_ONLY` regardless of model output.
  - Tests inject every non-management action and verify it cannot escape.
  - Initiation language in position narratives is rejected or repaired.

### F06 — Claims and citations are requested, not grounded

- Severity: Critical / P0
- Evidence: citation behavior is prompt-only in `src/swing_screener/intelligence/symbol_analyzer.py:49-53,144`; the formatter copies prose to schema at `:182-187`; postprocessing counts sources but does not validate claims/URLs at `src/swing_screener/intelligence/graph/nodes.py:231-260`; LLM-classified news/catalysts can enter the ledger in `src/swing_screener/intelligence/weighting/ledger.py:200-241`.
- Live evidence: the current MNST analysis reported “insider selling of approximately $15.5 million shares,” a malformed quantity/unit claim, while all configured app evidence collectors returned zero items and the narrative relied on web-search output.
- Why it matters: fabricated or distorted catalyst claims can look like structured evidence and affect a trader-facing balance.
- Recommended solution: Assign retrieval evidence IDs, require claim→evidence mappings, validate URL/date/ticker identity, and exclude unsupported claims from ledgers and decision summaries. Generate validated structured claims before prose.
- Expected impact: Material improvement to trust, auditability, and explainability.
- Effort: Large.
- Acceptance criteria:
  - Every news/catalyst claim references a retrieved or verified evidence ID.
  - Unsupported claims are visibly marked and contribute zero weight.
  - Citation precision, claim coverage, date validity, and ticker identity are evaluated in CI.
  - Invalid URLs or unit inconsistencies create a degraded result.

### F07 — Cache and analyzer configuration can be stale across strategy changes

- Severity: Critical / P0
- Evidence: cache identity is UTC date+ticker only at `src/swing_screener/intelligence/cache.py:15-16,54-84`, and it is returned before enrichment at `api/routers/intelligence.py:369-372`. A process-wide singleton is built at `api/routers/intelligence.py:77-86`; its constructor captures the strategy/model/policy once at `src/swing_screener/intelligence/symbol_analyzer.py:673-692`.
- Why it matters: a strategy switch, changed stop, revised close, prompt update, or model update can silently reuse old analysis.
- Recommended solution: Fingerprint strategy ID/version, request/trade plan, data-as-of values, prompt/schema version, and model. Resolve config per request or rebuild the analyzer when its signature changes.
- Expected impact: Makes strategy switching truthful and analysis reproducible.
- Effort: Medium.
- Acceptance criteria:
  - Any material input/config/model/prompt change causes a cache miss.
  - Result and trace expose the effective strategy/config/input fingerprint.
  - A strategy switch affects the next request without process restart.
  - Concurrent requests cannot mix configurations.

### F08 — Freshness and degradation are incomplete and sometimes misleading

- Severity: Critical / P0
- Evidence: stale provider cache can be served after failure at `src/swing_screener/data/providers/yfinance_provider.py:510-572`; `final_close` is derived from requested date/calendar rather than each ticker's last bar at `src/swing_screener/selection/screening_window.py:114-121`. Intelligence copies values without field-level source/as-of quality at `api/services/intelligence_enrichment.py:15-28,46-90`; `generated_at` can therefore look fresh over stale inputs.
- Why it matters: stale bars or fundamentals can drive apparently current action labels.
- Recommended solution: Introduce a shared provenance contract for price, technicals, fundamentals, events, and evidence. Include expected session, actual as-of, source/fallback, age, coverage, and degraded reason. Enforce confidence ceilings and action blocks.
- Expected impact: Traders can tell current facts from stale context at a glance.
- Effort: Medium–Large.
- Acceptance criteria:
  - Every decision shows market session/as-of and source status.
  - Lagging symbols are excluded or explicitly non-actionable.
  - High conviction is impossible when critical coverage/freshness fails.
  - “Generated now” and “data as of” are displayed separately.

### F09 — Strategy “Safety Score” provides unjustified assurance

- Severity: High / P1
- Evidence: validation checks only six parameters at `src/swing_screener/strategy/validation.py:123-168`; no warnings maps to 100 and `beginner-safe` at `:171-188`. The component also defaults missing/error validation to 100 at `web-ui/src/components/domain/strategy/StrategySafetyScore.tsx:19-21` while saying it shows the last known result at `:71-74`.
- Why it matters: the current 100% position cap, zero commission model, disabled regime protection, and absent earnings/portfolio guardrails still produce “Beginner Safe.” On validation failure, the UI can also show a synthetic 100.
- Recommended solution: Replace the score with a readiness checklist containing hard blocks, warnings, unknowns, and evidence. Never claim beginner safety from parameter ranges alone.
- Expected impact: Removes a misleading high-authority label.
- Effort: Medium.
- Acceptance criteria:
  - Validation error displays `Unavailable`, never 100.
  - A 100% position cap, missing fee profile, disabled event policy, or missing portfolio cap prevents “ready/safe.”
  - Every readiness statement links to the rule and observed value.

### F10 — Breakout/pullback semantics are weaker than their labels imply

- Severity: High / P1
- Evidence: breakout is close > prior closes, not prior highs, at `src/swing_screener/selection/entries.py:24-33`; pullback is only a one-day self-including MA cross at `:36-51`; volume is calculated but not required at `:124-130`. The active strategy disables positive-RS and weekly-uptrend requirements at `config/strategies.yaml:21-23`.
- Why it matters: “breakout” can still be below resistance; a one-day reclaim can be noise rather than a controlled pullback setup.
- Recommended solution: Make breakout basis explicit and configurable; require a buffer and confirmation policy. Define pullback as prior trend + controlled retracement + reclaim + intact structure. Downgrade weak volume/extension to conditional.
- Expected impact: Fewer false-ready setups and clearer trader expectations.
- Effort: Medium.
- Acceptance criteria:
  - A close below the prior intraday high cannot be a high-confidence price breakout.
  - Pullbacks without prior trend or controlled retracement fail.
  - Low-volume or extended signals remain conditional and explain why.

### F11 — “Confidence” is an uncalibrated relative setup heuristic

- Severity: High / P1
- Evidence: confidence blends cross-sectional percentile score, signal mapping, distance above SMA200, and inverse ATR in `src/swing_screener/strategy/modules/momentum.py:60-98`; ranking percentiles depend on the current batch in `src/swing_screener/selection/ranking.py:52-100`.
- Why it matters: a 74.8% label looks probabilistic but changes with universe composition and has no observed calibration.
- Recommended solution: Rename it `setup_score` immediately. Add win rate/expectancy only after out-of-sample calibration with sample size, horizon, cohort, and confidence intervals.
- Expected impact: Reduces false precision.
- Effort: Small for rename; Large for calibration.
- Acceptance criteria:
  - No UI/API calls the heuristic probability or confidence.
  - Any empirical probability shows N, period, regime/strategy cohort, expectancy, and uncertainty.

### F12 — Intelligence prediction evaluation is circular

- Severity: High / P1
- Evidence: earlier predictions are scored from the next model-generated `thesis_delta.what_played_out` at `src/swing_screener/intelligence/history.py:85-123`; no realized return or verified event outcome is used.
- Why it matters: a later model can “confirm” an earlier model by paraphrasing it. This is not evaluation.
- Recommended solution: Keep predictions unresolved until their horizon; score against prices, benchmark-relative returns, stop/target events, and verified catalyst outcomes. Keep qualitative human/LLM review separate.
- Expected impact: Enables real model and strategy calibration.
- Effort: Large.
- Acceptance criteria:
  - No outcome is resolved from LLM prose alone.
  - Evaluations persist horizon, baseline, realized/relative return, target/stop path, and event evidence.
  - Accuracy, abstention, and calibration are reportable by version.

### F13 — Strategy intelligence controls are mostly cosmetic; config round-trips are lossy

- Severity: High / P1
- Evidence: price confirmation, theme thresholds, opportunity weights, minimum score, and daily cap are inserted into the prompt at `src/swing_screener/intelligence/symbol_analyzer.py:650-669` but not deterministically enforced. YAML contains management fields omitted by the API schema, while update replaces the full payload: `config/strategies.yaml:62-64`; `api/models/strategy.py:81-125`; `api/services/strategy_service.py:65-81`.
- Why it matters: users cannot know which settings actually govern behavior; editing can silently remove supported-looking fields.
- Recommended solution: Define one versioned strategy schema, migrate the YAML, reject unknown/deprecated keys, make load/save lossless, and either implement or remove every exposed control.
- Expected impact: Restores configuration credibility and reduces dead surface.
- Effort: Medium.
- Acceptance criteria:
  - Load→edit one field→save preserves all other supported fields semantically.
  - Startup reports unknown/deprecated keys.
  - Every editable setting has a tested runtime consumer.

### F14 — Ranking is duplicated, partially inert, and hard to explain

- Severity: High / P1
- Evidence: candidates pass through momentum rank, confidence sort, combined priority, then action/conviction ordering at `api/services/screener_service.py:764-772,1243-1254` and `api/services/decision_context.py:211-235`. Catalyst is always absent in the decision context at `api/services/decision_context.py:114-130`, yet combined priority allocates it weight and defaults unknown to neutral in `src/swing_screener/recommendation/priority.py:45-74,164-177`. Setup-quality fields exist while active ranking weights remain inert in `src/swing_screener/strategy/modules/momentum.py:194-208`.
- Why it matters: the displayed priority cannot be reconstructed by the trader; missing factors can receive implicit credit.
- Recommended solution: Use one auditable rank with visible component contributions and explicit missing-data renormalization. Preserve raw technical rank as secondary context only.
- Expected impact: More stable, explainable candidate discovery.
- Effort: Medium.
- Acceptance criteria:
  - Displayed contributions sum to the displayed score.
  - Missing factors are excluded/renormalized, not neutral-filled.
  - No hidden post-score reorder changes the displayed priority.

### F15 — Earnings, regime, and cost safeguards fail open or are disabled

- Severity: High / P1
- Evidence: earnings exclusion defaults to zero and unknown dates pass at `config/defaults.yaml:355-377` and `api/services/screener_service.py:1234-1241`; active regime scaling is disabled at `config/strategies.yaml:47`; missing regime data returns a normal multiplier in `src/swing_screener/risk/regime.py:41-51`; commission is zero at `config/strategies.yaml:44` and the cost model omits broker minimums/spread/real FX at `src/swing_screener/risk/recommendations/engine.py:80-99`.
- Why it matters: overnight gap risk and small-account friction can dominate the advertised ATR/R plan.
- Recommended solution: Add explicit strategy policies for earnings (`exclude/reduce/allow`), regime unknown (`strict/reduce/allow`), and verified broker fee profiles. Surface them at plan approval.
- Expected impact: Fewer trades with hidden binary or cost risk.
- Effort: Medium.
- Acceptance criteria:
  - Known earnings inside the window blocks/scales per policy.
  - Source-unavailable is distinct from no event and cannot pass strict mode.
  - Every plan shows regime state and all-in round-trip cost/R.
  - Missing fee profile prevents a “ready” verdict.

### F16 — Strategic overlay can turn bearish evidence bullish

- Severity: High / P1
- Evidence: any non-regulation signal set becomes bullish regardless of bearish direction at `src/swing_screener/intelligence/strategic/agent.py:95-106`; confidence depends largely on count. The service builds a one-ticker context while the product describes a broader portfolio overlay at `api/services/strategic_review_service.py:41-60`.
- Why it matters: multiple bearish items can generate a higher-confidence bullish “prediction.”
- Recommended solution: Temporarily rename it “context summary” or remove directional output. If retained, aggregate direction, independence, source quality, recency, and corroboration; pass the promised portfolio/watchlist context.
- Expected impact: Removes a misleading AI-like authority cue.
- Effort: Medium.
- Acceptance criteria:
  - Bearish-only input cannot produce bullish direction.
  - Duplicate sources do not increase corroboration.
  - Confidence uses independence/quality/recency, not raw count.
  - The overlay includes actual portfolio/watchlist context.

### F17 — Retrieval content lacks prompt-injection isolation; failure modes are brittle

- Severity: High / P1
- Evidence: collector titles/summaries are concatenated into the prompt at `src/swing_screener/intelligence/symbol_analyzer.py:590-604`; chat serializes retrieved content, prior output, and user dictionaries together in `api/services/intelligence_chat_service.py:70-89,126-147`. Search/parse failures propagate through a linear graph and become raw 500 details at `src/swing_screener/intelligence/graph/nodes.py:150-180` and `api/routers/intelligence.py:401-404`.
- Why it matters: malicious content can compete with instructions, while one tool/format failure discards otherwise valid deterministic analysis.
- Recommended solution: Delimit and type untrusted text, validate lengths/schemes, add injection fixtures, and introduce typed partial/degraded outcomes with deterministic fallback.
- Expected impact: Stronger instruction integrity and better availability.
- Effort: Medium.
- Acceptance criteria:
  - Injection fixtures cannot change action ownership, schema, or tool policy.
  - External text has provenance/trust labels and bounded size.
  - Search timeout, empty output, parse error, and persistence failure have distinct tested states.
  - Provider exceptions are not exposed as the user-facing API contract.

### F18 — Observability measures operation, not answer quality

- Severity: Medium / P2
- Evidence: traces capture steps, timing, source counts, model, tokens, and prompt preview; metrics persist only timestamp/ticker/tokens at `src/swing_screener/intelligence/tracing.py:20-42` and `src/swing_screener/intelligence/metrics.py:13-38`. The live `/metrics` response contained no intelligence confidence/coverage observations despite recent persisted analyses.
- Why it matters: token/latency logs cannot tell whether an answer was grounded, consistent, useful, or safe.
- Recommended solution: Add version/fingerprint, cost, cache status, coverage, fallback reasons, unsupported claims, citation precision, latency percentiles, and trader feedback. Build frozen time-aware evaluation sets.
- Expected impact: Enables safe prompt/model/retrieval iteration.
- Effort: Large.
- Acceptance criteria:
  - Every run is reproducible from recorded versions and fingerprints.
  - CI tests position safety, numeric consistency, grounding, abstention, and injection resistance.
  - Production reporting shows degraded, grounding, cost, cache, and latency rates.

### F19 — LangGraph and batch configuration add complexity without their promised behavior

- Severity: Medium / P2
- Evidence: the graph is fixed and unconditional at `src/swing_screener/intelligence/graph/build.py:19-29,154-163`; it has no sufficiency routing or repair. `/sweep` is sequential while `max_concurrency` is unused at `api/routers/intelligence.py:210-258`.
- Why it matters: the system pays framework complexity without conditional reliability, while batch latency/spend remain unmanaged.
- Recommended solution: Either simplify to a typed pipeline or add evidence sufficiency, grounding, repair, and degraded branches. Add a shared concurrency/cost budget and background progress model.
- Expected impact: Lower maintenance or genuinely useful agentic control.
- Effort: Medium.
- Acceptance criteria:
  - Every graph node/edge has a distinct tested reliability role; otherwise it is removed.
  - Concurrent LLM calls never exceed the configured limit.
  - Sweep exposes actual per-symbol progress, cancellation, and budget exhaustion.

## 3. UX audit by journey and screen

### Navigation and information architecture

What works:

- A small number of primary destinations.
- Today is the default route.
- Operational Data Sources and Strategy are separated from trading data at the route level.

Problems:

- Navigation categories describe storage/implementation domains, not a decision sequence. “Book” combines positions, orders, journal, performance, and weekly review (`web-ui/src/pages/Book.tsx:380-473`).
- Data Sources receives the same primary-navigation weight as Today and Portfolio, even though it is an administrative/diagnostic destination (`web-ui/src/components/layout/Sidebar.tsx:20-26`).
- Strategy selection exists in the global header and again on the Strategy page (`web-ui/src/components/layout/Header.tsx:23-66`; `web-ui/src/pages/Strategy.tsx:132-168`).
- There is no persistent workflow status such as `12 discovered → 4 qualified → 2 waiting → 0 portfolio-approved`.

Recommendation: primary nav should be Today, Discover, Watchlist, Portfolio, Review. Put Calendar in Today/Portfolio context and place Strategy, Universes, and Data Health under Settings/Admin.

### Today

Evidence: `web-ui/src/pages/Today.tsx:80-149`; `web-ui/src/components/domain/today/TodayActionList.tsx:177-395`.

- The screen has no page title or market/data-readiness header.
- It mixes held positions, urgent actions, exit signals, pending orders, near-trigger watchlist items, and opportunities in one scroll.
- Today/Screener/Watchlist are peer tabs even though they are sequential stages.
- A selected symbol opens a second dense workspace rather than a clear next-step panel.
- The source-run indicator and recommended/all filters are useful, but they do not communicate the candidate funnel or why an item changed state.

Recommendation: start with blocking issues and portfolio actions, then show a compact candidate pipeline. Selecting a candidate should open a decision drawer with a single primary action based on gate state.

### Screener and candidate discovery

Evidence: `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx:113-360`; `web-ui/src/components/domain/screener/ScreenerForm.tsx:105-375`; `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx:120-311`.

- Running steps are a 1.5-second timer, not backend progress (`ScreenerInboxPanel.tsx:63-109`). This creates false process feedback.
- Filters, action categories, rank, relative performance, RR, expansion, recommendation detail, create order, and watch actions compete in one compact table.
- The Create Order button remains available for every row; its tooltip changes for `NOT_RECOMMENDED`, but the action is not gated (`ScreenerCandidatesTable.tsx:269-300`).
- Discovery/screener also appears inside Universes, producing two entry points with different surrounding mental models.
- Detail rows use `colSpan={6}` under a seven-column table (`ScreenerCandidateDetailsRow.tsx:22-24`), a small layout defect.

Recommendation: table columns should answer only “why is this candidate here?” and “what state is it in?” Use Status, Symbol, Setup score, Trigger state, Key risk, Freshness. Move metrics and order actions into the decision drawer. Replace fake progress with actual job status.

### Symbol analysis / stock detail

Evidence: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx:178-460`; `web-ui/src/components/domain/workspace/IntelligenceDecisionBrief.tsx:61-136`.

- Six tabs plus a persistent decision strip fragment the thesis.
- Overview combines decision explanation, fundamentals strip, position management, a second decision card, chart, catalyst card, and technical grid.
- The decision brief has a useful deterministic-vs-AI conflict warning, but the broader surface still mixes fact, heuristic, and model content.
- The screen shows intelligence generation time but not a complete input-as-of/coverage block.
- Backtest and Volume Zones are advanced research tools but receive peer tab prominence with Overview and Order.

Recommendation: one scrolling decision brief with sections: Setup, Trigger, Thesis, Risks/invalidation, Portfolio impact, Evidence. Put raw metrics, backtest, volume zones, trace, and chat in an Advanced drawer.

### Intelligence

Evidence: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx:344-429`; `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx`; `web-ui/src/components/domain/workspace/AgentTracePanel.tsx`.

- The surface presents Intelligence Decision Brief, Position Review, Strategic Review, Full Intelligence Report, Chat, and Technical Details. These overlap in purpose.
- AI output is not consistently labelled at the field level; some cards look equivalent to deterministic trade facts.
- An analysis can be freshly generated from zero app-collected evidence without a prominent coverage warning.
- The trace is correctly hidden under Technical Details, but it is developer observability rather than trader explanation.

Recommendation: replace overlapping AI panels with one “AI interpretation” section that has coverage, sources, unsupported-claim count, and explicit owner labels: Fact / Deterministic rule / AI interpretation. Keep chat contextual and keep strategic overlay out of symbol execution until corrected.

### Portfolio / Book

Evidence: `web-ui/src/pages/Book.tsx:380-473`.

- Positions and orders belong together; journal, performance, and review are analysis/history tasks.
- Tab state is stored in local storage and route state rather than a shareable URL.
- The daily workflow can move from Today to Book orders, but there is no visible pipeline state or reserved-risk model.

Recommendation: Portfolio should contain Positions and Orders with projected heat/cash. Review should contain Journal, Performance, and Weekly Review with URL-addressable tabs.

### Universes

Evidence: `web-ui/src/pages/Universes.tsx:157-257`.

- The page contains a universe sidebar plus Config, Constituents, Discovery, Screener, and Pool tabs.
- It duplicates candidate discovery and screening found on Today.
- Provider-level discovery controls are advanced setup operations, not a daily trader journey.

Recommendation: move daily Discover into a single product flow. Keep universe membership/provider administration under Settings → Market coverage.

### Calendar

Evidence: `web-ui/src/pages/Calendar.tsx:61-120`.

- Clean and readable, but passive.
- Events are not visibly converted into trade gates, risk-reduction rules, or portfolio exposure summaries.

Recommendation: embed upcoming binary events into Today and each trade approval. Keep a full calendar as a secondary view.

### Strategy / configuration

Evidence: `web-ui/src/pages/Strategy.tsx:106-266`; `web-ui/src/components/domain/strategy/StrategySafetyScore.tsx:14-134`.

- Strategy management, creation, capital summary, philosophy, safety, core settings, and advanced settings create a long configuration surface.
- “Safety” communicates more certainty than the validator earns.
- The active strategy can be changed globally without warning about invalidating cached analyses or pending plans.

Recommendation: organize as Intent, Entry rules, Risk limits, Portfolio limits, Event/regime policy, Intelligence policy. Show a change impact preview and invalidate affected plans/caches explicitly.

### Data Sources

- This is valuable operational tooling but not a primary daily destination.
- “Configured” does not necessarily mean recently healthy; the live source list had `last_probe: null` for all sources.

Recommendation: Settings → Data health. Summarize only decision-affecting degradation in Today and symbol views.

### Empty, loading, error, confidence, and warning states

- Generic `TableState` has loading/error/empty text but no retry or next action (`web-ui/src/components/common/TableState.tsx:13-47`).
- The screener uses fake progress rather than actual state.
- Intelligence returns a simple loading box and raw error message.
- Strategy validation can show 100 during missing/error state.
- Missing evidence, stale data, provider failure, and “no relevant evidence exists” are not consistently distinct.

Recommendation: standardize states as Loading with real progress, Empty with reason/next action, Degraded with missing coverage, Stale with as-of and refresh, Error with retry/support code, and Low confidence with explicit limiting factors.

### Accessibility and responsive behavior

Evidence: `web-ui/src/components/layout/MainLayout.tsx:48-55`; `web-ui/src/components/layout/Header.tsx:42-94`; `web-ui/src/pages/Today.tsx:98-147`.

- The 224px sidebar is always present; there is no mobile drawer behavior.
- The header includes strategy selection, risk summary, review badge, and date/time in a fixed 48px row without responsive hiding/reflow.
- Today keeps fixed 7/12 and 5/12 widths and a viewport-derived height, with no breakpoint stacking.
- Some tab implementations have good keyboard semantics, but Book and Universe tab bars do not use tab roles/keyboard navigation.
- Color is often paired with text, which is good; tiny 10–11px labels and four-pixel scrollbars reduce readability/operability.

Recommendation: responsive sidebar/drawer, stacked Today layout below desktop, minimum 12px supporting text, 44px touch targets, URL-addressable accessible tabs, visible focus, reduced-motion support, and automated axe plus keyboard testing.

## 4. Proposed workflow and information architecture

| Stage | User's main question | Required information | Primary action | Hide until needed | Intelligence role |
|---|---|---|---|---|---|
| 1. Market readiness | Is today suitable for new risk? | session completeness, stale sources, regime, portfolio heat/cash, upcoming portfolio events | Continue / manage only | provider diagnostics, raw benchmark metrics | Summarize material context only; never override hard risk gates |
| 2. Discover | What deserves attention? | universe, one auditable rank, setup type, freshness, exclusion counts | Select candidate | advanced filters, raw indicators | Optional catalyst coverage/summary, clearly separated from rank |
| 3. Qualify | Is the setup valid and is the trigger active? | trend/base, signal definition, trigger state, volume, extension, earnings status | Analyze / wait / reject | full chart metrics | Explain evidence gaps; do not promote conditional state |
| 4. Analyze | Is there a coherent thesis? | chart, business quality, catalyst evidence, counter-thesis, invalidation | Accept thesis / reject | filings, all ratios, trace | Produce grounded interpretation with citations and coverage |
| 5. Validate trade | Do trigger, stop, target, size, cost, and RR reconcile? | canonical plan, structural target, costs, gap/event risk | Validate plan | alternate scenarios | Explain assumptions; deterministic calculations own numbers |
| 6. Validate portfolio | Can I take it now? | cash after trade, projected heat, pending risk, concentration/correlation | Queue order / reduce size | full exposure matrix | No authority; may summarize deterministic blockers |
| 7. Decide | What happens next? | final state and reason | Queue order / watch / reject | notes/tags | Draft thesis/journal note with provenance |
| 8. Manage | Has the thesis or risk changed? | current R, stop, events, thesis delta based on facts | Raise stop / trim / exit / hold | advanced analytics | Explain new evidence; position mode is always manage-only |
| 9. Review | Did the process work? | outcomes in R, adherence, setup cohort, mistakes | Record lesson / adjust process | raw trace | Summarize; evaluations use observed outcomes, not self-scoring |

### Recommended navigation

```
Today
  Market readiness
  Required portfolio actions
  Candidate pipeline

Discover
  Screen
  Results
  Candidate drawer

Watchlist
  Waiting for trigger
  Thesis at risk
  Stale / review needed

Portfolio
  Positions
  Orders
  Exposure and heat

Review
  Journal
  Performance
  Weekly review

Settings
  Strategy
  Market coverage / universes
  Data health
  Intelligence and model policy
```

## 5. Low-fidelity layouts

### Today

```
┌ Today · Post-close review ───────── Data as of Fri 10 Jul · 2 degraded sources ┐
│ Market: NORMAL / DEFENSIVE     Cash €…     Heat …R     Next event: AAPL 18d     │
├ Required actions ───────────────────────────────────────────────────────────────┤
│ 1 stop review · 0 exits · 2 pending orders · [Review now]                      │
├ Candidate pipeline ─────────────────────────────────────────────────────────────┤
│ Discovered 42 → Qualified 9 → Triggered 2 → Portfolio-approved 1               │
│ [Run/refresh screen] [View pipeline]                                             │
├ Waiting / watchlist ─────────────────────┬ Portfolio blockers ──────────────────┤
│ LRCX  3.2% below trigger  fresh          │ Sector cap: semis                     │
│ BESI  thesis weakening   stale intel     │ Available capital: …                  │
└──────────────────────────────────────────┴───────────────────────────────────────┘
```

### Candidate decision drawer

```
┌ AAPL · Setup qualified · TRIGGER NOT ACTIVE ───────────── Facts as of … ┐
│ Next action: Wait for close above … with volume confirmation             │
│ Setup score 72/100 (not probability) · Earnings 18d · Data coverage 92%  │
├ Why it qualifies ───────────┬ What invalidates it ────────────────────────┤
│ Trend / base / RS           │ Close below … / earnings policy / stale    │
├ Plan preview ───────────────┴──────────────────────────────────────────────┤
│ Trigger …  Stop …  Structural target …  Achievable R …  Cost/R …          │
├ Portfolio impact ──────────────────────────────────────────────────────────┤
│ Waiting: portfolio approval runs only after trigger                         │
├ Evidence ───────────────────────────────────────────────────────────────────┤
│ Facts  | Deterministic rules | AI interpretation (3/4 claims grounded)      │
└ [Reject] [Add to watchlist] [Advanced analysis] ────────────────────────────┘
```

### Ready-to-order state

```
Setup ✓  Trigger ✓  Plan ✓  Freshness ✓  Portfolio ✓

Queue order
Trigger … | Stop … | Target … | Shares … | Risk €… / …R | Cash after …
[Back] [Queue order]
```

## 6. Prioritized implementation plan

### Critical fixes — before visual redesign

1. Implement the four-gate state model and remove conditional actions from `signal_active` (F01).
2. Reconcile every order plan and independently validate target/RR (F02–F03).
3. Add cash, heat, pending-order, concentration, and event approval before order creation (F04).
4. Force manage-only for held positions (F05).
5. Add claim grounding and stop unsupported evidence from entering the ledger (F06).
6. Fingerprint caches/config and rebuild analyzer behavior per active strategy (F07).
7. Add source/as-of/degraded contracts and block stale actionable outputs (F08).
8. Remove/rename the current Safety Score until it covers real safeguards (F09).

Release acceptance for this phase:

- No conditional setup can be represented as ready to order.
- Every displayed plan reconciles numerically.
- No order can bypass portfolio permission.
- No position analysis can suggest a new entry.
- Unsupported claims carry no decision weight.
- Strategy/input changes cannot return incompatible cache entries.
- Stale/unknown critical inputs cannot produce a normal actionable state.

### High-impact improvements

1. Strengthen and clarify breakout/pullback definitions; rename confidence (F10–F11).
2. Replace circular prediction scoring with observed outcomes (F12).
3. Consolidate and version the strategy schema; remove cosmetic controls (F13).
4. Create one explainable ranking model (F14).
5. Add explicit earnings, regime, and cost policies (F15).
6. Correct or relabel the strategic overlay (F16).
7. Add injection isolation and typed degraded generation (F17).
8. Rebuild navigation and Today/Discover/Analysis around the decision-gated workflow.

Release acceptance for this phase:

- One rank is reconstructable from visible components.
- Strategy edits are lossless and every exposed setting has a runtime effect.
- Trader-facing confidence terms are calibrated or clearly non-probabilistic.
- AI content is labelled and separated from facts/rules.
- Primary journeys work without entering Settings, Universes, or Data Sources.

### Longer-term enhancements

1. Build frozen, time-aware Intelligence and trading evaluation suites (F18).
2. Simplify LangGraph or add meaningful sufficiency/grounding/repair branches (F19).
3. Add bounded background sweep jobs with cost budgets and real progress.
4. Calibrate setup/risk parameters with walk-forward and event studies.
5. Add responsive/keyboard/axe testing and complete mobile layouts.
6. Integrate trader feedback and process adherence into Review.

Release acceptance for this phase:

- Every production Intelligence change is evaluated for grounding, numeric consistency, abstention, and trading safety.
- Batch work has bounded concurrency, cost, progress, and cancellation.
- Core journeys pass keyboard, screen-reader, and small-screen acceptance tests.
- Performance claims include sample size, horizon, regime, uncertainty, and out-of-sample method.

## 7. Verification and limitations

Verified:

- The local frontend responded at `http://127.0.0.1:5173` and the backend health endpoint was healthy.
- Live strategy, portfolio, watchlist, calendar, data-source, metrics, and cached Intelligence responses were inspected.
- Current MNST Intelligence output and operational metrics were reviewed.
- Backend test suite: 1,366 passed, 1 skipped, 14 deselected; warnings included LangChain Pydantic deprecations and a pandas `SettingWithCopyWarning`.
- Frontend TypeScript typecheck passed.
- Frontend test suite: 703 passed and 6 failed across `AnalysisCanvasPanel`, `IntelligenceChatPanel`, and `PositionReviewPanel`. The failures are expectation/runtime drift around the Intelligence review surfaces, including `AgentTracePanel` errors in analysis-canvas tests and changed review labels. This supports consolidating the overlapping Intelligence panels and restoring their contract tests before redesign.

Visual limitation:

- The in-app browser control surface was unavailable in this session, so the audit could not perform screenshot-based visual QA or direct pointer/keyboard journeys. UI findings are based on the running service state plus traced React layout, state, styling, and interaction code. A final implementation plan should add a short visual/accessibility validation pass at desktop, tablet, and mobile widths before design work begins.

## 8. Decision

Do not begin a broad visual restyle yet. First establish the canonical decision states, plan reconciliation, portfolio permission, provenance, and AI grounding. Then redesign Today and symbol analysis around those states. This sequence reduces cognitive load because it fixes the underlying information model instead of only rearranging the current ambiguity.
