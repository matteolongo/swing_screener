# MCP Tools Refactoring - Modular Architecture

> **Status: Snapshot.**  
> **Last Reviewed:** February 17, 2026.

**Date:** February 12, 2026  
**Status:** Complete  
**Commit:** f99a772

## Overview

Refactored MCP tools from monolithic files into a modular, maintainable architecture. Each tool is now in its own file, making it easier to add new tools and manage existing ones.

## Changes Summary

### Before (Monolithic)

```
mcp_server/tools/
├── portfolio.py (602 lines - 9 tools)
├── screener.py (271 lines - 3 tools)
├── base.py
└── registry.py
```

### After (Modular)

```
mcp_server/tools/
├── base.py
├── registry.py
├── portfolio/
│   ├── __init__.py (exports)
│   ├── _common.py (shared utilities)
│   ├── list_positions.py (~55 lines)
│   ├── get_position.py (~55 lines)
│   ├── update_position_stop.py (~75 lines)
│   ├── list_orders.py (~60 lines)
│   ├── create_order.py (~100 lines)
│   ├── suggest_position_stop.py (~58 lines)
│   ├── close_position.py (~73 lines)
│   ├── fill_order.py (~85 lines)
│   └── cancel_order.py (~50 lines)
└── screener/
    ├── __init__.py (exports)
    ├── _common.py (shared utilities)
    ├── run_screener.py (~145 lines)
    ├── list_universes.py (~48 lines)
    └── preview_order.py (~105 lines)
```

## Benefits

### 1. Smaller, More Manageable Files
- **Before:** 602-line portfolio.py file
- **After:** Individual files of 50-150 lines each
- Easier to read, review, and modify

### 2. Better Organization
- Tools grouped by domain (portfolio, screener)
- Clear directory structure
- Shared utilities separated into _common.py

### 3. Easier Maintenance
- Modify individual tools without touching others
- Reduced merge conflicts
- Clearer git history

### 4. Separation Ready
- New tools can be in separate packages
- Tools can be moved to external repositories
- Supports plugin architecture

### 5. Reusability
- Shared utilities (service loading, logging) in _common.py
- Package-level exports via __init__.py
- Clean import paths

## File Structure Details

### Portfolio Tools

**_common.py** (shared utilities):
```python
def get_portfolio_service():
    """Lazy import and create portfolio service."""
    from mcp_server.dependencies import get_portfolio_service
    return get_portfolio_service()
```

**Individual Tool Files** (9 files):
Each file contains:
- Single tool class
- Complete implementation
- ~50-100 lines
- Imports from _common

**__init__.py** (package exports):
```python
from .list_positions import ListPositionsTool
from .get_position import GetPositionTool
# ... more imports

def get_portfolio_tools() -> list[BaseTool]:
    return [
        ListPositionsTool(),
        GetPositionTool(),
        # ... more tools
    ]
```

### Screener Tools

Same pattern as portfolio:
- **_common.py** - Shared service loading
- **3 tool files** - run_screener, list_universes, preview_order
- **__init__.py** - Package exports

## Registry Integration

**No Changes to Registry:**
```python
# Registry imports work the same way
if config.is_feature_enabled('portfolio'):
    from mcp_server.tools.portfolio import get_portfolio_tools
    registry.register_tools(get_portfolio_tools())

if config.is_feature_enabled('screener'):
    from mcp_server.tools.screener import get_screener_tools
    registry.register_tools(get_screener_tools())
```

## Adding New Tools

### Step 1: Create Tool File

Create `mcp_server/tools/portfolio/new_tool.py`:

```python
"""New tool implementation."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class NewTool(BaseTool):
    """Description of new tool."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "new_tool"
    
    @property
    def description(self) -> str:
        return "What this tool does"
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                # ... schema
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_portfolio_service()
        # ... implementation
```

### Step 2: Update __init__.py

Add to `mcp_server/tools/portfolio/__init__.py`:

```python
from .new_tool import NewTool

def get_portfolio_tools() -> list[BaseTool]:
    return [
        # ... existing tools
        NewTool(),
    ]

__all__ = [
    # ... existing exports
    "NewTool",
]
```

### Step 3: Configure Tool

Add to `config/mcp_features.yaml`:

```yaml
features:
  portfolio:
    enabled: true
    tools:
      # ... existing tools
      - new_tool
```

That's it! The tool will be automatically registered.

## Validation

### All Tools Still Work

```bash
$ python -m mcp_server.main --validate-only
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: list_positions (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: get_position (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: update_position_stop (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: list_orders (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: create_order (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: suggest_position_stop (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: close_position (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: fill_order (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered tool: cancel_order (feature: portfolio)
2026-02-12 10:12:45,582 - mcp_server.tools.registry - INFO - Registered portfolio tools
2026-02-12 10:12:45,583 - mcp_server.tools.registry - INFO - Registered tool: run_screener (feature: screener)
2026-02-12 10:12:45,583 - mcp_server.tools.registry - INFO - Registered tool: list_universes (feature: screener)
2026-02-12 10:12:45,583 - mcp_server.tools.registry - INFO - Registered tool: preview_order (feature: screener)
2026-02-12 10:12:45,583 - mcp_server.tools.registry - INFO - Registered screener tools
2026-02-12 10:12:45,583 - mcp_server.tools.registry - INFO - Tool registry initialized: 12 tools registered across 2 features
2026-02-12 10:12:45,583 - __main__ - INFO - MCP Server initialized: name=swing-screener-mcp, version=0.1.0, environment=dev
2026-02-12 10:12:45,583 - __main__ - INFO - Registered 12 tools across 2 features
2026-02-12 10:12:46,154 - mcp_server.protocol - INFO - MCP protocol server initialized: 12 tools available
2026-02-12 10:12:46,154 - __main__ - INFO - Validation successful
```

✅ All 9 portfolio tools registered  
✅ All 3 screener tools registered  
✅ 12 tools total  
✅ Server validates successfully  

## Tool Size Comparison

| Tool | Before (lines) | After (lines) | Reduction |
|------|---------------|---------------|-----------|
| Portfolio (all) | 602 | ~610 (split) | More maintainable |
| Screener (all) | 271 | ~298 (split) | More maintainable |
| list_positions | N/A | 55 | Isolated |
| get_position | N/A | 55 | Isolated |
| update_position_stop | N/A | 75 | Isolated |
| list_orders | N/A | 60 | Isolated |
| create_order | N/A | 100 | Isolated |
| suggest_position_stop | N/A | 58 | Isolated |
| close_position | N/A | 73 | Isolated |
| fill_order | N/A | 85 | Isolated |
| cancel_order | N/A | 50 | Isolated |
| run_screener | N/A | 145 | Isolated |
| list_universes | N/A | 48 | Isolated |
| preview_order | N/A | 105 | Isolated |

**Note:** Total line count increased slightly due to file headers and imports, but each file is now much more manageable.

## Breaking Changes

**None!** The refactoring maintains complete backward compatibility:

- ✅ Registry imports unchanged
- ✅ Tool registration logic unchanged
- ✅ Tool interfaces unchanged
- ✅ Configuration unchanged
- ✅ All tests still pass

## Future Considerations

### Plugin Architecture

Tools can now be moved to separate packages:

```
swing-screener-mcp-portfolio-tools/
  portfolio/
    list_positions.py
    get_position.py
    ...

swing-screener-mcp-screener-tools/
  screener/
    run_screener.py
    ...

swing-screener-mcp-custom-tools/
  custom/
    my_tool.py
    ...
```

### External Tool Registration

Future enhancement: Allow external tools to register:

```python
# In external package
from mcp_server.tools.base import BaseTool

class ExternalTool(BaseTool):
    # ... implementation

# Register with MCP server
registry.register_tool(ExternalTool())
```

## Lessons Learned

1. **Modular is Better**: Smaller files are easier to manage
2. **Package Structure**: Subdirectories with __init__.py work well
3. **Shared Utilities**: _common.py pattern is clean
4. **Backward Compatibility**: Maintained throughout refactoring
5. **Testing Essential**: Validation confirmed everything works

## Success Criteria Met

- [x] Split large files into smaller modules
- [x] Maintain backward compatibility
- [x] All 12 tools still register
- [x] Server validates successfully
- [x] Clean package structure
- [x] Easy to add new tools
- [x] Documentation complete

---

Generated: February 12, 2026  
Last Updated: February 12, 2026
