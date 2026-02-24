# Recommendations Module Optimization Guide

## Responsibility
Generate recommendation outcomes and trade thesis artifacts from risk, checklist, and overlay inputs.

## Optimization Instructions
1. Replace repeated rule branches with a data-driven rule table (code, condition, message, severity).
2. Cache normalized scoring weights/threshold structures for batch scoring workloads.
3. Avoid repeated recomputation of derived values across setup-score and classification stages.

## Simplification Instructions
1. Isolate rule evaluation, reason construction, and final payload assembly into separate functions.
2. Keep threshold definitions centralized and configurable.

## Definition of Done
- Rule engine is easier to extend without copy/paste branches.
- Scoring/classification has fewer repeated calculations.
- Recommendation outputs remain stable under existing tests.
