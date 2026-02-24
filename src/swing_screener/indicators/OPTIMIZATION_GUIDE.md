# Indicators Module Optimization Guide

## Responsibility
Compute trend, momentum, and volatility features from price/volume data.

## Optimization Instructions
1. Compute rolling windows once per matrix and reuse them across feature builders.
2. Vectorize ATR/volatility calculations across tickers instead of iterating with per-ticker frame extraction.
3. Cache extracted field matrices (`high`, `low`, `close`, `volume`) within a computation pass.

## Simplification Instructions
1. Standardize helper signatures so all indicator functions accept/return consistent shapes.
2. Remove duplicated matrix extraction and NaN filtering logic by using shared utilities.

## Definition of Done
- Indicator pipelines avoid repeated per-ticker recomputation.
- Shared matrix extraction is used consistently.
- Output parity is validated with regression tests.
