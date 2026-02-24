# Strategies Module Optimization Guide

## Responsibility
Implement strategy-specific business logic (currently centered on momentum workflow).

## Optimization Instructions
1. Trim DataFrames before joins/sorts to reduce memory and CPU overhead.
2. Avoid repeated construction of default/fallback payload dictionaries.
3. Reuse intermediate ranked/plan tables across reporting and guidance steps.

## Simplification Instructions
1. Extract overlay/fallback builders into dedicated helpers.
2. Keep strategy assembly stages explicit: universe -> ranking -> risk plan -> report.

## Definition of Done
- Strategy pipeline uses narrower dataframes and fewer redundant transforms.
- Fallback logic is centralized and easier to audit.
- Strategy output remains identical to baseline for fixed inputs.
