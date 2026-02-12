"""Update configuration tool for MCP server.

This module provides the UpdateConfigTool for updating the current
application configuration including risk, indicators, and management settings.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.config._common import get_config_from_router, set_config_in_router, logger


class UpdateConfigTool(BaseTool):
    """Update application configuration."""
    
    @property
    def feature(self) -> str:
        return "config"
    
    @property
    def name(self) -> str:
        return "update_config"
    
    @property
    def description(self) -> str:
        return "Update the application configuration. Pass a config object with nested risk, indicators, and manage sections to update."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "risk": {
                    "type": "object",
                    "description": "Risk management settings",
                    "properties": {
                        "account_size": {"type": "number", "description": "Total account size in dollars"},
                        "risk_pct": {"type": "number", "description": "Risk per trade as decimal (e.g., 0.01 = 1%)"},
                        "max_position_pct": {"type": "number", "description": "Max position size as % of account"},
                        "min_shares": {"type": "integer", "description": "Minimum shares to trade"},
                        "k_atr": {"type": "number", "description": "ATR multiplier for stops"},
                        "min_rr": {"type": "number", "description": "Minimum reward-to-risk required"},
                        "max_fee_risk_pct": {"type": "number", "description": "Max fees as % of planned risk"}
                    }
                },
                "indicators": {
                    "type": "object",
                    "description": "Technical indicator settings",
                    "properties": {
                        "sma_fast": {"type": "integer", "description": "Fast SMA window"},
                        "sma_mid": {"type": "integer", "description": "Mid SMA window"},
                        "sma_long": {"type": "integer", "description": "Long SMA window"},
                        "atr_window": {"type": "integer", "description": "ATR window"},
                        "lookback_6m": {"type": "integer", "description": "6-month momentum lookback"},
                        "lookback_12m": {"type": "integer", "description": "12-month momentum lookback"},
                        "benchmark": {"type": "string", "description": "Benchmark ticker"},
                        "breakout_lookback": {"type": "integer", "description": "Breakout lookback window"},
                        "pullback_ma": {"type": "integer", "description": "Pullback MA window"},
                        "min_history": {"type": "integer", "description": "Minimum bars required for signals"}
                    }
                },
                "manage": {
                    "type": "object",
                    "description": "Position management settings",
                    "properties": {
                        "breakeven_at_r": {"type": "number", "description": "Move stop to entry when R >= this"},
                        "trail_after_r": {"type": "number", "description": "Start trailing when R >= this"},
                        "trail_sma": {"type": "integer", "description": "SMA to trail under"},
                        "sma_buffer_pct": {"type": "number", "description": "Buffer below SMA"},
                        "max_holding_days": {"type": "integer", "description": "Max days to hold position"}
                    }
                },
                "positions_file": {"type": "string", "description": "Path to positions file"},
                "orders_file": {"type": "string", "description": "Path to orders file"}
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute update_config tool.
        
        Args:
            arguments: Tool input with config update parameters
            
        Returns:
            Updated AppConfig as dictionary, or error dict if operation fails
        """
        try:
            # Import AppConfig here to avoid circular imports
            from api.models.config import AppConfig
            
            # Get current config
            current = get_config_from_router()
            
            # Create update dict, merging with current config
            update_dict = current.model_dump()
            
            # Deep merge updates into current config
            if "risk" in arguments and arguments["risk"]:
                update_dict["risk"].update(arguments["risk"])
            if "indicators" in arguments and arguments["indicators"]:
                update_dict["indicators"].update(arguments["indicators"])
            if "manage" in arguments and arguments["manage"]:
                update_dict["manage"].update(arguments["manage"])
            if "positions_file" in arguments:
                update_dict["positions_file"] = arguments["positions_file"]
            if "orders_file" in arguments:
                update_dict["orders_file"] = arguments["orders_file"]
            
            # Create new config from updated dict
            new_config = AppConfig(**update_dict)
            
            # Set it in the router
            updated = set_config_in_router(new_config)
            
            return updated.model_dump()
        except Exception as e:
            logger.error(f"Error updating config: {e}")
            return {
                "error": str(e),
                "config": None
            }
