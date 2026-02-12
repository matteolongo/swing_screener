"""Tests for MCP agent configuration and workflows."""
from __future__ import annotations

import pytest

from mcp_server.agent import AgentConfig, SwingScreenerAgent
from mcp_server.prompts import PromptStyle, PromptTone


class TestAgentConfig:
    """Test AgentConfig class."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = AgentConfig()
        
        assert config.style == PromptStyle.BALANCED
        assert config.tone == PromptTone.PROFESSIONAL
        assert config.max_candidates == 20
        assert config.auto_preview is True
        assert config.educational_mode is False
    
    def test_custom_config(self):
        """Test creating config with custom values."""
        config = AgentConfig(
            style=PromptStyle.DETAILED,
            tone=PromptTone.FRIENDLY,
            max_candidates=10,
            auto_preview=False,
            educational_mode=True,
        )
        
        assert config.style == PromptStyle.DETAILED
        assert config.tone == PromptTone.FRIENDLY
        assert config.max_candidates == 10
        assert config.auto_preview is False
        assert config.educational_mode is True
    
    def test_from_dict(self):
        """Test creating config from dictionary."""
        config_dict = {
            "style": "concise",
            "tone": "technical",
            "max_candidates": 15,
            "auto_preview": False,
            "educational_mode": True,
        }
        
        config = AgentConfig.from_dict(config_dict)
        
        assert config.style == PromptStyle.CONCISE
        assert config.tone == PromptTone.TECHNICAL
        assert config.max_candidates == 15
        assert config.auto_preview is False
        assert config.educational_mode is True
    
    def test_from_dict_partial(self):
        """Test creating config from partial dictionary."""
        config_dict = {
            "style": "educational",
            "max_candidates": 5,
        }
        
        config = AgentConfig.from_dict(config_dict)
        
        # Specified values
        assert config.style == PromptStyle.EDUCATIONAL
        assert config.max_candidates == 5
        
        # Default values
        assert config.tone == PromptTone.PROFESSIONAL
        assert config.auto_preview is True
        assert config.educational_mode is False
    
    def test_from_dict_empty(self):
        """Test creating config from empty dictionary."""
        config = AgentConfig.from_dict({})
        
        # Should use all defaults
        assert config.style == PromptStyle.BALANCED
        assert config.tone == PromptTone.PROFESSIONAL
        assert config.max_candidates == 20


class TestSwingScreenerAgent:
    """Test SwingScreenerAgent class."""
    
    def test_agent_initialization_default(self):
        """Test agent initialization with defaults."""
        agent = SwingScreenerAgent()
        
        assert agent.config is not None
        assert agent.config.style == PromptStyle.BALANCED
        assert agent.session is None
        assert agent.tools == {}
    
    def test_agent_initialization_custom_config(self):
        """Test agent initialization with custom config."""
        config = AgentConfig(
            style=PromptStyle.CONCISE,
            tone=PromptTone.FRIENDLY,
        )
        
        agent = SwingScreenerAgent(config)
        
        assert agent.config.style == PromptStyle.CONCISE
        assert agent.config.tone == PromptTone.FRIENDLY
    
    def test_analyze_candidates_concise(self):
        """Test candidate analysis with concise style."""
        config = AgentConfig(style=PromptStyle.CONCISE)
        agent = SwingScreenerAgent(config)
        
        candidates = [
            {"ticker": "AAPL", "rank": 1, "score": 8.5, "is_recommended": True},
            {"ticker": "MSFT", "rank": 2, "score": 7.9, "is_recommended": True},
            {"ticker": "GOOGL", "rank": 3, "score": 7.2, "is_recommended": False},
        ]
        
        analysis = agent._analyze_candidates(candidates, "test prompt")
        
        assert "AAPL" in analysis
        assert "8.5" in analysis or "8.50" in analysis
        assert len(analysis.split("\n")) <= 10  # Should be brief
    
    def test_analyze_candidates_educational(self):
        """Test candidate analysis with educational style."""
        config = AgentConfig(style=PromptStyle.EDUCATIONAL)
        agent = SwingScreenerAgent(config)
        
        candidates = [
            {"ticker": "AAPL", "rank": 1, "score": 8.5, "is_recommended": True},
        ]
        
        analysis = agent._analyze_candidates(candidates, "test prompt")
        
        assert "AAPL" in analysis
        assert "educational" in analysis.lower() or "trend" in analysis.lower()
    
    def test_analyze_candidates_empty(self):
        """Test candidate analysis with no candidates."""
        agent = SwingScreenerAgent()
        
        analysis = agent._analyze_candidates([], "test prompt")
        
        assert "no candidates" in analysis.lower()
    
    def test_generate_screening_recommendation(self):
        """Test screening recommendation generation."""
        agent = SwingScreenerAgent()
        
        candidates = [
            {"is_recommended": True},
            {"is_recommended": True},
            {"is_recommended": False},
        ]
        
        recommendation = agent._generate_screening_recommendation(candidates, "analysis")
        
        assert "2" in recommendation  # 2 recommended
        assert "3" in recommendation  # 3 total
    
    def test_generate_screening_recommendation_empty(self):
        """Test recommendation with no candidates."""
        agent = SwingScreenerAgent()
        
        recommendation = agent._generate_screening_recommendation([], "")
        
        assert "no candidates" in recommendation.lower()
    
    def test_analyze_position_concise(self):
        """Test position analysis with concise style."""
        config = AgentConfig(style=PromptStyle.CONCISE)
        agent = SwingScreenerAgent(config)
        
        position = {"ticker": "AAPL", "r_now": 2.5}
        
        analysis = agent._analyze_position(position, None)
        
        assert "AAPL" in analysis
        assert "2.5" in analysis or "2.5R" in analysis
    
    def test_analyze_position_different_r_values(self):
        """Test position analysis for different R values."""
        agent = SwingScreenerAgent()
        
        # Profitable position (R > 2)
        pos_profit = {"ticker": "AAPL", "r_now": 2.5}
        analysis = agent._analyze_position(pos_profit, None)
        assert "trail" in analysis.lower() or "stop" in analysis.lower()
        
        # Small profit (0 < R < 2)
        pos_small = {"ticker": "MSFT", "r_now": 0.8}
        analysis = agent._analyze_position(pos_small, None)
        assert "hold" in analysis.lower() or "monitor" in analysis.lower()
        
        # Loss (R < 0)
        pos_loss = {"ticker": "GOOGL", "r_now": -0.5}
        analysis = agent._analyze_position(pos_loss, None)
        assert "down" in analysis.lower() or "review" in analysis.lower()
    
    def test_generate_position_summary(self):
        """Test position summary generation."""
        agent = SwingScreenerAgent()
        
        position_analysis = [
            {"position": {"ticker": "AAPL", "r_now": 2.5}},
            {"position": {"ticker": "MSFT", "r_now": 0.8}},
            {"position": {"ticker": "GOOGL", "r_now": -0.3}},
        ]
        
        summary = agent._generate_position_summary(position_analysis)
        
        assert "2" in summary  # 2 profitable out of 3
        assert "3" in summary  # 3 total
    
    def test_generate_position_summary_empty(self):
        """Test summary with no positions."""
        agent = SwingScreenerAgent()
        
        summary = agent._generate_position_summary([])
        
        assert "no" in summary.lower()


class TestAgentStyleBehavior:
    """Test agent behavior varies by style."""
    
    def test_concise_produces_shorter_output(self):
        """Verify concise style produces shorter output."""
        concise_agent = SwingScreenerAgent(AgentConfig(style=PromptStyle.CONCISE))
        detailed_agent = SwingScreenerAgent(AgentConfig(style=PromptStyle.DETAILED))
        
        candidates = [
            {"ticker": f"TICK{i}", "rank": i, "score": 8.0, "is_recommended": True}
            for i in range(1, 6)
        ]
        
        concise_output = concise_agent._analyze_candidates(candidates, "")
        detailed_output = detailed_agent._analyze_candidates(candidates, "")
        
        # Concise should be noticeably shorter
        assert len(concise_output) < len(detailed_output)
    
    def test_educational_adds_context(self):
        """Verify educational style adds educational context."""
        educational_agent = SwingScreenerAgent(
            AgentConfig(style=PromptStyle.EDUCATIONAL)
        )
        
        candidates = [
            {"ticker": "AAPL", "rank": 1, "score": 8.5, "is_recommended": True},
        ]
        
        output = educational_agent._analyze_candidates(candidates, "")
        
        # Should contain educational keywords
        educational_keywords = ["trend", "momentum", "educational", "volatility"]
        assert any(keyword in output.lower() for keyword in educational_keywords)
