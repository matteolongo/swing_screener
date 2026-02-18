# LLM Guide (Intelligence)

> Status: current.  
> Last reviewed: 2026-02-17.

## Endpoint
- `POST /api/intelligence/classify`

## Providers
- `mock` (default, always available)
- `ollama` (requires local Ollama and model availability)

Provider selection is per request via the `provider` and `model` fields.
