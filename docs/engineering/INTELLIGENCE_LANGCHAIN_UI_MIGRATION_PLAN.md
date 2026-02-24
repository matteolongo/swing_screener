# INTELLIGENCE_LANGCHAIN_UI_MIGRATION_PLAN

## Summary
This plan resolves current conflicts, decouples intelligence from strategy/daily-review dependencies, integrates LangChain in the intelligence pipeline, introduces dedicated intelligence APIs, and adds a standalone Intelligence UI section.

## Public API / Interface Changes
1. Add `GET /api/intelligence/config`.
2. Add `PUT /api/intelligence/config`.
3. Add `GET /api/intelligence/providers`.
4. Add `POST /api/intelligence/providers/test`.
5. Add symbol-set endpoints:
   1. `GET /api/intelligence/symbol-sets`
   2. `POST /api/intelligence/symbol-sets`
   3. `PUT /api/intelligence/symbol-sets/{id}`
   4. `DELETE /api/intelligence/symbol-sets/{id}`
6. Extend `POST /api/intelligence/run` with `symbol_set_id` and enforce `symbols XOR symbol_set_id`.
7. Keep `GET /api/intelligence/run/{job_id}`, `GET /api/intelligence/opportunities`, `POST /api/intelligence/classify`.
8. Deprecate `strategy.market_intelligence` as runtime source of truth (temporary bootstrap only).

## Phase Plan

### Phase 0: Resolve Current Conflicts
1. Resolve `web-ui/src/components/domain/strategy/StrategyAdvancedSettingsCard.tsx` by taking `main` conflict sides (no backtest reintroduction).
2. Resolve `web-ui/src/i18n/messages.en.ts` by taking `main` in conflict blocks.
3. Remove any residual conflict markers and run web build/tests.

### Phase 1: Dedicated Intelligence Config Backend
1. Add `api/models/intelligence_config.py` with request/response schemas.
2. Add `api/repositories/intelligence_config_repo.py` for `data/intelligence/config.json`.
3. Add `api/repositories/intelligence_symbol_sets_repo.py` for `data/intelligence/symbol_sets.json`.
4. Add `api/services/intelligence_config_service.py` for validation/normalization.
5. Wire endpoints in `api/routers/intelligence.py`.
6. Update `api/services/intelligence_service.py` to read dedicated config instead of active strategy.
7. Add one-time bootstrap: if dedicated config missing, seed from active strategy `market_intelligence`.

### Phase 2: LangChain Integration
1. Add LangChain dependencies in `pyproject.toml`:
   1. `langchain-core`
   2. `langchain-ollama`
2. Implement `src/swing_screener/intelligence/llm/langchain_provider.py`.
3. Refactor provider creation into one shared factory used by:
   1. `src/swing_screener/intelligence/pipeline.py`
   2. `api/routers/intelligence.py`
4. Keep `mock` provider for tests/CI.
5. Add bounded concurrency to LLM enrichment (default `max_concurrency=4`).

### Phase 3: Intelligence UI Section
1. Add route `/intelligence` in `web-ui/src/App.tsx`.
2. Add sidebar item in `web-ui/src/components/layout/Sidebar.tsx`.
3. Create page `web-ui/src/pages/Intelligence.tsx`:
   1. Configuration editor (providers, LLM, catalyst/theme/opportunity settings).
   2. Manual symbols input.
   3. Saved symbol sets CRUD.
   4. Run controls + status + opportunities table/cards.
   5. Provider test action.
4. Add feature client/hooks/types under `web-ui/src/features/intelligence/` for new endpoints.
5. Add i18n keys under `intelligencePage.*` in `web-ui/src/i18n/messages.en.ts`.

### Phase 4: Decouple Old Surfaces
1. Remove intelligence UI from `web-ui/src/pages/DailyReview.tsx`.
2. Remove strategy-advanced intelligence controls from `web-ui/src/components/domain/strategy/StrategyAdvancedSettingsCard.tsx`.
3. Keep strategy model field temporarily for compatibility/bootstrap, but stop writing to it from UI.

### Phase 5: Cleanup and Final Deprecation
1. After migration window, remove `market_intelligence` from strategy API/UI models.
2. Remove transitional bootstrap path.
3. Update docs:
   1. `src/swing_screener/intelligence/README.md`
   2. `docs/engineering/MODULE_ARCHITECTURE_MIGRATION_PLAN.md`

## Test Cases and Scenarios
1. Conflict resolution compiles and no conflict markers remain.
2. Config endpoint roundtrip (`GET` then `PUT` then `GET`).
3. Symbol-set CRUD with normalization/dedupe and empty rejection.
4. Run endpoint accepts symbols or symbol set, rejects both/neither.
5. LangChain provider unavailable path returns explicit error.
6. LLM classify endpoint works via shared provider factory.
7. Pipeline enrichment handles failures per-event without aborting run.
8. `/intelligence` UI allows configure + run without orders/universes dependency.
9. DailyReview no longer contains intelligence controls.
10. Strategy page no longer owns intelligence configuration UI.

## Assumptions and Defaults
1. Backtest remains removed and out of scope.
2. Intelligence config is globally dedicated, not strategy-scoped.
3. Manual symbols + saved symbol sets are the only run-input UX.
4. LangChain is implemented in this migration (not deferred).
5. Transitional compatibility is temporary and removed in final cleanup phase.
