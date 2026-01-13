# AGENTS.md — Swing Screener

This file defines **project scope, goals, structure, and conventions** for AI coding agents
(e.g. Codex, ChatGPT, Cursor, Copilot) working on this repository.

Agents should read this file **before making any changes**.

---

## Project summary

**Swing Screener** is a systematic swing-trading framework for US equities.

It is designed to:
- screen large universes of stocks
- generate rule-based trade candidates
- manage open positions via risk rules
- keep execution manual (Degiro / retail broker friendly)

The project explicitly prioritizes:
- simplicity
- reproducibility
- risk control
- low operational overhead

This is **not**:
- a high-frequency system
- an intraday trading bot
- an auto-execution platform

---

## High-level goals

1. Produce **daily swing-trade candidates**
2. Enforce **risk-first position sizing**
3. Manage trades via **R-multiples and trailing stops**
4. Minimize discretionary decisions
5. Keep all logic testable and deterministic

The system should be usable by:
- a single retail trader
- once per day
- after market close

---

## Non-goals (important)

Agents MUST NOT:
- add live trading / broker APIs
- add intraday logic
- add ML models or predictive fitting
- introduce hidden state or magic heuristics
- bypass risk rules for “better performance”

This project values **clarity over cleverness**.

---

## Repository structure (authoritative)

```
swing_screener/
├── docs/                 # All documentation (user + dev)
├── notebooks/            # Educational / exploratory notebooks
├── src/swing_screener/
│   ├── cli.py            # Main CLI entrypoint
│   ├── data/             # Market data + universe loading
│   ├── indicators/       # Trend / momentum / volatility indicators
│   ├── screeners/        # Universe filtering & ranking
│   ├── reporting/        # Daily screener reports
│   ├── portfolio/        # Position state & management logic
│   └── backtesting/      # Historical simulation
├── tests/                # Unit tests (pytest)
├── positions.json        # User-maintained trade state
└── pyproject.toml
```

Agents should respect this layout.

---

## Core concepts agents must understand

### 1. OHLCV format

Market data is always a Pandas DataFrame with:
- index = date
- columns = MultiIndex (field, ticker)

Example:
```
(Open, AAPL), (Close, MSFT), (Volume, NVDA)
```

Agents must preserve this convention.

---

### 2. Indicators philosophy

Indicators are:
- deterministic
- transparent
- explainable

Common indicators:
- SMA (trend)
- momentum returns (6m, 12m)
- ATR (volatility)

Agents should **not** introduce:
- complex oscillators
- curve-fitted parameters
- indicators that require intraday data

---

### 3. R-multiples (critical)

Risk is expressed in **R**, where:

```
1R = entry_price - stop_price
```

All trade management logic is based on:
- current R (`r_now`)
- breakeven rules
- trailing stops

Agents must preserve R-based reasoning.

---

## CLI philosophy

The CLI is the primary interface.

Principles:
- explicit commands (`run`, `manage`)
- no hidden defaults
- filesystem-based state (CSV / JSON / MD)

Agents should not:
- add interactive prompts
- require GUIs
- hide outputs in logs

---

## positions.json contract

`positions.json` is the **single source of truth** for open trades.

Agents must:
- never auto-create positions
- never auto-close trades silently
- only update stops when explicitly requested (`--apply`)

Schema changes require:
- backward compatibility
- clear migration notes

---

## Testing requirements

Any agent change must:
- include unit tests if logic changes
- avoid breaking existing tests
- prefer pure functions

Backtesting logic must remain:
- deterministic
- reproducible
- seed-independent

---

## Documentation rules

Documentation lives in `docs/`.

Agents should:
- update docs when behavior changes
- avoid duplicating content
- keep operational docs accurate

The most important docs:
- `OPERATIONAL_GUIDE.md`
- `CLI.md`
- `README_technical.md`

---

## Style & constraints

- Python 3.11+
- Type hints preferred
- No unnecessary dependencies
- Pandas over NumPy unless performance-critical
- Explicit > implicit

Agents should favor:
- readability
- composability
- testability

---

## How agents should propose changes

Agents should:
1. Explain **why** a change is needed
2. Describe impact on users
3. Show minimal diff
4. Update tests
5. Update docs if needed

Large refactors must be justified.

---

## Final note to agents

This project is intentionally conservative.

If a change:
- increases complexity
- adds automation risk
- reduces transparency

…it is probably not desired.

When in doubt:
**ask before changing behavior.**

---

_End of AGENTS.md_
