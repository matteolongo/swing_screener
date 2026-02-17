# Intelligence System Design

> Status: current.  
> Last reviewed: 2026-02-17.

## Purpose
Post-close market intelligence pipeline for surfacing candidate opportunities and LLM-classified events. No auto-trading.

## Core Modules
- `config.py`
- `models.py`
- `pipeline.py`
- `ingestion/`
- `reaction.py`
- `relations.py`
- `state.py`
- `scoring.py`
- `storage.py`
- `llm/`

## Storage
- Root directory: `data/intelligence`
- Files: `events_YYYY-MM-DD.jsonl`, `signals_YYYY-MM-DD.json`, `themes_YYYY-MM-DD.json`, `opportunities_YYYY-MM-DD.json`, `symbol_state.json`

## API Endpoints
- `POST /api/intelligence/run`
- `GET /api/intelligence/run/{job_id}`
- `GET /api/intelligence/opportunities`
- `POST /api/intelligence/classify`
