"""MCP Server Configuration Management.

This module handles loading and validation of the MCP server configuration
from YAML files. Configuration controls which features and tools are enabled.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)


@dataclass
class ServerConfig:
    """Server metadata configuration."""
    
    name: str = "swing-screener-mcp"
    version: str = "0.1.0"
    description: str = "Model Context Protocol server for Swing Screener"


@dataclass
class FeatureConfig:
    """Configuration for a single feature domain."""
    
    enabled: bool = False
    tools: list[str] = field(default_factory=list)


@dataclass
class LoggingConfig:
    """Logging configuration."""
    
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


@dataclass
class RateLimitConfig:
    """Rate limiting configuration."""
    
    enabled: bool = False
    requests_per_minute: int = 60


@dataclass
class MCPConfig:
    """Main MCP server configuration.
    
    This class loads and validates configuration from YAML files.
    It provides methods to check if features and individual tools are enabled.
    """
    
    server: ServerConfig = field(default_factory=ServerConfig)
    environment: str = "dev"
    features: dict[str, FeatureConfig] = field(default_factory=dict)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    rate_limiting: RateLimitConfig = field(default_factory=RateLimitConfig)
    
    @classmethod
    def from_yaml(cls, config_path: Path) -> MCPConfig:
        """Load configuration from a YAML file.
        
        Args:
            config_path: Path to the YAML configuration file
            
        Returns:
            MCPConfig instance with loaded configuration
            
        Raises:
            FileNotFoundError: If config file doesn't exist
            yaml.YAMLError: If YAML parsing fails
            ValueError: If configuration is invalid
        """
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        logger.info("Loading MCP configuration from: %s", config_path)
        
        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        if not isinstance(data, dict):
            raise ValueError("Configuration file must contain a YAML dictionary")
        
        # Parse server config
        server_data = data.get("server", {})
        server = ServerConfig(
            name=server_data.get("name", "swing-screener-mcp"),
            version=server_data.get("version", "0.1.0"),
            description=server_data.get("description", ""),
        )
        
        # Parse environment
        environment = data.get("environment", "dev")
        if environment not in ["dev", "staging", "prod"]:
            logger.warning("Invalid environment '%s', defaulting to 'dev'", environment)
            environment = "dev"
        
        # Parse feature configs
        features_data = data.get("features", {})
        features = {}
        for feature_name, feature_data in features_data.items():
            if not isinstance(feature_data, dict):
                logger.warning("Invalid feature config for '%s', skipping", feature_name)
                continue
            
            features[feature_name] = FeatureConfig(
                enabled=bool(feature_data.get("enabled", False)),
                tools=feature_data.get("tools", [])
            )
        
        # Parse logging config
        logging_data = data.get("logging", {})
        logging_config = LoggingConfig(
            level=logging_data.get("level", "INFO"),
            format=logging_data.get("format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        
        # Parse rate limiting config
        rate_limit_data = data.get("rate_limiting", {})
        rate_limiting = RateLimitConfig(
            enabled=bool(rate_limit_data.get("enabled", False)),
            requests_per_minute=int(rate_limit_data.get("requests_per_minute", 60))
        )
        
        config = cls(
            server=server,
            environment=environment,
            features=features,
            logging=logging_config,
            rate_limiting=rate_limiting,
        )
        
        logger.info(
            "Configuration loaded: environment=%s, features=%s",
            config.environment,
            list(config.features.keys())
        )
        
        return config
    
    def is_feature_enabled(self, feature_name: str) -> bool:
        """Check if a feature domain is enabled.
        
        Args:
            feature_name: Name of the feature (e.g., 'portfolio', 'screener')
            
        Returns:
            True if feature is enabled, False otherwise
        """
        feature = self.features.get(feature_name)
        return feature.enabled if feature else False
    
    def is_tool_enabled(self, feature_name: str, tool_name: str) -> bool:
        """Check if a specific tool within a feature is enabled.
        
        Args:
            feature_name: Name of the feature domain
            tool_name: Name of the tool
            
        Returns:
            True if both feature and tool are enabled, False otherwise
        """
        if not self.is_feature_enabled(feature_name):
            return False
        
        feature = self.features.get(feature_name)
        if not feature:
            return False
        
        return tool_name in feature.tools
    
    def get_enabled_features(self) -> list[str]:
        """Get list of all enabled feature names.
        
        Returns:
            List of enabled feature names
        """
        return [
            name for name, config in self.features.items()
            if config.enabled
        ]
    
    def get_enabled_tools(self, feature_name: str) -> list[str]:
        """Get list of enabled tools for a feature.
        
        Args:
            feature_name: Name of the feature domain
            
        Returns:
            List of enabled tool names for the feature
        """
        if not self.is_feature_enabled(feature_name):
            return []
        
        feature = self.features.get(feature_name)
        return feature.tools if feature else []
    
    def validate(self) -> list[str]:
        """Validate the configuration.
        
        Returns:
            List of validation warnings (empty if valid)
        """
        warnings = []
        
        # Check for valid log level
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.logging.level.upper() not in valid_levels:
            warnings.append(
                f"Invalid log level '{self.logging.level}', "
                f"should be one of {valid_levels}"
            )
        
        # Check for at least one enabled feature in non-dev environments
        if self.environment != "dev" and not self.get_enabled_features():
            warnings.append(
                f"No features enabled in {self.environment} environment"
            )
        
        # Check rate limiting is reasonable
        if self.rate_limiting.enabled:
            if self.rate_limiting.requests_per_minute < 1:
                warnings.append(
                    "Rate limiting requests_per_minute must be >= 1"
                )
            elif self.rate_limiting.requests_per_minute > 1000:
                warnings.append(
                    "Rate limiting requests_per_minute > 1000 may be too high"
                )
        
        return warnings


def load_config(config_path: Optional[Path] = None) -> MCPConfig:
    """Load MCP configuration from file or use default path.
    
    Args:
        config_path: Optional path to config file. If None, uses default location.
        
    Returns:
        Loaded MCPConfig instance
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If configuration is invalid
    """
    if config_path is None:
        # Default to config/mcp_features.yaml relative to project root
        default_path = Path(__file__).parent.parent / "config" / "mcp_features.yaml"
        config_path = default_path
    
    return MCPConfig.from_yaml(config_path)
