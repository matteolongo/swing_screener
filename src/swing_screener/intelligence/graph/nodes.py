from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from swing_screener.intelligence.graph.state import AnalyzerState
from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.intelligence import symbol_analyzer as mod
from swing_screener.intelligence.weighting.config import load_evidence_weights_config
from swing_screener.intelligence.weighting.ledger import weigh

if TYPE_CHECKING:
    from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer


def resolve_context(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    req, ticker = state["req"], state["ticker"]
    now = state.get("now") or datetime.now(timezone.utc)
    pre_open, since = analyzer._pre_open_state(ticker, req, now)
    state["now"] = now
    state["pre_open"] = pre_open
    state["pre_open_since"] = since
    state["prior_digest"] = mod.read_history(
        ticker, limit=analyzer._history_digest_size
    )
    state["has_position"] = mod.is_position_request(req)
    return state


def _put(d: dict, key: str, value: object) -> None:
    """Assign only when value is not None (keeps False / 0)."""
    if value is not None:
        d[key] = value


def _put_truthy(d: dict, key: str, value: object) -> None:
    """Assign only when value is truthy (drops empty strings / empty dicts)."""
    if value:
        d[key] = value


def assemble_inputs(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    req = state["req"]
    inputs_used: dict = {}

    trade_plan: dict = {}
    _put(trade_plan, "entry", req.entry)
    _put(trade_plan, "stop", req.stop)
    _put(trade_plan, "target", req.target)
    _put(trade_plan, "rr", req.rr)
    if req.target is not None and req.close is not None and req.close != 0:
        trade_plan["upside_pct"] = round((req.target - req.close) / req.close * 100, 1)
    _put_truthy(inputs_used, "trade_plan", trade_plan)

    technical: dict = {}
    _put(technical, "sma_20", req.sma_20)
    _put(technical, "sma_50", req.sma_50)
    _put(technical, "sma_200", req.sma_200)
    _put(technical, "momentum_6m", req.momentum_6m)
    _put(technical, "momentum_12m", req.momentum_12m)
    _put(technical, "rel_strength", req.rel_strength)
    _put(technical, "sector_rs", req.sector_rs)
    _put(technical, "atr", req.atr)
    if req.dist_52w_high_pct is not None:
        technical["dist_52w_high_pct"] = round(req.dist_52w_high_pct * 100, 1)
    _put(technical, "near_52w_high", req.near_52w_high)
    _put_truthy(technical, "sector_rotation_context", req.sector_rotation_context)
    _put_truthy(technical, "signal", req.signal)
    _put_truthy(technical, "price_source", req.price_source)
    _put_truthy(inputs_used, "technical", technical)

    decision: dict = {}
    _put_truthy(decision, "action", req.decision_action)
    _put_truthy(decision, "conviction", req.decision_conviction)
    _put_truthy(decision, "technical_label", req.technical_label)
    _put_truthy(decision, "fundamentals_label", req.fundamentals_label)
    _put_truthy(decision, "valuation_label", req.valuation_label)
    _put(decision, "fair_value_low", req.fair_value_low)
    _put(decision, "fair_value_base", req.fair_value_base)
    _put(decision, "fair_value_high", req.fair_value_high)
    _put_truthy(inputs_used, "decision_context", decision)

    if state["has_position"]:
        position_context: dict = {"ticker": state["ticker"]}
        _put_truthy(position_context, "position_id", req.position_id)
        _put(position_context, "shares", req.shares)
        _put(position_context, "entry_price", req.entry_price)
        _put_truthy(position_context, "entry_date", req.entry_date)
        _put(position_context, "stop", req.stop)
        _put(position_context, "current_price", req.close)
        _put(position_context, "r_now", req.r_now)
        _put(position_context, "days_open", req.days_open)
        _put_truthy(inputs_used, "position_context", position_context)

    if req.catalyst_evidence:
        inputs_used["catalyst_evidence"] = {
            "count": len(req.catalyst_evidence),
            "sources": sorted(
                {ev.publisher for ev in req.catalyst_evidence if ev.publisher}
            ),
        }

    finnhub_signals: dict = {}
    _put(finnhub_signals, "insider_net_shares_90d", req.insider_net_shares_90d)
    _put(
        finnhub_signals,
        "insider_transaction_count_90d",
        req.insider_transaction_count_90d,
    )
    _put(finnhub_signals, "forward_eps_estimate", req.forward_eps_estimate)
    _put(
        finnhub_signals,
        "analyst_upgrade_downgrade_net_30d",
        req.analyst_upgrade_downgrade_net_30d,
    )
    _put_truthy(inputs_used, "finnhub_signals", finnhub_signals)

    if req.recent_patterns:
        inputs_used["candles"] = {"patterns": ", ".join(req.recent_patterns)}

    if state["pre_open"]:
        inputs_used["pre_open"] = {
            "window": "us_pre_market",
            "since": state["pre_open_since"],
        }
    if state["prior_digest"]:
        inputs_used["history"] = {"prior_runs": len(state["prior_digest"])}

    state["inputs_used"] = inputs_used
    return state


def build_prompt(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    state["user_prompt"] = mod._build_user_prompt(
        state["ticker"],
        state["req"],
        past_positions=state.get("past_positions") or [],
        pre_open=state["pre_open"],
        pre_open_since=state["pre_open_since"],
        prior_digest=state["prior_digest"],
    )
    return state


def search(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    resp = analyzer._client.responses.create(
        model=analyzer._model,
        tools=[{"type": "web_search_preview"}],
        instructions=mod._SYSTEM_PROMPT,
        input=state["user_prompt"],
        max_output_tokens=analyzer._max_tokens,
    )
    state["search_text"] = resp.output_text
    state["_search_usage"] = getattr(resp, "usage", None)
    return state


def format_node(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    text_format = mod._LLMPositionAnalysis if state["has_position"] else mod._LLMAnalysis
    parsed = analyzer._client.responses.parse(
        model=analyzer._format_model,
        instructions=mod._FORMAT_PROMPT,
        input=state["search_text"],
        text_format=text_format,
    )
    draft = parsed.output_parsed
    if state["has_position"]:
        fb_signal, fb_key_numbers = mod._fallback_position_fields(state["req"])
        if draft.position_signal is None:
            draft = draft.model_copy(update={"position_signal": fb_signal})
        if not draft.key_numbers:
            draft = draft.model_copy(update={"key_numbers": fb_key_numbers})
    state["draft"] = draft
    state["_parse_usage"] = getattr(parsed, "usage", None)
    return state


def postprocess(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    search_usage = state.get("_search_usage")
    parse_usage = state.get("_parse_usage")
    search_tokens = getattr(search_usage, "total_tokens", None)
    parse_tokens = getattr(parse_usage, "total_tokens", None)
    tokens: int | None = None
    if search_tokens is not None or parse_tokens is not None:
        tokens = (search_tokens or 0) + (parse_tokens or 0)
    state["tokens"] = tokens

    pub_counts: dict[str, int] = {}
    for ev in state["req"].catalyst_evidence:
        if ev.publisher:
            pub_counts[ev.publisher] = pub_counts.get(ev.publisher, 0) + 1

    try:
        from swing_screener.intelligence.evidence.config import (
            load_evidence_config as _load_ev_cfg,
        )
        from swing_screener.intelligence.evidence.collect import attempted_source_ids

        attempted = attempted_source_ids(_load_ev_cfg())
    except Exception:
        attempted = sorted(pub_counts)

    state["inputs_used"]["sources"] = {
        "attempted": attempted,
        "returned": pub_counts,
    }
    return state


def weigh_evidence(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    state["evidence_ledger"] = weigh(
        state["draft"], state["req"], load_evidence_weights_config()
    )
    return state


def assemble_result(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    draft = state["draft"]
    result = SymbolIntelligence(
        symbol=state["ticker"],
        generated_at=datetime.now(timezone.utc).isoformat(),
        action=draft.action,
        conviction=draft.conviction,
        catalyst_urgency=draft.catalyst_urgency,
        summary_line=draft.summary_line,
        narrative=draft.narrative,
        upcoming_events=draft.upcoming_events,
        position_signal=draft.position_signal,
        position_outlook=draft.position_outlook,
        position_move_explanation=draft.position_move_explanation,
        sources=draft.sources,
        price_hook=draft.price_hook,
        key_numbers=draft.key_numbers,
        risk_factors=draft.risk_factors,
        prediction_bullets=draft.prediction_bullets,
        news=draft.news,
        classified_catalysts=draft.classified_catalysts,
        past_trades_context=draft.past_trades_context,
        pre_open_outlook=draft.pre_open_outlook if state["pre_open"] else None,
        thesis_delta=draft.thesis_delta if state["prior_digest"] else None,
    )
    state["result"] = result.model_copy(
        update={
            "inputs_used": state["inputs_used"],
            "evidence_ledger": state.get("evidence_ledger"),
            "run_id": state.get("run_id"),
        }
    )
    return state


def persist(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> AnalyzerState:
    ticker, result = state["ticker"], state["result"]
    summary: dict = {
        "cache_written": False,
        "history_appended": False,
        "metrics_recorded": False,
    }
    try:
        mod.write_to_cache(ticker, result)
        summary["cache_written"] = True
    except Exception as exc:
        summary["cache_error"] = f"{type(exc).__name__}: {exc}"
        mod.logger.warning(
            "Failed to write intelligence cache for %r; result will not be cached",
            ticker,
            exc_info=True,
        )
    try:
        mod.append_history(ticker, result, max_entries=analyzer._history_max_entries)
        summary["history_appended"] = True
    except Exception as exc:
        summary["history_error"] = f"{type(exc).__name__}: {exc}"
        mod.logger.warning(
            "Failed to append intelligence history for %r", ticker, exc_info=True
        )
    try:
        mod.record_analysis_metrics(ticker, tokens=state.get("tokens"))
        summary["metrics_recorded"] = True
    except Exception as exc:
        summary["metrics_error"] = f"{type(exc).__name__}: {exc}"
        mod.logger.warning(
            "Failed to record analysis metrics for %r", ticker, exc_info=True
        )
    state["persist_summary"] = summary
    return state
