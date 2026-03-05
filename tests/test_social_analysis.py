from __future__ import annotations

from datetime import timedelta

import pandas as pd

from swing_screener.social.analysis import analyze_social_symbol
from swing_screener.social.cache import SocialCache
from swing_screener.social.models import SocialDailyMetrics, SocialRawEvent


class _DummyAnalyzer:
    name = "keyword"

    def analyze(self, _text: str):  # pragma: no cover - not used in patched metrics path
        return None


class _DummyMarketDataProvider:
    def fetch_ohlcv(self, *_args, **_kwargs):
        return pd.DataFrame()


def test_analyze_social_symbol_survives_single_provider_failure(monkeypatch, tmp_path, caplog):
    cache = SocialCache(base_dir=tmp_path)

    def fake_provider_for(name: str, _cache: SocialCache):
        class _Provider:
            def fetch_events(self, _start_dt, end_dt, symbols):
                if name == "reddit":
                    raise RuntimeError("403 blocked")
                return [
                    SocialRawEvent(
                        source="yahoo_finance",
                        symbol=symbols[0],
                        timestamp=end_dt - timedelta(hours=1),
                        text="Positive guidance update",
                    )
                ]

        return _Provider()

    def fake_compute_daily_metrics(events, symbols, _ohlcv, asof_date, _cache, **_kwargs):
        assert len(events) == 1
        assert events[0].source == "yahoo_finance"
        return [
            SocialDailyMetrics(
                symbol=symbols[0],
                date=asof_date,
                attention_score=1.0,
                attention_z=0.0,
                sentiment_score=0.4,
                sentiment_confidence=0.8,
                hype_score=1.0,
                sample_size=25,
                source_breakdown={"yahoo_finance": 1},
            )
        ]

    monkeypatch.setattr("swing_screener.social.analysis._provider_for", fake_provider_for)
    monkeypatch.setattr("swing_screener.social.analysis.compute_daily_metrics", fake_compute_daily_metrics)
    monkeypatch.setattr("swing_screener.social.analysis.get_market_data_provider", lambda: _DummyMarketDataProvider())
    monkeypatch.setattr(
        "swing_screener.social.sentiment.factory.get_sentiment_analyzer",
        lambda _name: _DummyAnalyzer(),
    )

    caplog.set_level("WARNING")

    result = analyze_social_symbol(
        "AALFG.AS",
        lookback_hours=24,
        min_sample_size=20,
        provider_names=["yahoo_finance", "reddit"],
        sentiment_analyzer_name="keyword",
        max_events=100,
        cache=cache,
    )

    assert result["status"] == "ok"
    assert result["sample_size"] == 25
    assert result["raw_events"]
    assert result["error"] is not None
    assert "reddit: 403 blocked" in result["error"]
    assert "Social provider 'reddit' failed" in caplog.text


def test_analyze_social_symbol_returns_error_when_all_providers_fail(monkeypatch, tmp_path):
    cache = SocialCache(base_dir=tmp_path)

    def fake_provider_for(name: str, _cache: SocialCache):
        class _Provider:
            def fetch_events(self, *_args, **_kwargs):
                raise RuntimeError(f"{name} unavailable")

        return _Provider()

    monkeypatch.setattr("swing_screener.social.analysis._provider_for", fake_provider_for)
    monkeypatch.setattr(
        "swing_screener.social.sentiment.factory.get_sentiment_analyzer",
        lambda _name: _DummyAnalyzer(),
    )

    result = analyze_social_symbol(
        "AALFG.AS",
        lookback_hours=24,
        min_sample_size=20,
        provider_names=["yahoo_finance", "reddit"],
        sentiment_analyzer_name="keyword",
        max_events=100,
        cache=cache,
    )

    assert result["status"] == "error"
    assert result["sample_size"] == 0
    assert result["raw_events"] == []
    assert result["error"] is not None
    assert "yahoo_finance: yahoo_finance unavailable" in result["error"]
    assert "reddit: reddit unavailable" in result["error"]
