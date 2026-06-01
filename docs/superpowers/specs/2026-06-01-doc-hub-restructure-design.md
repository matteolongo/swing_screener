# Doc Hub Restructure — Design Spec

Date: 2026-06-01  
Status: approved

## Goal

Make CLAUDE.md the fast-load agent entry point. Agents read it and know where to look for deeper context — they don't need to explore the codebase to orient themselves. Feature-specific docs live in existing files under `docs/` and `*/docs/`; CLAUDE.md links to them.

## What Gets Deleted

Planning and implementation-history docs with no ongoing reference value:

- `docs/engineering/BACKEND_CLEANUP_AUDIT.md`
- `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`
- `docs/engineering/COMBINED_ANALYSIS_IMPLEMENTATION_PLAN.md`
- `docs/engineering/PREDICTIVE_AND_EXPLANATION_IMPROVEMENT_PLAN.md`
- `docs/engineering/predictive-improvement/` (entire subfolder)
- `docs/engineering/MODULE_ARCHITECTURE_MIGRATION_PLAN.md`
- `docs/engineering/CODE_REVIEW.md`
- `docs/engineering/UNIVERSE_MANAGEMENT_REMEDIATION_PLAN.md`
- `docs/engineering/WORKSPACE_CHAT_ANALYSIS.md`

## Broken References to Fix

| File | Fix |
|---|---|
| `docs/overview/INDEX.md` | Remove dead links: DATA_SOURCE_ROADMAP.md, BROKER_INTEGRATION.md, INDICATOR_VALIDATION.md; remove deleted-doc entries; add intelligence README; update "last reviewed" |
| `.github/copilot-instructions.md` | Fix AGENTS.md path (→ `docs/overview/AGENTS.md`); remove DAILY_REVIEW_IMPLEMENTATION.md ref; drop stale test count |
| `README.md` | Remove `mcp_server/README.md` reference |

## Stale Docs to Update

### web-ui/README.md
Replace old page list (Dashboard, Screener, Orders, Positions, Daily Review) with current pages:
Today, Calendar, Book, Research, Universes, Strategy, Journal, Onboarding, Analytics, Fundamentals.

### web-ui/docs/WEB_UI_GUIDE.md
Full rewrite: current pages with one-line description each, feature directory map (which `web-ui/src/features/` dir maps to which page/domain), testing patterns, mark "Status: current".

### web-ui/docs/WEB_UI_ARCHITECTURE.md
Update component/feature/page structure to reflect current state. Update "last reviewed" date.

## New File: src/swing_screener/intelligence/README.md

Contents:
- Module purpose: post-close LLM enrichment for screener candidates and open positions
- File inventory: symbol_analyzer.py, models.py, cache.py, catalysts/ (generator.py, models.py, prompts.py, store.py)
- API surface: POST/GET /api/intelligence/{ticker}, POST /api/intelligence/sweep
- Config: intelligence.yaml — LLM provider, model, temperature, signal toggles
- Integration path: api/routers/intelligence.py → api/services/intelligence_service.py → symbol_analyzer.py
- Input context: fundamentals snapshot + Finnhub signals (insider/estimate/upgrade) + OHLCV features

## CLAUDE.md Restructure

**What stays:**
- What This Is (3 lines)
- Commands (Python + TypeScript — verbatim, they are correct)
- Architecture layer table
- Critical Conventions (snake_case↔camelCase, OHLCV MultiIndex, R-multiples, i18n, cross-layer contract rule, config surfaces one-liner, runtime state one-liner)
- Testing Patterns
- Documentation Rules
- PR Delivery

**What moves out:**
- 13-module verbose descriptions → already in MODULE_ARCHITECTURE.md and individual READMEs
- Configuration Surfaces YAML detail → config/README.md
- Runtime State JSON detail → data/README.md

**New section added at bottom — Feature Context:**
```
## Feature Context

For deeper context on a specific area:
- Backend modules:       docs/engineering/MODULE_ARCHITECTURE.md
- API surface:           api/README.md
- Web UI pages/features: web-ui/docs/WEB_UI_GUIDE.md
- Intelligence module:   src/swing_screener/intelligence/README.md
- Config options:        config/README.md
- Runtime data:          data/README.md
- Roadmap:               docs/engineering/ROADMAP.md
- Troubleshooting:       docs/engineering/TROUBLESHOOTING.md
```

**Net effect:** CLAUDE.md ~150 lines → ~90 lines.

## docs/overview/INDEX.md

After deletions and fixes, becomes a clean index of only files that exist and have reference value. Planning/snapshot docs removed. Intelligence README added. "last reviewed" updated to 2026-06-01.

## Out of Scope

- Module READMEs other than intelligence (they are current)
- docs/superpowers/plans/ and docs/superpowers/specs/ (implementation history, not reference docs — leave as-is)
- docs/education/ (product copy, not agent context)
- docs/product/ (user-facing, not agent context)
- config/README.md and data/README.md content (already exist; will receive the moved detail from CLAUDE.md but not otherwise restructured)
