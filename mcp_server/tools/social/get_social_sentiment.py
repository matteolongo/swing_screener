"""Get social sentiment tool for MCP server.

This module provides the GetSocialSentimentTool for analyzing social sentiment
on a specific ticker.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.social._common import get_social_service, logger


class GetSocialSentimentTool(BaseTool):
    """Analyze social sentiment for a specific ticker."""
    
    @property
    def feature(self) -> str:
        return "social"
    
    @property
    def name(self) -> str:
        return "get_social_sentiment"
    
    @property
    def description(self) -> str:
        return ("Get social sentiment analysis for a ticker including sentiment score, "
                "confidence, attention metrics, and raw social events from Reddit and other sources.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., 'AAPL', 'TSLA')"
                },
                "lookback_hours": {
                    "type": "integer",
                    "description": "Number of hours to look back for social data",
                    "minimum": 1,
                    "default": 24
                },
                "provider": {
                    "type": "string",
                    "description": "Social data provider (e.g., 'reddit')",
                    "default": "reddit"
                },
                "max_events": {
                    "type": "integer",
                    "description": "Maximum number of raw events to return",
                    "minimum": 1,
                    "maximum": 500,
                    "default": 100
                }
            },
            "required": ["symbol"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_social_sentiment tool.
        
        Args:
            arguments: Tool input with symbol and optional parameters
            
        Returns:
            Social sentiment analysis with scores, confidence, and raw events
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
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error analyzing social sentiment: {e}")
            return {
                "error": str(e),
                "status": "error",
                "symbol": symbol.strip(),
                "provider": arguments.get("provider", "reddit"),
                "lookback_hours": arguments.get("lookback_hours", 24),
                "last_execution_at": None,
                "sample_size": 0,
                "attention_score": 0.0,
                "raw_events": [],
                "reasons": []
            }
