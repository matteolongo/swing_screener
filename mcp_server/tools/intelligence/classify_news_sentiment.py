"""Classify news sentiment tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import logger
from api.models.intelligence import LLMClassifyNewsRequest


class ClassifyNewsSentimentTool(BaseTool):
    """Use LLM to classify news sentiment and event importance."""
    
    @property
    def feature(self) -> str:
        return "intelligence"
    
    @property
    def name(self) -> str:
        return "classify_news_sentiment"
    
    @property
    def description(self) -> str:
        return (
            "Use LLM to classify news sentiment and assess event importance. "
            "Analyzes news headlines/text and returns structured classification "
            "(bullish/bearish/neutral, importance score, reasoning)."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol"
                },
                "news_text": {
                    "type": "string",
                    "description": "News headline or article text to classify"
                },
                "llm_provider": {
                    "type": "string",
                    "enum": ["ollama", "mock"],
                    "description": "LLM provider to use (default: ollama)"
                },
                "llm_model": {
                    "type": "string",
                    "description": "LLM model name (default: llama3.2:3b)"
                }
            },
            "required": ["ticker", "news_text"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute classify_news_sentiment tool.
        
        Args:
            arguments: Tool input with ticker, news text, and optional LLM config
            
        Returns:
            Dictionary with classification results
        """
        # Import here to avoid circular dependencies
        from api.routers.intelligence import classify_news
        
        try:
            request = LLMClassifyNewsRequest(
                ticker=arguments["ticker"],
                news_text=arguments["news_text"],
                llm_provider=arguments.get("llm_provider", "ollama"),
                llm_model=arguments.get("llm_model", "llama3.2:3b")
            )
            
            result = classify_news(request)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error classifying news: {e}")
            return {
                "error": str(e),
                "ticker": arguments.get("ticker"),
                "classification": None
            }
