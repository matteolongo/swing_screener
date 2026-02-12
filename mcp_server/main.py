"""MCP Server main entrypoint.

This module provides the main server implementation for the Model Context Protocol (MCP)
server. It handles server initialization, configuration loading, and request routing.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from mcp_server.config import load_config, MCPConfig
from mcp_server.tools import create_registry

# Configure logging
logger = logging.getLogger(__name__)


def setup_logging(config: MCPConfig) -> None:
    """Configure logging based on configuration.
    
    Args:
        config: MCP configuration with logging settings
    """
    log_level = getattr(logging, config.logging.level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format=config.logging.format,
    )
    
    # Set MCP server loggers
    logging.getLogger("mcp_server").setLevel(log_level)
    
    logger.info("Logging configured: level=%s", config.logging.level)


class MCPServer:
    """MCP Server implementation.
    
    This server exposes Swing Screener functionality through the
    Model Context Protocol, allowing AI assistants to interact with
    the trading system.
    """
    
    def __init__(self, config: MCPConfig) -> None:
        """Initialize the MCP server.
        
        Args:
            config: Server configuration
        """
        self.config = config
        self.registry = create_registry(config)
        
        logger.info(
            "MCP Server initialized: name=%s, version=%s, environment=%s",
            config.server.name,
            config.server.version,
            config.environment
        )
        logger.info(
            "Registered %d tools across %d features",
            self.registry.tool_count(),
            len(self.registry.get_enabled_features())
        )
    
    def validate_configuration(self) -> bool:
        """Validate the server configuration.
        
        Returns:
            True if configuration is valid, False otherwise
        """
        warnings = self.config.validate()
        
        if warnings:
            logger.warning("Configuration validation warnings:")
            for warning in warnings:
                logger.warning("  - %s", warning)
        
        # For Phase 1, we allow servers with no tools (empty registry)
        if self.registry.tool_count() == 0:
            logger.warning("Server has no registered tools - all features are disabled")
        
        return True
    
    async def start(self) -> None:
        """Start the MCP server.
        
        This method will be expanded in Phase 2 to handle actual MCP protocol
        communication. For Phase 1, it just validates that the server can initialize.
        """
        logger.info("Starting MCP server...")
        
        if not self.validate_configuration():
            logger.error("Configuration validation failed")
            raise ValueError("Invalid server configuration")
        
        logger.info("Server validation complete")
        logger.info("Enabled features: %s", self.config.get_enabled_features())
        
        # Phase 2 will add actual MCP protocol handling here
        logger.info("MCP server ready (Phase 1 - skeleton mode)")
    
    async def stop(self) -> None:
        """Stop the MCP server."""
        logger.info("Stopping MCP server...")
        # Phase 2 will add cleanup logic here
        logger.info("MCP server stopped")


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.
    
    Returns:
        Parsed command-line arguments
    """
    parser = argparse.ArgumentParser(
        description="Swing Screener MCP Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to configuration YAML file (default: config/mcp_features.yaml)",
    )
    
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate configuration and exit without starting server",
    )
    
    return parser.parse_args()


async def async_main() -> int:
    """Async main function.
    
    Returns:
        Exit code (0 for success, non-zero for error)
    """
    args = parse_args()
    
    try:
        # Load configuration
        config = load_config(args.config)
        
        # Setup logging
        setup_logging(config)
        
        # Create server
        server = MCPServer(config)
        
        # Validate
        if not server.validate_configuration():
            logger.error("Server validation failed")
            return 1
        
        # If validate-only, exit after validation
        if args.validate_only:
            logger.info("Validation successful")
            return 0
        
        # Start server
        await server.start()
        
        # In Phase 1, we just validate and exit
        # Phase 2 will add actual server loop
        logger.info("Phase 1 validation complete - server would run here")
        
        return 0
        
    except FileNotFoundError as e:
        logger.error("Configuration file not found: %s", e)
        return 1
    except ValueError as e:
        logger.error("Configuration error: %s", e)
        return 1
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        return 0
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        return 1


def main() -> int:
    """Main entry point.
    
    Returns:
        Exit code (0 for success, non-zero for error)
    """
    # Import asyncio here to avoid issues if mcp package needs it
    import asyncio
    
    return asyncio.run(async_main())


if __name__ == "__main__":
    sys.exit(main())
