import json

from swing_screener.intelligence.history import (
    append_history,
    entry_from_result,
    read_history,
)
from swing_screener.intelligence.models import PredictionBullet, SymbolIntelligence


def _result(summary: str, risks=None, generated_at="2026-06-25T08:00:00Z", predictions=None) -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol="AAPL",
        generated_at=generated_at,
        action="MANAGE_ONLY",
        conviction="medium",
        summary_line=summary,
        narrative="Text.",
        risk_factors=risks or [],
        prediction_bullets=predictions or [],
    )


def test_watch_for_prefers_prediction_bullets_over_risks():
    entry = entry_from_result(
        _result(
            "hold",
            risks=["generic risk a", "generic risk b"],
            predictions=[
                PredictionBullet(direction="bullish", reason="holds SMA20", reference="technical"),
                PredictionBullet(direction="bearish", reason="earnings risk", reference="Q2"),
                PredictionBullet(direction="neutral", reason="third", reference="x"),
            ],
        )
    )
    assert entry.watch_for == ["holds SMA20", "earnings risk"]


def test_watch_for_falls_back_to_risks_when_no_predictions():
    entry = entry_from_result(_result("hold", risks=["a", "b", "c"]))
    assert entry.watch_for == ["a", "b"]
    assert entry.action == "MANAGE_ONLY"
    assert entry.summary_line == "hold"


def _day(i: int) -> str:
    return f"2026-06-{10 + i:02d}T08:00:00Z"


def test_append_then_read_newest_first(tmp_path):
    append_history("aapl", _result("first", generated_at=_day(0)), max_entries=50, history_root=tmp_path)
    append_history("AAPL", _result("second", generated_at=_day(1)), max_entries=50, history_root=tmp_path)
    entries = read_history("AAPL", history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["second", "first"]


def test_append_caps_at_max_entries(tmp_path):
    for i in range(5):
        append_history("AAPL", _result(f"run-{i}", generated_at=_day(i)), max_entries=3, history_root=tmp_path)
    entries = read_history("AAPL", history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["run-4", "run-3", "run-2"]


def test_read_limit(tmp_path):
    for i in range(4):
        append_history("AAPL", _result(f"run-{i}", generated_at=_day(i)), max_entries=50, history_root=tmp_path)
    entries = read_history("AAPL", limit=2, history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["run-3", "run-2"]


def test_read_missing_returns_empty(tmp_path):
    assert read_history("NOPE", history_root=tmp_path) == []


def test_read_corrupt_returns_empty(tmp_path):
    (tmp_path / "history").mkdir(parents=True)
    (tmp_path / "history" / "AAPL.json").write_text("{not json")
    assert read_history("AAPL", history_root=tmp_path) == []


def test_read_skips_bad_entry_keeps_good(tmp_path):
    (tmp_path / "history").mkdir(parents=True)
    good = {
        "generated_at": "2026-06-25T08:00:00Z",
        "action": "BUY_NOW",
        "conviction": "high",
        "summary_line": "good",
        "watch_for": [],
    }
    bad = {"generated_at": "2026-06-24T08:00:00Z"}  # missing required fields
    (tmp_path / "history" / "AAPL.json").write_text(json.dumps([good, bad]))
    entries = read_history("AAPL", history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["good"]


def test_read_skips_nonsense_action_keeps_valid(tmp_path):
    """Row with out-of-vocab action is skipped; file is not discarded."""
    (tmp_path / "history").mkdir(parents=True)
    valid = {
        "generated_at": "2026-06-25T08:00:00Z",
        "action": "BUY_NOW",
        "conviction": "high",
        "summary_line": "valid entry",
        "watch_for": [],
    }
    bad_action = {
        "generated_at": "2026-06-24T08:00:00Z",
        "action": "NONSENSE",
        "conviction": "low",
        "summary_line": "bad entry",
        "watch_for": [],
    }
    (tmp_path / "history" / "AAPL.json").write_text(json.dumps([valid, bad_action]))
    entries = read_history("AAPL", history_root=tmp_path)
    assert len(entries) == 1
    assert entries[0].summary_line == "valid entry"


def test_append_same_day_replaces_not_stacks(tmp_path):
    append_history("AAPL", _result("morning", generated_at="2026-06-25T08:00:00Z"), max_entries=50, history_root=tmp_path)
    append_history("AAPL", _result("midday", generated_at="2026-06-25T14:00:00Z"), max_entries=50, history_root=tmp_path)
    append_history("AAPL", _result("yesterday", generated_at="2026-06-24T14:00:00Z"), max_entries=50, history_root=tmp_path)
    entries = read_history("AAPL", history_root=tmp_path)
    # Same-day 08:00 entry replaced by the 14:00 rerun; the other day is kept.
    assert [e.summary_line for e in entries] == ["yesterday", "midday"]


def test_history_entry_rejects_unknown_action():
    import pytest
    from swing_screener.intelligence.history import HistoryEntry
    with pytest.raises(ValueError):
        HistoryEntry(generated_at="2026-06-25T00:00:00+00:00", action="NONSENSE",
                     conviction="low", summary_line="s")


def test_entry_from_result_captures_predictions():
    from swing_screener.intelligence.history import entry_from_result
    from swing_screener.intelligence.models import SymbolIntelligence, PredictionBullet
    res = SymbolIntelligence(symbol="AAA", generated_at="2026-06-25T00:00:00+00:00",
        action="WATCH", conviction="low", catalyst_urgency="none", summary_line="s",
        narrative="n", prediction_bullets=[PredictionBullet(direction="bullish", reason="r", reference="ref")])
    e = entry_from_result(res)
    assert e.predictions and e.predictions[0].direction == "bullish"


def test_append_marks_prior_prediction_confirmed_from_thesis_delta(tmp_path):
    from swing_screener.intelligence.models import ThesisDelta

    append_history(
        "AAPL",
        _result(
            "first",
            generated_at="2026-06-24T08:00:00Z",
            predictions=[
                PredictionBullet(
                    direction="bullish",
                    reason="earnings beat supports breakout",
                    reference="earnings",
                )
            ],
        ),
        max_entries=50,
        history_root=tmp_path,
    )
    follow_up = _result("second", generated_at="2026-06-25T08:00:00Z")
    follow_up.thesis_delta = ThesisDelta(
        status="confirmed",
        summary="Earnings beat played out.",
        what_played_out=["Earnings beat supported the breakout"],
    )

    append_history("AAPL", follow_up, max_entries=50, history_root=tmp_path)

    entries = read_history("AAPL", history_root=tmp_path)
    prior_prediction = entries[1].predictions[0]
    assert prior_prediction.outcome is not None
    assert prior_prediction.outcome.status == "confirmed"
    assert prior_prediction.outcome.evidence == "Earnings beat supported the breakout"


def test_append_marks_prior_prediction_unresolved_when_follow_up_has_no_match(tmp_path):
    append_history(
        "AAPL",
        _result(
            "first",
            generated_at="2026-06-24T08:00:00Z",
            predictions=[
                PredictionBullet(
                    direction="bearish",
                    reason="valuation compression risk",
                    reference="valuation",
                )
            ],
        ),
        max_entries=50,
        history_root=tmp_path,
    )

    append_history(
        "AAPL",
        _result("second", generated_at="2026-06-25T08:00:00Z"),
        max_entries=50,
        history_root=tmp_path,
    )

    entries = read_history("AAPL", history_root=tmp_path)
    prior_prediction = entries[1].predictions[0]
    assert prior_prediction.outcome is not None
    assert prior_prediction.outcome.status == "unresolved"
    assert prior_prediction.outcome.evidence == "No matching follow-up evidence yet."


def test_generic_two_token_overlap_does_not_confirm(tmp_path):
    """A couple of incidentally-shared generic words must not confirm a prediction
    against unrelated follow-up evidence."""
    from swing_screener.intelligence.models import ThesisDelta

    append_history(
        "AAPL",
        _result(
            "first",
            generated_at="2026-06-24T08:00:00Z",
            predictions=[
                PredictionBullet(
                    direction="bullish",
                    reason="earnings growth should accelerate next year",
                    reference="growth",
                )
            ],
        ),
        max_entries=50,
        history_root=tmp_path,
    )
    follow_up = _result("second", generated_at="2026-06-25T08:00:00Z")
    follow_up.thesis_delta = ThesisDelta(
        status="confirmed",
        summary="Unrelated development.",
        what_played_out=["Guidance cut despite earnings growth last quarter"],
    )

    append_history("AAPL", follow_up, max_entries=50, history_root=tmp_path)

    entries = read_history("AAPL", history_root=tmp_path)
    prior_prediction = entries[1].predictions[0]
    assert prior_prediction.outcome is not None
    assert prior_prediction.outcome.status == "unresolved"


def test_read_history_accepts_legacy_predictions_without_outcomes(tmp_path):
    (tmp_path / "history").mkdir(parents=True)
    legacy = {
        "generated_at": "2026-06-25T08:00:00Z",
        "action": "WATCH",
        "conviction": "low",
        "summary_line": "legacy",
        "watch_for": [],
        "predictions": [
            {"direction": "bullish", "reason": "holds SMA20", "reference": "technical"}
        ],
    }
    (tmp_path / "history" / "AAPL.json").write_text(json.dumps([legacy]))

    entries = read_history("AAPL", history_root=tmp_path)

    assert entries[0].predictions[0].outcome is None


def test_unresolved_prediction_can_be_confirmed_by_later_follow_up(tmp_path):
    from swing_screener.intelligence.models import ThesisDelta

    append_history(
        "AAPL",
        _result(
            "first",
            generated_at="2026-06-24T08:00:00Z",
            predictions=[
                PredictionBullet(
                    direction="bullish",
                    reason="product launch supports demand",
                    reference="product",
                )
            ],
        ),
        max_entries=50,
        history_root=tmp_path,
    )
    append_history(
        "AAPL",
        _result("second", generated_at="2026-06-25T08:00:00Z"),
        max_entries=50,
        history_root=tmp_path,
    )
    later = _result("third", generated_at="2026-06-26T08:00:00Z")
    later.thesis_delta = ThesisDelta(
        status="confirmed",
        summary="Launch demand improved.",
        what_played_out=["Product launch supported demand"],
    )

    append_history("AAPL", later, max_entries=50, history_root=tmp_path)

    entries = read_history("AAPL", history_root=tmp_path)
    outcome = entries[2].predictions[0].outcome
    assert outcome is not None
    assert outcome.status == "confirmed"
