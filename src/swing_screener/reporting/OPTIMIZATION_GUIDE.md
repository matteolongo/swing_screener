# Reporting Module Optimization Guide

## Responsibility
Build user-facing daily reports and action summaries from strategy outputs.

## Optimization Instructions
1. Cache strategy module resolution for repeated report generation in long-running processes.
2. Reduce repeated per-field formatting checks by using reusable format helpers.

## Simplification Instructions
1. Keep report assembly declarative: formatters + templates, not deeply nested branch logic.
2. Separate data extraction from display formatting.

## Definition of Done
- Report path has less branching and clearer formatting rules.
- Repeated report generation avoids repeated import/lookup overhead.
- Output format remains backward compatible.
