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

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- catalyst_urgency: one of high | medium | low | none
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: flowing prose in Markdown. Start with the actionable read: **What to do:** and **Watch for:** in the first two short paragraphs. Then add the supporting technical, fundamental, and catalyst rationale. No H1/H2 headings. Max 300 words.
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

    lines = [
        f"Symbol: {ticker}",
        f"Signal: {req.signal}",
        f"Close: {fmt(req.close)} {req.currency}",
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}",
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%",
        f"Entry: {fmt(req.entry)} | Stop: {fmt(req.stop)}",
        f"Sector: {req.sector or 'Unknown'}",
    ]

    if req.entry_price is not None and req.r_now is not None and req.days_open is not None:
        lines.append(
            f"Position context: entry={fmt(req.entry_price)}, "
            f"current R={req.r_now:.2f}R, held {req.days_open} days"
        )
        lines.append(
            "Include position_signal (HOLD / TRIM / EXIT) with a one-sentence reason."
        )
        lines.append(
            "Also include position_outlook with expected_holding_period, hold_until, "
            "next_review_trigger, thesis_status, invalidation_signals, profit_management, "
            "opportunity_cost, and confidence_decay. Focus on how long the position is still "
            "worth keeping open and what would make that patience invalid."
        )

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
        try:
            write_to_cache(ticker, result)
        except Exception:
            pass
        return result
