"""Workspace chat service powered by LangGraph and LangChain."""
from __future__ import annotations

from datetime import datetime
import json
import logging
from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from api.models.chat import ChatAnswerRequest, ChatAnswerResponse, ChatTurn, WorkspaceContext
from api.services.intelligence_config_service import IntelligenceConfigService
from api.services.workspace_context_service import WorkspaceContextService
from swing_screener.intelligence.config import build_intelligence_config
from swing_screener.intelligence.llm.factory import build_langchain_chat_model

logger = logging.getLogger(__name__)

_SPECULATIVE_MARKERS = (" could ", " might ", " likely ", " probably ", " expected ", " may ")
_READ_ONLY_MARKERS = (
    "create order",
    "place order",
    "buy ",
    "sell ",
    "update stop",
    "close position",
    "run intelligence",
    "execute",
    "cancel order",
)
_FORECAST_MARKERS = (
    " forecast",
    " foresee",
    " future",
    " outlook",
    " upside",
    " downside",
    " drop ",
    " increase ",
    " next move",
    " next leg",
    " going forward",
    " in the future",
)

ChatIntent = Literal[
    "portfolio",
    "screener",
    "intelligence",
    "selected_ticker",
    "forecast",
    "general",
    "action_request",
]


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def _clean_text(value: object, *, max_len: int = 600) -> str:
    text = " ".join(str(value or "").split()).strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}…"


def _dedupe_texts(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        cleaned = _clean_text(value, max_len=240)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    return normalized


def _coerce_content_text(raw_content: Any) -> str:
    if isinstance(raw_content, str):
        return raw_content.strip()
    if isinstance(raw_content, list):
        return "\n".join(_coerce_content_text(item) for item in raw_content if _coerce_content_text(item)).strip()
    if isinstance(raw_content, dict):
        for key in ("text", "content", "output_text"):
            if key in raw_content:
                return _coerce_content_text(raw_content[key])
        return _clean_text(json.dumps(raw_content, ensure_ascii=True), max_len=4000)
    return str(raw_content or "").strip()


def _contains_speculative_language(text: str) -> bool:
    normalized = f" {str(text).lower()} "
    return any(marker in normalized for marker in _SPECULATIVE_MARKERS)


class _IntentResult(BaseModel):
    intent: ChatIntent
    reasoning: str = ""


class _AnswerResult(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)
    facts_used: list[str] = Field(default_factory=list, max_length=16)
    warnings: list[str] = Field(default_factory=list, max_length=8)


class _ChatState(TypedDict, total=False):
    request: ChatAnswerRequest
    normalized_question: str
    normalized_conversation: list[ChatTurn]
    context: WorkspaceContext
    intent: ChatIntent
    warnings: list[str]
    answer_draft: _AnswerResult
    response: ChatAnswerResponse


class ChatService:
    """Answer read-only workspace questions using shared context."""

    def __init__(
        self,
        *,
        workspace_context_service: WorkspaceContextService,
        config_service: IntelligenceConfigService,
    ) -> None:
        self._workspace_context_service = workspace_context_service
        self._config_service = config_service
        self._graph = self._build_graph()

    def answer(self, request: ChatAnswerRequest) -> ChatAnswerResponse:
        result = self._graph.invoke({"request": request})
        return result["response"]

    def _build_graph(self):
        graph = StateGraph(_ChatState)
        graph.add_node("normalize_input", self._normalize_input)
        graph.add_node("build_context", self._build_context)
        graph.add_node("classify_intent", self._classify_intent)
        graph.add_node("answer_question", self._answer_question)
        graph.add_node("validate_answer", self._validate_answer)
        graph.add_node("return_response", self._return_response)
        graph.set_entry_point("normalize_input")
        graph.add_edge("normalize_input", "build_context")
        graph.add_edge("build_context", "classify_intent")
        graph.add_edge("classify_intent", "answer_question")
        graph.add_edge("answer_question", "validate_answer")
        graph.add_edge("validate_answer", "return_response")
        graph.add_edge("return_response", END)
        return graph.compile()

    def _normalize_input(self, state: _ChatState) -> _ChatState:
        request = state["request"]
        normalized_question = _clean_text(request.question, max_len=2000)
        normalized_conversation = request.conversation[-10:]
        return {
            "normalized_question": normalized_question,
            "normalized_conversation": normalized_conversation,
            "warnings": [],
        }

    def _build_context(self, state: _ChatState) -> _ChatState:
        request = state["request"]
        context = self._workspace_context_service.build_context(
            selected_ticker=request.selected_ticker,
            workspace_snapshot=request.workspace_snapshot,
        )
        return {
            "context": context,
            "warnings": _dedupe_texts([*state.get("warnings", []), *context.warnings]),
        }

    def _classify_intent(self, state: _ChatState) -> _ChatState:
        question = state["normalized_question"]
        context = state["context"]
        warnings = list(state.get("warnings", []))
        runtime_cfg = self._runtime_config()

        if self._llm_ready(runtime_cfg):
            try:
                parsed = self._invoke_structured_output(
                    runtime_cfg,
                    schema=_IntentResult,
                    system_prompt=(
                        "You classify read-only workspace chat questions for a swing-trading assistant. "
                        "Return strict JSON. "
                        "Use 'forecast' for future-oriented questions about upside, downside, next move, "
                        "drop, increase, or outlook. "
                        "Use 'action_request' if the user is asking the system to place, cancel, execute, or mutate anything."
                    ),
                    payload={
                        "question": question,
                        "selected_ticker": context.selected_ticker,
                        "available_sources": [source.model_dump(mode="json") for source in context.meta.sources],
                    },
                )
                return {"intent": parsed.intent, "warnings": warnings}
            except Exception as exc:
                logger.warning("Chat intent classification fell back to heuristic routing: %s", exc)
                warnings.append(f"Intent classifier fallback used: {_clean_text(str(exc), max_len=140)}")

        return {
            "intent": self._heuristic_intent(question, context.selected_ticker),
            "warnings": _dedupe_texts(warnings),
        }

    def _answer_question(self, state: _ChatState) -> _ChatState:
        question = state["normalized_question"]
        context = state["context"]
        intent = state["intent"]
        warnings = list(state.get("warnings", []))

        if intent == "action_request":
            return {
                "answer_draft": self._read_only_answer(context),
                "warnings": _dedupe_texts(warnings),
            }

        runtime_cfg = self._runtime_config()
        if self._llm_ready(runtime_cfg):
            try:
                if intent == "forecast":
                    warnings.append("Forward-looking answers are scenario-based and not price predictions.")
                answer = self._invoke_structured_output(
                    runtime_cfg,
                    schema=_AnswerResult,
                    system_prompt=self._answer_system_prompt(intent),
                    payload={
                        "question": question,
                        "intent": intent,
                        "conversation": [turn.model_dump(mode="json") for turn in state["normalized_conversation"]],
                        "context_summary": self._context_payload(context),
                        "facts": context.fact_map,
                        "rules": {
                            "read_only": True,
                            "must_reference_fact_keys": True,
                            "scenario_only": intent == "forecast",
                            "max_warnings": 4,
                        },
                    },
                )
                return {
                    "answer_draft": answer,
                    "warnings": _dedupe_texts([*warnings, *answer.warnings]),
                }
            except Exception as exc:
                logger.warning("Chat answer generation fell back to deterministic logic: %s", exc)
                warnings.append(f"LLM answer fallback used: {_clean_text(str(exc), max_len=140)}")

        return {
            "answer_draft": self._deterministic_answer(question=question, intent=intent, context=context),
            "warnings": _dedupe_texts(warnings),
        }

    def _validate_answer(self, state: _ChatState) -> _ChatState:
        draft = state["answer_draft"]
        context = state["context"]
        warnings = list(state.get("warnings", []))
        facts_used = [fact for fact in draft.facts_used if fact in context.fact_map]
        answer = _clean_text(draft.answer, max_len=4000)

        if state["intent"] == "action_request":
            validated = self._read_only_answer(context)
            warnings.append("Chat is read-only in v1. Action requests are answered without mutating state.")
            return {
                "answer_draft": validated,
                "warnings": _dedupe_texts([*warnings, *validated.warnings]),
            }

        if not answer or _contains_speculative_language(answer):
            warnings.append("The generated answer was replaced because it was empty or speculative.")
            fallback = self._deterministic_answer(
                question=state["normalized_question"],
                intent=state["intent"],
                context=context,
            )
            return {
                "answer_draft": fallback,
                "warnings": _dedupe_texts([*warnings, *fallback.warnings]),
            }

        if not facts_used:
            facts_used = self._default_facts_for_context(state["intent"], context)
            if not facts_used:
                warnings.append("The answer did not cite explicit facts from context.")

        return {
            "answer_draft": _AnswerResult(answer=answer, facts_used=facts_used, warnings=draft.warnings),
            "warnings": _dedupe_texts(warnings),
        }

    def _return_response(self, state: _ChatState) -> _ChatState:
        answer = state["answer_draft"]
        conversation_state = [
            *state["normalized_conversation"],
            ChatTurn(role="user", content=state["normalized_question"]),
            ChatTurn(role="assistant", content=answer.answer, created_at=_now_iso()),
        ][-12:]

        return {
            "response": ChatAnswerResponse(
                answer=answer.answer,
                warnings=_dedupe_texts([*state.get("warnings", []), *answer.warnings]),
                facts_used=answer.facts_used,
                context_meta=state["context"].meta,
                conversation_state=conversation_state,
            )
        }

    def _runtime_config(self):
        payload = self._config_service.get_config().model_dump()
        return build_intelligence_config({"market_intelligence": payload})

    def _llm_ready(self, runtime_cfg) -> bool:
        llm_cfg = getattr(runtime_cfg, "llm", None)
        if llm_cfg is None or not bool(getattr(llm_cfg, "enabled", False)):
            return False
        provider = str(getattr(llm_cfg, "provider", "")).strip().lower()
        return provider not in {"", "mock"}

    def _invoke_structured_output(self, runtime_cfg, *, schema: type[BaseModel], system_prompt: str, payload: dict[str, Any]):
        llm_cfg = runtime_cfg.llm
        parser = PydanticOutputParser(pydantic_object=schema)
        llm = build_langchain_chat_model(
            provider_name=llm_cfg.provider,
            model=llm_cfg.model,
            base_url=llm_cfg.base_url,
            api_key=llm_cfg.api_key,
            temperature=0,
            max_retries=0,
        )
        response = llm.invoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(
                    content=json.dumps(
                        {
                            "format_instructions": parser.get_format_instructions(),
                            "payload": payload,
                        },
                        separators=(",", ":"),
                        ensure_ascii=True,
                    )
                ),
            ]
        )
        return parser.parse(_coerce_content_text(getattr(response, "content", "")))

    def _heuristic_intent(self, question: str, selected_ticker: str | None) -> ChatIntent:
        lower = f" {question.lower()} "
        if any(marker in lower for marker in _READ_ONLY_MARKERS):
            return "action_request"
        if any(marker in lower for marker in _FORECAST_MARKERS):
            return "forecast"
        if any(token in lower for token in (" pnl ", " profit", " loss", "portfolio", "positions", "orders", "stop ")):
            return "portfolio"
        if any(token in lower for token in (" intelligence", "catalyst", "news", "event", "why", "explain")):
            return "intelligence" if selected_ticker else "general"
        if any(token in lower for token in (" screener", "candidate", "rank", "setup", "watchlist")):
            return "screener"
        if selected_ticker and selected_ticker.lower() in lower:
            return "selected_ticker"
        return "general"

    def _default_facts_for_context(self, intent: ChatIntent, context: WorkspaceContext) -> list[str]:
        preferred_by_intent: dict[ChatIntent, list[str]] = {
            "portfolio": [
                "portfolio.positions.open_count",
                "portfolio.orders.pending_count",
                "portfolio.summary.total_pnl",
            ],
            "screener": [
                "screener.snapshot.asof",
                "screener.snapshot.top_candidates",
                "screener.selected_candidate.signal",
            ],
            "intelligence": [
                "intelligence.asof",
                "intelligence.selected_opportunity.state",
                "intelligence.selected_education.thesis_summary",
            ],
            "selected_ticker": [
                "selected_ticker",
                "screener.selected_candidate.signal",
                "intelligence.selected_opportunity.state",
            ],
            "forecast": [
                "selected_ticker",
                "screener.selected_candidate.entry",
                "screener.selected_candidate.stop",
                "screener.selected_candidate.target",
                "intelligence.selected_opportunity.state",
            ],
            "general": [
                "portfolio.positions.open_count",
                "portfolio.orders.pending_count",
                "screener.snapshot.top_candidates",
            ],
            "action_request": ["selected_ticker"],
        }
        return [fact for fact in preferred_by_intent[intent] if fact in context.fact_map][:4]

    def _context_payload(self, context: WorkspaceContext) -> dict[str, Any]:
        selected_opportunity = (
            context.intelligence.opportunities[0]
            if context.intelligence and context.intelligence.opportunities
            else None
        )
        latest_event = (
            context.intelligence.events[0]
            if context.intelligence and context.intelligence.events
            else None
        )
        education_thesis = (
            context.intelligence.education.outputs.get("thesis")
            if context.intelligence and context.intelligence.education
            else None
        )
        return {
            "selected_ticker": context.selected_ticker,
            "warnings": context.warnings,
            "portfolio": {
                "orders_count": len(context.orders),
                "positions_count": len(context.positions),
                "portfolio_summary": (
                    context.portfolio_summary.model_dump(mode="json") if context.portfolio_summary else None
                ),
            },
            "screener": {
                "snapshot": context.screener_snapshot.model_dump(mode="json") if context.screener_snapshot else None,
                "selected_candidate": (
                    context.selected_candidate.model_dump(mode="json") if context.selected_candidate else None
                ),
            },
            "intelligence": {
                "selected_opportunity": (
                    selected_opportunity.model_dump(mode="json") if selected_opportunity else None
                ),
                "latest_event": latest_event.model_dump(mode="json") if latest_event else None,
                "education_thesis": education_thesis.model_dump(mode="json") if education_thesis else None,
            },
            "facts": context.fact_map,
        }

    def _answer_system_prompt(self, intent: ChatIntent) -> str:
        if intent == "forecast":
            return (
                "You are a read-only workspace assistant for a swing-trading system. "
                "Provide bounded forward-looking scenario analysis only. "
                "Use only the provided context and facts. "
                "Do not claim to foresee or predict prices. "
                "Do not use these words: may, might, could, likely, probably, expected. "
                "Write a compact scenario answer using conditional language and concrete levels when available. "
                "Include base case, bull case, and bear case in plain prose. "
                "State clearly that this is scenario analysis, not a forecast. "
                "Return strict JSON only."
            )
        return (
            "You are a read-only workspace assistant for a swing-trading system. "
            "Use only the provided context and facts. "
            "Never invent fresh data, predictions, or guarantees. "
            "If context is missing, say so plainly. Return strict JSON only."
        )

    def _read_only_answer(self, context: WorkspaceContext) -> _AnswerResult:
        selected = context.selected_ticker or "the current workspace"
        return _AnswerResult(
            answer=(
                f"Chat is read-only in v1. I can explain {selected} using the current portfolio, "
                "screener snapshot, and cached intelligence context, but I cannot place orders, "
                "update stops, or run workflows from chat."
            ),
            facts_used=self._default_facts_for_context("action_request", context),
            warnings=["Read-only guardrail enforced."],
        )

    def _deterministic_answer(
        self,
        *,
        question: str,
        intent: ChatIntent,
        context: WorkspaceContext,
    ) -> _AnswerResult:
        del question
        open_positions = [position for position in context.positions if position.status == "open"]
        pending_orders = [order for order in context.orders if order.status == "pending"]
        selected_ticker = context.selected_ticker
        facts_used = self._default_facts_for_context(intent, context)
        warnings: list[str] = []

        if intent == "portfolio":
            if not context.orders and not context.positions:
                return _AnswerResult(
                    answer="There are no stored orders or positions in the current workspace state.",
                    facts_used=facts_used,
                    warnings=warnings,
                )
            fragments = [
                f"You currently have {len(open_positions)} open positions and {len(pending_orders)} pending orders."
            ]
            if context.portfolio_summary is not None:
                fragments.append(
                    f"Unrealized P&L is {context.portfolio_summary.total_pnl:.2f} with win rate {context.portfolio_summary.win_rate:.2f}%."
                )
            if selected_ticker:
                selected_position = next(
                    (position for position in context.positions if position.ticker.upper() == selected_ticker),
                    None,
                )
                if selected_position is not None:
                    fragments.append(
                        f"{selected_ticker} is an open position at {selected_position.current_price or selected_position.entry_price:.2f}, "
                        f"with P&L {selected_position.pnl:.2f} and R now {selected_position.r_now:.2f}."
                    )
            return _AnswerResult(answer=" ".join(fragments), facts_used=facts_used, warnings=warnings)

        if intent in {"screener", "selected_ticker"}:
            if context.selected_candidate is None:
                return _AnswerResult(
                    answer="There is no current screener snapshot for the selected ticker in the workspace.",
                    facts_used=facts_used,
                    warnings=["Workspace screener snapshot is missing or does not include the selected ticker."],
                )
            candidate = context.selected_candidate
            fragments = [f"{candidate.ticker} is in the current screener snapshot."]
            if candidate.signal:
                fragments.append(f"Signal: {candidate.signal}.")
            if candidate.entry is not None and candidate.stop is not None:
                fragments.append(
                    f"Entry is {candidate.entry:.2f} and stop is {candidate.stop:.2f}."
                )
            if candidate.target is not None and candidate.rr is not None:
                fragments.append(f"Target is {candidate.target:.2f} with reward/risk {candidate.rr:.2f}.")
            if candidate.recommendation_verdict:
                fragments.append(f"Verdict: {candidate.recommendation_verdict}.")
            if candidate.beginner_explanation:
                fragments.append(candidate.beginner_explanation)
            return _AnswerResult(answer=" ".join(fragments), facts_used=facts_used, warnings=warnings)

        if intent == "intelligence":
            if context.intelligence is None or (
                not context.intelligence.opportunities and context.intelligence.education is None
            ):
                return _AnswerResult(
                    answer="There is no cached intelligence context available for this question yet.",
                    facts_used=facts_used,
                    warnings=["Cached intelligence data is missing for the current scope."],
                )
            fragments: list[str] = []
            if context.intelligence.opportunities:
                opportunity = context.intelligence.opportunities[0]
                fragments.append(
                    f"{opportunity.symbol} is currently in state {opportunity.state} with opportunity score {opportunity.opportunity_score:.2f}."
                )
            if context.intelligence.events:
                latest = context.intelligence.events[0]
                fragments.append(
                    f"The latest cached event is {latest.event_type} from {latest.source_name} "
                    f"with materiality {latest.materiality:.2f} and confidence {latest.confidence:.2f}."
                )
            if context.intelligence.education is not None:
                thesis = context.intelligence.education.outputs.get("thesis")
                if thesis is not None:
                    fragments.append(thesis.summary)
            return _AnswerResult(answer=" ".join(fragments), facts_used=facts_used, warnings=warnings)

        if intent == "forecast":
            warnings.append("Forward-looking answers are scenario-based and not price predictions.")
            selected_symbol = selected_ticker or (
                context.selected_candidate.ticker if context.selected_candidate is not None else "this symbol"
            )
            candidate = context.selected_candidate
            if candidate is None and (context.intelligence is None or not context.intelligence.opportunities):
                return _AnswerResult(
                    answer=(
                        f"I cannot frame a forward-looking scenario for {selected_symbol} yet because the current workspace "
                        "does not include a screener setup or cached intelligence context for that symbol."
                    ),
                    facts_used=facts_used,
                    warnings=[*warnings, "Scenario analysis needs a selected symbol plus screener or intelligence context."],
                )

            fragments = [f"This is scenario analysis for {selected_symbol}, not a price forecast."]
            if candidate is not None:
                if candidate.stop is not None and candidate.entry is not None:
                    fragments.append(
                        f"Base case: the current setup stays intact while price holds above {candidate.stop:.2f} "
                        f"and continues to build around {candidate.entry:.2f}."
                    )
                elif candidate.stop is not None:
                    fragments.append(
                        f"Base case: the setup stays intact while price holds above {candidate.stop:.2f}."
                    )
                if candidate.entry is not None and candidate.target is not None:
                    fragments.append(
                        f"Bull case: upside extension stays open on acceptance above {candidate.entry:.2f}, "
                        f"with {candidate.target:.2f} as the current upside reference."
                    )
                elif candidate.target is not None:
                    fragments.append(
                        f"Bull case: upside extension stays open toward {candidate.target:.2f} while the current setup remains valid."
                    )
                if candidate.stop is not None:
                    fragments.append(
                        f"Bear case: downside risk increases on a clean loss of {candidate.stop:.2f}, "
                        "which would invalidate the current setup structure."
                    )
                if candidate.signal:
                    fragments.append(f"The active setup type is {candidate.signal}.")

            if context.intelligence and context.intelligence.opportunities:
                opportunity = context.intelligence.opportunities[0]
                fragments.append(
                    f"Cached intelligence state is {opportunity.state} with opportunity score {opportunity.opportunity_score:.2f}."
                )
            if context.intelligence and context.intelligence.events:
                latest = context.intelligence.events[0]
                fragments.append(
                    f"Latest event context: {latest.event_type} from {latest.source_name} "
                    f"with materiality {latest.materiality:.2f} and confidence {latest.confidence:.2f}."
                )
            if context.intelligence and context.intelligence.education is not None:
                thesis = context.intelligence.education.outputs.get("thesis")
                if thesis is not None:
                    fragments.append(f"Current thesis context: {thesis.summary}")

            return _AnswerResult(answer=" ".join(fragments), facts_used=facts_used, warnings=warnings)

        top_candidates = (
            ", ".join(candidate.ticker for candidate in context.screener_snapshot.candidates[:5])
            if context.screener_snapshot and context.screener_snapshot.candidates
            else "none"
        )
        fragments = [
            f"The workspace currently has {len(open_positions)} open positions, {len(pending_orders)} pending orders, and top screener candidates: {top_candidates}."
        ]
        if context.selected_ticker:
            fragments.append(f"The current focus ticker is {context.selected_ticker}.")
        if context.intelligence and context.intelligence.opportunities:
            opportunity = context.intelligence.opportunities[0]
            fragments.append(
                f"Cached intelligence for the focus area shows state {opportunity.state} and score {opportunity.opportunity_score:.2f}."
            )
        return _AnswerResult(answer=" ".join(fragments), facts_used=facts_used, warnings=warnings)
