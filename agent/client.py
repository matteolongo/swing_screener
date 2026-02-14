"""MCP Client for connecting to the Swing Screener MCP server.

This module provides a client that connects to the MCP server via stdio
transport and handles tool execution.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional
from pathlib import Path
import subprocess

logger = logging.getLogger(__name__)


class MCPClient:
    """MCP Client for connecting to Swing Screener MCP server.
    
    This client communicates with the MCP server running in a subprocess
    using stdio transport (stdin/stdout communication).
    """
    
    def __init__(self, server_command: Optional[list[str]] = None):
        """Initialize the MCP client.
        
        Args:
            server_command: Command to start the MCP server.
                           Defaults to ["python", "-m", "mcp_server.main"]
        """
        self.server_command = server_command or ["python", "-m", "mcp_server.main"]
        self.process: Optional[subprocess.Popen] = None
        self.tools: dict[str, dict] = {}
        
    async def connect(self) -> None:
        """Connect to the MCP server.
        
        Starts the MCP server as a subprocess and initializes communication.
        """
        logger.info("Starting MCP server: %s", " ".join(self.server_command))
        
        # Start the server process
        self.process = subprocess.Popen(
            self.server_command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        
        # Initialize MCP protocol
        await self._initialize_protocol()
        
        # List available tools
        await self._list_tools()
        
        logger.info("Connected to MCP server with %d tools", len(self.tools))
    
    async def _initialize_protocol(self) -> None:
        """Initialize the MCP protocol with the server."""
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "swing-screener-agent",
                    "version": "0.1.0"
                }
            }
        }
        
        await self._send_request(init_request)
        
        # Send initialized notification
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        
        if self.process and self.process.stdin:
            self.process.stdin.write(json.dumps(initialized_notification) + "\n")
            self.process.stdin.flush()
    
    async def _list_tools(self) -> None:
        """List available tools from the server."""
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        response = await self._send_request(request)
        
        if "result" in response and "tools" in response["result"]:
            for tool in response["result"]["tools"]:
                self.tools[tool["name"]] = {
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema", {})
                }
    
    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Call a tool on the MCP server.
        
        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments
            
        Returns:
            Tool execution result
            
        Raises:
            ValueError: If tool is not found
            RuntimeError: If tool execution fails
        """
        if tool_name not in self.tools:
            raise ValueError(f"Tool not found: {tool_name}")
        
        logger.debug("Calling tool: %s with args: %s", tool_name, arguments)
        
        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        response = await self._send_request(request)
        
        if "error" in response:
            error_msg = response["error"].get("message", "Unknown error")
            raise RuntimeError(f"Tool execution failed: {error_msg}")
        
        # Extract result from MCP response
        if "result" in response and "content" in response["result"]:
            content = response["result"]["content"]
            if content and len(content) > 0:
                # Parse JSON from text content
                text = content[0].get("text", "{}")
                return json.loads(text)
        
        return {}
    
    async def _send_request(self, request: dict) -> dict:
        """Send a JSON-RPC request to the server.
        
        Args:
            request: JSON-RPC request object
            
        Returns:
            JSON-RPC response object
        """
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise RuntimeError("Not connected to MCP server")
        
        # Send request
        request_str = json.dumps(request) + "\n"
        self.process.stdin.write(request_str)
        self.process.stdin.flush()
        
        # Read response
        response_str = self.process.stdout.readline()
        if not response_str:
            raise RuntimeError("No response from server")
        
        return json.loads(response_str)
    
    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        if self.process:
            logger.info("Disconnecting from MCP server")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
    
    def get_available_tools(self) -> list[str]:
        """Get list of available tool names.
        
        Returns:
            List of tool names
        """
        return list(self.tools.keys())
    
    def get_tool_info(self, tool_name: str) -> Optional[dict]:
        """Get information about a specific tool.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            Tool information including description and schema, or None if not found
        """
        return self.tools.get(tool_name)
