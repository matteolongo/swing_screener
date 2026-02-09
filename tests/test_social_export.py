from datetime import date, datetime

from swing_screener.social.cache import SocialCache
from swing_screener.social.export import load_events_df, load_metrics_df, export_social_cache
from swing_screener.social.models import SocialRawEvent, SocialDailyMetrics


def test_social_export_creates_files(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    day = date(2026, 2, 8)

    events = [
        SocialRawEvent(
            source="reddit",
            symbol="TSLA",
            timestamp=datetime(2026, 2, 8, 10, 0, 0),
            text="TSLA to the moon",
            author_id_hash=None,
        )
    ]
    cache.store_events("reddit", day, events)

    metrics = [
        SocialDailyMetrics(
            symbol="TSLA",
            date=day,
            attention_score=1.0,
            attention_z=None,
            sentiment_score=0.1,
            sentiment_confidence=0.2,
            hype_score=0.3,
            sample_size=1,
            source_breakdown={"reddit": 1},
        )
    ]
    cache.store_metrics(day, metrics)

    out_dir = tmp_path / "out"
    saved = export_social_cache(
        cache,
        out_dir=out_dir,
        fmt="parquet",
        scope="both",
        provider="reddit",
    )

    assert "events" in saved
    assert "metrics" in saved
    assert (out_dir / "social_events.parquet").exists()
    assert (out_dir / "social_metrics.parquet").exists()


def test_loaders_add_cache_date(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    day = date(2026, 2, 8)

    cache.store_events(
        "reddit",
        day,
        [
            SocialRawEvent(
                source="reddit",
                symbol="AAPL",
                timestamp=datetime(2026, 2, 8, 9, 0, 0),
                text="AAPL",
                author_id_hash=None,
            )
        ],
    )
    cache.store_metrics(
        day,
        [
            SocialDailyMetrics(
                symbol="AAPL",
                date=day,
                attention_score=1.0,
                attention_z=None,
                sentiment_score=0.0,
                sentiment_confidence=0.0,
                hype_score=None,
                sample_size=1,
                source_breakdown={"reddit": 1},
            )
        ],
    )

    events_df = load_events_df(cache, provider="reddit")
    metrics_df = load_metrics_df(cache)

    assert "cache_date" in events_df.columns
    assert "cache_date" in metrics_df.columns
    assert events_df.loc[0, "cache_date"] == "2026-02-08"
    assert metrics_df.loc[0, "cache_date"] == "2026-02-08"
