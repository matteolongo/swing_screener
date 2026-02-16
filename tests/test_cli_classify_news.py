"""Tests for classify-news CLI command."""

import json
import sys
from pathlib import Path

import pytest

from swing_screener.cli import main


def _run_cli(args: list[str]) -> None:
    """Helper to run CLI with given arguments."""
    old_argv = sys.argv
    try:
        sys.argv = ["swing-screener"] + args
        main()
    finally:
        sys.argv = old_argv


class TestClassifyNewsCLI:
    """Tests for the classify-news CLI command."""
    
    def test_classify_news_with_mock_provider(self, capsys):
        """Test classify-news command with mock provider."""
        _run_cli([
            "classify-news",
            "--symbols", "AAPL", "NVDA",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Check output contains expected content
        assert "Using LLM: mock-classifier" in output
        assert "Classifying news for symbols: AAPL, NVDA" in output
        assert "Using MOCK news data" in output
        assert "Classified" in output
        assert "items" in output
    
    def test_classify_news_with_output_file(self, tmp_path, capsys):
        """Test classify-news with output file."""
        output_file = tmp_path / "results.json"
        
        _run_cli([
            "classify-news",
            "--symbols", "AAPL",
            "--mock",
            "--provider", "mock",
            "--output", str(output_file),
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Check file was created
        assert output_file.exists()
        assert f"Saved results to: {output_file.resolve()}" in output
        
        # Check file content
        with open(output_file) as f:
            data = json.load(f)
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check structure of first item
        item = data[0]
        assert "headline" in item
        assert "event_type" in item
        assert "severity" in item
        assert "is_material" in item
        assert "confidence" in item
        assert "summary" in item
        assert "model" in item
    
    def test_classify_news_multiple_symbols(self, capsys):
        """Test classify-news with multiple symbols."""
        _run_cli([
            "classify-news",
            "--symbols", "AAPL", "MSFT", "GOOGL",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        assert "AAPL, MSFT, GOOGL" in output
    
    def test_classify_news_mock_provider_default(self, capsys):
        """Test that mock provider works as default when specified."""
        _run_cli([
            "classify-news",
            "--symbols", "TSLA",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        assert "mock-classifier" in output
        assert "Classified" in output
    
    def test_classify_news_shows_statistics(self, capsys):
        """Test that CLI shows classification statistics."""
        _run_cli([
            "classify-news",
            "--symbols", "AAPL",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Check for statistics
        assert "Average processing time:" in output
        assert "Cached responses:" in output
        assert "Material events:" in output
        assert "Event type distribution:" in output
    
    def test_classify_news_shows_event_details(self, capsys):
        """Test that CLI shows event classification details."""
        _run_cli([
            "classify-news",
            "--symbols", "NVDA",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Check for event details (should show some classifications)
        # Mock provider should classify at least one event
        assert "Material:" in output
        assert "Confidence:" in output
    
    def test_classify_news_with_custom_model(self, capsys):
        """Test classify-news with custom model parameter."""
        _run_cli([
            "classify-news",
            "--symbols", "AAPL",
            "--mock",
            "--provider", "mock",
            "--model", "custom-model-name",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Should still work with mock provider (ignores model param)
        assert "Classified" in output
    
    def test_classify_news_requires_symbols(self):
        """Test that classify-news requires --symbols argument."""
        with pytest.raises(SystemExit):
            _run_cli([
                "classify-news",
                "--mock",
                "--provider", "mock",
            ])
    
    def test_classify_news_requires_mock_flag_for_data(self, capsys):
        """Test that not providing --mock gives appropriate error."""
        # When --mock is not provided, real news fetching is attempted
        # which should show an error message
        with pytest.raises(SystemExit):
            _run_cli([
                "classify-news",
                "--symbols", "AAPL",
                "--provider", "mock",
            ])
        
        captured = capsys.readouterr()
        output = captured.err + captured.out
        
        # Should indicate that real news fetching is not implemented
        assert "not yet implemented" in output.lower() or "ERROR" in output
    
    def test_classify_news_cache_stats(self, capsys):
        """Test that cache statistics are shown."""
        _run_cli([
            "classify-news",
            "--symbols", "AAPL",
            "--mock",
            "--provider", "mock",
        ])
        
        captured = capsys.readouterr()
        output = captured.out
        
        # Check for cache info
        assert "Cache:" in output
        assert "entries" in output.lower()
    
    def test_classify_news_with_ollama_unavailable(self, capsys):
        """Test classify-news with ollama provider when unavailable."""
        # Try to use ollama provider (likely not available in test env)
        with pytest.raises(SystemExit):
            _run_cli([
                "classify-news",
                "--symbols", "AAPL",
                "--mock",
                "--provider", "ollama",
            ])
        
        captured = capsys.readouterr()
        output = captured.err + captured.out
        
        # Should show error about Ollama not being available
        assert "not available" in output.lower() or "ERROR" in output


class TestClassifyNewsCLIIntegration:
    """Integration tests for classify-news CLI with live Ollama."""
    
    @pytest.mark.integration
    def test_classify_news_with_live_ollama(self, capsys):
        """Test classify-news with live Ollama instance."""
        try:
            _run_cli([
                "classify-news",
                "--symbols", "AAPL",
                "--mock",
                "--provider", "ollama",
                "--model", "mistral:7b-instruct",
            ])
            
            captured = capsys.readouterr()
            output = captured.out
            
            assert "mistral:7b-instruct" in output
            assert "Classified" in output
            
        except SystemExit:
            pytest.skip("Ollama not available")
    
    @pytest.mark.integration
    def test_classify_news_with_ollama_output_file(self, tmp_path):
        """Test classify-news with Ollama writing to file."""
        output_file = tmp_path / "ollama_results.json"
        
        try:
            _run_cli([
                "classify-news",
                "--symbols", "NVDA",
                "--mock",
                "--provider", "ollama",
                "--output", str(output_file),
            ])
            
            # If Ollama is available, file should be created
            assert output_file.exists()
            
            with open(output_file) as f:
                data = json.load(f)
            assert len(data) > 0
            
        except SystemExit:
            pytest.skip("Ollama not available")
