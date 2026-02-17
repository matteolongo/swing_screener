# Market Intelligence Layer - Philosophy & Design

> **Status: Evergreen principles.**  
> **Last Reviewed:** February 17, 2026.

## Why This Exists

Swing Screener is intentionally deterministic and risk-first.
However, technical signals alone answer one question:

> "Is this stock technically ready?"

They do not answer:

> "Why is capital flowing into this stock now?"

The Market Intelligence Layer detects new information entering the market, connects it to price behavior, and surfaces symbols where technical readiness and fresh catalysts align.

## Core Principle

> Price tells you that something is happening.
> Events help explain why.
> The combination tells you where to look next.

This system does not trade news. It detects state changes in market attention.

## Design Goals

- Post-close workflow only
- Deterministic and explainable
- Beginner-safe
- No automation of execution
- Transparent scoring
- Files as source of truth

This layer is not meant to predict the future. It is meant to reduce search space.

## Mental Model: Energy Entering the System

Markets move when new information forces participants to reprice risk.

Examples:

- earnings surprises
- guidance changes
- regulatory actions
- macro shocks
- product announcements
- analyst revisions
- sector rotations

Most tools display news. Few systems answer the key question:

> Did the market actually care?

Swing Screener treats price as the lie detector. News without abnormal price movement is noise.

## Relation Engine

The intelligence layer connects:

```
Events -> Symbols -> Price Behavior
```

For every symbol:

1. Did something happen?
2. Did price react abnormally?
3. Are peers reacting?
4. Is a broader theme forming?

## Symbol State Machine

Symbols move through a lifecycle:

- `QUIET`: normal behavior.
- `WATCH`: early abnormal movement or credible event.
- `CATALYST_ACTIVE`: significant move with credible catalyst.
- `TRENDING`: follow-through after initial shock.
- `COOLING_OFF`: momentum fades and volatility contracts.

This shifts users from chasing first moves to tracking sustained imbalances.

## Opportunity Formula

Opportunity requires both:

- Technical Readiness
- Catalyst Strength

Default blend:

```
Opportunity Score = 0.55 * Technical Readiness + 0.45 * Catalyst Strength
```

Technical dominates slightly because swing execution depends on structure.

## Theme Detection

Stocks rarely move in isolation. When curated peers move abnormally together, the system flags an emerging theme.

Examples:

- semiconductor momentum
- biotech sympathy runs
- defense spending narratives
- AI infrastructure cycles

## Market Context Is Mandatory

Every intelligence report starts with:

- `SPY`
- `QQQ`
- key sector ETFs
- `SMH`
- `XBI`

Stocks move within regimes, not in isolation.

## False Catalyst Filter

Hard rule:

> If price did not move abnormally, the event is ignored.

Default:

```
return_z >= 1.5
```

## Curated Relationships First

The system starts with a small human-editable peer map for signal quality, deterministic behavior, and easier debugging.

## Opinionated by Design

Output is intentionally constrained:

> max 5-8 opportunities per day.

Short lists improve decision quality.

## What This Is Not

Not:

- a news trading engine
- a prediction model
- a sentiment toy
- a high-frequency signal generator

It is a market attention filter that guides where deeper analysis is warranted.

## Long-Term Direction

This layer enables future modules:

- macro regime detection
- volatility environments
- sector rotation analysis
- correlation shifts
- liquidity monitoring

## Final Philosophy

The screener answers:

> Which stocks are technically healthy?

The intelligence layer answers:

> Where is new risk being priced?

Together:

> Where should I focus tomorrow?

Objective: informed selectivity, not activity.
