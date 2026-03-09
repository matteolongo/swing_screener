# Intelligence Module

> Status: current.  
> Last reviewed: 2026-02-23.

## Purpose
Post-close market intelligence pipeline that enriches technical screening with:
- event ingestion and catalyst validation
- optional LLM event classification
- evidence-agent normalization across multiple free sources
- theme/peer confirmation
- ranked daily opportunities

This layer is advisory only. It does not place orders.

## Current Usage
- Runs are currently manual.
- UI entry point is the dedicated Intelligence page.
- API entry point is `POST /api/intelligence/run`.

## Run Flow
1. `IntelligenceService.start_run()` loads dedicated intelligence config from `data/intelligence/config.json`.
2. A background job is queued in `api/services/intelligence_warmup.py`.
3. Worker executes `run_intelligence_pipeline()` in `src/swing_screener/intelligence/pipeline.py`.
4. Providers ingest events (`ingestion/`).
5. Optional LLM enrichment classifies each event and adjusts credibility (`llm/` + `pipeline.py`).
6. Event reaction metrics are computed against OHLCV (`reaction.py`).
7. Peer confirmation and theme clusters are built (`relations.py`).
8. Symbol lifecycle state is updated (`state.py`).
9. Evidence records are normalized into catalyst features (`evidence.py`).
10. Catalyst scores and final opportunities are computed (`scoring.py`).
11. Snapshot is persisted to `data/intelligence/*` (`storage.py`).

## Scoring

### 1) Event Credibility
Base credibility comes from ingestion events.

When LLM is enabled, per-event credibility is blended:
- `llm_credibility = clamp01(0.45*confidence + 0.45*severity_weight + 0.1*is_material)`
- `blended_credibility = clamp01(0.6*base_credibility + 0.4*llm_credibility)`

Severity weights:
- `LOW=0.35`
- `MEDIUM=0.7`
- `HIGH=1.0`

### 2) Catalyst Score
For each signal (non false-catalyst), score is:
- `0.30*reaction_z + 0.20*atr_shock + 0.15*peer_confirmation + 0.15*recency + 0.10*theme_strength + 0.10*event_credibility`

Where each component is normalized/clamped to `[0,1]`.

### 3) Opportunity Score
Per symbol:
- `opportunity_score = technical_weight*technical_readiness + catalyst_weight*catalyst_score`

Then:
- filter by `min_opportunity_score`
- sort descending
- keep top `max_daily_opportunities`

## Configuration Source Of Truth
Intelligence config is dedicated and persisted under:
- `data/intelligence/config.json`

Strategy-scoped `market_intelligence` is only used as one-time bootstrap fallback when dedicated config is absent.

### UI Configuration
In the Intelligence page, controls cover:
- enable/disable pipeline
- providers and universe scope
- market context symbols
- LLM provider/model/base URL/cache/audit
- catalyst thresholds
- theme thresholds and curated peer map path
- opportunity weighting and limits

### Environment Variables
There is no separate env toggle required for normal intelligence configuration.

For Ollama, `OLLAMA_HOST` can be used as a fallback host in the LLM client when `base_url` is not explicitly passed.

## Supported LLM Providers

The `intelligence/llm/` layer supports:

| Provider | `provider` value | Notes |
|----------|-----------------|-------|
| Ollama | `"ollama"` | Default. Local inference. Default model: `mistral:7b-instruct`. Uses `OLLAMA_HOST` env var as fallback host. |
| OpenAI | `"openai"` | Requires `OPENAI_API_KEY` |
| Anthropic | `"anthropic"` | Requires `ANTHROPIC_API_KEY` |
| LM Studio | `"lm_studio"` | Local OpenAI-compatible endpoint |

LLM is **disabled by default** (`llm.enabled: false`). When disabled, all events are processed with heuristic credibility scores only.

## Event Ingestion Sources

Available providers in `intelligence/ingestion/`:

| Source | Description |
|--------|-------------|
| Yahoo Finance | News articles and press releases |
| Earnings Calendar | Upcoming and recent earnings events |
| SEC Edgar | 8-K and other material filings |
| RSS Feeds | Configurable RSS/Atom news feeds |
| (extensible) | Custom providers via the `IngestionProvider` protocol |

## Storage
Default root:
- `data/intelligence`

Artifacts:
- `events_YYYY-MM-DD.jsonl`
- `signals_YYYY-MM-DD.json`
- `evidence_YYYY-MM-DD.jsonl`
- `normalized_events_YYYY-MM-DD.json`
- `themes_YYYY-MM-DD.json`
- `opportunities_YYYY-MM-DD.json`
- `symbol_state.json`
- `run_jobs.json`
- `sources_health.json`
- `source_quality_stats.json`
- `intelligence_metrics.json`
- `discovered_feeds_cache.json`

## API Endpoints
- `GET /api/intelligence/config`
- `PUT /api/intelligence/config`
- `GET /api/intelligence/providers`
- `POST /api/intelligence/providers/test`
- `GET /api/intelligence/symbol-sets`
- `POST /api/intelligence/symbol-sets`
- `PUT /api/intelligence/symbol-sets/{id}`
- `DELETE /api/intelligence/symbol-sets/{id}`
- `POST /api/intelligence/run`
- `GET /api/intelligence/run/{job_id}`
- `GET /api/intelligence/opportunities`
- `GET /api/intelligence/events`
- `GET /api/intelligence/upcoming-catalysts`
- `GET /api/intelligence/sources/health`
- `GET /api/intelligence/metrics`
- `POST /api/intelligence/classify`
