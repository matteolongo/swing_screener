# Portfolio Module Optimization Guide

## Responsibility
Store and evaluate position state, portfolio metrics, and position-management decisions.

## Optimization Instructions
1. Parse timestamps once at load time and avoid repeated datetime conversion in evaluation loops.
2. Reduce object-copy overhead when mutating small subsets of fields during position updates.
3. Reuse computed metrics within evaluation passes instead of recomputing per rule branch.

## Simplification Instructions
1. Move dict-to-model and model-to-dict logic into dedicated model helpers.
2. Separate persistence concerns from management logic to keep evaluation functions focused.

## Definition of Done
- Position evaluation loop performs fewer conversions/copies.
- Serialization has a single implementation path.
- Metrics and management behavior remain regression-safe.
