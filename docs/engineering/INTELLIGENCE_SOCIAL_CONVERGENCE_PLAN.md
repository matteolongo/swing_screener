# Intelligence + Social Convergence Plan (Adapted to Current Plugin Architecture)

> Status: proposed  
> Last updated: 2026-03-07

## Summary

This plan replaces the standalone `social/sentiment` domain with an intelligence-native social evidence capability, while preserving stability during migration.

The current branch uses a YAML plugin strategy architecture (`config/strategy.yaml` + plugin manifests). The migration must therefore cover:

- Intelligence pipeline and scoring
- Screener compatibility fields (`overlay_*`)
- Strategy plugin graph changes
- API deprecation compatibility
- MCP social tooling migration

The final state is a single intelligence evidence pipeline where social data is treated as risk/context signals (not primary alpha).

## Current State (Observed)

1. Strategy is read-only, plugin-based, and YAML-driven.
2. `social_overlay` and `market_intelligence` are separate strategy plugins.
3. `/api/social/*` endpoints are live and used by UI + MCP.
4. Screener still computes social warmup/background status via social services.
5. Intelligence already has advanced evidence/scoring infrastructure and dedicated config endpoints.

## Design Decisions (Locked)

1. The standalone social domain will be deprecated and removed after a compatibility window.
2. Social ingestion will become intelligence evidence (`source_type = social`).
3. Social contribution remains low-weight and guardrailed in opportunity scoring.
4. During transition, screener keeps `overlay_*` fields, populated from intelligence outputs.
5. `/api/social/*` stays as deprecated aliases for one release, then removed.
6. Strategy plugin graph removes `social_overlay` and moves social config under `market_intelligence`.

## Implementation Plan

### Phase 1 — Add Social Evidence to Intelligence (No Breakage)

1. Introduce social evidence adapters inside intelligence (`reddit_social`, `yahoo_social`).
2. Add strict symbol relevance gating before event acceptance:
   - ambiguity policy for short/common tickers
   - cashtag requirement for ambiguous symbols
   - entity/ticker relevance score threshold
3. Add social cache/artifacts under `data/intelligence/social_cache/*`.
4. Extend intelligence config with `sources.social.*` controls:
   - enabled providers
   - relevance thresholds
   - ambiguity policy
   - provider-specific options
5. Persist social evidence in the same audit trail as other intelligence evidence.

### Phase 2 — Intelligence Scoring + Screener Bridge

1. Extend intelligence feature vectors with social components:
   - `social_attention_z`
   - `social_sentiment_score`
   - `social_sentiment_confidence`
   - `social_relevance_score`
   - `social_crowding_penalty`
2. Add social scoring components with conservative default weights.
3. Add hard guards:
   - low relevance => zero social contribution
   - social cannot alone push opportunity above trade threshold
4. Replace screener dependency on direct `run_social_overlay` logic with intelligence-derived social outputs.
5. Keep screener response compatibility fields (`overlay_*`) mapped from intelligence for one release.

### Phase 3 — API Migration (Backward Compatible)

1. Add intelligence-native social endpoints:
   - `POST /api/intelligence/social/analyze`
   - optional warmup/status endpoint only if still needed by UI behavior
2. Convert `/api/social/analyze` and `/api/social/warmup/{job_id}` into deprecated aliases that proxy intelligence.
3. Add deprecation metadata (headers and docs).
4. Keep existing response shape compatibility during transition.

### Phase 4 — Strategy Plugin Architecture Update

1. Remove `social_overlay` plugin from plugin manifests and execution graph.
2. Move social settings into `market_intelligence` plugin config section.
3. Update YAML defaults and root config (`config/strategy.yaml`).
4. Update legacy adaptation in strategy resolver so existing downstream consumers keep working during migration.
5. Update strategy validation expectations and docs.

### Phase 5 — UI + MCP + CLI Migration

1. Move sentiment UI panels to intelligence endpoints.
2. Replace social warmup references with intelligence run/job references.
3. Migrate MCP `social` tools to intelligence-backed behavior.
4. Optionally rename MCP feature domain from `social` to `intelligence` after compatibility period.
5. Deprecate/remove social CLI commands once intelligence commands fully cover workflows.

### Phase 6 — Cleanup Removal (After Compatibility Window)

1. Remove:
   - `src/swing_screener/social/*`
   - `api/services/social_service.py`
   - `api/services/social_warmup.py`
   - `api/routers/social.py`
   - MCP social tool package
2. Remove API mounting for `/api/social`.
3. Remove config and type surfaces that only exist for legacy social overlay.
4. Remove stale docs and examples.

## Public API / Interface Changes

### Additive

1. `POST /api/intelligence/social/analyze`
2. Optional intelligence social job/status endpoint (only if warmup remains required).

### Deprecated (Transition)

1. `POST /api/social/analyze` -> alias to intelligence
2. `GET /api/social/warmup/{job_id}` -> alias to intelligence

### Breaking (Final Removal)

1. Remove `/api/social/*` routes.
2. Remove `social_overlay` plugin and move settings under `market_intelligence` plugin.

## Test Plan

### Unit Tests

1. Symbol relevance gate:
   - ambiguous ticker acceptance/rejection
   - cashtag-required policy
   - entity relevance threshold behavior
2. Social dedupe and merge correctness.
3. Social scoring guardrails and clamping.
4. Backward compatibility mappers for `overlay_*` fields.

### Integration Tests

1. End-to-end intelligence run with social providers on/off.
2. Provider failure handling and deterministic fallback.
3. Screener run with intelligence-backed overlay compatibility fields.
4. Deprecated `/api/social/*` alias behavior.

### Contract Tests

1. Strategy runtime plugin payload no longer includes `social_overlay`.
2. `market_intelligence` plugin config includes social controls.
3. MCP tool behavior matches migrated endpoints.

### Regression / Quality

1. False positive reduction benchmark on ambiguous ticker fixture set.
2. No regressions in opportunity generation when social providers are unavailable.
3. No crash paths in health/metrics collection.

## Acceptance Criteria

1. Social data is ingested only through intelligence evidence adapters.
2. Screener works without direct social module runtime dependency.
3. UI sentiment views run entirely via intelligence endpoints.
4. `/api/social/*` works as deprecated aliases for one release.
5. Plugin graph and config are consistent after removing `social_overlay`.
6. False positives for ambiguous symbols are measurably reduced.
7. After compatibility window, social legacy modules are fully removed.

## Assumptions and Defaults

1. Strategy remains YAML/plugin read-only.
2. Advisory-only behavior remains unchanged.
3. Social remains a risk/context signal with constrained scoring weight.
4. One-release compatibility window for `/api/social/*` is acceptable.
5. In uncertain symbol relevance cases, default policy is deny.
