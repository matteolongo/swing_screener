# System Design Notes

> Status: current.  
> Last reviewed: 2026-02-17.

Principles for keeping the system robust and conservative:
- Prefer stable, transparent rules over clever tuning.
- Risk management is a first-class system layer.
- Portfolio-level risk matters more than single-trade optimism.
- Keep workflows repeatable and post-close.
- Avoid discretionary overrides and hidden state.
