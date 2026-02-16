"""Tests for Yahoo Finance provider."""
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from swing_screener.social.cache import SocialCache
from swing_screener.social.providers.yahoo_finance import YahooFinanceProvider


@pytest.fixture
def mock_cache(tmp_path):
    """Create a mock cache."""
    return SocialCache(base_dir=tmp_path)


@pytest.fixture
def provider(mock_cache):
    """Create a Yahoo Finance provider."""
    return YahooFinanceProvider(
        user_agent="test-agent",
        rate_limit_per_sec=10.0,  # Fast for tests
        cache=mock_cache,
    )


def test_provider_name(provider):
    """Test provider has correct name."""
    assert provider.name == "yahoo_finance"


def test_fetch_events_cached(tmp_path):
    """Test that cached events are returned without making HTTP calls."""
    from swing_screener.social.models import SocialRawEvent
    from datetime import datetime, timezone
    
    # Create a test cache and provider
    test_cache = SocialCache(base_dir=tmp_path / "test_cached")
    
    # Store cached events first
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    target_date = now.date()
    cached_events = [
        SocialRawEvent(
            source="yahoo_finance",
            symbol="AAPL",
            timestamp=now,
            text="Apple announces new product",
            url="https://example.com/news",
        )
    ]
    test_cache.store_events("yahoo_finance", target_date, cached_events)
    
    # Now create provider with the cache that has data
    test_provider = YahooFinanceProvider(
        user_agent="test-agent",
        rate_limit_per_sec=10.0,
        cache=test_cache,
    )
    
    # Mock httpx.Client to ensure it's never called
    with patch("swing_screener.social.providers.yahoo_finance.httpx.Client") as mock_client:
        mock_client.side_effect = Exception("Should not make HTTP request")
        
        # Fetch events for the exact same date we stored
        start_dt = now - timedelta(hours=1)
        end_dt = now + timedelta(hours=1)
        events = test_provider.fetch_events(start_dt, end_dt, ["AAPL"])
        
        # Verify we got the cached events back
        assert len(events) == 1
        assert events[0].symbol == "AAPL"
        assert events[0].source == "yahoo_finance"
        assert "Apple announces new product" in events[0].text


def test_fetch_events_api_call(tmp_path):
    """Test fetching events from Yahoo Finance API."""
    from datetime import datetime, timezone
    
    # Use fresh cache to avoid cached data
    fresh_cache = SocialCache(base_dir=tmp_path / "test_api_call")
    test_provider = YahooFinanceProvider(
        user_agent="test-agent",
        rate_limit_per_sec=10.0,
        cache=fresh_cache,
    )
    
    now = datetime.now(timezone.utc)
    mock_response = {
        "news": [
            {
                "title": "Apple Stock Rises",
                "summary": "Apple sees gains in trading",
                "providerPublishTime": int(now.timestamp()),
                "link": "https://example.com/news1",
                "publisher": "TestNews",
                "type": "STORY",
            },
            {
                "title": "Apple Q4 Earnings",
                "summary": "Strong quarter reported",
                "providerPublishTime": int(now.timestamp()),
                "link": "https://example.com/news2",
                "publisher": "FinanceDaily",
                "type": "STORY",
            },
        ]
    }
    
    with patch("swing_screener.social.providers.yahoo_finance.httpx.Client") as mock_client:
        mock_get = Mock()
        mock_get.json.return_value = mock_response
        mock_get.raise_for_status = Mock()
        mock_client.return_value.__enter__.return_value.get = Mock(return_value=mock_get)
        
        start_dt = now - timedelta(hours=24)
        end_dt = now
        events = test_provider.fetch_events(start_dt, end_dt, ["AAPL"])
        
        assert len(events) == 2
        assert all(e.symbol == "AAPL" for e in events)
        assert all(e.source == "yahoo_finance" for e in events)
        assert "Apple Stock Rises" in events[0].text or "Apple Q4 Earnings" in events[0].text


def test_fetch_events_empty_response(tmp_path):
    """Test handling of empty API response."""
    from datetime import datetime, timezone
    
    # Use fresh cache
    fresh_cache = SocialCache(base_dir=tmp_path / "test_empty")
    test_provider = YahooFinanceProvider(
        user_agent="test-agent",
        rate_limit_per_sec=10.0,
        cache=fresh_cache,
    )
    
    mock_response = {"news": []}
    
    with patch("swing_screener.social.providers.yahoo_finance.httpx.Client") as mock_client:
        mock_get = Mock()
        mock_get.json.return_value = mock_response
        mock_get.raise_for_status = Mock()
        mock_client.return_value.__enter__.return_value.get = Mock(return_value=mock_get)
        
        now = datetime.now(timezone.utc)
        start_dt = now - timedelta(hours=24)
        end_dt = now
        events = test_provider.fetch_events(start_dt, end_dt, ["AAPL"])
        
        assert len(events) == 0


def test_fetch_events_multiple_symbols(tmp_path):
    """Test fetching events for multiple symbols."""
    from datetime import datetime, timezone
    
    # Use fresh cache
    fresh_cache = SocialCache(base_dir=tmp_path / "test_multiple")
    test_provider = YahooFinanceProvider(
        user_agent="test-agent",
        rate_limit_per_sec=10.0,
        cache=fresh_cache,
    )
    
    now = datetime.now(timezone.utc)
    
    def mock_response(url, params=None):
        symbol = params.get("q") if params else "AAPL"
        mock_get = Mock()
        mock_get.json.return_value = {
            "news": [
                {
                    "title": f"{symbol} News",
                    "summary": f"News about {symbol}",
                    "providerPublishTime": int(now.timestamp()),
                    "link": f"https://example.com/{symbol}",
                    "publisher": "TestNews",
                    "type": "STORY",
                }
            ]
        }
        mock_get.raise_for_status = Mock()
        return mock_get
    
    with patch("swing_screener.social.providers.yahoo_finance.httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get = mock_response
        
        start_dt = now - timedelta(hours=24)
        end_dt = now
        events = test_provider.fetch_events(start_dt, end_dt, ["AAPL", "MSFT", "GOOGL"])
        
        assert len(events) == 3
        symbols = {e.symbol for e in events}
        assert "AAPL" in symbols
        assert "MSFT" in symbols
        assert "GOOGL" in symbols
