"""Run intelligence analysis tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_svc, logger
from api.models.intelligence import IntelligenceRunRequest


class RunIntelligenceTool(BaseTool):
    """Launch AI-powered intelligence analysis for trade discovery."""
    
    @property
    def feature(self) -> str:
        return "intelligence"
    
    @property
    def name(self) -> str:
        return "run_intelligence"
    
    @property
    def description(self) -> str:
        return (
            "Launch AI-powered intelligence analysis to discover potential trades. "
            "Analyzes news, events, and market signals for given tickers. "
            "Returns a job_id for tracking progress."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "tickers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of stock tickers to analyze (e.g., ['AAPL', 'MSFT'])"
                },
                "asof_date": {
                    "type": "string",
                    "description": "Date for analysis in YYYY-MM-DD format (defaults to today)"
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
            "required": ["tickers"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute run_intelligence tool.
        
        Args:
            arguments: Tool input with tickers and optional parameters
            
        Returns:
            Dictionary with job_id for tracking and status
        """
        service = get_intelligence_svc()
        
        try:
            request = IntelligenceRunRequest(
                tickers=arguments["tickers"],
                asof_date=arguments.get("asof_date"),
                llm_provider=arguments.get("llm_provider", "ollama"),
                llm_model=arguments.get("llm_model", "llama3.2:3b")
            )
            
            result = service.start_run(request)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error running intelligence: {e}")
            return {
                "error": str(e),
                "job_id": None,
                "status": "error"
            }
