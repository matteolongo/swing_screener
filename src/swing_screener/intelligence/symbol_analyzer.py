from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.cache import write_to_cache
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.settings import get_settings_manager

_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

IMPORTANT RULE — EXISTING POSITION MODE:
If the input contains an "OPEN POSITION" block, the user already holds this stock.
In that case you MUST:
  • Set action = MANAGE_ONLY (never BUY_NOW / BUY_ON_PULLBACK / etc.)
  • Write the narrative from a position-management perspective — do NOT suggest initiating an entry.
  • Frame **What to do:** around holding, trimming, or exiting the current position.
  • Frame **Watch for:** around signals that would change your hold/trim/exit recommendation.

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- catalyst_urgency: one of high | medium | low | none
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: flowing prose in Markdown. Start with the actionable read: **What to do:** and **Watch for:** in the first two short paragraphs. Then add the supporting technical, fundamental, and catalyst rationale. No H1/H2 headings. Max 400 words.
  When writing the narrative, always include:
  - **When to act:** Explain the specific timing for order placement — after market close today, on a confirmed pullback to the entry level, or on a breakout above a key level. Be concrete about the condition.
  - **Expected growth:** Using the target price and fair value context, state the expected upside as a percentage and how long it might take to play out (days/weeks).
  - **Take profit reasoning:** Explain why the target price was set where it is — R-multiple from stop, resistance level, or fair value estimate.
  Keep the narrative flowing and discursive, integrating the screener decision context naturally rather than listing fields mechanically.
- upcoming_events: array of objects {type, date, direction, summary} for events that could move the price.
  type: earnings | macro | dividend | product_launch | regulatory | other
  date: ISO date string or null if unknown
  direction: bullish | bearish | neutral
  summary: one sentence description
- position_signal: null unless position context is provided — then {action: HOLD | TRIM | EXIT, reason: one sentence}
  HOLD = thesis intact, no change needed
  TRIM = take partial profit or reduce risk, thesis weakening
  EXIT = thesis broken or clearly better use of capital
- position_outlook: null unless position context is provided — then an object with:
  expected_holding_period: days | 1-2_weeks | 2-6_weeks | unknown
  hold_until: plain-English condition for staying in the trade, not a guaranteed date
  next_review_trigger: the next event, price action, or time condition that should force reassessment
  thesis_status: intact | weakening | broken | unclear
  invalidation_signals: 2-4 concrete price/news/catalyst signals that would weaken or break the trade
  profit_management: hold_full | consider_trim | trail_stop | protect_breakeven | exit
  opportunity_cost: low | medium | high
  confidence_decay: one sentence explaining when the idea becomes stale if nothing changes
- sources: list of URLs you cited (may be empty)

Do not include any text outside the JSON block.\
"""


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in LLM response: {text[:300]}")


def _build_user_prompt(ticker: str, req: SymbolIntelligenceRequest) -> str:
    def fmt(v: float | None) -> str:
        return f"{v:.2f}" if v is not None else "N/A"

    has_position = (
        req.entry_price is not None
        and req.r_now is not None
        and req.days_open is not None
    )

    lines: list[str] = []

    if has_position:
        r_sign = "+" if req.r_now >= 0 else ""  # type: ignore[operator]
        lines += [
            "⚠️  OPEN POSITION — the user already holds this stock. Do NOT suggest initiating.",
            f"  Filled entry:  {fmt(req.entry_price)} {req.currency}",
            f"  Current price: {fmt(req.close)} {req.currency}",
            f"  Current P&L:   {r_sign}{req.r_now:.2f}R",
            f"  Days held:     {req.days_open}",
            f"  Current stop:  {fmt(req.stop)} {req.currency}",
            "",
            "Focus on whether to HOLD, TRIM, or EXIT. Set action = MANAGE_ONLY.",
            "Include position_signal and position_outlook in your JSON output.",
        ]
    else:
        lines += [
            f"Symbol: {ticker}",
            f"Signal: {req.signal}",
            f"Close: {fmt(req.close)} {req.currency}",
        ]

    lines += [
        "",
        "--- Technical context ---",
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}",
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%",
        f"Sector: {req.sector or 'Unknown'}",
    ]

    if not has_position:
        # Trade plan block
        if any(x is not None for x in (req.entry, req.stop, req.target, req.rr)):
            currency = req.currency or ""
            plan_lines: list[str] = [
                "",
                "--- Trade plan ---",
            ]
            entry_str = f"Planned entry (pullback level): {fmt(req.entry)} {currency}" if req.entry is not None else ""
            stop_str = f"Stop loss (invalidation level): {fmt(req.stop)} {currency}" if req.stop is not None else ""
            target_str = f"Price target: {fmt(req.target)} {currency}" if req.target is not None else ""
            price_parts = [p for p in (entry_str, stop_str, target_str) if p]
            if price_parts:
                plan_lines.append(" | ".join(price_parts))
            rr_str = f"Risk/Reward: {req.rr}x" if req.rr is not None else ""
            if req.target is not None and req.close is not None:
                upside_pct = round((req.target - req.close) / req.close * 100, 1)
                upside_str = f"Upside to target: {upside_pct}%"
            else:
                upside_str = ""
            rr_parts = [p for p in (rr_str, upside_str) if p]
            if rr_parts:
                plan_lines.append(" | ".join(rr_parts))
            lines += plan_lines

        # Decision context block
        has_decision = any(
            x is not None and x != ""
            for x in (
                req.decision_action, req.decision_conviction,
                req.technical_label, req.fundamentals_label, req.valuation_label,
                req.fair_value_low, req.fair_value_base, req.fair_value_high,
            )
        )
        if has_decision:
            currency = req.currency or ""
            lines += ["", "--- Decision context (screener) ---"]
            action_str = f"Action: {req.decision_action}" if req.decision_action else ""
            conv_str = f"Conviction: {req.decision_conviction}" if req.decision_conviction else ""
            ac_parts = [p for p in (action_str, conv_str) if p]
            if ac_parts:
                lines.append(" | ".join(ac_parts))
            tech_str = f"Technical: {req.technical_label}" if req.technical_label else ""
            fund_str = f"Fundamentals: {req.fundamentals_label}" if req.fundamentals_label else ""
            val_str = f"Valuation: {req.valuation_label}" if req.valuation_label else ""
            label_parts = [p for p in (tech_str, fund_str, val_str) if p]
            if label_parts:
                lines.append(" | ".join(label_parts))
            if all(x is not None for x in (req.fair_value_low, req.fair_value_base, req.fair_value_high)):
                fv_low = fmt(req.fair_value_low)
                fv_high = fmt(req.fair_value_high)
                fv_base = fmt(req.fair_value_base)
                lines.append(
                    f"Fair value range: {fv_low}–{fv_high} (base {fv_base}) {currency}"
                )

        # Chart quality block
        has_chart_quality = any(x is not None for x in (req.atr, req.rel_strength))
        if has_chart_quality:
            lines += ["", "--- Chart quality ---"]
            atr_str = f"ATR: {fmt(req.atr)}" if req.atr is not None else ""
            rs_str = f"Relative strength vs benchmark: {req.rel_strength}%" if req.rel_strength is not None else ""
            cq_parts = [p for p in (atr_str, rs_str) if p]
            if cq_parts:
                lines.append(" | ".join(cq_parts))

    # Catalyst context block (before web search instruction)
    if req.catalyst_summary:
        lines += [
            "",
            "--- Existing catalyst context ---",
            req.catalyst_summary,
            "(Build on this context. Do not repeat it verbatim.)",
        ]

    lines.append(
        f"\nSearch for recent news, earnings results, catalysts, and analyst views for {ticker}. "
        "Then produce the structured JSON analysis."
    )
    return "\n".join(lines)


class SymbolAnalyzer:
    def __init__(self) -> None:
        doc = get_settings_manager().load_intelligence_document()
        llm_cfg = doc.get("config", {}).get("llm", {})
        self._model = llm_cfg.get("web_search_model", "gpt-4o")
        self._max_tokens = int(llm_cfg.get("web_search_max_tokens", 2000))
        self._client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def analyze(self, ticker: str, req: SymbolIntelligenceRequest) -> SymbolIntelligence:
        inputs_used: dict = {}

        trade_plan: dict = {}
        if req.entry is not None:
            trade_plan["entry"] = req.entry
        if req.stop is not None:
            trade_plan["stop"] = req.stop
        if req.target is not None:
            trade_plan["target"] = req.target
        if req.rr is not None:
            trade_plan["rr"] = req.rr
        if req.target is not None and req.close is not None:
            trade_plan["upside_pct"] = round((req.target - req.close) / req.close * 100, 1)
        if trade_plan:
            inputs_used["trade_plan"] = trade_plan

        technical: dict = {}
        if req.sma_20 is not None:
            technical["sma_20"] = req.sma_20
        if req.sma_50 is not None:
            technical["sma_50"] = req.sma_50
        if req.sma_200 is not None:
            technical["sma_200"] = req.sma_200
        if req.momentum_6m is not None:
            technical["momentum_6m"] = req.momentum_6m
        if req.momentum_12m is not None:
            technical["momentum_12m"] = req.momentum_12m
        if req.rel_strength is not None:
            technical["rel_strength"] = req.rel_strength
        if req.atr is not None:
            technical["atr"] = req.atr
        if req.signal:
            technical["signal"] = req.signal
        if technical:
            inputs_used["technical"] = technical

        decision: dict = {}
        if req.decision_action:
            decision["action"] = req.decision_action
        if req.decision_conviction:
            decision["conviction"] = req.decision_conviction
        if req.technical_label:
            decision["technical_label"] = req.technical_label
        if req.fundamentals_label:
            decision["fundamentals_label"] = req.fundamentals_label
        if req.valuation_label:
            decision["valuation_label"] = req.valuation_label
        if req.fair_value_low is not None:
            decision["fair_value_low"] = req.fair_value_low
        if req.fair_value_base is not None:
            decision["fair_value_base"] = req.fair_value_base
        if req.fair_value_high is not None:
            decision["fair_value_high"] = req.fair_value_high
        if decision:
            inputs_used["decision_context"] = decision

        if req.catalyst_summary:
            inputs_used["catalyst"] = {"summary_available": True}

        user_prompt = _build_user_prompt(ticker, req)
        response = self._client.responses.create(
            model=self._model,
            tools=[{"type": "web_search_preview"}],
            instructions=_SYSTEM_PROMPT,
            input=user_prompt,
            max_output_tokens=self._max_tokens,
        )
        raw = _extract_json(response.output_text)
        result = SymbolIntelligence(
            symbol=ticker,
            generated_at=datetime.now(timezone.utc).isoformat(),
            action=raw["action"],
            conviction=raw["conviction"],
            catalyst_urgency=raw.get("catalyst_urgency", "none"),
            summary_line=raw["summary_line"],
            narrative=raw["narrative"],
            upcoming_events=raw.get("upcoming_events", []),
            position_signal=raw.get("position_signal"),
            position_outlook=raw.get("position_outlook"),
            sources=raw.get("sources", []),
        )
        result = result.model_copy(update={"inputs_used": inputs_used})
        try:
            write_to_cache(ticker, result)
        except Exception:
            pass
        return result
