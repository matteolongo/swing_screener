"""Workspace chat router."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends

from api.dependencies import get_chat_service
from api.models.chat import ChatAnswerRequest, ChatAnswerResponse
from api.services.chat_service import ChatService

router = APIRouter()


@router.post("/answer", response_model=ChatAnswerResponse)
async def answer_chat(
    request: ChatAnswerRequest,
    service: ChatService = Depends(get_chat_service),
):
    return await asyncio.to_thread(service.answer, request)
