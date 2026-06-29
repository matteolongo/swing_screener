"""Tests for DegiroNewsCollector covering B1 (singleton reset) and B2 (continue on bad date)."""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from swing_screener.intelligence.evidence.collectors.degiro_news import DegiroNewsCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig

CFG = EvidenceConfig()
ASOF = date(2026, 6, 30)
FAKE_ISIN = "NL0000009165"


def _make_item(
    *,
    item_date,
    title: str = "Some headline",
    brief: str = "Brief text",
    content: str = "",
    id: str = "n1",
    provider: str = "Reuters",
    category: str = "general",
) -> SimpleNamespace:
    return SimpleNamespace(
        date=item_date,
        title=title,
        brief=brief,
        content=content,
        id=id,
        provider=provider,
        category=category,
    )


def _make_batch(items: list) -> SimpleNamespace:
    return SimpleNamespace(items=items)


def test_skips_item_with_unparseable_date():
    """B2 fix: item with a bad date should be skipped (continue), not silently included."""
    recent_item = _make_item(item_date=ASOF - timedelta(days=5), title="Recent news", id="n1")
    bad_date_item = _make_item(item_date=None, title="No date", id="n2")

    fake_client = MagicMock()
    fake_client.api.get_news_by_company.return_value = _make_batch([bad_date_item, recent_item])

    # Patch NewsRequest import so the try block in collect() doesn't fail
    import sys
    from types import ModuleType
    if "degiro_connector.trading.models.news" not in sys.modules:
        news_mod = ModuleType("degiro_connector.trading.models.news")
        news_mod.NewsRequest = MagicMock
        sys.modules.setdefault("degiro_connector", ModuleType("degiro_connector"))
        sys.modules.setdefault("degiro_connector.trading", ModuleType("degiro_connector.trading"))
        sys.modules.setdefault("degiro_connector.trading.models", ModuleType("degiro_connector.trading.models"))
        sys.modules["degiro_connector.trading.models.news"] = news_mod

    with (
        patch(
            "swing_screener.intelligence.evidence.collectors.degiro_news._get_client",
            return_value=fake_client,
        ),
        patch(
            "swing_screener.intelligence.evidence.collectors.degiro_news._resolve_isin",
            return_value=FAKE_ISIN,
        ),
    ):
        out = DegiroNewsCollector.collect("ASML", asof_date=ASOF, cfg=CFG)

    # bad_date_item triggers the except branch → continue; recent_item should still be returned
    assert len(out) == 1
    assert out[0].title == "Recent news"


def test_fetch_exception_resets_client_singleton():
    """B1 fix: on fetch failure, _client_singleton is cleared so next call retries connect."""
    import swing_screener.intelligence.evidence.collectors.degiro_news as mod

    fake_client = MagicMock()
    fake_client.api.get_news_by_company.side_effect = RuntimeError("connection dropped")

    mod._client_singleton = fake_client

    with patch(
        "swing_screener.intelligence.evidence.collectors.degiro_news._resolve_isin",
        return_value=FAKE_ISIN,
    ):
        out = DegiroNewsCollector.collect("ASML", asof_date=ASOF, cfg=CFG)

    assert out == []
    assert mod._client_singleton is None

    # Restore module state for isolation
    mod._client_singleton = None


def test_no_client_returns_empty():
    """Without credentials, collect returns []."""
    with patch(
        "swing_screener.intelligence.evidence.collectors.degiro_news._get_client",
        return_value=None,
    ):
        out = DegiroNewsCollector.collect("ASML", asof_date=ASOF, cfg=CFG)
    assert out == []


def test_no_isin_returns_empty():
    """Without ISIN mapping, collect returns []."""
    fake_client = MagicMock()
    with (
        patch(
            "swing_screener.intelligence.evidence.collectors.degiro_news._get_client",
            return_value=fake_client,
        ),
        patch(
            "swing_screener.intelligence.evidence.collectors.degiro_news._resolve_isin",
            return_value=None,
        ),
    ):
        out = DegiroNewsCollector.collect("UNKNOWN", asof_date=ASOF, cfg=CFG)
    assert out == []
