from __future__ import annotations

import json
import logging
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from swing_screener.intelligence.config_access import intelligence_config_section
from swing_screener.settings.paths import data_dir
from swing_screener.utils.file_lock import FileLockTimeoutError, open_locked_text

logger = logging.getLogger(__name__)


class StepTrace(BaseModel):
    name: str
    status: Literal["ok", "error"]
    started_at: str
    finished_at: str
    duration_ms: float
    inputs_summary: dict = Field(default_factory=dict)
    outputs_summary: dict = Field(default_factory=dict)
    error: str | None = None
    model: str | None = None
    tokens: int | None = None
    source_counts: dict[str, int] | None = None
    prompt_hash: str | None = None
    prompt_preview: str | None = None


class RunTrace(BaseModel):
    run_id: str
    ticker: str
    started_at: str
    finished_at: str | None = None
    status: Literal["ok", "error", "running"] = "running"
    steps: list[StepTrace] = Field(default_factory=list)
    error: str | None = None


class RunIndexEntry(BaseModel):
    run_id: str
    ticker: str
    started_at: str
    finished_at: str | None = None
    status: str
    duration_ms: float | None = None
    step_count: int = 0


class StepDraft:
    """Mutable scratch a node/step can fill during execution."""

    def __init__(self) -> None:
        self.inputs_summary: dict = {}
        self.outputs_summary: dict = {}
        self.model: str | None = None
        self.tokens: int | None = None
        self.source_counts: dict[str, int] | None = None
        self.prompt_hash: str | None = None
        self.prompt_preview: str | None = None

    def update(self, values: dict[str, Any]) -> None:
        for key, value in values.items():
            if hasattr(self, key):
                setattr(self, key, value)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def tracing_enabled() -> bool:
    return bool(intelligence_config_section("tracing").get("enabled", True))


def _max_runs_per_ticker() -> int:
    return int(intelligence_config_section("tracing").get("max_runs_per_ticker", 50))


def _preview_chars() -> int:
    return int(intelligence_config_section("tracing").get("prompt_preview_chars", 500))


class TraceRecorder:
    def __init__(
        self, ticker: str, *, run_id: str | None = None, preview_chars: int | None = None
    ) -> None:
        self.run_id = run_id or uuid4().hex
        self.preview_chars = preview_chars if preview_chars is not None else _preview_chars()
        self.trace = RunTrace(
            run_id=self.run_id,
            ticker=ticker.upper(),
            started_at=_now().isoformat(),
        )

    @contextmanager
    def step(self, name: str) -> Iterator[StepDraft]:
        draft = StepDraft()
        start = _now()
        status: str = "ok"
        error: str | None = None
        try:
            yield draft
        except BaseException as exc:  # noqa: BLE001 - record then re-raise
            status = "error"
            error = repr(exc)
            raise
        finally:
            end = _now()
            try:
                self.record(
                    StepTrace(
                        name=name,
                        status=status,  # type: ignore[arg-type]
                        started_at=start.isoformat(),
                        finished_at=end.isoformat(),
                        duration_ms=round((end - start).total_seconds() * 1000.0, 3),
                        inputs_summary=draft.inputs_summary,
                        outputs_summary=draft.outputs_summary,
                        error=error,
                        model=draft.model,
                        tokens=draft.tokens,
                        source_counts=draft.source_counts,
                        prompt_hash=draft.prompt_hash,
                        prompt_preview=draft.prompt_preview,
                    )
                )
            except Exception:  # noqa: BLE001 - never fail an analysis on trace recording
                logger.warning("Failed to record trace step %r", name, exc_info=True)

    def record(self, step: StepTrace) -> None:
        self.trace.steps.append(step)

    def mark_error(self, exc: BaseException) -> None:
        self.trace.error = repr(exc)

    def finish(self, status: str | None = None) -> None:
        self.trace.finished_at = _now().isoformat()
        if status is not None:
            self.trace.status = status  # type: ignore[assignment]
        elif self.trace.error or any(s.status == "error" for s in self.trace.steps):
            self.trace.status = "error"
        else:
            self.trace.status = "ok"


def new_recorder(ticker: str) -> TraceRecorder | None:
    try:
        if not tracing_enabled():
            return None
        return TraceRecorder(ticker)
    except Exception:  # noqa: BLE001 - never fail an analysis on trace setup
        logger.warning("Failed to create intelligence trace recorder for %r", ticker, exc_info=True)
        return None


def step(recorder: TraceRecorder | None, name: str):
    if recorder is None:
        return nullcontext()
    return recorder.step(name)


def finalize_trace(recorder: TraceRecorder | None, *, error: BaseException | None = None) -> None:
    if recorder is None:
        return
    try:
        if error is not None:
            recorder.mark_error(error)
        recorder.finish()
        write_run_trace(recorder.trace)
    except Exception:  # noqa: BLE001 - never fail an analysis on trace I/O
        logger.warning("Failed to finalize intelligence trace %r", recorder.run_id, exc_info=True)


@contextmanager
def recording_run(ticker: str) -> Iterator[TraceRecorder | None]:
    """Own a recorder's full lifecycle: create, capture any error, always finalize.

    Yields None when tracing is disabled. The recorder is finalized on exit for
    both success and failure paths, so callers never hand-coordinate
    ``new_recorder`` / ``mark_error`` / ``finalize_trace``.
    """
    recorder = new_recorder(ticker)
    error: BaseException | None = None
    try:
        yield recorder
    except BaseException as exc:  # noqa: BLE001 - record then re-raise
        error = exc
        raise
    finally:
        finalize_trace(recorder, error=error)


def runs_dir(root: Path | None = None) -> Path:
    return (root or data_dir()) / "intelligence" / "runs"


def _index_path(ticker: str, root: Path | None = None) -> Path:
    return runs_dir(root) / "index" / f"{ticker.upper()}.json"


def write_run_trace(trace: RunTrace, root: Path | None = None) -> None:
    try:
        base = runs_dir(root)
        base.mkdir(parents=True, exist_ok=True)
        (base / f"{trace.run_id}.json").write_text(trace.model_dump_json(indent=2))
        _upsert_index(trace, root)
    except (OSError, ValueError):
        logger.warning("Failed to write intelligence run trace %r", trace.run_id, exc_info=True)


def _upsert_index(trace: RunTrace, root: Path | None = None) -> None:
    path = _index_path(trace.ticker, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    duration = None
    if trace.steps:
        duration = round(sum(s.duration_ms for s in trace.steps), 3)
    entry = RunIndexEntry(
        run_id=trace.run_id,
        ticker=trace.ticker,
        started_at=trace.started_at,
        finished_at=trace.finished_at,
        status=trace.status,
        duration_ms=duration,
        step_count=len(trace.steps),
    ).model_dump()
    cap = _max_runs_per_ticker()
    dropped_ids: list[str] = []
    # Read-modify-write under an exclusive lock so concurrent same-ticker runs
    # cannot clobber each other's index entry (and orphan the trace file).
    try:
        with open_locked_text(path, mode="r+", lock_kind="exclusive", create_file=True) as fh:
            raw = fh.read()
            entries: list[dict] = []
            if raw.strip():
                try:
                    loaded = json.loads(raw)
                    if isinstance(loaded, list):
                        entries = [
                            e
                            for e in loaded
                            if isinstance(e, dict) and e.get("run_id") != trace.run_id
                        ]
                except ValueError:
                    entries = []
            entries.insert(0, entry)
            entries.sort(key=lambda e: e.get("started_at") or "", reverse=True)
            kept = entries[:cap]
            # Never prune the run we just wrote, even if clock skew sorts it below
            # the cap — otherwise its own trace file would be unlinked here.
            if not any(e.get("run_id") == trace.run_id for e in kept):
                others = [e for e in entries if e.get("run_id") != trace.run_id]
                kept = [entry, *others[: cap - 1]]
            kept_ids = {e.get("run_id") for e in kept}
            dropped_ids = [
                rid for e in entries if (rid := e.get("run_id")) and rid not in kept_ids
            ]
            fh.seek(0)
            fh.truncate()
            json.dump(kept, fh, indent=2)
            fh.flush()
    except FileLockTimeoutError:
        logger.warning("Timed out locking intelligence run index for %r", trace.ticker)
        return
    for dropped_run_id in dropped_ids:
        try:
            (runs_dir(root) / f"{dropped_run_id}.json").unlink(missing_ok=True)
        except OSError:
            logger.warning(
                "Failed to delete pruned intelligence run trace %r",
                dropped_run_id,
                exc_info=True,
            )


def read_run_trace(run_id: str, root: Path | None = None) -> RunTrace | None:
    path = runs_dir(root) / f"{run_id}.json"
    if not path.exists():
        return None
    try:
        return RunTrace.model_validate_json(path.read_text())
    except (OSError, ValueError):
        logger.warning("Failed to read intelligence run trace %r", run_id, exc_info=True)
        return None


def list_runs_for_ticker(
    ticker: str, *, limit: int | None = None, root: Path | None = None
) -> list[RunIndexEntry]:
    path = _index_path(ticker, root)
    if not path.exists():
        return []
    try:
        loaded = json.loads(path.read_text())
    except (OSError, ValueError):
        return []
    if not isinstance(loaded, list):
        return []
    entries: list[RunIndexEntry] = []
    for e in loaded:
        try:
            entries.append(RunIndexEntry.model_validate(e))
        except ValueError:
            # Skip a schema-invalid / hand-edited row rather than 500 the endpoint.
            continue
    return entries[:limit] if limit is not None else entries
