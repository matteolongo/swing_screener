from datetime import date

from swing_screener.intelligence.evidence.curation import curate
from swing_screener.intelligence.evidence.models import SourceEvidence


def _ev(title, url, published_at, summary="s"):
    return SourceEvidence(
        title=title, url=url, publisher="P", published_at=published_at,
        quote_or_summary=summary, relevance="r",
    )


ASOF = date(2026, 6, 24)


def test_drops_items_older_than_window():
    items = [_ev("old", "u1", "2026-05-01"), _ev("fresh", "u2", "2026-06-20")]
    out = curate(items, window_days=30, max_items=8, asof_date=ASOF)
    assert [e.title for e in out] == ["fresh"]


def test_drops_undated_and_future_items():
    items = [_ev("nodate", "u1", None), _ev("future", "u2", "2026-07-01")]
    assert curate(items, window_days=30, max_items=8, asof_date=ASOF) == []


def test_dedups_by_normalized_title_and_url():
    items = [_ev("Big  News", "http://x/a/", "2026-06-20"), _ev("big news", "http://x/a", "2026-06-21")]
    out = curate(items, window_days=30, max_items=8, asof_date=ASOF)
    assert len(out) == 1


def test_sorts_newest_first_and_caps():
    items = [_ev(f"n{i}", f"u{i}", f"2026-06-{10 + i:02d}") for i in range(5)]
    out = curate(items, window_days=60, max_items=3, asof_date=ASOF)
    assert [e.title for e in out] == ["n4", "n3", "n2"]


def test_parses_rfc822_iso_already_normalized():
    items = [_ev("a", "u1", "2026-06-20")]
    assert len(curate(items, window_days=30, max_items=8, asof_date=ASOF)) == 1
