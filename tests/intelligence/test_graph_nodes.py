from __future__ import annotations

from swing_screener.intelligence.graph import nodes
from tests.intelligence.test_analyzer_graph_equivalence import _position_req


def test_resolve_context_sets_position_flag(monkeypatch):
    class _Stub:
        _history_digest_size = 5

        def _pre_open_state(self, *args, **kwargs):
            return False, None

    monkeypatch.setattr(nodes.mod, "read_history", lambda *args, **kwargs: [])

    state = {"req": _position_req(), "ticker": "AAPL"}
    out = nodes.resolve_context(_Stub(), state)

    assert out["has_position"] is True
    assert out["pre_open"] is False
