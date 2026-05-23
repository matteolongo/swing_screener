from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.settings import get_settings_manager

_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: full Markdown string with sections ## Why it's moving, ## Key risks, ## Synthetic read
- sources: list of URLs you cited (may be empty if no relevant sources found)

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

    return (
        f"Symbol: {ticker}\n"
        f"Signal: {req.signal}\n"
        f"Close: {fmt(req.close)} {req.currency}\n"
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}\n"
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%\n"
        f"Entry: {fmt(req.entry)} | Stop: {fmt(req.stop)}\n"
        f"Sector: {req.sector or 'Unknown'}\n\n"
        f"Search for recent news, earnings results, catalysts, and analyst views for {ticker}. "
        f"Then produce the structured JSON analysis."
    )


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
        return SymbolIntelligence(
            symbol=ticker,
            generated_at=datetime.now(timezone.utc).isoformat(),
            action=raw["action"],
            conviction=raw["conviction"],
            summary_line=raw["summary_line"],
            narrative=raw["narrative"],
            sources=raw.get("sources", []),
        )
