from __future__ import annotations

import asyncio

import api.services.agent_runtime as agent_runtime_module
from api.models.chat import ChatAnswerRequest
from api.services.agent_runtime import AgentRuntime


class FakeAgent:
    instances: list["FakeAgent"] = []

    def __init__(self):
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


class FlakyAgent(FakeAgent):
    def __init__(self):
        super().__init__()
        self.fail_once = len(FlakyAgent.instances) == 1

    async def ask(
        self,
        question: str,
        *,
        conversation=None,
        selected_ticker=None,
        workspace_snapshot=None,
    ) -> dict:
        self.questions.append(question)
        if self.fail_once:
            self.fail_once = False
            raise RuntimeError("broken mcp session")
        return await super().ask(
            question,
            conversation=conversation,
            selected_ticker=selected_ticker,
            workspace_snapshot=workspace_snapshot,
        )


def test_agent_runtime_restarts_once_after_failed_chat_call(monkeypatch):
    FlakyAgent.instances.clear()
    monkeypatch.setattr(agent_runtime_module, "SwingScreenerAgent", FlakyAgent)

    runtime = AgentRuntime()

    response = asyncio.run(runtime.answer(ChatAnswerRequest(question="Recover me")))
    snapshot = asyncio.run(runtime.snapshot())
    asyncio.run(runtime.shutdown())

    assert response.answer == "Echo: Recover me"
    assert len(FlakyAgent.instances) == 2
    assert FlakyAgent.instances[0].stopped == 1
    assert FlakyAgent.instances[1].started == 1
    assert snapshot == {
        "status": "ready",
        "running": True,
        "restart_count": 1,
        "last_error": None,
    }


class BrokenAgent(FakeAgent):
    async def ask(
        self,
        question: str,
        *,
        conversation=None,
        selected_ticker=None,
        workspace_snapshot=None,
    ) -> dict:
        self.questions.append(question)
        raise RuntimeError("still broken")


def test_agent_runtime_stops_after_retry_failure(monkeypatch):
    BrokenAgent.instances.clear()
    monkeypatch.setattr(agent_runtime_module, "SwingScreenerAgent", BrokenAgent)

    runtime = AgentRuntime()

    try:
        asyncio.run(runtime.answer(ChatAnswerRequest(question="Fail twice")))
    except RuntimeError as exc:
        assert str(exc) == "still broken"
    else:  # pragma: no cover
        raise AssertionError("Expected runtime to re-raise after retry failure")

    snapshot = asyncio.run(runtime.snapshot())

    assert len(BrokenAgent.instances) == 2
    assert BrokenAgent.instances[0].stopped == 1
    assert BrokenAgent.instances[1].stopped == 1
    assert snapshot == {
        "status": "error",
        "running": False,
        "restart_count": 1,
        "last_error": "RuntimeError: still broken",
    }
