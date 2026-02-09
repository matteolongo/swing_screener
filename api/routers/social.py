"""Social analysis router."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.models.social import SocialAnalysisRequest, SocialAnalysisResponse
from api.dependencies import get_social_service
from api.services.social_service import SocialService

router = APIRouter()


@router.post("/analyze", response_model=SocialAnalysisResponse)
def analyze(
    request: SocialAnalysisRequest,
    service: SocialService = Depends(get_social_service),
):
    return service.analyze(request)
