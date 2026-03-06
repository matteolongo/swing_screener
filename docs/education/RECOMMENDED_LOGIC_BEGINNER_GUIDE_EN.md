# Recommended Logic Recap

Here is the recap, explained for a beginner.

The logic behind `recommended` is not: "take the stocks with the highest score and buy them." It is a 2-layer process:

1. first the system finds stocks that are technically interesting
2. then it checks whether the trade is actually tradable under strict risk rules

So a stock can be strong, highly ranked, and still end up as `NOT_RECOMMENDED`.

## How the shortlist is created

The engine starts from a stock universe and removes anything that does not meet the base filters: price in range, volatility not too high, acceptable trend, supported currency.

In the default strategy the filters are fairly broad: price 5-500, ATR% up to 15%, trend required, USD/EUR currencies.

## How stocks are ranked

After filtering, each stock gets a `score` based on:

- 6-month momentum
- 12-month momentum
- 6-month relative strength versus the benchmark

In practice, the system rewards stocks that are already outperforming others. This is the "momentum" part.

## When a stock becomes operationally interesting

Then the system looks for an entry signal:

- `breakout`: price breaks above recent highs
- `pullback`: price recovers a moving average after a pullback
- `both`: both conditions are present, so the setup is stronger

If there is no active signal, the stock may still be a good idea, but it does not become `recommended`.

## How `RECOMMENDED` is decided

This is the most important part. The final verdict comes from a checklist: a trade is `RECOMMENDED` only if it passes everything.

The main checks are:

- there is an active signal
- there is a valid stop below entry
- the position size is tradable
- the risk stays within the budget
- reward/risk is at least the required minimum
- costs and slippage do not eat too much of the trade
- there is no veto from the social overlay

If even one of these fails, the verdict becomes `NOT_RECOMMENDED`.

## In plain language

A `recommended` trade means:

"This is not just a strong stock. It is a strong stock with an active setup, a clear stop, controlled risk, and a reward/risk profile that is good enough to justify the trade."

## Most important default thresholds

In the default strategy:

- risk per trade: 1% of account capital
- stop: roughly `entry - 2 x ATR`
- minimum reward/risk: 2.0
- maximum fees: 20% of planned risk

This means the system prefers asymmetric trades: risk 1 to aim for at least 2.

## Difference between `score`, `confidence`, and `recommended`

- `score`: how strong the stock is versus others
- `confidence`: how solid the setup looks qualitatively
- `recommended`: the final yes/no after risk checks

This distinction matters: a stock can have a high score and still not be recommended.

## In the Daily Review

The Daily Review shows only candidates with a `RECOMMENDED` verdict and hides the others.

If needed, this document can also become the basis for a small educational UI section with examples like "why this stock is not recommended."
