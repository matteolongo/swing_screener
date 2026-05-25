from __future__ import annotations
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystOpportunityState, CatalystReport
from swing_screener.intelligence.catalysts.prompts import SYSTEM_PROMPT, URL_USER_PROMPT, WEB_SEARCH_USER_PROMPT
from swing_screener.intelligence.catalysts.store import CatalystStore

logger = logging.getLogger(__name__)
_MODEL = "gpt-4o"


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in LLM output: {text[:300]}")


def _opportunities_from_report(report: CatalystReport) -> list[CatalystOpportunity]:
    result: list[CatalystOpportunity] = []
    now = datetime.now(timezone.utc).isoformat()
    for company in [*report.beneficiaries, *report.hidden_opportunities]:
        state = CatalystOpportunityState.CATALYST_ACTIVE if company.catalyst_strength >= 6.7 else (
            CatalystOpportunityState.WATCH if company.catalyst_strength >= 4.0 else CatalystOpportunityState.QUIET
        )
        result.append(CatalystOpportunity(
            ticker=company.ticker.upper(),
            state=state,
            catalyst_strength=company.catalyst_strength,
            thesis=company.thesis,
            key_risks=company.key_risks,
            sources=[ev.url for ev in company.evidence],
            report_id=report.report_id,
            generated_at=now,
        ))
    for company in report.losers:
        result.append(CatalystOpportunity(
            ticker=company.ticker.upper(),
            state=CatalystOpportunityState.COOLING_OFF,
            catalyst_strength=company.catalyst_strength,
            thesis=company.thesis,
            key_risks=company.key_risks,
            sources=[ev.url for ev in company.evidence],
            report_id=report.report_id,
            generated_at=now,
        ))
    return result


class CatalystReportGenerator:
    def __init__(self) -> None:
        self._client = OpenAI()
        self._store = CatalystStore()

    def _generate(self, user_prompt: str) -> CatalystReport:
        response = self._client.responses.create(
            model=_MODEL,
            tools=[{"type": "web_search_preview"}],
            input=[{"role": "user", "content": user_prompt}],
        )
        raw = _extract_json(response.output_text)
        # Ensure a stable report_id
        if not raw.get("report_id"):
            raw["report_id"] = str(uuid.uuid4())
        if not raw.get("generated_at"):
            raw["generated_at"] = datetime.now(timezone.utc).isoformat()
        report = CatalystReport.model_validate(raw)
        self._persist(report)
        return report

    def generate_from_url(self, url: str) -> CatalystReport:
        return self._generate(URL_USER_PROMPT.format(url=url))

    def generate_from_web_search(self) -> CatalystReport:
        return self._generate(WEB_SEARCH_USER_PROMPT)

    def _persist(self, report: CatalystReport) -> None:
        from datetime import datetime, timezone
        try:
            self._store.save_report(report)
            opportunities = _opportunities_from_report(report)
            today = datetime.now(timezone.utc).date()
            self._store.save_symbol_index(today, opportunities)
        except Exception as exc:
            logger.warning("Failed to persist catalyst report %s: %s", report.report_id, exc)
