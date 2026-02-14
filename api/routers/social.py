"""Social analysis router."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.models.social import SocialAnalysisRequest, SocialAnalysisResponse
from api.dependencies import get_social_service
from api.services.social_service import SocialService

router = APIRouter()


class SocialProvidersResponse(BaseModel):
    providers: list[str]
    analyzers: list[str]


@router.get("/providers", response_model=SocialProvidersResponse)
def list_providers():
    """List available social data providers and sentiment analyzers."""
    from swing_screener.social.sentiment.factory import list_available_analyzers
    
    return SocialProvidersResponse(
        providers=["reddit", "yahoo_finance"],
        analyzers=list_available_analyzers(),
    )


@router.post("/analyze", response_model=SocialAnalysisResponse)
def analyze(
    request: SocialAnalysisRequest,
    service: SocialService = Depends(get_social_service),
):
    return service.analyze(request)
