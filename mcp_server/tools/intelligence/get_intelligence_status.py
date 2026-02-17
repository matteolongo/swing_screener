"""Get intelligence job status tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_svc, logger


class GetIntelligenceStatusTool(BaseTool):
    """Check the status of a running intelligence analysis job."""
    
    @property
    def feature(self) -> str:
        return "intelligence"
    
    @property
    def name(self) -> str:
        return "get_intelligence_status"
    
    @property
    def description(self) -> str:
        return (
            "Check the status of a running intelligence analysis job. "
            "Returns progress, completion status, and any errors."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "job_id": {
                    "type": "string",
                    "description": "The job ID returned by run_intelligence"
                }
            },
            "required": ["job_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_intelligence_status tool.
        
        Args:
            arguments: Tool input with job_id
            
        Returns:
            Dictionary with job status, progress, and results
        """
        service = get_intelligence_svc()
        job_id = arguments["job_id"]
        
        try:
            result = service.get_run_status(job_id)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error getting intelligence status for job {job_id}: {e}")
            return {
                "error": str(e),
                "job_id": job_id,
                "status": "error",
                "progress": 0,
                "total": 0
            }
