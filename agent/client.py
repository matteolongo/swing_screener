"""Direct backend tool client for the Swing Screener agent.

The original subprocess/stdout MCP client was brittle in this repository's
runtime environment. The agent now uses direct backend tool adapters that map
to the same read/write capabilities, while chat orchestration is layered on top
with LangGraph.
"""
from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Optional

from pydantic import BaseModel

from mcp_server.dependencies import (
    get_chat_service,
    get_intelligence_service,
    get_portfolio_service,
    get_screener_service,
    get_strategy_service,
    get_daily_review_service,
    get_workspace_context_service,
)
from api.models.chat import ChatAnswerRequest, WorkspaceSnapshot
from api.models.intelligence import IntelligenceExplainSymbolRequest
from api.models.portfolio import ClosePositionRequest, CreateOrderRequest, FillOrderRequest, UpdateStopRequest
from api.models.screener import ScreenerRequest

logger = logging.getLogger(__name__)

ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _to_json_payload(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_to_json_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_json_payload(item) for key, item in value.items()}
    return value


def _legacy_candidate_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    payload = dict(candidate)
    if "entry" in payload and "entry_price" not in payload:
        payload["entry_price"] = payload.get("entry")
    if "stop" in payload and "stop_price" not in payload:
        payload["stop_price"] = payload.get("stop")
    if "target" in payload and "target_price" not in payload:
        payload["target_price"] = payload.get("target")
    return payload


class ToolClient:
    """Direct tool adapter client used by workflows and the chat agent."""

    def __init__(self, server_command: Optional[list[str]] = None):
        self.server_command = server_command or []
        self.tools: dict[str, dict[str, Any]] = {}

    async def connect(self) -> None:
        logger.info("Initializing direct backend tool adapters")
        self.tools = {
            "list_universes": {
                "description": "List available screening universes.",
                "handler": self._list_universes,
            },
            "run_screener": {
                "description": "Run the screener.",
                "handler": self._run_screener,
            },
            "preview_order": {
                "description": "Preview order sizing from entry and stop.",
                "handler": self._preview_order,
            },
            "list_orders": {
                "description": "List stored orders.",
                "handler": self._list_orders,
            },
            "create_order": {
                "description": "Create an order.",
                "handler": self._create_order,
            },
            "fill_order": {
                "description": "Fill an order.",
                "handler": self._fill_order,
            },
            "cancel_order": {
                "description": "Cancel an order.",
                "handler": self._cancel_order,
            },
            "list_positions": {
                "description": "List positions.",
                "handler": self._list_positions,
            },
            "get_position": {
                "description": "Get a position by id.",
                "handler": self._get_position,
            },
            "suggest_position_stop": {
                "description": "Suggest a stop update for a position.",
                "handler": self._suggest_position_stop,
            },
            "update_position_stop": {
                "description": "Update a position stop.",
                "handler": self._update_position_stop,
            },
            "close_position": {
                "description": "Close a position.",
                "handler": self._close_position,
            },
            "get_active_strategy": {
                "description": "Get the active strategy.",
                "handler": self._get_active_strategy,
            },
            "list_strategies": {
                "description": "List strategies.",
                "handler": self._list_strategies,
            },
            "get_strategy": {
                "description": "Get a strategy by id.",
                "handler": self._get_strategy,
            },
            "get_daily_review": {
                "description": "Run the daily review workflow.",
                "handler": self._get_daily_review,
            },
            "get_workspace_context": {
                "description": "Build the normalized workspace context.",
                "handler": self._get_workspace_context,
            },
            "get_intelligence_opportunities": {
                "description": "Load cached intelligence opportunities.",
                "handler": self._get_intelligence_opportunities,
            },
            "get_intelligence_events": {
                "description": "Load cached intelligence events.",
                "handler": self._get_intelligence_events,
            },
            "explain_symbol": {
                "description": "Explain a symbol using cached education.",
                "handler": self._explain_symbol,
            },
            "chat_answer": {
                "description": "Answer a read-only workspace chat question.",
                "handler": self._chat_answer,
            },
        }

    async def disconnect(self) -> None:
        logger.info("Shutting down direct backend tool adapters")
        self.tools = {}

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool = self.tools.get(tool_name)
        if tool is None:
            raise ValueError(f"Tool not found: {tool_name}")
        handler: ToolHandler = tool["handler"]
        return await handler(arguments)

    def get_available_tools(self) -> list[str]:
        return list(self.tools.keys())

    def get_tool_info(self, tool_name: str) -> Optional[dict]:
        return self.tools.get(tool_name)

    async def _list_universes(self, arguments: dict[str, Any]) -> dict[str, Any]:
        del arguments
        return get_screener_service().list_universes()

    async def _run_screener(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = ScreenerRequest(
            universe=arguments.get("universe"),
            tickers=arguments.get("tickers"),
            top=arguments.get("top_n", arguments.get("top", 20)),
            strategy_id=arguments.get("strategy", arguments.get("strategy_id")),
            asof_date=arguments.get("asof_date"),
            min_price=arguments.get("min_price"),
            max_price=arguments.get("max_price"),
            currencies=arguments.get("currencies"),
            breakout_lookback=arguments.get("breakout_lookback"),
            pullback_ma=arguments.get("pullback_ma"),
            min_history=arguments.get("min_history"),
        )
        result = get_screener_service().run_screener(request)
        payload = result.model_dump(mode="json")
        payload["candidates"] = [_legacy_candidate_payload(candidate) for candidate in payload.get("candidates", [])]
        return payload

    async def _preview_order(self, arguments: dict[str, Any]) -> dict[str, Any]:
        entry_price = float(arguments["entry_price"])
        stop_price = float(arguments["stop_price"])
        if stop_price >= entry_price:
            raise ValueError(f"stop_price ({stop_price}) must be below entry_price ({entry_price})")
        ticker = str(arguments.get("ticker", "UNKNOWN")).strip().upper() or "UNKNOWN"
        strategy = get_strategy_service().get_active_strategy()
        risk_cfg = strategy["risk"] if isinstance(strategy, dict) else strategy.risk
        per_share_risk = entry_price - stop_price
        account_size = float(risk_cfg["account_size"] if isinstance(risk_cfg, dict) else risk_cfg.account_size)
        risk_pct = float(risk_cfg["risk_pct"] if isinstance(risk_cfg, dict) else risk_cfg.risk_pct)
        min_shares = int(risk_cfg["min_shares"] if isinstance(risk_cfg, dict) else risk_cfg.min_shares)
        target_risk_amount = account_size * risk_pct
        shares = max(int(target_risk_amount // per_share_risk), min_shares)
        position_value = shares * entry_price
        actual_risk = shares * per_share_risk
        actual_risk_pct = actual_risk / account_size
        return {
            "ticker": ticker,
            "entry_price": entry_price,
            "stop_price": stop_price,
            "atr": float(arguments.get("atr", per_share_risk)),
            "shares": shares,
            "position_value": position_value,
            "position_size_usd": position_value,
            "risk_amount": actual_risk,
            "risk_usd": actual_risk,
            "risk_pct": actual_risk_pct,
        }

    async def _list_orders(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_portfolio_service().list_orders(
            status=arguments.get("status"),
            ticker=arguments.get("ticker"),
        )
        return result.model_dump(mode="json")

    async def _create_order(self, arguments: dict[str, Any]) -> dict[str, Any]:
        quantity = arguments.get("quantity")
        if quantity is None:
            preview = await self._preview_order(arguments)
            quantity = preview["shares"]
        limit_price = arguments.get("limit_price", arguments.get("entry_price"))
        request = CreateOrderRequest(
            ticker=arguments["ticker"],
            order_type=arguments["order_type"],
            quantity=quantity,
            limit_price=limit_price,
            stop_price=arguments.get("stop_price"),
            notes=arguments.get("notes", ""),
            order_kind=arguments.get("order_kind", "entry"),
        )
        result = get_portfolio_service().create_order(request)
        return result.model_dump(mode="json")

    async def _fill_order(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = FillOrderRequest(
            filled_price=arguments["fill_price"],
            filled_date=arguments["fill_date"],
            stop_price=arguments.get("stop_price"),
            fee_eur=arguments.get("fee_eur"),
            fill_fx_rate=arguments.get("fill_fx_rate"),
        )
        return get_portfolio_service().fill_order(arguments["order_id"], request)

    async def _cancel_order(self, arguments: dict[str, Any]) -> dict[str, Any]:
        return get_portfolio_service().cancel_order(arguments["order_id"])

    async def _list_positions(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_portfolio_service().list_positions(status=arguments.get("status"))
        return result.model_dump(mode="json")

    async def _get_position(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_portfolio_service().get_position(arguments["position_id"])
        return result.model_dump(mode="json")

    async def _suggest_position_stop(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_portfolio_service().suggest_position_stop(arguments["position_id"])
        return result.model_dump(mode="json")

    async def _update_position_stop(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = UpdateStopRequest(new_stop=arguments["new_stop_price"], reason=arguments.get("reason", ""))
        return get_portfolio_service().update_position_stop(arguments["position_id"], request)

    async def _close_position(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = ClosePositionRequest(
            exit_price=arguments["exit_price"],
            reason=arguments.get("reason", ""),
            fee_eur=arguments.get("fee_eur"),
        )
        return get_portfolio_service().close_position(arguments["position_id"], request)

    async def _get_active_strategy(self, arguments: dict[str, Any]) -> dict[str, Any]:
        del arguments
        return _to_json_payload(get_strategy_service().get_active_strategy())

    async def _list_strategies(self, arguments: dict[str, Any]) -> dict[str, Any]:
        del arguments
        return {"strategies": _to_json_payload(get_strategy_service().list_strategies())}

    async def _get_strategy(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_strategy_service().get_strategy(arguments["strategy_id"])
        return _to_json_payload(result)

    async def _get_daily_review(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_daily_review_service().generate_daily_review(
            top_n=int(arguments.get("top_n", 200)),
            universe=arguments.get("universe"),
        )
        return result.model_dump(mode="json")

    async def _get_workspace_context(self, arguments: dict[str, Any]) -> dict[str, Any]:
        snapshot_payload = arguments.get("workspace_snapshot")
        snapshot = (
            WorkspaceSnapshot.model_validate(snapshot_payload)
            if isinstance(snapshot_payload, dict)
            else None
        )
        result = get_workspace_context_service().build_context(
            selected_ticker=arguments.get("selected_ticker"),
            workspace_snapshot=snapshot,
        )
        return result.model_dump(mode="json")

    async def _get_intelligence_opportunities(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_intelligence_service().get_opportunities(
            asof_date=arguments.get("asof_date"),
            symbols=arguments.get("symbols"),
        )
        return result.model_dump(mode="json")

    async def _get_intelligence_events(self, arguments: dict[str, Any]) -> dict[str, Any]:
        result = get_intelligence_service().get_events(
            asof_date=arguments.get("asof_date"),
            symbols=arguments.get("symbols"),
            event_types=arguments.get("event_types"),
            min_materiality=arguments.get("min_materiality"),
        )
        return result.model_dump(mode="json")

    async def _explain_symbol(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = IntelligenceExplainSymbolRequest.model_validate(arguments)
        result = get_intelligence_service().explain_symbol(request)
        return result.model_dump(mode="json")

    async def _chat_answer(self, arguments: dict[str, Any]) -> dict[str, Any]:
        request = ChatAnswerRequest.model_validate(arguments)
        result = get_chat_service().answer(request)
        return result.model_dump(mode="json")


# Backwards-compatible alias for existing workflow imports.
MCPClient = ToolClient
