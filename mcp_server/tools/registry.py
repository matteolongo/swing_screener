"""Tool registry for MCP server.

This module manages registration and lookup of MCP tools.
Tools are organized by feature domain and can be enabled/disabled
through configuration.
"""
from __future__ import annotations

import logging
from typing import Optional

from mcp_server.config import MCPConfig
from mcp_server.tools.base import BaseTool, ToolDefinition

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry for MCP tools.
    
    The registry manages tool registration and provides lookup by name.
    It also handles feature-based filtering according to configuration.
    """
    
    def __init__(self, config: MCPConfig) -> None:
        """Initialize the tool registry.
        
        Args:
            config: MCP configuration controlling which tools are enabled
        """
        self._config = config
        self._tools: dict[str, ToolDefinition] = {}
        self._tools_by_feature: dict[str, list[str]] = {}
    
    def register_tool(self, tool: BaseTool) -> None:
        """Register a tool in the registry.
        
        Args:
            tool: Tool instance to register
            
        Raises:
            ValueError: If tool with same name is already registered
        """
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered")
        
        # Check if tool's feature is enabled
        if not self._config.is_feature_enabled(tool.feature):
            logger.debug(
                "Skipping tool '%s' - feature '%s' is not enabled",
                tool.name,
                tool.feature
            )
            return
        
        # Check if specific tool is enabled within the feature
        if not self._config.is_tool_enabled(tool.feature, tool.name):
            logger.debug(
                "Skipping tool '%s' - not enabled in feature '%s' configuration",
                tool.name,
                tool.feature
            )
            return
        
        # Register the tool
        definition = tool.to_definition()
        self._tools[tool.name] = definition
        
        # Track by feature
        if tool.feature not in self._tools_by_feature:
            self._tools_by_feature[tool.feature] = []
        self._tools_by_feature[tool.feature].append(tool.name)
        
        logger.info(
            "Registered tool: %s (feature: %s)",
            tool.name,
            tool.feature
        )
    
    def register_tools(self, tools: list[BaseTool]) -> None:
        """Register multiple tools at once.
        
        Args:
            tools: List of tool instances to register
        """
        for tool in tools:
            try:
                self.register_tool(tool)
            except ValueError as e:
                logger.error("Failed to register tool: %s", e)
    
    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get a tool by name.
        
        Args:
            name: Tool name
            
        Returns:
            ToolDefinition if found, None otherwise
        """
        return self._tools.get(name)
    
    def get_all_tools(self) -> list[ToolDefinition]:
        """Get all registered tools.
        
        Returns:
            List of all registered tool definitions
        """
        return list(self._tools.values())
    
    def get_tools_by_feature(self, feature: str) -> list[ToolDefinition]:
        """Get all tools for a specific feature.
        
        Args:
            feature: Feature name
            
        Returns:
            List of tool definitions for the feature
        """
        tool_names = self._tools_by_feature.get(feature, [])
        return [self._tools[name] for name in tool_names]
    
    def get_enabled_features(self) -> list[str]:
        """Get list of features that have at least one registered tool.
        
        Returns:
            List of feature names with registered tools
        """
        return list(self._tools_by_feature.keys())
    
    def tool_count(self) -> int:
        """Get total number of registered tools.
        
        Returns:
            Number of registered tools
        """
        return len(self._tools)
    
    def is_registered(self, name: str) -> bool:
        """Check if a tool is registered.
        
        Args:
            name: Tool name
            
        Returns:
            True if tool is registered, False otherwise
        """
        return name in self._tools


def create_registry(config: MCPConfig) -> ToolRegistry:
    """Create a tool registry and register tools based on configuration.
    
    Args:
        config: MCP configuration
        
    Returns:
        Initialized ToolRegistry with registered tools
    """
    registry = ToolRegistry(config)
    
    # In Phase 1, we just create an empty registry
    # Future phases will import and register feature-specific tools here
    # Example for future phases:
    # if config.is_feature_enabled('portfolio'):
    #     from mcp_server.tools.portfolio import get_portfolio_tools
    #     registry.register_tools(get_portfolio_tools())
    
    logger.info(
        "Tool registry initialized: %d tools registered across %d features",
        registry.tool_count(),
        len(registry.get_enabled_features())
    )
    
    return registry
