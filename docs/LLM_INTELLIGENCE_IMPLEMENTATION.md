# LLM-Augmented Market Intelligence Layer - Implementation Guide

## Status: Proposal / Not Implemented

This document outlines how to integrate Large Language Models (LLMs) into Swing Screener's existing Market Intelligence framework while preserving the system's core principles of deterministic decision-making and beginner safety.

---

## Executive Summary

**Objective:** Enhance the existing intelligence pipeline (`src/swing_screener/intelligence/`) with LLM-based semantic interpretation capabilities while maintaining strict boundaries between interpretation and decision-making.

**Key Principle:** LLMs interpret—they do not decide. All trading decisions remain deterministic.

**Current State:** Swing Screener already has a functional market intelligence layer that:
- Fetches events from Yahoo Finance (`intelligence/ingestion/yahoo_finance.py`)
- Detects price reactions (`intelligence/reaction.py`)
- Scores catalysts based on return_z and ATR shocks (`intelligence/scoring.py`)
- Clusters related symbols by themes (`intelligence/relations.py`)
- Combines technical + catalyst scores into opportunities (`intelligence/pipeline.py`)
- Exposes intelligence via API endpoints (`api/routers/intelligence.py`)

**What LLMs Add:** Semantic understanding of news content to improve:
1. Event classification (earnings vs. M&A vs. regulatory, etc.)
2. Headline deduplication (reduce noise)
3. Beginner-friendly explanations (educational output)

---

## Strategic Integration Points

### Where LLMs Fit in the Existing Pipeline

```
Current Flow:
├── 1. collect_events()        [ingestion/service.py]
│   └── Yahoo Finance → Event objects (all type="news", generic)
├── 2. build_catalyst_signals() [reaction.py]
│   └── Price data + Events → CatalystSignal objects
├── 3. detect_theme_clusters()  [relations.py]
│   └── Signals + Peer Map → ThemeCluster objects
├── 4. build_opportunities()    [scoring.py]
│   └── Technical + Catalyst → Opportunity objects (with score)
└── 5. API Response             [api/routers/intelligence.py]

Enhanced Flow (with LLMs):
├── 1. collect_events()
│   └── Yahoo Finance → Event objects
├── 1a. LLM Event Classifier    [NEW: intelligence/llm/classifier.py]
│   └── Event.headline → Structured classification
│       • event_type: EARNINGS | M&A | PRODUCT | REGULATORY | ...
│       • severity: LOW | MEDIUM | HIGH
│       • is_material: true/false
│       • confidence: 0.0-1.0
├── 1b. LLM Deduplicator        [NEW: intelligence/llm/deduper.py]
│   └── Cluster semantically identical headlines
│       • Reduce noise from duplicate stories
│       • Aggregate source counts for significance
├── 2. build_catalyst_signals() [ENHANCED: use event_type + severity]
│   └── Weight signals by LLM classification
├── 3. detect_theme_clusters()  [ENHANCED: use event_type for labeling]
│   └── Add semantic theme names
├── 4. build_opportunities()    [ENHANCED: include LLM insights]
│   └── Technical + Catalyst + Event Context → Opportunity
├── 4a. LLM Explanation Layer   [NEW: intelligence/llm/explainer.py]
│   └── Generate beginner-friendly summaries for top opportunities
└── 5. API Response             [ENHANCED: include explanations]
```

---

## Design Principles Alignment

### 1. Deterministic First, LLM Second
✅ **Alignment:** The LLM never changes opportunity scores directly. It only:
- Classifies events to improve catalyst scoring inputs
- Explains outputs that are already determined

### 2. Manual Execution
✅ **Alignment:** LLMs do not trigger trades. They provide context for human decisions.

### 3. Transparency & Reproducibility
✅ **Alignment:** All LLM outputs are:
- Validated against strict schemas
- Persisted for inspection (`data/intelligence/llm_outputs/`)
- Versioned by prompt version
- Run at temperature=0 for consistency

### 4. Risk-First Reasoning
✅ **Alignment:** LLM classifications feed into existing risk-based scoring. False positives are filtered by price confirmation rules.

### 5. Educational Focus
✅ **Alignment:** LLM explanations reinforce learning by translating structured data into natural language insights.

---

## Architecture

### New Module Structure

```
src/swing_screener/intelligence/llm/
├── __init__.py
├── client.py         # LLM API client (OpenAI/Anthropic/local)
├── schemas.py        # Pydantic models for structured outputs
├── prompts.py        # Versioned prompt templates
├── classifier.py     # Event classification logic
├── deduper.py        # Headline clustering logic
├── explainer.py      # Explanation generation logic
└── config.py         # LLM-specific configuration
```

### Integration with Existing Components

**1. Enhanced Event Model** (`intelligence/models.py`)
```python
@dataclass(frozen=True)
class Event:
    event_id: str
    symbol: str
    source: str
    occurred_at: str
    headline: str
    event_type: str  # Currently generic "news"
    credibility: float
    url: str | None = None
    metadata: dict[str, str | float | int | bool] = field(default_factory=dict)
    
    # NEW: LLM-enhanced fields (optional, added post-classification)
    llm_classification: dict | None = None  # Stores LLM output
```

**LLM Classification Schema:**
```python
{
    "classified_type": "EARNINGS | M&A | PRODUCT | REGULATORY | ...",
    "severity": "LOW | MEDIUM | HIGH",
    "is_material": true,
    "confidence": 0.85,
    "summary": "One sentence factual description",
    "prompt_version": "v1.0",
    "model": "gpt-4o-mini"
}
```

**2. Enhanced Opportunity Model** (`intelligence/models.py`)
```python
@dataclass(frozen=True)
class Opportunity:
    symbol: str
    technical_readiness: float
    catalyst_strength: float
    opportunity_score: float
    state: SymbolLifecycleState
    explanations: list[str] = field(default_factory=list)
    
    # NEW: LLM-generated explanation (optional)
    llm_explanation: str | None = None
```

**3. Enhanced Intelligence Config** (`intelligence/config.py`)
```python
@dataclass(frozen=True)
class LLMConfig:
    enabled: bool = False
    provider: str = "openai"  # openai | anthropic | local
    model: str = "gpt-4o-mini"
    temperature: float = 0.0
    max_tokens: int = 500
    api_key_env_var: str = "OPENAI_API_KEY"
    classification_enabled: bool = True
    deduplication_enabled: bool = False
    explanation_enabled: bool = False
    explanation_max_opportunities: int = 8
    cache_responses: bool = True
    prompt_version: str = "v1.0"

@dataclass(frozen=True)
class IntelligenceConfig:
    enabled: bool = False
    providers: tuple[str, ...] = DEFAULT_INTEL_PROVIDERS
    universe_scope: str = "screener_universe"
    market_context_symbols: tuple[str, ...] = DEFAULT_MARKET_CONTEXT_SYMBOLS
    symbol_states: tuple[str, ...] = DEFAULT_SYMBOL_STATES
    catalyst: CatalystConfig = field(default_factory=CatalystConfig)
    theme: ThemeConfig = field(default_factory=ThemeConfig)
    opportunity: OpportunityConfig = field(default_factory=OpportunityConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)  # NEW
```

---

## Event Taxonomy

### Canonical Event Types

Based on market impact and corporate actions (not journalism categories):

**Tier 1 - Company Fundamentals (Highest Impact)**
- `EARNINGS` - Quarterly/annual results, surprises
- `GUIDANCE` - Forward outlook changes
- `M&A` - Acquisitions, mergers, spin-offs
- `CAPITAL` - Offerings, buybacks, dividends

**Tier 2 - Operational Drivers**
- `PRODUCT` - Launches, approvals, clinical trials
- `PARTNERSHIP` - Joint ventures, strategic agreements
- `MANAGEMENT` - Leadership changes

**Tier 3 - External Forces**
- `REGULATORY` - Antitrust, investigations, bans
- `LEGAL` - Lawsuits, settlements
- `MACRO` - Economy-wide forces (Fed, CPI, geopolitics)
- `SECTOR` - Industry-wide developments

**Tier 4 - Market Mechanics (Lower Signal)**
- `ANALYST` - Upgrades, downgrades, price targets
- `FLOW` - Short squeezes, unusual options activity
- `OTHER` - Fallback (should be <5%)

### Severity Heuristics

- **HIGH**: Earnings surprises, M&A, guidance changes, regulatory rulings
- **MEDIUM**: Product launches, partnerships, management changes
- **LOW**: Minor analyst moves, small announcements

---

## Implementation Phases

### Phase 1: Event Classifier (Highest ROI)

**Goal:** Convert generic "news" events into structured classifications.

**Components:**
1. `llm/client.py` - LLM API wrapper with retry logic
2. `llm/schemas.py` - Pydantic models for validation
3. `llm/prompts.py` - Event classification prompt (temperature=0)
4. `llm/classifier.py` - Batch classification logic

**Integration Point:** After `collect_events()` in `pipeline.py`

**API Enhancement:** Add `include_llm_classification=true` param to `/api/intelligence/run`

**Testing:** Unit tests for classifier, integration tests for pipeline

**Estimated Effort:** 2-3 days

---

### Phase 2: Headline Deduplication

**Goal:** Reduce noise from duplicate stories across wires.

**Components:**
1. `llm/deduper.py` - Clustering logic using LLM embeddings or semantic similarity

**Integration Point:** Before `build_catalyst_signals()` in `pipeline.py`

**Output:** Cluster IDs, representative headlines, source counts

**Benefit:** Improves catalyst scoring by reducing false signal amplification

**Estimated Effort:** 1-2 days

---

### Phase 3: Explanation Layer

**Goal:** Generate beginner-friendly explanations for top opportunities.

**Components:**
1. `llm/explainer.py` - Explanation generation with retrieval-style prompting

**Integration Point:** After `build_opportunities()` for top N opportunities (default N=8)

**Example Output:**
> "NVIDIA moved 2.1× its typical daily range after reporting strong earnings. Multiple semiconductor peers also rose, suggesting sector-wide demand expectations. This is a TRENDING opportunity with 75% technical readiness and HIGH catalyst strength."

**Constraints:**
- Only derive from structured facts (no speculation)
- Include educational context (what is ATR? what is R-multiple?)
- Cite specific signals (e.g., "3 peer confirmations")

**Estimated Effort:** 2-3 days

---

### Phase 4: Theme Labeling (Optional)

**Goal:** Add semantic labels to theme clusters.

**Components:**
1. `llm/theme_labeler.py` - Generate descriptive theme names

**Example:**
- Cluster: [NVDA, AMD, INTC] → "AI Infrastructure Demand"
- Cluster: [LLY, NVO] → "GLP-1 Weight Loss Drug Competition"

**Integration Point:** In `detect_theme_clusters()` after clustering

**Benefit:** Improves UX by making themes more intuitive

**Estimated Effort:** 1-2 days

---

## Guardrails (Non-Negotiable)

### 1. Schema Enforcement
- All LLM outputs validated via Pydantic models
- Reject invalid outputs (do not auto-correct silently)
- Log validation failures for debugging

### 2. Temperature = 0
- Consistency over creativity
- Reproducible outputs for same inputs

### 3. Cost Control
- Only process candidates from screener (≤30 symbols)
- Only fetch news for candidates (not entire universe)
- Cache responses by headline hash
- Rate limit: max 100 API calls per day

### 4. Human Debuggability
- Persist all LLM requests/responses in `data/intelligence/llm_outputs/{date}/`
- Include prompt version, model, timestamp
- Enable retrospective analysis

### 5. Graceful Degradation
- If LLM unavailable or fails, pipeline continues without LLM enhancements
- Log errors but do not crash pipeline

---

## API Enhancements

### New Endpoints

**1. POST /api/intelligence/run** (enhanced)
```json
{
  "symbols": ["AAPL", "NVDA"],
  "technical_readiness": {"AAPL": 0.75, "NVDA": 0.85},
  "llm_options": {
    "enable_classification": true,
    "enable_deduplication": false,
    "enable_explanations": true,
    "max_explanations": 8
  }
}
```

**2. GET /api/intelligence/opportunities** (enhanced)
```json
{
  "asof_date": "2026-02-15",
  "opportunities": [
    {
      "symbol": "NVDA",
      "technical_readiness": 0.85,
      "catalyst_strength": 0.92,
      "opportunity_score": 0.88,
      "state": "CATALYST_ACTIVE",
      "explanations": ["High return_z (2.3), peer confirmation (3)"],
      "llm_explanation": "NVIDIA moved 2.1× typical range after earnings...",
      "events": [
        {
          "event_id": "yf-abc123",
          "headline": "Nvidia reports record revenue",
          "llm_classification": {
            "classified_type": "EARNINGS",
            "severity": "HIGH",
            "is_material": true,
            "confidence": 0.95
          }
        }
      ]
    }
  ]
}
```

**3. GET /api/intelligence/events** (new)
```json
{
  "asof_date": "2026-02-15",
  "symbol": "NVDA",
  "events": [
    {
      "event_id": "yf-abc123",
      "headline": "Nvidia reports record revenue",
      "event_type": "news",
      "llm_classification": {
        "classified_type": "EARNINGS",
        "severity": "HIGH",
        "is_material": true,
        "summary": "Company reported Q4 revenue beat with strong guidance"
      }
    }
  ]
}
```

---

## Configuration

### Strategy Config (`config.json` or strategy YAML)

```json
{
  "market_intelligence": {
    "enabled": true,
    "providers": ["yahoo_finance"],
    "llm": {
      "enabled": true,
      "provider": "openai",
      "model": "gpt-4o-mini",
      "temperature": 0.0,
      "classification_enabled": true,
      "deduplication_enabled": false,
      "explanation_enabled": true,
      "explanation_max_opportunities": 8,
      "prompt_version": "v1.0"
    },
    "catalyst": {
      "lookback_hours": 72,
      "use_llm_severity": true
    }
  }
}
```

### Environment Variables

```bash
# Required for LLM functionality
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=...

# Optional: Override model
SWING_SCREENER_LLM_MODEL=gpt-4o-mini
```

---

## Prompt Engineering

### Event Classification Prompt (v1.0)

**System Prompt:**
```
You are a financial event classifier.

Your task is to convert financial news headlines into structured market events.

You must follow the taxonomy EXACTLY.

Do not invent categories.
Do not speculate.
Do not predict price direction.
Focus only on what objectively happened.
```

**User Prompt Template:**
```
Classify the following financial headline.

Return ONLY valid JSON matching this schema:
{
  "classified_type": "EARNINGS | GUIDANCE | M&A | CAPITAL | PRODUCT | PARTNERSHIP | MANAGEMENT | REGULATORY | LEGAL | MACRO | SECTOR | ANALYST | FLOW | OTHER",
  "severity": "LOW | MEDIUM | HIGH",
  "is_material": true,
  "confidence": 0.85,
  "summary": "One sentence factual description, no speculation"
}

Headline: "{headline}"

Snippet: "{snippet}"

Instructions:
1. Choose exactly ONE classified_type from the taxonomy above.
2. Assign severity based on likely valuation impact.
3. Mark is_material = false if unlikely to affect valuation.
4. Write a factual summary with no speculation.
5. Provide confidence between 0 and 1.

If unsure, choose OTHER and set confidence < 0.5.
```

**JSON Mode:** Enabled (force structured output)

---

## Cost Estimates

### Assumptions
- 30 symbols per day (post-screener filter)
- 3 headlines per symbol on average
- 90 classifications per day
- Using GPT-4o-mini ($0.150 per 1M input tokens, $0.600 per 1M output tokens)

### Daily Cost Calculation

**Phase 1 (Classification Only):**
- Input: ~200 tokens/classification × 90 = 18,000 tokens = $0.003
- Output: ~150 tokens/classification × 90 = 13,500 tokens = $0.008
- **Total: ~$0.01 per day**

**Phase 3 (+ Explanations):**
- Additional 8 explanations × 500 tokens = 4,000 tokens = $0.002
- **Total: ~$0.012 per day**

**Monthly Cost:** ~$0.36/month

**Conclusion:** Negligible cost for post-close batch processing.

---

## Testing Strategy

### Unit Tests

**1. LLM Client** (`tests/intelligence/llm/test_client.py`)
- Mock API responses
- Test retry logic
- Test timeout handling
- Test error cases

**2. Classifier** (`tests/intelligence/llm/test_classifier.py`)
- Test valid classifications
- Test schema validation
- Test fallback to OTHER
- Test confidence thresholds

**3. Schemas** (`tests/intelligence/llm/test_schemas.py`)
- Test Pydantic validation
- Test all event types
- Test severity levels
- Test edge cases

### Integration Tests

**1. Pipeline** (`tests/intelligence/test_pipeline_llm.py`)
- Test LLM enhancement in full pipeline
- Test graceful degradation when LLM fails
- Test cache behavior
- Test cost limiting

**2. API** (`tests/api/test_intelligence_llm.py`)
- Test enhanced endpoints with LLM options
- Test response formats
- Test error handling

### Manual Testing

**1. Real Headlines**
- Run classifier on actual Yahoo Finance data
- Verify classifications are sensible
- Check for hallucinated symbols
- Validate confidence scores

**2. Cost Monitoring**
- Track token usage per run
- Verify cache hit rate
- Monitor API rate limits

---

## Risks & Mitigations

### Risk 1: Over-Automation
**Concern:** LLMs could lead to "AI trading bot" perception.

**Mitigation:**
- LLMs never produce trade signals directly
- All decisions remain rule-based
- Explanations clearly state "this is interpretation, not advice"
- Documentation emphasizes manual execution

### Risk 2: Hallucination
**Concern:** LLMs might invent tickers or facts.

**Mitigation:**
- Schema validation rejects hallucinated outputs
- Confidence thresholds filter uncertain classifications
- All classifications stored for human review
- Pipeline continues without LLM if validation fails

### Risk 3: Prompt Drift
**Concern:** LLM behavior changes over time.

**Mitigation:**
- Version all prompts (v1.0, v1.1, etc.)
- Store prompt version with each classification
- Pin model versions (not "latest")
- Periodic validation against ground truth dataset

### Risk 4: Cost Overruns
**Concern:** Costs could spike unexpectedly.

**Mitigation:**
- Hard limit on symbols (≤30)
- Hard limit on API calls per day (≤100)
- Cache all responses by headline hash
- Monitor spend via API provider dashboard

### Risk 5: Latency
**Concern:** LLM calls slow down pipeline.

**Mitigation:**
- Batch classifications (all headlines in one request if supported)
- Async API calls where possible
- Skip explanations if generation takes >30 seconds
- Make LLM features optional per run

---

## Acceptance Criteria

✅ **Deterministic Core Intact**
- Opportunity scores remain calculable without LLM
- LLM failures do not break pipeline

✅ **Schema Validation**
- All LLM outputs validated via Pydantic
- Invalid outputs rejected with logging

✅ **No Autonomous Decisions**
- LLMs do not generate trade recommendations
- All outputs are informational only

✅ **Cost Bounded**
- Daily token usage ≤ $0.05
- Hard limit on API calls

✅ **Auditable**
- All LLM inputs/outputs persisted
- Prompt versions tracked
- Reproducible for debugging

✅ **Educational**
- Explanations enhance learning
- Cite structured facts, not speculation

✅ **Tests Pass**
- Unit tests for all LLM components
- Integration tests for pipeline
- Coverage ≥80%

---

## Documentation Requirements

### User-Facing Docs

**1. Update `docs/OPERATIONAL_GUIDE.md`**
- Add LLM configuration section
- Explain how to enable/disable LLM features
- Document cost implications

**2. Update `docs/WEB_UI_GUIDE.md`**
- Show LLM-enhanced opportunity cards
- Explain LLM-generated explanations
- Add screenshots

**3. New `docs/LLM_INTELLIGENCE_GUIDE.md`**
- Deep dive on LLM integration
- Prompt engineering guide
- Troubleshooting common issues

### Developer Docs

**1. Update `docs/AGENTS.md`**
- Add LLM module structure
- Document LLM conventions
- Warn against expanding LLM scope

**2. API Docs (`api/README.md`)**
- Document new/enhanced endpoints
- Add example requests/responses
- Explain LLM options

**3. Architecture Diagram**
- Update intelligence flow diagram
- Show LLM integration points

---

## Migration Path

### For Existing Users

**Default Behavior:** LLMs disabled by default (`llm.enabled: false`)

**Opt-In Steps:**
1. Set environment variable: `OPENAI_API_KEY=...`
2. Update strategy config: `market_intelligence.llm.enabled: true`
3. Run intelligence pipeline: `/api/intelligence/run` with `llm_options`

**Backward Compatibility:**
- All existing endpoints work unchanged
- LLM fields are optional in responses
- Pipeline degrades gracefully if LLM unavailable

---

## Future Enhancements (Out of Scope)

### Not in Initial Implementation

❌ **Multi-Model Ensemble** - Complex, unclear benefit  
❌ **Fine-Tuning** - Requires large dataset, maintenance burden  
❌ **Real-Time Streaming** - Post-close batch is sufficient  
❌ **Sentiment Scoring** - Conflicts with price-first philosophy  
❌ **Predictive Features** - Violates deterministic principle  

---

## Final Philosophy

The LLM is not a trading brain. It is:

> **A semantic parser that converts human language into structured inputs for the deterministic engine.**

If this boundary is respected, the system gains intelligence without sacrificing discipline.

---

## Implementation Checklist

- [ ] Phase 1: Event Classifier
  - [ ] Create `intelligence/llm/` module structure
  - [ ] Implement LLM client with retry logic
  - [ ] Define Pydantic schemas for classification
  - [ ] Write event classification prompt (v1.0)
  - [ ] Integrate classifier into pipeline
  - [ ] Add LLM config to `IntelligenceConfig`
  - [ ] Write unit tests for classifier
  - [ ] Write integration tests for pipeline
  - [ ] Update API to accept `llm_options`
  - [ ] Test with real Yahoo Finance data

- [ ] Phase 2: Headline Deduplication
  - [ ] Implement deduplication logic
  - [ ] Add dedup step to pipeline
  - [ ] Update tests
  - [ ] Validate noise reduction

- [ ] Phase 3: Explanation Layer
  - [ ] Implement explanation generator
  - [ ] Add explanation prompt (v1.0)
  - [ ] Integrate into opportunity building
  - [ ] Add `llm_explanation` field to API responses
  - [ ] Write tests for explainer
  - [ ] Validate educational value

- [ ] Phase 4: Documentation
  - [ ] Update OPERATIONAL_GUIDE.md
  - [ ] Update WEB_UI_GUIDE.md
  - [ ] Create LLM_INTELLIGENCE_GUIDE.md
  - [ ] Update AGENTS.md
  - [ ] Update api/README.md
  - [ ] Add architecture diagrams

- [ ] Phase 5: Deployment
  - [ ] Add environment variable checks
  - [ ] Set up cost monitoring
  - [ ] Configure graceful degradation
  - [ ] Test migration for existing users
  - [ ] Document rollout plan

---

## Summary

This implementation adapts the original LLM proposal to fit Swing Screener's existing architecture. Key adaptations:

1. **Build on existing intelligence layer** - Don't replace, enhance
2. **Maintain deterministic core** - LLMs are an optional addon
3. **Preserve risk-first philosophy** - Classifications improve inputs, not decisions
4. **Keep costs negligible** - Post-close batch processing only
5. **Educational focus** - Explanations teach, not persuade
6. **Strict guardrails** - Schema validation, temperature=0, human debuggability

**Timeline:** 1-2 weeks for Phase 1-3, another week for Phase 4-5.

**Risk Level:** Low - graceful degradation ensures backward compatibility.

**ROI:** High for event classification, medium for explanations, low for deduplication/themes.

---

_For questions or clarifications, see the project maintainer or file an issue._
