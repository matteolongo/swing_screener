"""API endpoints for market catalyst reports and symbol opportunities."""
from __future__ import annotations
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from swing_screener.intelligence.catalysts.generator import CatalystReportGenerator
from swing_screener.intelligence.catalysts.models import CatalystOpportunity, CatalystReport
from swing_screener.intelligence.catalysts.store import CatalystStore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/catalysts", tags=["catalysts"])


def _require_api_key() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")


class ManualCatalystRequest(BaseModel):
    url: str


@router.post("/manual", response_model=CatalystReport)
def generate_manual(request: ManualCatalystRequest) -> CatalystReport:
    """Generate a catalyst report from a specific news URL."""
    _require_api_key()
    try:
        return CatalystReportGenerator().generate_from_url(request.url)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/daily-scan", response_model=CatalystReport)
def daily_scan() -> CatalystReport:
    """Generate a catalyst report by searching recent market news."""
    _require_api_key()
    try:
        return CatalystReportGenerator().generate_from_web_search()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/latest", response_model=CatalystReport)
def get_latest() -> CatalystReport:
    """Return the most recently generated catalyst report, or 404."""
    store = CatalystStore()
    report = store.load_latest_report()
    if report is None:
        raise HTTPException(status_code=404, detail="No catalyst report available")
    return report


@router.get("/symbol/{ticker}", response_model=CatalystOpportunity)
def get_symbol_opportunity(ticker: str) -> CatalystOpportunity:
    """Return today's catalyst opportunity for a symbol, or 404."""
    store = CatalystStore()
    opp = store.load_symbol_opportunity(ticker.upper())
    if opp is None:
        raise HTTPException(status_code=404, detail=f"No catalyst opportunity for {ticker} today")
    return opp
