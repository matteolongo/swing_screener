"""MCP protocol implementation for Swing Screener.

This module integrates the MCP SDK to expose tools through the
Model Context Protocol using stdio transport.
"""
from __future__ import annotations

import logging
from typing import Any

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp import types

from mcp_server.config import MCPConfig
from mcp_server.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class SwingScreenerMCP:
    """MCP server implementation for Swing Screener."""
    
    def __init__(self, config: MCPConfig, registry: ToolRegistry) -> None:
        """Initialize the MCP server.
        
        Args:
            config: MCP configuration
            registry: Tool registry with registered tools
        """
        self.config = config
        self.registry = registry
        
        # Create MCP Server instance
        self.server = Server(
            name=config.server.name,
            version=config.server.version,
            instructions=config.server.description
        )
        
        # Register MCP handlers
        self._register_handlers()
        
        logger.info(
            "MCP protocol server initialized: %d tools available",
            registry.tool_count()
        )
    
    def _register_handlers(self) -> None:
        """Register MCP protocol handlers."""
        
        @self.server.list_tools()
        async def list_tools() -> list[types.Tool]:
            """List all available tools.
            
            Returns:
                List of tool definitions in MCP format
            """
            tools = []
            for tool_def in self.registry.get_all_tools():
                tools.append(types.Tool(
                    name=tool_def.name,
                    description=tool_def.description,
                    inputSchema=tool_def.input_schema
                ))
            
            logger.debug("Listed %d tools", len(tools))
            return tools
        
        @self.server.call_tool()
        async def call_tool(
            name: str,
            arguments: dict[str, Any]
        ) -> list[types.TextContent]:
            """Execute a tool by name.
            
            Args:
                name: Tool name
                arguments: Tool input arguments
                
            Returns:
                Tool execution result as text content
            """
            logger.info("Executing tool: %s with args: %s", name, arguments)
            
            tool_def = self.registry.get_tool(name)
            if not tool_def:
                error_msg = f"Tool not found: {name}"
                logger.error(error_msg)
                return [types.TextContent(
                    type="text",
                    text=f"Error: {error_msg}"
                )]
            
            try:
                # Execute the tool
                result = await tool_def.handler(arguments)
                
                # Convert result to JSON string for text content
                import json
                result_text = json.dumps(result, indent=2, ensure_ascii=False)
                
                logger.info("Tool %s executed successfully", name)
                return [types.TextContent(
                    type="text",
                    text=result_text
                )]
                
            except Exception as e:
                error_msg = f"Tool execution failed: {str(e)}"
                logger.error("%s: %s", error_msg, name, exc_info=True)
                return [types.TextContent(
                    type="text",
                    text=f"Error: {error_msg}"
                )]
    
    async def run(self) -> None:
        """Run the MCP server with stdio transport.
        
        This method starts the server and handles requests via stdin/stdout.
        """
        logger.info("Starting MCP server with stdio transport")
        
        async with stdio_server() as (read_stream, write_stream):
            init_options = InitializationOptions(
                server_name=self.config.server.name,
                server_version=self.config.server.version,
                capabilities=self.server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={}
                )
            )
            
            await self.server.run(
                read_stream,
                write_stream,
                init_options
            )
