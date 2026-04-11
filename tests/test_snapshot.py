from datetime import date

from swing_screener.recommendation.snapshot import build_symbol_analysis_snapshot


def test_consistent_snapshot_when_all_layers_match():
    snap = build_symbol_analysis_snapshot(
        symbol="AAPL",
        reference_date=date(2026, 4, 11),
        source_dates={
            "technical": date(2026, 4, 11),
            "fundamentals": date(2026, 4, 11),
            "intelligence": date(2026, 4, 11),
        },
    )
    assert snap.is_consistent_snapshot is True
    assert snap.warnings == []
    assert len(snap.source_meta) == 3
    assert all(m.is_fresh for m in snap.source_meta)


def test_inconsistent_snapshot_produces_warning_for_stale_layer():
    snap = build_symbol_analysis_snapshot(
        symbol="AAPL",
        reference_date=date(2026, 4, 11),
        source_dates={
            "technical": date(2026, 4, 11),
            "fundamentals": date(2026, 4, 8),
            "intelligence": date(2026, 4, 11),
        },
    )
    assert snap.is_consistent_snapshot is False
    assert any("fundamentals" in w for w in snap.warnings)
    assert any("3 day(s)" in w for w in snap.warnings)
    # technical and intelligence are fresh; only fundamentals warning
    assert len(snap.warnings) == 1


def test_missing_layer_does_not_trigger_consistency_failure():
    """A layer with asof_date=None (data unavailable) must not mark the snapshot
    as inconsistent — unavailability is different from a stale date."""
    snap = build_symbol_analysis_snapshot(
        symbol="AAPL",
        reference_date=date(2026, 4, 11),
        source_dates={
            "technical": date(2026, 4, 11),
            "fundamentals": None,
            "intelligence": date(2026, 4, 11),
        },
    )
    assert snap.is_consistent_snapshot is True
    assert snap.warnings == []
    # fundamentals layer present in source_meta but not fresh
    fund_meta = next(m for m in snap.source_meta if m.layer == "fundamentals")
    assert fund_meta.asof_date is None
    assert fund_meta.is_fresh is False
