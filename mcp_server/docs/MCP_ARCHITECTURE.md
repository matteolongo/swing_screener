# MCP Server Architecture Design

> **Status: Archived design snapshot.** Implementation completed in February 2026; consult `/mcp_server/docs/PHASE4_MCP_COMPLETE.md` for current architecture.  
> **Last Reviewed:** February 17, 2026.
> **Note:** This document uses pre-implementation tool names (e.g., `positions_list`). Current tools use names like `list_positions` and `run_screener`.

**Purpose:** Define the architecture for wrapping Swing Screener in an MCP server  
**Approach:** Refactor-first, coevolution of FastAPI and MCP interfaces  
**Date:** February 12, 2026  
**Status:** Design Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Architecture Layers](#architecture-layers)
4. [Service Layer Design](#service-layer-design)
5. [MCP Tool Design](#mcp-tool-design)
6. [Configuration System](#configuration-system)
7. [Dependency Injection](#dependency-injection)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Topology](#deployment-topology)

---

## Overview

### What is MCP?

**Model Context Protocol (MCP)** is a protocol that enables AI assistants (like Claude, GitHub Copilot) to interact with external tools and data sources. MCP servers expose capabilities as "tools" that can be discovered and invoked by MCP clients.

### Why MCP for Swing Screener?

1. **AI-Native Interface:** Enable AI assistants to help users manage trades
2. **Programmable Trading:** Automate workflows through AI agents
3. **Natural Language:** Users can say "show me my positions" instead of API calls
4. **Dual Interface:** Keep existing FastAPI + Web UI, add MCP as alternative

### Design Philosophy

This design follows the **refactor-first, coevolution approach**:

- ✅ Business logic lives in services (interface-agnostic)
- ✅ Both FastAPI and MCP consume the same services
- ✅ Configuration controls which features are exposed
- ✅ No duplication of business logic
- ✅ Both interfaces evolve together

---

## Core Principles

### 1. Service-Oriented Architecture

```
Interfaces Layer (Multiple)     FastAPI Routers  |  MCP Tools
                                        ↓                ↓
Service Layer (Shared)              Services (Dependency Injection)
                                        ↓
Repository Layer (Shared)          Repositories
                                        ↓
Storage Layer                      JSON Files / Database
```

**Key Point:** Services know nothing about HTTP or MCP. They are pure domain logic.

### 2. Single Source of Truth

- Configuration: One config file for app settings
- Feature Toggles: One file for interface exposure
- Business Rules: One place (services)
- Data: One storage backend (shared by both interfaces)

### 3. Interface Parity

Both FastAPI and MCP expose the same features:
- Same operations
- Same validation rules
- Same error handling
- Same data models

### 4. Configuration Over Code

Feature exposure is configuration-driven:
```yaml
features:
  positions:
    enabled: true
    read: true
    write: true
```

No code changes needed to enable/disable features.

---

## Architecture Layers

### Layer 1: Interface Layer (Protocol-Specific)

**FastAPI Interface** (`api/routers/`)
- HTTP REST endpoints
- Request/response models (Pydantic)
- HTTP status codes
- CORS, middleware

**MCP Interface** (`mcp_server/tools/`)
- MCP tool definitions
- Tool input schemas (JSON Schema)
- Tool result formatting
- MCP protocol handling

**Responsibilities:**
- Protocol translation (HTTP ↔ MCP)
- Input validation
- Response formatting
- Error mapping

### Layer 2: Service Layer (Shared Business Logic)

**Location:** `api/services/`

**Services:**
- `PortfolioService` - Positions and orders
- `StrategyService` - Strategy management
- `ScreenerService` - Market scanning
- `BacktestService` - Simulations
- `SocialService` - Sentiment analysis
- `DailyReviewService` - Daily workflow

**Responsibilities:**
- Business logic
- Domain rules
- Orchestration
- Complex operations
- Side effects

**Key Characteristics:**
- ✅ No HTTP coupling
- ✅ No MCP coupling
- ✅ Pure functions where possible
- ✅ Testable in isolation
- ✅ Uses repositories for data access

### Layer 3: Repository Layer (Data Access)

**Location:** `api/repositories/`

**Repositories:**
- `PositionsRepository` - positions.json
- `OrdersRepository` - orders.json
- `StrategyRepository` - strategies.json

**Responsibilities:**
- Read/write JSON files
- File locking
- Data format conversion
- Basic queries (filter, find)

**Key Characteristics:**
- ✅ No business logic
- ✅ Thin wrappers over storage
- ✅ Atomic operations

### Layer 4: Storage Layer (Files)

**Current:** JSON files with file locking  
**Future:** Can migrate to database without changing services

---

## Service Layer Design

### Existing Design (Already Good!)

The current service layer is already well-designed for sharing:

```python
# api/services/portfolio_service.py
class PortfolioService:
    def __init__(self, orders_repo: OrdersRepository, positions_repo: PositionsRepository):
        self.orders_repo = orders_repo
        self.positions_repo = positions_repo
    
    def list_positions(self, status: Optional[str] = None) -> PositionsResponse:
        # Pure business logic - no HTTP
        positions, asof = self.positions_repo.list_positions(status)
        return PositionsResponse(positions=positions, asof=asof)
```

**Why This Works:**
1. Constructor injection (easy to test)
2. Returns domain models (not HTTP responses)
3. No HTTP exceptions (uses domain exceptions)
4. Stateless (safe for concurrent use)

### Service Interface Pattern

All services follow this pattern:

```python
from dataclasses import dataclass

@dataclass
class ServiceResult:
    """Generic service result."""
    success: bool
    data: Any | None = None
    error: str | None = None
    
class DomainService:
    def __init__(self, repo: Repository):
        self.repo = repo
    
    def operation(self, params: Dict) -> ServiceResult:
        """Pure business logic."""
        try:
            # Validate
            # Execute
            # Return
            return ServiceResult(success=True, data=result)
        except DomainError as e:
            return ServiceResult(success=False, error=str(e))
```

### No Changes Needed!

The current service layer can be reused as-is by MCP. We just need to:
1. Create MCP tools that call services
2. Map service results to MCP responses
3. Share the same DI setup

---

## MCP Tool Design

### Tool Structure

Each MCP tool maps to one service operation:

```python
# mcp_server/tools/portfolio.py
from mcp import Tool, ToolInput, ToolResult
from api.services.portfolio_service import PortfolioService

class ListPositionsTool(Tool):
    name = "list_positions"
    description = "Get all open positions, optionally filtered by status"
    
    def input_schema(self):
        return {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["open", "closed"],
                    "description": "Filter by position status"
                }
            }
        }
    
    def __init__(self, service: PortfolioService):
        self.service = service
    
    def execute(self, input: ToolInput) -> ToolResult:
        """Execute tool - calls service."""
        try:
            result = self.service.list_positions(status=input.get("status"))
            return ToolResult(
                success=True,
                content=result.model_dump_json()
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=str(e)
            )
```

### Tool Naming Convention

**Format:** `<domain>_<operation>`

**Examples:**
- `config_get` - Get configuration
- `config_update` - Update configuration
- `strategy_list` - List strategies
- `strategy_get` - Get single strategy
- `strategy_create` - Create strategy
- `positions_list` - List positions
- `positions_get` - Get single position
- `positions_update_stop` - Update position stop
- `orders_list` - List orders
- `orders_create` - Create order
- `orders_fill` - Fill order
- `screener_run` - Run screener
- `backtest_run` - Run backtest
- `daily_review_get` - Get daily review

### Tool Categories

**1. Simple Read Tools** (GET endpoints)
- Input: Query parameters (optional)
- Output: JSON response
- No side effects

**2. Simple Write Tools** (POST/PUT/DELETE endpoints)
- Input: Request body
- Output: Success/failure + result
- Side effects: File writes

**3. Complex Tools** (Long-running operations)
- Input: Configuration
- Output: Large result set
- Considerations: Timeout, progress, streaming

---

## Configuration System

### Feature Configuration File

**Location:** `config/mcp_features.yaml`

```yaml
# MCP Feature Configuration
# Controls which features are exposed through the MCP server

version: "1.0"
server:
  name: "swing-screener-mcp"
  version: "0.1.0"
  description: "MCP server for Swing Screener trading system"
  
features:
  # Configuration Management
  config:
    enabled: true
    description: "Application settings management"
    tools:
      get:
        enabled: true
      update:
        enabled: true
      reset:
        enabled: true
        confirm_required: true
      get_defaults:
        enabled: true
  
  # Strategy Management
  strategy:
    enabled: true
    description: "Trading strategy configuration"
    tools:
      list:
        enabled: true
      get:
        enabled: true
      get_active:
        enabled: true
      set_active:
        enabled: true
      create:
        enabled: true
      update:
        enabled: true
      delete:
        enabled: true
        confirm_required: true
  
  # Screener
  screener:
    enabled: true
    description: "Market scanning for trade candidates"
    tools:
      list_universes:
        enabled: true
      run:
        enabled: true
        timeout_seconds: 300
        max_results: 100
      preview_order:
        enabled: true
  
  # Portfolio - Positions
  positions:
    enabled: true
    description: "Position management"
    tools:
      list:
        enabled: true
      get:
        enabled: true
      get_stop_suggestion:
        enabled: true
      update_stop:
        enabled: true
      close:
        enabled: true
        confirm_required: true
  
  # Portfolio - Orders
  orders:
    enabled: true
    description: "Order management"
    tools:
      list:
        enabled: true
      get:
        enabled: true
      get_snapshot:
        enabled: true
      create:
        enabled: true
      fill:
        enabled: true
        confirm_required: true
      cancel:
        enabled: true
  
  # Daily Review
  daily_review:
    enabled: true
    description: "Daily position review + new candidates"
    tools:
      get:
        enabled: true
        timeout_seconds: 300
  
  # Backtesting
  backtest:
    enabled: true
    description: "Historical strategy simulation"
    tools:
      quick:
        enabled: true
        timeout_seconds: 120
      full:
        enabled: true
        timeout_seconds: 600
      list_simulations:
        enabled: true
      get_simulation:
        enabled: true
      delete_simulation:
        enabled: true
  
  # Social Sentiment
  social:
    enabled: false  # Disabled by default
    description: "Social media sentiment analysis"
    tools:
      analyze:
        enabled: false
        requires_api_keys: true

# Tool execution settings
execution:
  default_timeout_seconds: 30
  max_timeout_seconds: 600
  enable_progress_updates: true
  
# Security settings
security:
  require_confirmation:
    - config_reset
    - strategy_delete
    - positions_close
    - orders_fill
  
  read_only_mode: false  # If true, disable all write operations
```

### Configuration Loading

```python
# mcp_server/config.py
from pathlib import Path
import yaml
from typing import Dict, Any

class MCPConfig:
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self._config = self._load()
    
    def _load(self) -> Dict[str, Any]:
        with open(self.config_path) as f:
            return yaml.safe_load(f)
    
    def is_feature_enabled(self, feature: str) -> bool:
        return self._config["features"].get(feature, {}).get("enabled", False)
    
    def is_tool_enabled(self, feature: str, tool: str) -> bool:
        feature_cfg = self._config["features"].get(feature, {})
        if not feature_cfg.get("enabled", False):
            return False
        return feature_cfg["tools"].get(tool, {}).get("enabled", False)
    
    def requires_confirmation(self, tool_name: str) -> bool:
        return tool_name in self._config["security"]["require_confirmation"]
    
    def get_timeout(self, feature: str, tool: str) -> int:
        """Get tool-specific timeout or default."""
        feature_cfg = self._config["features"].get(feature, {})
        tool_cfg = feature_cfg["tools"].get(tool, {})
        return tool_cfg.get("timeout_seconds", 
                           self._config["execution"]["default_timeout_seconds"])
```

---

## Dependency Injection

### Shared DI Setup

Both FastAPI and MCP use the same service instances:

```python
# mcp_server/dependencies.py
from api.dependencies import (
    get_orders_repo,
    get_positions_repo,
    get_strategy_repo,
    get_portfolio_service,
    get_strategy_service,
    get_screener_service,
    get_backtest_service,
    get_social_service,
)

# Re-export for MCP server
__all__ = [
    "get_orders_repo",
    "get_positions_repo",
    "get_strategy_repo",
    "get_portfolio_service",
    "get_strategy_service",
    "get_screener_service",
    "get_backtest_service",
    "get_social_service",
]
```

### Tool Registration

```python
# mcp_server/main.py
from mcp import Server
from mcp_server.config import MCPConfig
from mcp_server.tools import registry
from mcp_server.dependencies import (
    get_portfolio_service,
    get_strategy_service,
    # ... other services
)

def create_mcp_server(config_path: Path) -> Server:
    """Create and configure MCP server."""
    config = MCPConfig(config_path)
    server = Server(name=config.server_name)
    
    # Get service instances (same DI as FastAPI)
    portfolio_service = get_portfolio_service()
    strategy_service = get_strategy_service()
    # ...
    
    # Register tools based on configuration
    if config.is_feature_enabled("positions"):
        if config.is_tool_enabled("positions", "list"):
            server.register_tool(
                registry.create_list_positions_tool(portfolio_service)
            )
        if config.is_tool_enabled("positions", "update_stop"):
            server.register_tool(
                registry.create_update_stop_tool(portfolio_service)
            )
        # ... other position tools
    
    # ... register other features
    
    return server
```

---

## Error Handling

### Service Layer Errors

Services raise domain exceptions:

```python
# api/services/exceptions.py (new)
class DomainError(Exception):
    """Base class for domain errors."""
    pass

class NotFoundError(DomainError):
    """Entity not found."""
    pass

class ValidationError(DomainError):
    """Invalid input."""
    pass

class StateError(DomainError):
    """Invalid state transition."""
    pass
```

### FastAPI Error Mapping

```python
# api/routers/portfolio.py
from api.services.exceptions import NotFoundError, ValidationError
from fastapi import HTTPException

@router.get("/positions/{id}")
async def get_position(id: str, service: PortfolioService = Depends(...)):
    try:
        return service.get_position(id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
```

### MCP Error Mapping

```python
# mcp_server/tools/portfolio.py
from api.services.exceptions import NotFoundError, ValidationError

class GetPositionTool(Tool):
    def execute(self, input: ToolInput) -> ToolResult:
        try:
            result = self.service.get_position(input["id"])
            return ToolResult(success=True, content=result)
        except NotFoundError as e:
            return ToolResult(success=False, error=f"Not found: {e}")
        except ValidationError as e:
            return ToolResult(success=False, error=f"Invalid input: {e}")
        except Exception as e:
            return ToolResult(success=False, error=f"Internal error: {e}")
```

---

## Testing Strategy

### Layer 1: Service Tests (Existing)

```python
# tests/api/test_portfolio_service.py
def test_list_positions_filters_by_status():
    # Mock repositories
    orders_repo = Mock()
    positions_repo = Mock()
    positions_repo.list_positions.return_value = ([...], "2026-02-12")
    
    # Test service
    service = PortfolioService(orders_repo, positions_repo)
    result = service.list_positions(status="open")
    
    assert len(result.positions) == 3
    positions_repo.list_positions.assert_called_with(status="open")
```

### Layer 2: MCP Tool Tests (New)

```python
# tests/mcp_server/test_portfolio_tools.py
from mcp_server.tools.portfolio import ListPositionsTool

def test_list_positions_tool_success():
    # Mock service
    service = Mock()
    service.list_positions.return_value = PositionsResponse(...)
    
    # Test tool
    tool = ListPositionsTool(service)
    result = tool.execute({"status": "open"})
    
    assert result.success is True
    assert "positions" in result.content
    service.list_positions.assert_called_with(status="open")

def test_list_positions_tool_handles_errors():
    service = Mock()
    service.list_positions.side_effect = NotFoundError("No positions")
    
    tool = ListPositionsTool(service)
    result = tool.execute({})
    
    assert result.success is False
    assert "No positions" in result.error
```

### Layer 3: Integration Tests (New)

```python
# tests/mcp_server/test_integration.py
def test_mcp_and_api_return_same_data():
    """Verify both interfaces return identical results."""
    # Setup
    config = MCPConfig(test_config_path)
    mcp_server = create_mcp_server(config)
    api_client = TestClient(app)
    
    # Call both interfaces
    mcp_result = mcp_server.call_tool("positions_list", {})
    api_result = api_client.get("/api/portfolio/positions")
    
    # Compare
    assert mcp_result.data == api_result.json()
```

### Layer 4: Configuration Tests (New)

```python
# tests/mcp_server/test_config.py
def test_disabled_feature_not_registered():
    config = MCPConfig(disabled_config_path)
    server = create_mcp_server(config)
    
    assert "backtest_run" not in server.list_tools()

def test_confirmation_required_enforced():
    config = MCPConfig(test_config_path)
    
    assert config.requires_confirmation("config_reset") is True
    assert config.requires_confirmation("positions_list") is False
```

---

## Deployment Topology

### Option A: Separate Processes (Recommended)

```
┌─────────────────┐         ┌─────────────────┐
│  FastAPI Server │         │   MCP Server    │
│  (Port 8000)    │         │  (Port 8001)    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
         ┌───────────────────────┐
         │   Shared Services     │
         │  (Same Python process │
         │   or separate module) │
         └───────────┬───────────┘
                     ▼
         ┌───────────────────────┐
         │   JSON Files          │
         │  (File-locked access) │
         └───────────────────────┘
```

**Pros:**
- Independent lifecycle
- Separate ports
- Easier scaling
- Isolation

**Cons:**
- Two processes to manage
- Slightly more complex setup

### Option B: Unified Process

```
┌────────────────────────────┐
│   Combined Application     │
│                            │
│  ┌──────────┐ ┌──────────┐│
│  │ FastAPI  │ │   MCP    ││
│  │ (8000)   │ │  (8001)  ││
│  └────┬─────┘ └────┬─────┘│
│       │            │      │
│       └──────┬─────┘      │
│              ▼            │
│      Shared Services      │
└────────────────────────────┘
```

**Pros:**
- Single process
- Simpler deployment
- Shared memory

**Cons:**
- Tight coupling
- Harder to scale independently

### Recommendation

Start with **Option A** (separate processes) because:
1. Cleaner separation
2. Easier to disable MCP if not needed
3. More flexible for future scaling
4. Matches existing architecture (separate api/ directory)

---

## Startup Scripts

### FastAPI Server

```bash
# scripts/start_api.sh
#!/bin/bash
cd /path/to/swing_screener
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### MCP Server

```bash
# scripts/start_mcp.sh
#!/bin/bash
cd /path/to/swing_screener
python -m mcp_server.main --config config/mcp_features.yaml --port 8001
```

### Both (Development)

```bash
# scripts/start_dev.sh
#!/bin/bash
./scripts/start_api.sh &
./scripts/start_mcp.sh &
wait
```

---

## Security Considerations

### 1. Read-Only Mode

Configuration option to disable all write operations:

```yaml
security:
  read_only_mode: true
```

Useful for:
- Demo/testing environments
- Read-only AI assistants
- Audit/analysis use cases

### 2. Confirmation Requirements

Dangerous operations require explicit confirmation:

```yaml
security:
  require_confirmation:
    - config_reset
    - positions_close
    - orders_fill
```

MCP client must pass `confirmed: true` in input.

### 3. No Credentials in Config

Sensitive data (API keys, passwords) should be:
- Environment variables
- Separate secrets file (not in version control)
- External secrets manager

### 4. File Locking

Both FastAPI and MCP use file locking for safe concurrent access:
- Already implemented in `api/utils/file_lock.py`
- Prevents race conditions
- Atomic read-modify-write

---

## Performance Considerations

### 1. Long-Running Operations

Some operations take minutes:
- Full backtest (historical data processing)
- Screener run (fetch + compute)
- Daily review (screener + position eval)

**Solutions:**
- Increase timeout in config
- Implement progress callbacks (future)
- Consider job queue (future)

### 2. Concurrent Access

Both interfaces may run simultaneously:
- ✅ File locking handles this
- ✅ Services are stateless
- ⚠️ Watch for lock contention

**Monitoring:**
- Track lock wait times
- Log slow operations
- Alert on timeouts

### 3. Memory Usage

Large result sets:
- Backtest results (full simulation)
- Screener results (100+ candidates)
- Historical price data

**Solutions:**
- Pagination (future enhancement)
- Streaming responses (future)
- Result limiting (already in config)

---

## Migration Path

### Phase 1: Foundation
1. ✅ Service layer already interface-agnostic
2. ⏳ Add MCP server structure
3. ⏳ Create configuration system
4. ⏳ Setup DI for MCP

### Phase 2: Simple Tools
1. Config management (read/write)
2. Strategy management (CRUD)
3. Position list (read-only)
4. Order list (read-only)

### Phase 3: Complex Tools
1. Screener execution
2. Order creation + validation
3. Position stop updates
4. Order filling

### Phase 4: Advanced
1. Daily review
2. Backtesting
3. Progress updates
4. Streaming results

---

## Success Metrics

### Functional Parity
- ✅ All FastAPI features available in MCP
- ✅ Same validation rules
- ✅ Same error messages
- ✅ Same data returned

### Performance
- ✅ MCP operations complete within timeout
- ✅ No lock contention under normal load
- ✅ Memory usage reasonable

### Code Quality
- ✅ No business logic duplication
- ✅ Services testable in isolation
- ✅ High test coverage (80%+)
- ✅ Clear documentation

---

## Next Steps

1. ✅ Feature mapping complete
2. ✅ Architecture design complete
3. ⏳ Create configuration schema
4. ⏳ Create implementation roadmap
5. ⏳ Begin implementation

---

**Document Status:** Complete  
**Review Date:** February 12, 2026  
**Approved By:** Awaiting review  
**Next Review:** After implementation begins
