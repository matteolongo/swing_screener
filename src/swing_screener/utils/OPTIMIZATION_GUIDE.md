# Utils Module Optimization Guide

## Responsibility
Provide shared helper utilities for dictionaries, dates, tickers, and dataframe field extraction.

## Optimization Instructions
1. Replace manual ordered-dedup loops with `dict.fromkeys`-style patterns where appropriate.
2. Ensure shared dataframe field-extraction helpers are used across modules to avoid duplicated extraction costs.
3. Keep utility functions side-effect free and cheap to call in hot paths.

## Simplification Instructions
1. Remove duplicate helper implementations that exist in feature modules.
2. Keep utility API minimal and well-scoped to cross-cutting concerns.

## Definition of Done
- Call sites converge on one helper per concern.
- Utility code remains small, pure, and broadly reusable.
- No behavioral drift in downstream modules.
