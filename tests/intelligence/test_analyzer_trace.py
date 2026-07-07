from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from swing_screener.intelligence import tracing
from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

_SEARCH_TEXT = "Action: BUY_ON_PULLBACK. Sources:\nhttps://example.com/a\n"

_PARSED = {
    "action": "BUY_ON_PULLBACK",
    "conviction": "medium",
    "catalyst_urgency": "low",
    "summary_line": "Constructive.",
    "narrative": "Buy the pullback.",
    "upcoming_events": [],
    "position_signal": None,
    "position_outlook": None,
    "position_move_explanation": None,
    "sources": ["https://example.com/a"],
    "price_hook": "Pullback entry.",
    "key_numbers": [{"label": "SMA20", "value": "98.0", "sentiment": "bullish"}],
    "risk_factors": [],
    "prediction_bullets": [],
    "news": [],
    "classified_catalysts": [],
    "past_trades_context": None,
    "pre_open_outlook": None,
    "thesis_delta": None,
}


def _req() -> SymbolIntelligenceRequest:
    return SymbolIntelligenceRequest(
        close=100.0, signal="BUY_ON_PULLBACK", entry=98.0, stop=94.0, currency="USD"
    )


def _install_fake(monkeypatch, *, search_raises: bool = False):
    from swing_screener.intelligence import symbol_analyzer as mod

    def fake_init(self):
        self._model = "gpt-4o"
        self._format_model = "gpt-4o-mini"
        self._max_tokens = 2000
        self._timeout = 60.0
        self._max_retries = 2
        self._history_max_entries = 50
        self._history_digest_size = 5
        self._pre_open_cfg = {"enabled": False}
        client = MagicMock()
        if search_raises:
            client.responses.create.side_effect = RuntimeError("search boom")
        else:
            client.responses.create.return_value = SimpleNamespace(
                output_text=_SEARCH_TEXT, usage=SimpleNamespace(total_tokens=1000)
            )
        client.responses.parse.return_value = SimpleNamespace(
            output_parsed=mod._LLMAnalysis(**_PARSED),
            usage=SimpleNamespace(total_tokens=200),
        )
        self._client = client
        self._graph = None

    monkeypatch.setattr(mod.SymbolAnalyzer, "__init__", fake_init)


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    yield


def test_successful_run_records_all_graph_steps_and_run_id(monkeypatch):
    _install_fake(monkeypatch)
    now = datetime(2026, 7, 3, 15, 0, tzinfo=timezone.utc)
    result = SymbolAnalyzer().analyze("AAPL", _req(), now=now)

    assert result.run_id is not None
    trace = tracing.read_run_trace(result.run_id)
    assert trace is not None
    assert trace.status == "ok"
    names = [s.name for s in trace.steps]
    assert names == [
        "resolve_context",
        "assemble_inputs",
        "build_prompt",
        "search",
        "format",
        "postprocess",
        "weigh_evidence",
        "assemble_result",
        "persist",
    ]
    build_step = next(s for s in trace.steps if s.name == "build_prompt")
    assert build_step.prompt_hash is not None
    assert build_step.prompt_preview is not None
    search_step = next(s for s in trace.steps if s.name == "search")
    assert search_step.model == "gpt-4o"
    assert search_step.tokens == 1000


def test_run_id_is_written_into_cache(monkeypatch):
    _install_fake(monkeypatch)
    from swing_screener.intelligence.cache import read_from_cache

    result = SymbolAnalyzer().analyze("AAPL", _req())
    cached = read_from_cache("AAPL")
    assert cached is not None
    assert cached.run_id == result.run_id


def test_persist_step_reports_cache_write_failure(monkeypatch):
    _install_fake(monkeypatch)
    from swing_screener.intelligence import symbol_analyzer as mod

    def _cache_boom(*_args, **_kwargs):
        raise OSError("cache disk full")

    monkeypatch.setattr(mod, "write_to_cache", _cache_boom)

    result = SymbolAnalyzer().analyze("AAPL", _req())
    assert result.run_id is not None
    trace = tracing.read_run_trace(result.run_id)
    assert trace is not None
    persist_step = next(s for s in trace.steps if s.name == "persist")

    assert persist_step.outputs_summary["cache_written"] is False
    assert "cache disk full" in persist_step.outputs_summary["cache_error"]
    assert persist_step.outputs_summary["history_appended"] is True
    assert persist_step.outputs_summary["metrics_recorded"] is True


def test_failed_search_records_error_trace_and_reraises(monkeypatch):
    _install_fake(monkeypatch, search_raises=True)
    with pytest.raises(RuntimeError, match="search boom"):
        SymbolAnalyzer().analyze("AAPL", _req())

    entries = tracing.list_runs_for_ticker("AAPL")
    assert len(entries) == 1
    trace = tracing.read_run_trace(entries[0].run_id)
    assert trace is not None
    assert trace.status == "error"
    failed = [s for s in trace.steps if s.status == "error"]
    assert [s.name for s in failed] == ["search"]


def test_summarizer_failure_does_not_fail_analysis(monkeypatch):
    _install_fake(monkeypatch)
    from swing_screener.intelligence.graph import build

    def _boom(analyzer, state):
        raise RuntimeError("summ boom")

    monkeypatch.setitem(build.SUMMARIZERS, "search", _boom)
    result = SymbolAnalyzer().analyze("AAPL", _req())
    assert result.run_id is not None
    trace = tracing.read_run_trace(result.run_id)
    assert trace is not None
    search_step = next(s for s in trace.steps if s.name == "search")
    assert search_step.status == "ok"


def test_disabled_tracing_yields_no_trace_and_null_run_id(monkeypatch):
    _install_fake(monkeypatch)
    monkeypatch.setattr(tracing, "tracing_enabled", lambda: False)
    result = SymbolAnalyzer().analyze("AAPL", _req())
    assert result.run_id is None
    assert tracing.list_runs_for_ticker("AAPL") == []
