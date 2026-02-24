# Execution Module Optimization Guide

## Responsibility
Manage order models, persistence, and order lifecycle workflows (entry, scale-in, exits).

## Optimization Instructions
1. Build and reuse in-memory indices (`order_id -> order`) in workflow functions to avoid repeated list scans.
2. Minimize repeated recomputation when updating linked entry/exit orders.
3. Ensure load/save routines handle bulk operations efficiently and avoid unnecessary full-file rewrites when no changes occurred.

## Simplification Instructions
1. Centralize order serialization/deserialization in one place and reuse it across `orders.py` and service/workflow layers.
2. Keep workflow functions focused on business transitions; move shared lookup/update helpers into a common utility module.

## Definition of Done
- Workflow complexity is reduced (fewer repeated loops).
- Serialization is single-source-of-truth.
- Tests cover transition correctness and persistence behavior.
