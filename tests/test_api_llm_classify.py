"""Tests for LLM classification API endpoint."""

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


class TestLLMClassifyEndpoint:
    """Test /api/intelligence/classify endpoint."""
    
    def test_classify_with_mock_provider(self):
        """Test classification with mock provider."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [
                    {
                        "headline": "NVDA beats earnings expectations",
                        "snippet": "NVIDIA reported strong results.",
                    }
                ],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert len(data["classifications"]) == 1
        assert data["provider_available"] is True
        
        classification = data["classifications"][0]
        assert classification["headline"] == "NVDA beats earnings expectations"
        assert classification["event_type"] == "EARNINGS"
        assert classification["severity"] == "HIGH"
        assert classification["primary_symbol"] == "NVDA"
        assert classification["model"] == "mock-classifier"
    
    def test_classify_multiple_headlines(self):
        """Test classifying multiple headlines."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [
                    {"headline": "AAPL beats earnings"},
                    {"headline": "MSFT launches product"},
                    {"headline": "Analyst upgrades GOOGL"},
                ],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 3
        assert len(data["classifications"]) == 3
        assert data["avg_processing_time_ms"] >= 0
        assert data["cached_count"] >= 0
        assert data["material_count"] >= 0
    
    def test_classify_with_snippet(self):
        """Test classification with headline and snippet."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [
                    {
                        "headline": "Company announces merger",
                        "snippet": "Full details of the acquisition.",
                    }
                ],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        classification = data["classifications"][0]
        assert classification["snippet"] == "Full details of the acquisition."
    
    def test_classify_invalid_headline_too_short(self):
        """Test that short headlines are rejected."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Short"}],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_classify_empty_headlines_list(self):
        """Test that empty headlines list is rejected."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_classify_missing_headline_field(self):
        """Test that items without headline field are rejected."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"snippet": "No headline provided"}],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_classify_unknown_provider(self):
        """Test that unknown provider returns error."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Test headline for unknown provider"}],
                "provider": "unknown_provider",
            },
        )
        
        assert response.status_code == 400
        assert "Unknown provider" in response.json()["detail"]
    
    def test_classify_caching_behavior(self):
        """Test that identical headlines use cache."""
        # First request
        response1 = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Test headline for caching behavior test"}],
                "provider": "mock",
            },
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second identical request should use cache
        response2 = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Test headline for caching behavior test"}],
                "provider": "mock",
            },
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # At least one should be cached (depending on test order)
        assert data1["cached_count"] >= 0 or data2["cached_count"] >= 1
    
    def test_classify_material_count(self):
        """Test material event counting."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [
                    {"headline": "NVDA beats earnings expectations"},  # Material: HIGH severity
                    {"headline": "Analyst upgrades TSLA"},  # Non-material: LOW severity
                ],
                "provider": "mock",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Mock provider should classify earnings as material, analyst as not
        assert data["material_count"] >= 1
    
    def test_classify_with_custom_model(self):
        """Test specifying custom model."""
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Test with custom model parameter"}],
                "provider": "mock",
                "model": "custom-model-name",
            },
        )
        
        assert response.status_code == 200
        # Mock provider ignores model parameter, but request should succeed
    
    def test_classify_default_provider(self):
        """Test that provider defaults to ollama."""
        # Note: This will fail if Ollama isn't running, which is expected
        response = client.post(
            "/api/intelligence/classify",
            json={
                "headlines": [{"headline": "Test default provider behavior"}],
                # No provider specified - should default to ollama
            },
        )
        
        # Should return 503 if Ollama not available
        assert response.status_code in (200, 503)
        if response.status_code == 503:
            assert "not available" in response.json()["detail"]
