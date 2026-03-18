"""Pytest configuration and shared fixtures for all tests."""

import pytest


@pytest.fixture
def mock_llm_provider():
    """Provide MockLLMProvider for simple tests."""
    from swing_screener.intelligence.llm import MockLLMProvider

    return MockLLMProvider()
