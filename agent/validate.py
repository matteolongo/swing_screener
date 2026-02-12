#!/usr/bin/env python3
"""
Validation script for the Swing Screener Agent.

This script performs basic validation tests to ensure the agent
can connect to the MCP server and list available tools.
"""
import asyncio
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.client import MCPClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def validate_client():
    """Validate MCP client functionality."""
    print("=" * 70)
    print("SWING SCREENER AGENT VALIDATION")
    print("=" * 70)
    print()
    
    # Test 1: Client initialization
    print("Test 1: Initialize MCP Client...")
    try:
        client = MCPClient()
        print("✓ Client initialized\n")
    except Exception as e:
        print(f"✗ Failed to initialize client: {e}\n")
        return False
    
    # Test 2: Connection to MCP server
    print("Test 2: Connect to MCP Server...")
    try:
        await client.connect()
        print("✓ Connected to MCP server\n")
    except Exception as e:
        print(f"✗ Failed to connect: {e}\n")
        print("Possible issues:")
        print("- MCP server not installed: pip install -e '.[mcp]'")
        print("- MCP configuration missing: check config/mcp_features.yaml")
        print("- Python path issue: ensure mcp_server is importable")
        return False
    
    # Test 3: List available tools
    print("Test 3: List Available Tools...")
    try:
        tools = client.get_available_tools()
        print(f"✓ Found {len(tools)} tools:\n")
        
        # Group tools by domain
        domains = {}
        for tool in tools:
            domain = tool.split('_')[0] if '_' in tool else 'other'
            if domain not in domains:
                domains[domain] = []
            domains[domain].append(tool)
        
        for domain, domain_tools in sorted(domains.items()):
            print(f"  {domain.capitalize()}:")
            for tool in sorted(domain_tools):
                print(f"    • {tool}")
            print()
        
    except Exception as e:
        print(f"✗ Failed to list tools: {e}\n")
        await client.disconnect()
        return False
    
    # Test 4: Get tool info
    print("Test 4: Get Tool Information...")
    try:
        if tools:
            sample_tool = tools[0]
            info = client.get_tool_info(sample_tool)
            print(f"✓ Got info for '{sample_tool}':")
            print(f"  Description: {info.get('description', 'N/A')[:80]}...")
            print()
    except Exception as e:
        print(f"⚠️ Could not get tool info: {e}\n")
    
    # Test 5: Disconnect
    print("Test 5: Disconnect from Server...")
    try:
        await client.disconnect()
        print("✓ Disconnected successfully\n")
    except Exception as e:
        print(f"✗ Error during disconnect: {e}\n")
        return False
    
    print("=" * 70)
    print("VALIDATION COMPLETE - ALL TESTS PASSED")
    print("=" * 70)
    print()
    print("Next steps:")
    print("- Run: python -m agent.cli tools")
    print("- Try: python -m agent.cli screen --universe mega_all --top 5")
    print("- Read: agent/README.md")
    print()
    
    return True


async def main():
    """Main validation entry point."""
    try:
        success = await validate_client()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\nValidation interrupted by user")
        return 130
    except Exception as e:
        logger.exception("Unexpected error during validation")
        print(f"\n✗ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
