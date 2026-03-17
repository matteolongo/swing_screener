"""Real stdio MCP client for the Swing Screener agent."""
from __future__ import annotations

import importlib
import json
import logging
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _default_server_command() -> list[str]:
    return [sys.executable, "-m", "mcp_server.main"]


class MCPClient:
    """Thin stdio MCP client used by workflows and the chat graph."""

    def __init__(self, server_command: Optional[list[str]] = None):
        self.server_command = list(server_command or _default_server_command())
        self._stack: AsyncExitStack | None = None
        self._session: Any | None = None
        self._local_registry: Any | None = None
        self._tools: dict[str, dict[str, Any]] = {}

    async def connect(self) -> None:
        if self._session is not None:
            return
        if not self.server_command:
            raise ValueError("server_command must include an executable")

        try:
            from mcp.client.session import ClientSession
            from mcp.client.stdio import StdioServerParameters, stdio_client
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "MCP SDK unavailable in the current interpreter; using local registry fallback: %s",
                exc,
            )
            self._connect_via_local_registry()
            return

        command, *args = self.server_command
        logger.info("Connecting agent via stdio MCP: %s", " ".join(self.server_command))

        stack = AsyncExitStack()
        try:
            read_stream, write_stream = await stack.enter_async_context(
                stdio_client(
                    StdioServerParameters(
                        command=command,
                        args=args,
                        cwd=str(_project_root()),
                    )
                )
            )
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()
            tools_result = await session.list_tools()
        except Exception:
            await stack.aclose()
            raise

        self._stack = stack
        self._session = session
        self._tools = {
            tool.name: {
                "description": tool.description,
                "input_schema": tool.inputSchema,
                "output_schema": getattr(tool, "outputSchema", None),
            }
            for tool in tools_result.tools
        }
        logger.info("Connected to MCP server with %d tools", len(self._tools))

    async def disconnect(self) -> None:
        if self._stack is None:
            self._session = None
            self._local_registry = None
            self._tools = {}
            return

        logger.info("Disconnecting stdio MCP client")
        stack = self._stack
        self._stack = None
        self._session = None
        self._local_registry = None
        self._tools = {}
        await stack.aclose()

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._session is None:
            raise RuntimeError("Client not connected. Call connect() first.")

        sanitized_arguments = {key: value for key, value in arguments.items() if value is not None}
        if self._local_registry is not None:
            tool = self._local_registry.get_tool(tool_name)
            if tool is None:
                raise RuntimeError(f"Tool not found: {tool_name}")
            try:
                result = await tool.handler(sanitized_arguments)
            except Exception as exc:
                raise RuntimeError(str(exc) or f"Tool execution failed: {tool_name}") from exc
            return self._normalize_local_result(tool_name, result)

        result = await self._session.call_tool(tool_name, sanitized_arguments)
        if result.structuredContent is not None:
            if result.isError:
                raise RuntimeError(json.dumps(result.structuredContent, ensure_ascii=False))
            return dict(result.structuredContent)

        text_payload = self._extract_text_payload(result.content)
        if result.isError or text_payload.startswith("Error: "):
            message = text_payload[7:] if text_payload.startswith("Error: ") else text_payload
            raise RuntimeError(message.strip() or f"Tool execution failed: {tool_name}")

        try:
            parsed = json.loads(text_payload)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Tool {tool_name} returned non-JSON text: {text_payload}") from exc

        if not isinstance(parsed, dict):
            raise RuntimeError(f"Tool {tool_name} returned unsupported payload type: {type(parsed).__name__}")
        if "error" in parsed and parsed.get("error"):
            raise RuntimeError(str(parsed["error"]))
        return parsed

    def get_available_tools(self) -> list[str]:
        return list(self._tools.keys())

    def get_tool_info(self, tool_name: str) -> Optional[dict[str, Any]]:
        tool = self._tools.get(tool_name)
        return dict(tool) if tool is not None else None

    @staticmethod
    def _extract_text_payload(content: list[Any]) -> str:
        text_parts: list[str] = []
        for item in content:
            if getattr(item, "type", None) == "text":
                text_parts.append(str(getattr(item, "text", "")))
        return "\n".join(part for part in text_parts if part).strip()

    def _connect_via_local_registry(self) -> None:
        module_name = self._extract_module_name()
        if module_name is None:
            raise RuntimeError(
                "The optional MCP dependency is required. Install with `uv sync --extra mcp` "
                "or `uv run --extra mcp ...`."
            )

        module = importlib.import_module(module_name)
        patch_dependencies = getattr(module, "_patch_dependencies", None)
        if callable(patch_dependencies):
            patch_dependencies()

        from mcp_server.config import load_config
        from mcp_server.tools.registry import create_registry

        registry = create_registry(load_config(self._extract_config_path()))
        self._session = object()
        self._local_registry = registry
        self._tools = {
            tool.name: {
                "description": tool.description,
                "input_schema": tool.input_schema,
                "output_schema": None,
            }
            for tool in registry.get_all_tools()
        }
        logger.info("Connected via local registry fallback with %d tools", len(self._tools))

    def _extract_module_name(self) -> str | None:
        try:
            module_flag_index = self.server_command.index("-m")
        except ValueError:
            return None
        if module_flag_index + 1 >= len(self.server_command):
            return None
        return self.server_command[module_flag_index + 1]

    def _extract_config_path(self) -> Path | None:
        try:
            config_flag_index = self.server_command.index("--config")
        except ValueError:
            return None
        if config_flag_index + 1 >= len(self.server_command):
            return None
        config_path = Path(self.server_command[config_flag_index + 1])
        if config_path.is_absolute():
            return config_path
        return _project_root() / config_path

    @staticmethod
    def _normalize_local_result(tool_name: str, result: Any) -> dict[str, Any]:
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        if isinstance(result, dict):
            return result
        raise RuntimeError(f"Tool {tool_name} returned unsupported payload type: {type(result).__name__}")
