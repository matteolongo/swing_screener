from __future__ import annotations

import asyncio

import api.services.agent_runtime as agent_runtime_module
from api.models.chat import ChatAnswerRequest
from api.services.agent_runtime import AgentRuntime


class FakeAgent:
    instances: list["FakeAgent"] = []

    def __init__(self, server_command=None):
        self.server_command = server_command
        self.started = 0
        self.stopped = 0
        self.questions: list[str] = []
        FakeAgent.instances.append(self)

    async def start(self) -> None:
        self.started += 1

    async def stop(self) -> None:
        self.stopped += 1

    async def ask(
        self,
        question: str,
        *,
        conversation=None,
        selected_ticker=None,
        workspace_snapshot=None,
    ) -> dict:
        self.questions.append(question)
        return {
            "answer": f"Echo: {question}",
            "warnings": [],
            "facts_used": [],
            "context_meta": {
                "selected_ticker": selected_ticker,
                "sources": [],
            },
            "conversation_state": [],
        }


def test_agent_runtime_reuses_single_agent_instance(monkeypatch):
    FakeAgent.instances.clear()
    monkeypatch.setattr(agent_runtime_module, "SwingScreenerAgent", FakeAgent)

    runtime = AgentRuntime()

    first = asyncio.run(runtime.answer(ChatAnswerRequest(question="First")))
    second = asyncio.run(runtime.answer(ChatAnswerRequest(question="Second")))
    asyncio.run(runtime.shutdown())

    assert first.answer == "Echo: First"
    assert second.answer == "Echo: Second"
    assert len(FakeAgent.instances) == 1
    assert FakeAgent.instances[0].started == 1
    assert FakeAgent.instances[0].questions == ["First", "Second"]
    assert FakeAgent.instances[0].stopped == 1
