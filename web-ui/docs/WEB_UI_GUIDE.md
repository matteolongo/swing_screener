# Web UI Guide

> Status: updated to match current UI architecture.
> Last reviewed: 2026-02-28.

## Purpose
Daily trading workflow through the Swing Screener web interface.

## Pages
- Workspace: unified screener inbox, analysis canvas, and portfolio actions
- Daily Review: consolidated daily workflow and actionable review tables
- Strategy: strategy configuration, safety score, and educational controls
- Intelligence: market-intelligence run and opportunity review
- Onboarding: beginner workflow and setup guidance
- Learn: centralized glossary and educational references

## Notes on Legacy Routes
The following legacy routes redirect to current surfaces:
- `/dashboard`, `/screener`, `/orders`, `/positions` -> `/workspace`
- `/settings` -> `/strategy`

## Typical Workflow
1. Start API and web UI.
2. Open Workspace and run Screener Inbox.
3. Review selected ticker in Analysis Canvas.
4. Open Order tab and place orders from validated setups.
5. Use Daily Review for next-session decisions.

Timing guidance lives in `docs/product/DAILY_USAGE_GUIDE.md`.
