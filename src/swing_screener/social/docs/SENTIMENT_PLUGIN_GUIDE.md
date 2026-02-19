# Sentiment Plugin Guide

> Status: current.  
> Last reviewed: 2026-02-17.

## Capabilities
- Providers: `reddit`, `yahoo_finance`
- Analyzers: `keyword`, `vader` (if installed)
- Social overlay metrics and cached fetches

## API Endpoints
- `GET /api/social/providers`
- `POST /api/social/analyze`
- `GET /api/social/warmup/{job_id}`

## Extension Points
- Providers: `src/swing_screener/social/providers/`
- Analyzers: `src/swing_screener/social/sentiment/`
