from __future__ import annotations

from functools import partial
from typing import TYPE_CHECKING

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
    ("assemble_result", nodes.assemble_result),
    ("persist", nodes.persist),
]


def build_graph(analyzer: "SymbolAnalyzer"):
    graph = StateGraph(AnalyzerState)
    names = [name for name, _ in _ORDER]
    for name, fn in _ORDER:
        graph.add_node(name, partial(fn, analyzer))
    graph.add_edge(START, names[0])
    for current, next_name in zip(names, names[1:]):
        graph.add_edge(current, next_name)
    graph.add_edge(names[-1], END)
    return graph.compile()
