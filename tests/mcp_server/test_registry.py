"""Tests for MCP server tool registry."""
from __future__ import annotations

from typing import Any

import pytest

from mcp_server.config import MCPConfig, FeatureConfig
from mcp_server.tools.base import BaseTool, ToolDefinition
from mcp_server.tools.registry import ToolRegistry, create_registry


class DummyTool(BaseTool):
    """Dummy tool for testing."""
    
    def __init__(self, feature: str, name: str, description: str = "Test tool"):
        self._feature = feature
        self._name = name
        self._description = description
    
    @property
    def feature(self) -> str:
        return self._feature
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    async def execute(self, arguments: dict[str, Any]) -> Any:
        return {"status": "ok"}


@pytest.fixture
def empty_config() -> MCPConfig:
    """Configuration with all features disabled."""
    return MCPConfig(features={})


@pytest.fixture
def enabled_portfolio_config() -> MCPConfig:
    """Configuration with portfolio feature enabled."""
    return MCPConfig(
        features={
            "portfolio": FeatureConfig(
                enabled=True,
                tools=["list_positions", "get_position"]
            )
        }
    )


@pytest.fixture
def mixed_config() -> MCPConfig:
    """Configuration with some features enabled."""
    return MCPConfig(
        features={
            "portfolio": FeatureConfig(
                enabled=True,
                tools=["list_positions", "get_position"]
            ),
            "screener": FeatureConfig(
                enabled=False,
                tools=["run_screener"]
            )
        }
    )


class TestBaseTool:
    """Tests for BaseTool interface."""
    
    def test_dummy_tool_properties(self):
        """Test dummy tool has correct properties."""
        tool = DummyTool(feature="test", name="test_tool")
        
        assert tool.feature == "test"
        assert tool.name == "test_tool"
        assert tool.description == "Test tool"
        assert isinstance(tool.input_schema, dict)
    
    def test_to_definition(self):
        """Test converting tool to definition."""
        tool = DummyTool(feature="test", name="test_tool", description="A test")
        definition = tool.to_definition()
        
        assert isinstance(definition, ToolDefinition)
        assert definition.name == "test_tool"
        assert definition.description == "A test"
        assert definition.feature == "test"
        assert definition.handler == tool.execute


class TestToolRegistry:
    """Tests for ToolRegistry."""
    
    def test_init_empty(self, empty_config: MCPConfig):
        """Test initializing empty registry."""
        registry = ToolRegistry(empty_config)
        
        assert registry.tool_count() == 0
        assert registry.get_enabled_features() == []
    
    def test_register_tool_disabled_feature(self, empty_config: MCPConfig):
        """Test registering tool for disabled feature."""
        registry = ToolRegistry(empty_config)
        tool = DummyTool(feature="portfolio", name="list_positions")
        
        # Should not register since feature is disabled
        registry.register_tool(tool)
        
        assert registry.tool_count() == 0
        assert not registry.is_registered("list_positions")
    
    def test_register_tool_enabled_feature(self, enabled_portfolio_config: MCPConfig):
        """Test registering tool for enabled feature."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool = DummyTool(feature="portfolio", name="list_positions")
        
        registry.register_tool(tool)
        
        assert registry.tool_count() == 1
        assert registry.is_registered("list_positions")
    
    def test_register_tool_not_in_config_tools(self, enabled_portfolio_config: MCPConfig):
        """Test registering tool not listed in feature's tools."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool = DummyTool(feature="portfolio", name="unlisted_tool")
        
        # Should not register since tool not in config
        registry.register_tool(tool)
        
        assert registry.tool_count() == 0
        assert not registry.is_registered("unlisted_tool")
    
    def test_register_duplicate_tool(self, enabled_portfolio_config: MCPConfig):
        """Test registering duplicate tool name."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool1 = DummyTool(feature="portfolio", name="list_positions")
        tool2 = DummyTool(feature="portfolio", name="list_positions")
        
        registry.register_tool(tool1)
        
        with pytest.raises(ValueError, match="already registered"):
            registry.register_tool(tool2)
    
    def test_register_multiple_tools(self, enabled_portfolio_config: MCPConfig):
        """Test registering multiple tools."""
        registry = ToolRegistry(enabled_portfolio_config)
        tools = [
            DummyTool(feature="portfolio", name="list_positions"),
            DummyTool(feature="portfolio", name="get_position"),
        ]
        
        registry.register_tools(tools)
        
        assert registry.tool_count() == 2
        assert registry.is_registered("list_positions")
        assert registry.is_registered("get_position")
    
    def test_get_tool(self, enabled_portfolio_config: MCPConfig):
        """Test getting tool by name."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool = DummyTool(feature="portfolio", name="list_positions")
        registry.register_tool(tool)
        
        retrieved = registry.get_tool("list_positions")
        assert retrieved is not None
        assert retrieved.name == "list_positions"
        
        not_found = registry.get_tool("nonexistent")
        assert not_found is None
    
    def test_get_all_tools(self, enabled_portfolio_config: MCPConfig):
        """Test getting all registered tools."""
        registry = ToolRegistry(enabled_portfolio_config)
        tools = [
            DummyTool(feature="portfolio", name="list_positions"),
            DummyTool(feature="portfolio", name="get_position"),
        ]
        registry.register_tools(tools)
        
        all_tools = registry.get_all_tools()
        assert len(all_tools) == 2
        assert all(isinstance(t, ToolDefinition) for t in all_tools)
    
    def test_get_tools_by_feature(self, mixed_config: MCPConfig):
        """Test getting tools by feature."""
        registry = ToolRegistry(mixed_config)
        tools = [
            DummyTool(feature="portfolio", name="list_positions"),
            DummyTool(feature="portfolio", name="get_position"),
        ]
        registry.register_tools(tools)
        
        portfolio_tools = registry.get_tools_by_feature("portfolio")
        assert len(portfolio_tools) == 2
        
        screener_tools = registry.get_tools_by_feature("screener")
        assert len(screener_tools) == 0
        
        nonexistent_tools = registry.get_tools_by_feature("nonexistent")
        assert len(nonexistent_tools) == 0
    
    def test_get_enabled_features(self, enabled_portfolio_config: MCPConfig):
        """Test getting enabled features with registered tools."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool = DummyTool(feature="portfolio", name="list_positions")
        registry.register_tool(tool)
        
        features = registry.get_enabled_features()
        assert "portfolio" in features
    
    def test_is_registered(self, enabled_portfolio_config: MCPConfig):
        """Test checking if tool is registered."""
        registry = ToolRegistry(enabled_portfolio_config)
        tool = DummyTool(feature="portfolio", name="list_positions")
        
        assert not registry.is_registered("list_positions")
        
        registry.register_tool(tool)
        
        assert registry.is_registered("list_positions")
        assert not registry.is_registered("nonexistent")


class TestCreateRegistry:
    """Tests for create_registry function."""
    
    def test_create_empty_registry(self, empty_config: MCPConfig):
        """Test creating registry with no enabled features."""
        registry = create_registry(empty_config)
        
        assert isinstance(registry, ToolRegistry)
        assert registry.tool_count() == 0
    
    def test_create_registry_with_config(self, enabled_portfolio_config: MCPConfig):
        """Test creating registry with configuration."""
        registry = create_registry(enabled_portfolio_config)
        
        assert isinstance(registry, ToolRegistry)
        # Phase 1: No tools are auto-registered yet
        assert registry.tool_count() == 0
