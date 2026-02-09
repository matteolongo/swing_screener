# System Design Notes (Trading OS Mindset)

This document distills a practical systems-level perspective for the Swing Screener project. It translates the guidance below into concrete, project-aligned principles and operational rules. The goal is not to invent a new strategy, but to protect a robust edge through disciplined system design.

## 1. The Edge Is Already There
Momentum + trend + risk sizing is one of the few long-lived, well-documented anomalies. The system does not need cleverness; it needs to avoid destroying the edge through over-optimization, parameter creep, or discretionary overrides.

**Project implication:** Favor simple, stable defaults. Keep indicators transparent and deterministic. Avoid adding knobs unless they are clearly justified and tested.

## 2. Build a Machine That Survives
Profit = survival × time. The system should be optimized for durability, not brilliance. The goal is to stay operational through long drawdowns and regime shifts.

**Project implication:** Risk management is a first-class system layer, not a afterthought. Defaults should assume long-run survival, not short-run performance.

## 3. Risk Engine Is the Real Engine
If position sizing is wrong, the system fails even with a strong strategy. If sizing is correct, a modest edge can compound over time.

**Project implication:**
- Risk parameters should be explicit, visible, and hard to bypass.
- The system should encourage smaller per-trade risk for multi-position portfolios.
- Position sizing should be front-and-center in reports and daily workflows.

## 4. Portfolio Thinking > Trade Thinking
The unit of risk is the portfolio, not a single trade. Correlation and concentration are as important as individual setups.

**Project implication:**
- Expose portfolio-level constraints (max positions, sector exposure, correlated assets).
- Warn when the universe or orders concentrate into one sector or theme.

## 5. Durability of Edge
Ask why the edge should persist. Momentum works because it reflects human/flow behavior (underreaction, herding, institutional flows), not fragile micro-patterns.

**Project implication:**
- Avoid micro-pattern/parameter tuning.
- Favor broad, behavior-driven rules with long test horizons.

## 6. Overfitting Is the Silent Killer
More parameters often create the illusion of control while eroding robustness.

**Project implication:**
- Reduce degrees of freedom.
- Prefer a few strong rules over many weak tweaks.
- Treat “advanced” parameters as optional and keep defaults stable.

## 7. Regime Awareness Without Market Timing
Markets are not stationary. The professional move is not to switch strategies on/off, but to scale risk based on regime.

**Project implication:**
- Introduce regime-aware risk scaling (e.g., reduce risk when market is below SMA200, or when volatility spikes).
- Keep the rule mechanical and transparent.

## 8. Long-Horizon Validation
Short backtests can lie. Robust strategies survive multiple crises and regimes.

**Project implication:**
- Encourage 10–15 year backtests in documentation.
- Include 2008, 2020, 2022 style regimes in validation.

## 9. Accept Drawdowns As Normal
If a trader cannot tolerate a 25–35% drawdown, the system’s risk profile is too aggressive or the expectations are unrealistic.

**Project implication:**
- Document expected drawdown ranges clearly.
- Make drawdown tolerance explicit in operational guidance.

## 10. Automate the Process, Minimize Discretion
The greatest threat to a systematic edge is the operator. Automation reduces behavioral leakage.

**Project implication:**
- Keep the CLI and UI workflows structured and repeatable.
- Avoid manual overrides unless explicitly requested and logged.

---

# Suggested Adjustments for Swing Screener

Below are adjustments implied by the principles above. These are **recommendations**; implement only if they align with the project’s conservative philosophy.

## A. Risk Calibration
- Consider lowering default per-trade risk for multi-position portfolios.
  - Suggested range: 0.25%–0.75% per trade (configurable, not enforced).
- Add a “portfolio risk budget” concept (sum of open risk in R or %).

## B. Regime-Aware Risk Scaling
- Add an optional rule to reduce risk when the benchmark is below its SMA200.
- Add an optional rule to reduce risk when volatility (e.g., VIX proxy) exceeds a threshold.
- Implement as a **simple multiplier** (e.g., risk × 0.5), not as a hard strategy switch.

## C. Concentration Controls
- Add exposure checks in reporting (sector concentration, correlated names).
- Warn when too many candidates/orders are in a single sector or theme.

## D. Parameter Discipline
- Freeze defaults and treat advanced parameters as “expert mode.”
- Add a short note: “More tuning does not imply better results.”

## E. Backtest Horizon Guidance
- Encourage long-horizon backtests by default (10–15 years when data is available).
- Provide presets: “Full Cycle” and “Crisis Stress” date ranges.

## F. Drawdown Expectations
- Document expected drawdown ranges in the operational guide.
- Add a UI reminder when risk settings imply aggressive drawdown potential.

---

# Scope Boundaries
These recommendations stay within the project’s conservative scope:
- No intraday logic
- No ML/curve-fitting
- No auto-execution

