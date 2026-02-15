# Issue: LLM-Augmented Market Intelligence Layer

## Summary

Enhance Swing Screener's existing Market Intelligence framework (`src/swing_screener/intelligence/`) with optional LLM-based semantic interpretation capabilities while maintaining strict deterministic decision-making.

**Status:** Proposal / Not Implemented

---

## Objective

Add Large Language Model (LLM) integration to the intelligence pipeline to provide:

1. **Event Classification** - Convert generic "news" events into structured categories (EARNINGS, M&A, PRODUCT, etc.)
2. **Headline Deduplication** - Reduce noise from duplicate stories across news wires
3. **Beginner-Friendly Explanations** - Generate educational context for top opportunities

**Critical Constraint:** LLMs interpret semantic content—they do not make trading decisions. All opportunity scoring remains deterministic.

---

## Current Architecture

Swing Screener already has a functional intelligence layer:

```
src/swing_screener/intelligence/
├── ingestion/          # Yahoo Finance event fetching
├── reaction.py         # Price reaction detection (return_z, ATR shocks)
├── scoring.py          # Catalyst scoring
├── relations.py        # Theme clustering & peer analysis
├── pipeline.py         # Orchestration
└── models.py           # Event, CatalystSignal, Opportunity, etc.

API: /api/intelligence/run, /api/intelligence/opportunities
```

**Current Flow:**
1. Fetch events from Yahoo Finance (all type="news", generic)
2. Detect price reactions (catalyst signals)
3. Cluster related symbols (themes)
4. Score opportunities (55% technical, 45% catalyst)
5. Return ranked opportunities via API

---

## Proposed Enhancement

Add LLM layer that:

1. **Classifies events** after ingestion using structured taxonomy
2. **Deduplicates headlines** to reduce false signal amplification
3. **Generates explanations** for top N opportunities (default N=8)

**New Module:**
```
src/swing_screener/intelligence/llm/
├── client.py       # LLM API wrapper (OpenAI/Anthropic)
├── schemas.py      # Pydantic validation models
├── prompts.py      # Versioned prompt templates
├── classifier.py   # Event classification logic
├── deduper.py      # Headline clustering
└── explainer.py    # Explanation generation
```

**Enhanced Flow:**
```
1. collect_events()
   ↓
1a. [NEW] LLM classify events → structured event_type, severity, materiality
   ↓
2. build_catalyst_signals() [ENHANCED: use LLM classification for weighting]
   ↓
1b. [NEW] LLM deduplicate headlines → reduce noise
   ↓
3. detect_theme_clusters()
   ↓
4. build_opportunities()
   ↓
4a. [NEW] LLM generate explanations → educational output for top opportunities
   ↓
5. API response [ENHANCED: include llm_explanation field]
```

---

## Key Design Principles

### 1. Deterministic Core Remains Intact
- Opportunity scores are **always calculable** without LLM
- LLM failures → pipeline continues with degraded features
- No LLM → old behavior (generic event types, no explanations)

### 2. Schema Enforcement
- All LLM outputs validated via Pydantic
- Temperature = 0 (consistency over creativity)
- Reject invalid outputs, log for debugging

### 3. Cost Control
- Only process post-screener candidates (≤30 symbols)
- Hard limit: ≤100 API calls per day
- Cache responses by headline hash
- **Estimated cost:** ~$0.01/day with GPT-4o-mini

### 4. Transparency & Auditability
- Persist all LLM inputs/outputs to `data/intelligence/llm_outputs/{date}/`
- Version prompts (v1.0, v1.1, etc.)
- Store prompt version + model with each classification

### 5. Educational Focus
- Explanations cite structured facts (e.g., "return_z=2.3, 3 peer confirmations")
- No speculation or price predictions
- Teach concepts (what is ATR? what is R-multiple?)

---

## Event Taxonomy

**Tier 1 - Company Fundamentals:**
- EARNINGS, GUIDANCE, M&A, CAPITAL

**Tier 2 - Operational:**
- PRODUCT, PARTNERSHIP, MANAGEMENT

**Tier 3 - External:**
- REGULATORY, LEGAL, MACRO, SECTOR

**Tier 4 - Market Mechanics:**
- ANALYST, FLOW, OTHER

**Severity:** LOW | MEDIUM | HIGH

**Materiality:** true/false (would a professional reconsider valuation?)

---

## API Changes

### Enhanced Endpoint: POST /api/intelligence/run

**Request:**
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

**Response (enhanced):**
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
      "llm_explanation": "NVIDIA moved 2.1× typical range after earnings. Multiple semiconductor peers also rose, suggesting sector-wide demand expectations."
    }
  ]
}
```

### New Endpoint: GET /api/intelligence/events

Returns events with LLM classifications for debugging/inspection.

---

## Configuration

Add to strategy config (`config.json` or YAML):

```json
{
  "market_intelligence": {
    "enabled": true,
    "llm": {
      "enabled": false,  // Default: disabled
      "provider": "openai",
      "model": "gpt-4o-mini",
      "temperature": 0.0,
      "classification_enabled": true,
      "deduplication_enabled": false,
      "explanation_enabled": true,
      "explanation_max_opportunities": 8,
      "prompt_version": "v1.0"
    }
  }
}
```

**Environment Variable:**
```bash
OPENAI_API_KEY=sk-...
```

---

## Implementation Phases

### Phase 1: Event Classifier (2-3 days)
**Highest ROI** - Improves catalyst scoring inputs

- [ ] Create `intelligence/llm/` module
- [ ] Implement LLM client with retry logic
- [ ] Define Pydantic schemas
- [ ] Write classification prompt (v1.0)
- [ ] Integrate into pipeline after `collect_events()`
- [ ] Add tests (unit + integration)

### Phase 2: Headline Deduplication (1-2 days)
**Medium ROI** - Reduces noise from duplicate stories

- [ ] Implement clustering logic
- [ ] Add to pipeline before `build_catalyst_signals()`
- [ ] Validate noise reduction

### Phase 3: Explanation Layer (2-3 days)
**High UX Value** - Educational output

- [ ] Implement explanation generator
- [ ] Write explanation prompt (v1.0)
- [ ] Add to pipeline after `build_opportunities()`
- [ ] Limit to top N opportunities (default 8)
- [ ] Add tests

### Phase 4: Documentation & Deployment (1 week)
- [ ] Update OPERATIONAL_GUIDE.md, WEB_UI_GUIDE.md, AGENTS.md
- [ ] Create LLM_INTELLIGENCE_GUIDE.md
- [ ] Add cost monitoring
- [ ] Test migration for existing users

**Total Estimate:** 2-3 weeks

---

## Guardrails (Non-Negotiable)

1. **No Autonomous Decisions** - LLMs do not generate trade signals
2. **Schema Validation** - Reject invalid outputs
3. **Temperature = 0** - Reproducible results
4. **Cost Bounded** - Hard limits on API calls
5. **Graceful Degradation** - Pipeline works without LLM
6. **Human Debuggability** - Persist all I/O for inspection

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Over-automation perception | LLMs never touch decisions; explanations state "interpretation only" |
| Hallucination | Schema validation, confidence thresholds, human review |
| Prompt drift | Version prompts, pin models, validate against ground truth |
| Cost overruns | Hard limits, caching, monitoring |
| Latency | Batch calls, async, skip on timeout |

---

## Acceptance Criteria

✅ Deterministic core intact (pipeline works without LLM)  
✅ Schema validation enforces structure  
✅ No trade recommendations from LLM  
✅ Cost ≤ $0.05/day  
✅ All I/O persisted for audit  
✅ Tests pass (≥80% coverage)  
✅ Documentation complete  

---

## References

**Full Implementation Guide:** `docs/LLM_INTELLIGENCE_IMPLEMENTATION.md`

This document contains:
- Detailed architecture diagrams
- Complete API specifications
- Full prompt templates
- Cost calculations
- Testing strategy
- Migration path

**Related Docs:**
- `docs/AGENTS.md` - Project philosophy and constraints
- `src/swing_screener/intelligence/` - Existing intelligence layer
- `api/routers/intelligence.py` - Current API endpoints

---

## Questions for Discussion

1. **Which LLM provider?** OpenAI (gpt-4o-mini) vs Anthropic (claude-3-haiku) vs local (llama)
2. **Default enabled?** Suggest disabled by default, opt-in via config
3. **Web UI integration?** Show LLM explanations in opportunity cards?
4. **Cost alerts?** Email if daily spend > $0.10?
5. **Prompt versioning strategy?** Git-based or config-based?

---

## Summary

This proposal adds optional LLM capabilities to enhance Swing Screener's existing intelligence layer without compromising its deterministic, risk-first philosophy. LLMs act as a semantic interpretation layer—they classify and explain, but never decide.

**Timeline:** 2-3 weeks  
**Cost:** ~$0.30/month  
**Risk:** Low (graceful degradation)  
**Impact:** High (better catalyst scoring + educational UX)

---

_For detailed implementation, see `docs/LLM_INTELLIGENCE_IMPLEMENTATION.md`_
