"""Workspace chat router."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.dependencies import get_agent_chat_service
from api.models.chat import ChatAnswerRequest, ChatAnswerResponse
from api.services.agent_chat_service import AgentChatService

router = APIRouter()


@router.post("/answer", response_model=ChatAnswerResponse)
async def answer_chat(
    request: ChatAnswerRequest,
    service: AgentChatService = Depends(get_agent_chat_service),
):
    return await service.answer(request)
