from __future__ import annotations

from swing_screener.intelligence.evidence.registry import get_registered, register


def test_register_adds_collector_by_source_id():
    @register
    class _Dummy:
        SOURCE_ID = "dummy_src"

        @classmethod
        def collect(cls, ticker, *, asof_date, cfg):
            return []

    assert get_registered()["dummy_src"] is _Dummy


def test_existing_collectors_are_registered():
    from swing_screener.intelligence.evidence.collectors import (  # noqa: F401
        degiro_news,
        polygon_news,
        sec_edgar,
    )

    reg = get_registered()
    assert {"sec_edgar_catalysts", "polygon_news", "degiro_news"} <= set(reg)
