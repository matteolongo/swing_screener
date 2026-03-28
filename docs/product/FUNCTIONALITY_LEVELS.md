# App Functionality Levels

This app does not have a single hard "plan tier" switch in code. It degrades and upgrades by subsystem depending on:

- which providers are configured
- which optional Python extras are installed
- which environment variables are present
- which features are explicitly enabled in config

The practical result is a small set of capability levels.

## Capability Levels

| Level | What you need | What works | Main limits |
|------|---------------|------------|-------------|
| Level 0 — Local planner | No external API keys required. Default config only. | Strategy setup, screener, Daily Review, workspace, local orders/positions, technical analysis, execution guidance, basic fundamentals fallback. | No LLM intelligence, no broker sync, no enhanced identifier mapping. |
| Level 1 — Heuristic research | `intelligence.enabled=true` with default free-source config. | Intelligence pipeline, catalyst/event ingestion, opportunity scoring, evidence normalization, theme clustering, ranked opportunities. | Still no LLM enrichment. Explanations stay deterministic / heuristic. |
| Level 2 — AI research | `OPENAI_API_KEY` plus `intelligence.enabled=true` and `intelligence.llm.enabled=true`. | LLM event classification, richer explanation generation, beginner education outputs, recommendation/thesis/learn intelligence views. | Advisory only. Does not place orders automatically. |
| Level 3 — Broker-synced EU workflow | Install `pip install -e \".[degiro]\"` and provide `DEGIRO_USERNAME`, `DEGIRO_PASSWORD`, `DEGIRO_INT_ACCOUNT`, plus TOTP/OTP. | DeGiro capability audit, portfolio sync preview/apply, richer EU fundamentals from DeGiro when provider chain can resolve the instrument. | Still no direct order routing from the app to DeGiro. Sync is reconciliation, not execution. |
| Level 4 — Enhanced symbol mapping | `SWING_SCREENER_OPENFIGI_ENABLED=true`, optionally `OPENFIGI_API_KEY`. | Better identifier / venue mapping inside the intelligence evidence path, especially when symbols need exchange-aware resolution. | Additive only. It does not unlock core app workflows by itself. |

## What Each Level Changes In Practice

| Area | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
|------|---------|---------|---------|---------|---------|
| Screener / Daily Review | Yes | Yes | Yes | Yes | Yes |
| Workspace analysis | Yes | Yes | Yes | Yes | Yes |
| Fundamentals snapshots | Yes, free-first chain | Yes | Yes | Better EU coverage if DeGiro resolves | Yes |
| Intelligence opportunities | No | Yes | Yes | Yes | Slightly improved mapping |
| LLM explanations / education | No | No | Yes | Yes | No |
| Local order planning | Yes | Yes | Yes | Yes | Yes |
| Broker portfolio sync | No | No | No | Yes | No |
| Automated broker execution | No | No | No | No | No |

## Important Caveats

| Item | Current code reality |
|------|----------------------|
| `OPENAI_API_KEY` alone is not enough | OpenAI-backed intelligence only activates when intelligence is enabled and `llm.enabled=true`. |
| DeGiro is sync + capability audit, not trading automation | DeGiro support currently covers capability probing, portfolio/order reconciliation, and fundamentals enrichment paths. It does not submit trades. |
| Fundamentals are free-first by default | The provider chain is `sec_edgar -> degiro -> yfinance`, so the app already has a useful baseline without paid APIs. |
| Intelligence is manual by default | The intelligence pipeline is not automatically scheduled by default; runs are started from the UI/API. |
| `SWING_SCREENER_PROVIDER` is effectively fixed today | The app is yfinance-only for OHLCV. Setting `SWING_SCREENER_PROVIDER` to anything else is invalid. |

## Code Anchors

| Concern | Code anchor |
|---------|-------------|
| Default market-data provider | `src/swing_screener/config.py` |
| Free-first fundamentals provider chain | `src/swing_screener/fundamentals/config.py` |
| Intelligence defaults and LLM gating | `src/swing_screener/intelligence/config.py` |
| OpenAI env resolution | `src/swing_screener/runtime_env.py` |
| Intelligence operating model | `src/swing_screener/intelligence/README.md` |
| DeGiro capability audit / portfolio sync gating | `api/services/fundamentals_service.py`, `api/routers/portfolio.py` |
| Low-level defaults | `config/defaults.yaml` |

## Recommended Product Framing

If this needs to be explained to users, the cleanest framing is:

1. **Planner**: no keys required
2. **Research**: enable intelligence
3. **AI Research**: add OpenAI
4. **Broker-Synced**: add DeGiro integration
5. **Enhanced Mapping**: add OpenFIGI

That matches the current code better than pretending the app has one linear commercial tier ladder.
