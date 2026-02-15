"""Base classes for MCP tools.

This module provides the base infrastructure for defining and registering
MCP tools that expose service layer functionality.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Optional


@dataclass
class ToolDefinition:
    """Defines an MCP tool with its metadata and handler.
    
    Attributes:
        name: Tool name (e.g., 'list_positions')
        description: Human-readable description of what the tool does
        feature: Feature domain this tool belongs to (e.g., 'portfolio')
        input_schema: JSON schema for tool input parameters
        handler: Callable that executes the tool logic
    """
    
    name: str
    description: str
    feature: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


class BaseTool(ABC):
    """Base class for MCP tools.
    
    Each tool wraps one or more service methods and exposes them
    through the MCP protocol.
    """
    
    @property
    @abstractmethod
    def feature(self) -> str:
        """Feature domain this tool belongs to (e.g., 'portfolio', 'screener')."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name (must be unique across all tools)."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of the tool."""
        pass
    
    @property
    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        """JSON schema defining the tool's input parameters."""
        pass
    
    @abstractmethod
    async def execute(self, arguments: dict[str, Any]) -> Any:
        """Execute the tool with given arguments.
        
        Args:
            arguments: Input parameters matching the input_schema
            
        Returns:
            Tool execution result (JSON-serializable)
            
        Raises:
            ValueError: If arguments are invalid
            Exception: If execution fails
        """
        pass
    
    def to_definition(self) -> ToolDefinition:
        """Convert this tool to a ToolDefinition.
        
        Returns:
            ToolDefinition with this tool's metadata and handler
        """
        return ToolDefinition(
            name=self.name,
            description=self.description,
            feature=self.feature,
            input_schema=self.input_schema,
            handler=self.execute,
        )
