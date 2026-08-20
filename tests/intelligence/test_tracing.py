from __future__ import annotations

import time

import pytest

from swing_screener.intelligence import tracing


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    yield


def test_step_records_ok_with_timing_and_summary():
    rec = tracing.TraceRecorder("aapl", run_id="r1")
    with rec.step("build_prompt") as draft:
        draft.update({"prompt_hash": "abc123", "outputs_summary": {"prompt_chars": 42}})
    assert len(rec.trace.steps) == 1
    step = rec.trace.steps[0]
    assert step.name == "build_prompt"
    assert step.status == "ok"
    assert step.prompt_hash == "abc123"
    assert step.outputs_summary == {"prompt_chars": 42}
    assert step.duration_ms >= 0.0
    assert step.error is None


def test_step_records_error_and_reraises():
    rec = tracing.TraceRecorder("aapl", run_id="r1")
    with pytest.raises(ValueError):
        with rec.step("search"):
            raise ValueError("boom")
    assert rec.trace.steps[-1].status == "error"
    assert "boom" in rec.trace.steps[-1].error


def test_finish_sets_status_error_when_any_step_failed():
    rec = tracing.TraceRecorder("aapl", run_id="r1")
    with pytest.raises(ValueError):
        with rec.step("search"):
            raise ValueError("boom")
    rec.finish()
    assert rec.trace.status == "error"
    assert rec.trace.finished_at is not None


def test_finish_sets_status_ok_when_all_steps_ok():
    rec = tracing.TraceRecorder("aapl", run_id="r1")
    with rec.step("resolve_context"):
        pass
    rec.finish()
    assert rec.trace.status == "ok"


def test_write_read_round_trip():
    rec = tracing.TraceRecorder("AAPL", run_id="run-xyz")
    with rec.step("resolve_context"):
        pass
    rec.finish()
    tracing.write_run_trace(rec.trace)
    loaded = tracing.read_run_trace("run-xyz")
    assert loaded is not None
    assert loaded.run_id == "run-xyz"
    assert loaded.ticker == "AAPL"
    assert [s.name for s in loaded.steps] == ["resolve_context"]


def test_attempt_identity_and_mode_persist_in_trace_and_index():
    rec = tracing.TraceRecorder(
        "AAPL",
        run_id="run-attempt",
        client_attempt_id="attempt-123",
        attempt_force=True,
    )
    rec.finish()
    tracing.write_run_trace(rec.trace)

    stored = tracing.read_run_trace("run-attempt")
    indexed = tracing.list_runs_for_ticker("AAPL")
    assert stored is not None
    assert stored.client_attempt_id == "attempt-123"
    assert stored.attempt_force is True
    assert indexed[0].client_attempt_id == "attempt-123"
    assert indexed[0].attempt_force is True


def test_read_missing_returns_none():
    assert tracing.read_run_trace("does-not-exist") is None


def test_index_lists_newest_first_and_caps(monkeypatch):
    monkeypatch.setattr(tracing, "_max_runs_per_ticker", lambda: 3)
    for i in range(5):
        rec = tracing.TraceRecorder("AAPL", run_id=f"run-{i}")
        with rec.step("resolve_context"):
            pass
        rec.finish()
        tracing.write_run_trace(rec.trace)
        time.sleep(0.001)
    entries = tracing.list_runs_for_ticker("AAPL")
    assert len(entries) == 3
    assert [e.run_id for e in entries] == ["run-4", "run-3", "run-2"]
    assert entries[0].step_count == 1


def test_dropped_runs_have_their_trace_files_deleted(monkeypatch):
    monkeypatch.setattr(tracing, "_max_runs_per_ticker", lambda: 2)
    ids = []
    for i in range(4):
        rec = tracing.TraceRecorder("AAPL", run_id=f"run-{i}")
        with rec.step("resolve_context"):
            pass
        rec.finish()
        tracing.write_run_trace(rec.trace)
        ids.append(f"run-{i}")
        time.sleep(0.001)
    # Only the 2 newest remain readable; older trace files are pruned from disk.
    assert tracing.read_run_trace("run-3") is not None
    assert tracing.read_run_trace("run-2") is not None
    assert tracing.read_run_trace("run-1") is None
    assert tracing.read_run_trace("run-0") is None
    assert [e.run_id for e in tracing.list_runs_for_ticker("AAPL")] == ["run-3", "run-2"]


def test_finalize_trace_is_fail_soft_on_bad_root(monkeypatch):
    rec = tracing.TraceRecorder("AAPL", run_id="run-1")
    monkeypatch.setattr(
        tracing, "write_run_trace", lambda *a, **k: (_ for _ in ()).throw(OSError("nope"))
    )
    # Must not raise.
    tracing.finalize_trace(rec)


def test_new_recorder_none_when_disabled(monkeypatch):
    monkeypatch.setattr(tracing, "tracing_enabled", lambda: False)
    assert tracing.new_recorder("AAPL") is None


def test_step_helper_nullcontext_when_recorder_none():
    with tracing.step(None, "search"):
        pass  # no error, no recording


def test_step_with_invalid_draft_value_does_not_raise():
    rec = tracing.TraceRecorder("AAPL", run_id="r1")
    # A non-coercible tokens value would fail StepTrace validation in the finally;
    # it must be swallowed, not propagated, and the bad step simply dropped.
    with rec.step("search") as draft:
        draft.tokens = object()  # invalid for int | None
    assert rec.trace.steps == []            # bad step dropped, no exception
    # A subsequent good step still records fine.
    with rec.step("format"):
        pass
    assert [s.name for s in rec.trace.steps] == ["format"]


def test_new_recorder_returns_none_when_config_raises(monkeypatch):
    def _boom():
        raise RuntimeError("config boom")
    monkeypatch.setattr(tracing, "tracing_enabled", _boom)
    assert tracing.new_recorder("AAPL") is None
