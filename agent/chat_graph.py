"""LangGraph-based read-only chat orchestration for the Swing Screener agent."""
from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, StateGraph

from api.models.chat import ChatTurn, WorkspaceSnapshot
from agent.client import MCPClient


class _AgentChatState(TypedDict, total=False):
    question: str
    selected_ticker: str | None
    conversation: list[ChatTurn]
    workspace_snapshot: WorkspaceSnapshot | None
    result: dict


class AgentChatGraph:
    """Minimal LangGraph wrapper around the shared chat_answer tool."""

    def __init__(self, client: MCPClient) -> None:
        self._client = client
        self._graph = self._build_graph()

    async def ask(
        self,
        *,
        question: str,
        conversation: list[ChatTurn] | None = None,
        selected_ticker: str | None = None,
        workspace_snapshot: WorkspaceSnapshot | None = None,
    ) -> dict:
        result = await self._graph.ainvoke(
            {
                "question": question,
                "conversation": conversation or [],
                "selected_ticker": selected_ticker,
                "workspace_snapshot": workspace_snapshot,
            }
        )
        return result["result"]

    def _build_graph(self):
        graph = StateGraph(_AgentChatState)
        graph.add_node("normalize_input", self._normalize_input)
        graph.add_node("answer_question", self._answer_question)
        graph.set_entry_point("normalize_input")
        graph.add_edge("normalize_input", "answer_question")
        graph.add_edge("answer_question", END)
        return graph.compile()

    async def _normalize_input(self, state: _AgentChatState) -> _AgentChatState:
        return {
            "question": " ".join(str(state["question"]).split()).strip(),
            "conversation": state.get("conversation", [])[-10:],
            "selected_ticker": state.get("selected_ticker"),
            "workspace_snapshot": state.get("workspace_snapshot"),
        }

    async def _answer_question(self, state: _AgentChatState) -> _AgentChatState:
        result = await self._client.call_tool(
            "chat_answer",
            {
                "question": state["question"],
                "conversation": [turn.model_dump(mode="json") for turn in state.get("conversation", [])],
                "selected_ticker": state.get("selected_ticker"),
                "workspace_snapshot": (
                    state["workspace_snapshot"].model_dump(mode="json")
                    if state.get("workspace_snapshot") is not None
                    else None
                ),
            },
        )
        return {"result": result}
