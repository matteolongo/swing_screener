"""Pytest configuration and shared fixtures for all tests."""

import json
import re
import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_ollama_client():
    """Mock Ollama client that returns valid classification responses."""
    
    def create_mock_response(text: str):
        """Generate mock Ollama response based on headline/snippet text."""
        # Determine event type from available text context.
        headline_lower = text.lower()
        if "earnings" in headline_lower or "revenue" in headline_lower:
            event_type = "EARNINGS"
            severity = "HIGH"
        elif "acquisition" in headline_lower or "m&a" in headline_lower:
            event_type = "M_AND_A"
            severity = "HIGH"
        elif "product" in headline_lower or "launch" in headline_lower:
            event_type = "PRODUCT"
            severity = "MEDIUM"
        else:
            event_type = "OTHER"
            severity = "LOW"
        
        # Use json.dumps to ensure valid JSON without control characters
        return {
            "message": {
                "content": json.dumps({
                    "event_type": event_type,
                    "severity": severity,
                    "primary_symbol": "AAPL",
                    "secondary_symbols": [],
                    "is_material": True,
                    "confidence": 0.9,
                    "summary": f"Test classification for: {text[:50].strip()}"
                })
            }
        }
    
    mock_client = MagicMock()
    
    # Mock list() to return available models
    mock_client.list.return_value = {
        "models": [
            {"name": "mistral:7b-instruct"},
            {"name": "llama3:latest"}
        ]
    }
    
    # Mock chat() to return classification
    def mock_chat(model, messages, format=None, options=None):
        # Extract headline from the full prompt payload.
        user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
        headline_match = re.search(r'Headline:\s*"([^"]*)"', user_msg)
        snippet_match = re.search(r'Snippet:\s*"([^"]*)"', user_msg)
        headline = headline_match.group(1) if headline_match else user_msg
        snippet = snippet_match.group(1) if snippet_match else ""
        return create_mock_response(f"{headline} {snippet}".strip())
    
    mock_client.chat.side_effect = mock_chat
    
    return mock_client


@pytest.fixture
def mock_ollama_provider(monkeypatch, mock_ollama_client):
    """Patch OllamaProvider to use mocked client."""
    def mock_get_client(self):
        return mock_ollama_client
    
    from swing_screener.intelligence.llm.client import OllamaProvider
    monkeypatch.setattr(OllamaProvider, "_get_client", mock_get_client)
    
    return OllamaProvider


@pytest.fixture
def mock_llm_provider():
    """Provide MockLLMProvider for simple tests."""
    from swing_screener.intelligence.llm import MockLLMProvider
    return MockLLMProvider()
