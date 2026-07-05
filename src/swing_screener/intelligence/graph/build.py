from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Callable

from langgraph.graph import END, START, StateGraph

from swing_screener.intelligence.graph import nodes
from swing_screener.intelligence.graph.state import AnalyzerState

if TYPE_CHECKING:
    from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer


_ORDER = [
    ("resolve_context", nodes.resolve_context),
    ("assemble_inputs", nodes.assemble_inputs),
    ("build_prompt", nodes.build_prompt),
    ("search", nodes.search),
    ("format", nodes.format_node),
    ("postprocess", nodes.postprocess),
    ("weigh_evidence", nodes.weigh_evidence),
    ("assemble_result", nodes.assemble_result),
    ("persist", nodes.persist),
]


def _summ_resolve(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    return {
        "outputs_summary": {
            "pre_open": state.get("pre_open"),
            "has_position": state.get("has_position"),
            "prior_runs": len(state.get("prior_digest") or []),
        }
    }


def _summ_assemble_inputs(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    return {"outputs_summary": {"categories": sorted(state.get("inputs_used", {}).keys())}}


def _summ_build_prompt(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    prompt = state.get("user_prompt") or ""
    recorder = state.get("_recorder")
    preview_chars = getattr(recorder, "preview_chars", 500)
    return {
        "prompt_hash": hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16],
        "prompt_preview": prompt[:preview_chars],
        "outputs_summary": {"prompt_chars": len(prompt)},
    }


def _summ_search(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    usage = state.get("_search_usage")
    return {
        "model": analyzer._model,
        "tokens": getattr(usage, "total_tokens", None),
        "outputs_summary": {"search_chars": len(state.get("search_text") or "")},
    }


def _summ_format(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    usage = state.get("_parse_usage")
    return {
        "model": analyzer._format_model,
        "tokens": getattr(usage, "total_tokens", None),
        "outputs_summary": {"has_position": state.get("has_position")},
    }


def _summ_postprocess(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    sources = state.get("inputs_used", {}).get("sources", {})
    return {
        "tokens": state.get("tokens"),
        "source_counts": sources.get("returned") or {},
    }


def _summ_weigh(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    ledger = state.get("evidence_ledger")
    if ledger is None:
        return {}
    return {"outputs_summary": {"balance_label": ledger.balance_label, "net": ledger.net}}


def _summ_assemble_result(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    result = state.get("result")
    if result is None:
        return {}
    return {"outputs_summary": {"action": result.action, "conviction": result.conviction}}


def _summ_persist(analyzer: "SymbolAnalyzer", state: AnalyzerState) -> dict:
    return {"outputs_summary": {"cached": True}}


SUMMARIZERS: dict[str, Callable[["SymbolAnalyzer", AnalyzerState], dict]] = {
    "resolve_context": _summ_resolve,
    "assemble_inputs": _summ_assemble_inputs,
    "build_prompt": _summ_build_prompt,
    "search": _summ_search,
    "format": _summ_format,
    "postprocess": _summ_postprocess,
    "weigh_evidence": _summ_weigh,
    "assemble_result": _summ_assemble_result,
    "persist": _summ_persist,
}


def _traced(analyzer: "SymbolAnalyzer", name: str, fn):
    def wrapped(state: AnalyzerState) -> AnalyzerState:
        recorder = state.get("_recorder")
        if recorder is None:
            return fn(analyzer, state)
        with recorder.step(name) as draft:
            new_state = fn(analyzer, state)
            summarizer = SUMMARIZERS.get(name)
            if summarizer is not None:
                draft.update(summarizer(analyzer, new_state))
        return new_state

    return wrapped


def build_graph(analyzer: "SymbolAnalyzer"):
    graph = StateGraph(AnalyzerState)
    names = [name for name, _ in _ORDER]
    for name, fn in _ORDER:
        graph.add_node(name, _traced(analyzer, name, fn))
    graph.add_edge(START, names[0])
    for current, next_name in zip(names, names[1:]):
        graph.add_edge(current, next_name)
    graph.add_edge(names[-1], END)
    return graph.compile()
