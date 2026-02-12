"""Tests for MCP server configuration system."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure mcp_server is importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import tempfile
from textwrap import dedent

import pytest

from mcp_server.config import (
    MCPConfig,
    ServerConfig,
    FeatureConfig,
    LoggingConfig,
    RateLimitConfig,
    load_config,
)


@pytest.fixture
def valid_config_yaml() -> str:
    """Sample valid configuration YAML."""
    return dedent("""
        server:
          name: "test-mcp-server"
          version: "0.1.0"
          description: "Test MCP server"
        
        environment: "dev"
        
        features:
          portfolio:
            enabled: true
            tools:
              - list_positions
              - get_position
          
          screener:
            enabled: false
            tools:
              - run_screener
        
        logging:
          level: "DEBUG"
          format: "%(message)s"
        
        rate_limiting:
          enabled: false
          requests_per_minute: 60
    """)


@pytest.fixture
def config_file(valid_config_yaml: str) -> Path:
    """Create a temporary config file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(valid_config_yaml)
        path = Path(f.name)
    
    yield path
    
    # Cleanup
    if path.exists():
        path.unlink()


class TestServerConfig:
    """Tests for ServerConfig dataclass."""
    
    def test_default_values(self):
        """Test default server configuration values."""
        config = ServerConfig()
        assert config.name == "swing-screener-mcp"
        assert config.version == "0.1.0"
        assert config.description == "Model Context Protocol server for Swing Screener"
    
    def test_custom_values(self):
        """Test custom server configuration values."""
        config = ServerConfig(
            name="custom-server",
            version="1.0.0",
            description="Custom description"
        )
        assert config.name == "custom-server"
        assert config.version == "1.0.0"
        assert config.description == "Custom description"


class TestFeatureConfig:
    """Tests for FeatureConfig dataclass."""
    
    def test_default_values(self):
        """Test default feature configuration values."""
        config = FeatureConfig()
        assert config.enabled is False
        assert config.tools == []
    
    def test_enabled_with_tools(self):
        """Test enabled feature with tools."""
        config = FeatureConfig(
            enabled=True,
            tools=["tool1", "tool2"]
        )
        assert config.enabled is True
        assert config.tools == ["tool1", "tool2"]


class TestMCPConfig:
    """Tests for MCPConfig class."""
    
    def test_from_yaml_valid(self, config_file: Path):
        """Test loading valid YAML configuration."""
        config = MCPConfig.from_yaml(config_file)
        
        assert config.server.name == "test-mcp-server"
        assert config.server.version == "0.1.0"
        assert config.environment == "dev"
        
        # Check features
        assert "portfolio" in config.features
        assert config.features["portfolio"].enabled is True
        assert "list_positions" in config.features["portfolio"].tools
        
        assert "screener" in config.features
        assert config.features["screener"].enabled is False
        
        # Check logging
        assert config.logging.level == "DEBUG"
        assert config.logging.format == "%(message)s"
        
        # Check rate limiting
        assert config.rate_limiting.enabled is False
        assert config.rate_limiting.requests_per_minute == 60
    
    def test_from_yaml_missing_file(self):
        """Test loading from non-existent file."""
        with pytest.raises(FileNotFoundError):
            MCPConfig.from_yaml(Path("/nonexistent/config.yaml"))
    
    def test_from_yaml_invalid_yaml(self):
        """Test loading invalid YAML."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write("invalid: yaml: content:")
            path = Path(f.name)
        
        try:
            with pytest.raises(Exception):  # yaml.YAMLError or similar
                MCPConfig.from_yaml(path)
        finally:
            path.unlink()
    
    def test_from_yaml_not_dict(self):
        """Test loading YAML that's not a dictionary."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write("- list\n- of\n- items")
            path = Path(f.name)
        
        try:
            with pytest.raises(ValueError, match="must contain a YAML dictionary"):
                MCPConfig.from_yaml(path)
        finally:
            path.unlink()
    
    def test_is_feature_enabled(self, config_file: Path):
        """Test checking if feature is enabled."""
        config = MCPConfig.from_yaml(config_file)
        
        assert config.is_feature_enabled("portfolio") is True
        assert config.is_feature_enabled("screener") is False
        assert config.is_feature_enabled("nonexistent") is False
    
    def test_is_tool_enabled(self, config_file: Path):
        """Test checking if tool is enabled."""
        config = MCPConfig.from_yaml(config_file)
        
        # Enabled feature, enabled tool
        assert config.is_tool_enabled("portfolio", "list_positions") is True
        
        # Enabled feature, non-existent tool
        assert config.is_tool_enabled("portfolio", "nonexistent_tool") is False
        
        # Disabled feature, any tool
        assert config.is_tool_enabled("screener", "run_screener") is False
        
        # Non-existent feature
        assert config.is_tool_enabled("nonexistent", "tool") is False
    
    def test_get_enabled_features(self, config_file: Path):
        """Test getting list of enabled features."""
        config = MCPConfig.from_yaml(config_file)
        
        enabled = config.get_enabled_features()
        assert "portfolio" in enabled
        assert "screener" not in enabled
    
    def test_get_enabled_tools(self, config_file: Path):
        """Test getting enabled tools for a feature."""
        config = MCPConfig.from_yaml(config_file)
        
        # Enabled feature
        tools = config.get_enabled_tools("portfolio")
        assert "list_positions" in tools
        assert "get_position" in tools
        
        # Disabled feature
        tools = config.get_enabled_tools("screener")
        assert tools == []
        
        # Non-existent feature
        tools = config.get_enabled_tools("nonexistent")
        assert tools == []
    
    def test_validate_valid_config(self, config_file: Path):
        """Test validation of valid configuration."""
        config = MCPConfig.from_yaml(config_file)
        warnings = config.validate()
        
        # Should have no warnings for valid config
        assert isinstance(warnings, list)
    
    def test_validate_invalid_log_level(self):
        """Test validation with invalid log level."""
        config = MCPConfig(
            logging=LoggingConfig(level="INVALID")
        )
        warnings = config.validate()
        
        assert any("Invalid log level" in w for w in warnings)
    
    def test_validate_no_features_in_prod(self):
        """Test validation warns when no features enabled in prod."""
        config = MCPConfig(
            environment="prod",
            features={}
        )
        warnings = config.validate()
        
        assert any("No features enabled" in w for w in warnings)
    
    def test_validate_rate_limit_too_low(self):
        """Test validation warns on invalid rate limit."""
        config = MCPConfig(
            rate_limiting=RateLimitConfig(enabled=True, requests_per_minute=0)
        )
        warnings = config.validate()
        
        assert any("requests_per_minute must be >= 1" in w for w in warnings)
    
    def test_validate_rate_limit_too_high(self):
        """Test validation warns on very high rate limit."""
        config = MCPConfig(
            rate_limiting=RateLimitConfig(enabled=True, requests_per_minute=5000)
        )
        warnings = config.validate()
        
        assert any("too high" in w for w in warnings)
    
    def test_environment_validation(self):
        """Test environment validation defaults to 'dev'."""
        yaml_content = "environment: 'invalid_env'\nfeatures: {}"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(yaml_content)
            path = Path(f.name)
        
        try:
            config = MCPConfig.from_yaml(path)
            # Should default to 'dev' and log warning
            assert config.environment == "dev"
        finally:
            path.unlink()


class TestLoadConfig:
    """Tests for load_config function."""
    
    def test_load_config_with_path(self, config_file: Path):
        """Test loading config with explicit path."""
        config = load_config(config_file)
        assert config.server.name == "test-mcp-server"
    
    def test_load_config_default_path(self):
        """Test loading config with default path."""
        # This should try to load from config/mcp_features.yaml
        # which should exist in the repo
        config = load_config()
        assert isinstance(config, MCPConfig)
        assert config.server.name == "swing-screener-mcp"
