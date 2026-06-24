from swing_screener.fundamentals.service import FundamentalsAnalysisService
from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.data.source_health import recent_events, reset_fallback_events


class _BoomProvider:
    name = "sec_edgar"

    def fetch_record(self, symbol):
        raise RuntimeError("sec edgar 503")


class _OkProvider:
    name = "yfinance"

    def fetch_record(self, symbol):
        from swing_screener.fundamentals.models import ProviderFundamentalsRecord
        return ProviderFundamentalsRecord(symbol=symbol, asof_date="2026-06-24", provider="yfinance")


def test_provider_exception_records_fallback_event(monkeypatch, tmp_path):
    reset_fallback_events()
    service = FundamentalsAnalysisService()
    monkeypatch.setattr(
        service, "_providers_for", lambda cfg: [_BoomProvider(), _OkProvider()]
    )
    monkeypatch.setattr(service._storage, "load_snapshot", lambda s: None)
    monkeypatch.setattr(service._storage, "save_snapshot", lambda s: None)

    service.get_snapshot("AAPL", cfg=FundamentalsConfig())

    events = recent_events()
    assert any(
        e.domain == "fundamentals" and e.from_provider == "sec_edgar" and e.fell_back_to == "yfinance"
        for e in events
    )
