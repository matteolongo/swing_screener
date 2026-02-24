# Signals Module Optimization Guide

## Responsibility
Generate entry signals (for example breakout and pullback/reclaim) from market data.

## Optimization Instructions
1. Precompute rolling highs/moving averages once per symbol series (or matrix) and reuse them.
2. Vectorize signal-board construction to avoid repeated per-symbol slicing and dropna calls.
3. Reduce repeated type/shape checks in tight loops by normalizing inputs upfront.

## Simplification Instructions
1. Keep each signal rule pure and parameterized.
2. Share common windowing helpers across signal functions.

## Definition of Done
- Signal generation performs fewer repeated series operations.
- Rule behavior is consistent across single- and multi-symbol inputs.
- Tests validate output parity after vectorization.
