# Intelligence Module

> Status: current  
> Last reviewed: 2026-02-23

## Quick Start

```python
from swing_screener.intelligence import (
    IntelligenceConfig,
    run_intelligence_pipeline,
    IntelligenceStorage,
)

# Basic configuration
cfg = IntelligenceConfig(
    enabled=True,
    providers=("yahoo_finance",),
)

# Run pipeline
symbols = ["NVDA", "AMD", "INTC", "TSM", "AVGO"]
snapshot = run_intelligence_pipeline(symbols=symbols, cfg=cfg)

print(f"Found {len(snapshot.opportunities)} opportunities")
for opp in snapshot.opportunities[:5]:
    print(f"  {opp.symbol}: {opp.opportunity_score:.2f}")
```

```python
# Use LLM classification via gateway
from swing_screener.intelligence.llm import get_llm_gateway

gateway = get_llm_gateway(provider="openai", model="gpt-4o-mini")
if gateway.is_available():
    result = gateway.classify_event(
        headline="NVDA reports record earnings",
        snippet="Revenue up 25% YoY"
    )
    print(f"Type: {result.event_type.value}, Severity: {result.severity.value}")
```

```python
# Load saved results
storage = IntelligenceStorage()
opportunities = storage.load_opportunities("2026-02-23")
```

## Submodules

| Module | Description |
|--------|-------------|
| `pipeline` | Main intelligence pipeline orchestration |
| `config` | Configuration classes (IntelligenceConfig, LLMConfig, etc.) |
| `models` | Domain models (Event, CatalystSignal, Opportunity, etc.) |
| `ingestion` | Event collection from providers |
| `llm` | LLM classification via LangChain gateway |
| `reaction` | Event reaction metrics calculation |
| `relations` | Peer confirmation and theme detection |
| `scoring` | Catalyst and opportunity scoring |
| `state` | Symbol lifecycle state machine |
| `storage` | Persistence to JSON files |

## Purpose
Post-close market intelligence pipeline that enriches technical screening with:
- event ingestion and catalyst validation
- optional LLM event classification
- theme/peer confirmation
- ranked daily opportunities

This layer is advisory only and never places orders.

## Runtime Entry Points
- Manual run from Daily Review UI.
- API run trigger: `POST /api/intelligence/run`.
- API classify utility: `POST /api/intelligence/classify`.

## Architecture
The module now uses a LangChain-first LLM path:

1. `pipeline.py` collects events from ingestion providers.
2. `llm/classifier.py` applies cache/audit wrappers and delegates model calls.
3. `llm/gateway.py` resolves provider/model credentials and invokes LangChain chat models.
4. Classification metadata is persisted in `event.metadata.llm_trace`.
5. Scoring/state/theme/opportunity logic remains deterministic and unchanged.

## LLM Providers
Supported provider values:
- `openai`
- `anthropic`
- `ollama`
- `mock`

Model defaults when omitted:
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-haiku-20240307`
- Ollama: `mistral:7b-instruct`
- Mock: `mock-classifier`

## Configuration Source Of Truth
Strategy-scoped config:
- `strategy.market_intelligence`

### LLM Fields
- `enabled`
- `provider`
- `model`
- `api_key`
- `base_url`
- `enable_cache`
- `enable_audit`
- `cache_path`
- `audit_path`

Semantics:
- `base_url` is primarily for Ollama.
- For OpenAI-compatible custom endpoints, `base_url` can be set explicitly.
- `api_key` can be provided in strategy or inherited from environment variables.

## Environment Variables
- `OPENAI_API_KEY` for OpenAI (fallback when `llm.api_key` is empty).
- `ANTHROPIC_API_KEY` for Anthropic (fallback when `llm.api_key` is empty).
- `OLLAMA_HOST` for Ollama host fallback.

LangSmith / LangChain tracing works out-of-the-box when standard LangSmith env vars are configured in the runtime.

## Storage
Default root:
- `data/intelligence`

Artifacts:
- `events_YYYY-MM-DD.jsonl`
- `signals_YYYY-MM-DD.json`
- `themes_YYYY-MM-DD.json`
- `opportunities_YYYY-MM-DD.json`
- `symbol_state.json`
- `run_jobs.json`
- `llm_cache.json`
- `llm_audit/*.jsonl`

## Scoring
Event credibility when LLM is enabled:
- `llm_credibility = clamp01(0.45*confidence + 0.45*severity_weight + 0.1*is_material)`
- `blended_credibility = clamp01(0.6*base_credibility + 0.4*llm_credibility)`

Catalyst score:
- `0.30*reaction_z + 0.20*atr_shock + 0.15*peer_confirmation + 0.15*recency + 0.10*theme_strength + 0.10*event_credibility`

Opportunity score:
- `technical_weight*technical_readiness + catalyst_weight*catalyst_score`

## API Endpoints
- `POST /api/intelligence/run`
- `GET /api/intelligence/run/{job_id}`
- `GET /api/intelligence/opportunities`
- `GET /api/intelligence/events`
- `POST /api/intelligence/classify`
