"""API endpoint for on-demand symbol intelligence analysis."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(ticker: str, request: SymbolIntelligenceRequest) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol."""
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")
    try:
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(ticker.upper(), request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
