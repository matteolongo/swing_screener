# LLM Event Classification Guide

## Overview

The LLM Event Classification system provides semantic interpretation of financial news using Large Language Models while preserving deterministic decision-making. LLMs classify and structure events but **never predict prices or generate trading signals**.

## Architecture

### Event Taxonomy

14 event types organized by market impact tiers:

**Tier 1 - Company Fundamentals (Highest Impact)**
- `EARNINGS`: Quarterly/annual results, surprises, guidance
- `GUIDANCE`: Forward-looking revisions outside earnings
- `M_AND_A`: Acquisitions, mergers, buyouts, spin-offs  
- `CAPITAL`: Stock offerings, buybacks, dividend changes

**Tier 2 - Operational Drivers**
- `PRODUCT`: Launches, clinical trials, regulatory approvals
- `PARTNERSHIP`: Joint ventures, distribution agreements
- `MANAGEMENT`: Leadership changes, CEO departures

**Tier 3 - External Forces**
- `REGULATORY`: Antitrust, bans, investigations
- `LEGAL`: Litigation, settlements
- `MACRO`: Interest rates, CPI, geopolitical events
- `SECTOR`: Industry-wide developments

**Tier 4 - Market Mechanics (Lower Signal)**
- `ANALYST`: Upgrades, downgrades, price targets
- `FLOW`: Short squeeze, unusual options activity
- `OTHER`: Fallback for unclassifiable events

### LLM Providers

1. **Ollama** (Production) - Local inference with Mistral 7B
2. **Mock** (Testing) - Deterministic keyword-based classification

## Docker Setup

### Starting Ollama

The `docker-compose.yml` includes an Ollama service with GPU support:

```bash
# Start all services (API + Web + Ollama)
docker compose up -d

# Check Ollama health
docker compose ps ollama

# View Ollama logs
docker compose logs -f ollama
```

### Pull Model

After starting Ollama, pull the model:

```bash
# Using Docker Compose
docker compose exec ollama ollama pull mistral:7b-instruct

# Or directly via Ollama CLI (if installed locally)
ollama pull mistral:7b-instruct
```

### Verify Model

```bash
# List available models
docker compose exec ollama ollama list

# Test model
docker compose exec ollama ollama run mistral:7b-instruct "Hello"
```

### GPU Configuration

The docker-compose.yml includes NVIDIA GPU support:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

**Requirements:**
- NVIDIA GPU
- nvidia-docker2 installed
- NVIDIA Container Toolkit configured

**Without GPU:**  
Remove the `deploy` section from `docker-compose.yml`. Ollama will run on CPU (slower).

## Usage

### CLI

```bash
# Test with mock provider (no Ollama needed)
swing-screener classify-news --symbols AAPL NVDA --mock --provider mock

# Use Ollama (requires Ollama running)
swing-screener classify-news --symbols AAPL NVDA --mock --provider ollama

# Save output to JSON
swing-screener classify-news --symbols AAPL --mock --provider mock --output results.json
```

### API

```bash
# Classify headlines
curl -X POST http://localhost:8000/api/intelligence/classify \
  -H "Content-Type: application/json" \
  -d '{
    "headlines": [
      {
        "headline": "NVDA beats Q4 earnings expectations",
        "snippet": "NVIDIA reported strong quarterly results."
      }
    ],
    "provider": "ollama",
    "model": "mistral:7b-instruct"
  }'
```

**Response:**
```json
{
  "total": 1,
  "classifications": [{
    "headline": "NVDA beats Q4 earnings expectations",
    "event_type": "EARNINGS",
    "severity": "HIGH",
    "primary_symbol": "NVDA",
    "is_material": true,
    "confidence": 0.95,
    "summary": "NVIDIA reported quarterly earnings exceeding expectations.",
    "model": "mistral:7b-instruct",
    "processing_time_ms": 234.5,
    "cached": false
  }],
  "avg_processing_time_ms": 234.5,
  "cached_count": 0,
  "material_count": 1,
  "provider_available": true
}
```

### Python

```python
from swing_screener.intelligence.llm import (
    EventClassifier,
    OllamaProvider,
    MockLLMProvider,
)

# Initialize provider
provider = OllamaProvider(model="mistral:7b-instruct")

# Check availability
if not provider.is_available():
    print("Ollama not running or model not pulled")
    exit(1)

# Create classifier with caching
classifier = EventClassifier(
    provider=provider,
    enable_cache=True,
    enable_audit=True,
)

# Classify single headline
result = classifier.classify(
    headline="Apple announces Vision Pro launch date",
    snippet="Apple unveiled the official release date.",
)

print(f"Event Type: {result.classification.event_type.value}")
print(f"Severity: {result.classification.severity.value}")
print(f"Material: {result.classification.is_material}")
print(f"Summary: {result.classification.summary}")
print(f"Cached: {result.cached}")

# Batch classification
headlines = [
    ("AAPL beats earnings", "Apple reported..."),
    ("MSFT launches product", "Microsoft unveiled..."),
]
results = classifier.classify_batch(headlines)
```

## Configuration

Add to your strategy config or environment:

```json
{
  "market_intelligence": {
    "llm": {
      "enabled": false,
      "provider": "ollama",
      "model": "mistral:7b-instruct",
      "base_url": "http://localhost:11434",
      "enable_cache": true,
      "enable_audit": true
    }
  }
}
```

**Environment Variables:**
```bash
# Override Ollama host (useful in Docker)
export OLLAMA_HOST=http://ollama:11434
```

## Data Persistence

### Cache
- **Location**: `data/intelligence/llm_cache.json`
- **Format**: JSON hash map (headline+snippet → classification)
- **Purpose**: Avoid re-classifying identical headlines

### Audit Logs
- **Location**: `data/intelligence/llm_audit/{date}.jsonl`
- **Format**: JSONL (one entry per line)
- **Purpose**: Debug classifications, track model behavior

### Example Audit Entry
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "headline": "NVDA beats earnings",
  "classification": {
    "event_type": "EARNINGS",
    "severity": "HIGH",
    "is_material": true
  },
  "model": "mistral:7b-instruct",
  "cached": false,
  "processing_time_ms": 234.5
}
```

## Guardrails

### Schema Enforcement
All LLM outputs are validated against Pydantic schemas. Invalid responses are rejected.

### Temperature = 0
LLMs use temperature 0 for consistency over creativity.

### No Speculative Language
Summaries are validated to reject phrases like "could", "might", "may", "will drive".

### Auditable
Every classification is logged with raw input/output for inspection.

### Cost Bounded
- Caching reduces redundant API calls
- Only runs on filtered candidates post-close
- Typical cost: pennies per day for 30 symbols

## Troubleshooting

### Ollama Not Available

**Error**: `Ollama model 'mistral:7b-instruct' not available`

**Solution**:
```bash
# Check if Ollama is running
docker compose ps ollama

# Pull the model
docker compose exec ollama ollama pull mistral:7b-instruct

# Verify
docker compose exec ollama ollama list
```

### GPU Not Detected

**Error**: `docker: Error response from daemon: could not select device driver "" with capabilities: [[gpu]]`

**Solution**:
1. Install nvidia-docker2: `sudo apt install nvidia-docker2`
2. Restart Docker: `sudo systemctl restart docker`
3. Or remove GPU section from docker-compose.yml to use CPU

### Slow Performance

**Issue**: Classifications take >5 seconds each

**Solutions**:
- Use GPU (20-50x faster than CPU)
- Enable caching (`enable_cache=True`)
- Use smaller model: `mistral:7b` → `llama3.2:3b`
- Batch process headlines

### Import Error

**Error**: `ModuleNotFoundError: No module named 'ollama'`

**Solution**:
```bash
pip install 'swing-screener[llm]'
# or
pip install ollama>=0.1.0
```

## Performance Benchmarks

**Mistral 7B on NVIDIA RTX 3080:**
- Cold classification: ~250ms
- Cached: <1ms
- Throughput: ~240 headlines/minute

**Mistral 7B on CPU (8-core):**
- Cold classification: ~4000ms  
- Cached: <1ms
- Throughput: ~15 headlines/minute

## Security Notes

- LLMs run **locally** via Ollama (no external API calls)
- No data leaves your infrastructure
- Audit logs stored locally for inspection
- Models are reproducible at specific versions

## Phase 2 Roadmap

**Not Yet Implemented:**
- Real news provider integration (currently mock data only)
- Headline deduplication
- LLM-generated explanations
- Theme labeling

**Coming Soon:**
- Alpaca News API integration
- Yahoo Finance news scraping
- Event correlation with price reactions
- Integration with intelligence pipeline
