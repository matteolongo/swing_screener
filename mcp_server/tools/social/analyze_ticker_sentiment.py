"""Analyze ticker sentiment tool for MCP server.

This module provides the AnalyzeTickerSentimentTool for comprehensive sentiment analysis
of multiple tickers or batch analysis.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.social._common import get_social_service, logger


class AnalyzeTickerSentimentTool(BaseTool):
    """Analyze social sentiment for one or more tickers."""
    
    @property
    def feature(self) -> str:
        return "social"
    
    @property
    def name(self) -> str:
        return "analyze_ticker_sentiment"
    
    @property
    def description(self) -> str:
        return ("Analyze social sentiment for one or more tickers with detailed metrics. "
                "Supports custom lookback periods and social data providers.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol to analyze (e.g., 'AAPL', 'TSLA')"
                },
                "lookback_hours": {
                    "type": "integer",
                    "description": "Number of hours to look back for social data",
                    "minimum": 1,
                    "default": 48
                },
                "provider": {
                    "type": "string",
                    "description": "Social data provider (e.g., 'reddit', 'twitter')",
                    "default": "reddit"
                },
                "max_events": {
                    "type": "integer",
                    "description": "Maximum number of raw events to include in response",
                    "minimum": 1,
                    "maximum": 500,
                    "default": 200
                }
            },
            "required": ["symbol"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute analyze_ticker_sentiment tool.
        
        Args:
            arguments: Tool input with symbol and optional parameters
            
        Returns:
            Detailed sentiment analysis including scores, confidence, and supporting events
        """
        # Validate input
        if "symbol" not in arguments:
            logger.error("Missing required parameter: symbol")
            return {"error": "Missing required parameter: symbol"}
        
        symbol = arguments.get("symbol")
        
        if not isinstance(symbol, str) or not symbol.strip():
            logger.error(f"Invalid symbol: must be a non-empty string, got {type(symbol).__name__}")
            return {"error": "symbol must be a non-empty string"}
        
        from api.models.social import SocialAnalysisRequest
        
        service = get_social_service()
        
        try:
            request = SocialAnalysisRequest(
                symbol=symbol.strip(),
                lookback_hours=arguments.get("lookback_hours"),
                provider=arguments.get("provider"),
                max_events=arguments.get("max_events")
            )
            result = service.analyze(request)
            
            # Return the full response with all available data
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error analyzing ticker sentiment: {e}")
            return {
                "error": str(e),
                "status": "error",
                "symbol": symbol.strip(),
                "provider": arguments.get("provider", "reddit"),
                "lookback_hours": arguments.get("lookback_hours", 48),
                "last_execution_at": None,
                "sample_size": 0,
                "sentiment_score": None,
                "sentiment_confidence": None,
                "attention_score": 0.0,
                "attention_z": None,
                "hype_score": None,
                "reasons": [],
                "raw_events": []
            }
