# Risk Recommendations Optimization Guide

## Responsibility
Evaluate recommendation verdicts and build structured trade thesis artifacts as part of risk policy.

## Optimization Instructions
1. Keep gate evaluation data-driven (rule table) to reduce repeated branch code.
2. Cache reused normalized thresholds/weights during batch recommendation scoring.
3. Avoid recomputing derived metrics across recommendation and thesis stages.

## Simplification Instructions
1. Keep three clear layers:
- rule evaluation
- reason/thesis composition
- payload serialization
2. Ensure risk engine is the single entry point for recommendation generation.

## Definition of Done
- Recommendation logic is only under `risk/recommendations`.
- Rule extension requires minimal code change.
- Existing recommendation payload contracts remain stable.
