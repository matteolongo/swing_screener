"""Unit tests for MCP prompt templates."""
from __future__ import annotations

import pytest

from mcp_server.prompts import (
    PromptStyle,
    PromptTone,
    get_system_prompt,
    get_task_prompt,
    SYSTEM_PROMPTS,
    TONE_MODIFIERS,
    TASK_PROMPTS,
)


class TestPromptTemplates:
    """Test prompt template functionality."""
    
    def test_all_styles_have_system_prompts(self):
        """Verify all prompt styles have system prompts."""
        for style in PromptStyle:
            assert style in SYSTEM_PROMPTS
            assert len(SYSTEM_PROMPTS[style]) > 0
    
    def test_all_tones_have_modifiers(self):
        """Verify all tones have modifiers."""
        for tone in PromptTone:
            assert tone in TONE_MODIFIERS
            assert len(TONE_MODIFIERS[tone]) > 0
    
    def test_get_system_prompt_combines_style_and_tone(self):
        """Test that system prompt combines style and tone."""
        prompt = get_system_prompt(PromptStyle.BALANCED, PromptTone.PROFESSIONAL)
        
        # Should contain both base prompt and tone modifier
        assert "trading assistant" in prompt.lower()
        assert len(prompt) > 0
    
    def test_get_system_prompt_default_values(self):
        """Test system prompt with default values."""
        prompt = get_system_prompt()
        assert len(prompt) > 0
    
    def test_concise_style_is_brief(self):
        """Concise style should be noticeably shorter."""
        concise = get_system_prompt(PromptStyle.CONCISE)
        detailed = get_system_prompt(PromptStyle.DETAILED)
        
        assert len(concise) < len(detailed)
    
    def test_educational_style_mentions_learning(self):
        """Educational style should focus on learning."""
        educational = get_system_prompt(PromptStyle.EDUCATIONAL)
        
        assert "educational" in educational.lower() or "learn" in educational.lower()
    
    def test_task_prompts_exist_for_all_tasks(self):
        """Verify task prompts exist for expected tasks."""
        expected_tasks = ["screening", "order_preview", "position_management", "daily_workflow"]
        
        for task in expected_tasks:
            assert task in TASK_PROMPTS
            assert PromptStyle.CONCISE in TASK_PROMPTS[task]
            assert PromptStyle.BALANCED in TASK_PROMPTS[task]
            assert PromptStyle.DETAILED in TASK_PROMPTS[task]
            assert PromptStyle.EDUCATIONAL in TASK_PROMPTS[task]
    
    def test_get_task_prompt_with_variables(self):
        """Test task prompt with variable substitution."""
        prompt = get_task_prompt("screening", style=PromptStyle.BALANCED, n=10)
        
        assert "10" in prompt
        assert "candidates" in prompt.lower()
    
    def test_get_task_prompt_unknown_task(self):
        """Test handling of unknown task."""
        prompt = get_task_prompt("unknown_task", style=PromptStyle.BALANCED)
        
        assert "unknown_task" in prompt.lower()
    
    def test_concise_screening_is_shorter(self):
        """Concise screening prompt should be shorter than detailed."""
        concise = get_task_prompt("screening", style=PromptStyle.CONCISE, n=10)
        detailed = get_task_prompt("screening", style=PromptStyle.DETAILED, n=10)
        
        assert len(concise) < len(detailed)
    
    def test_educational_prompt_has_explanation(self):
        """Educational prompts should include explanatory content."""
        educational = get_task_prompt(
            "order_preview",
            style=PromptStyle.EDUCATIONAL,
            ticker="AAPL"
        )
        
        # Should mention explanation or learning
        assert "explain" in educational.lower() or "how" in educational.lower()


class TestPromptEnums:
    """Test prompt enum definitions."""
    
    def test_prompt_style_values(self):
        """Test PromptStyle enum values."""
        assert PromptStyle.CONCISE.value == "concise"
        assert PromptStyle.BALANCED.value == "balanced"
        assert PromptStyle.DETAILED.value == "detailed"
        assert PromptStyle.EDUCATIONAL.value == "educational"
    
    def test_prompt_tone_values(self):
        """Test PromptTone enum values."""
        assert PromptTone.PROFESSIONAL.value == "professional"
        assert PromptTone.FRIENDLY.value == "friendly"
        assert PromptTone.TECHNICAL.value == "technical"
    
    def test_can_iterate_styles(self):
        """Test that we can iterate over styles."""
        styles = list(PromptStyle)
        assert len(styles) == 4
    
    def test_can_iterate_tones(self):
        """Test that we can iterate over tones."""
        tones = list(PromptTone)
        assert len(tones) == 3


class TestPromptConsistency:
    """Test consistency across prompt templates."""
    
    def test_all_tasks_have_all_styles(self):
        """Verify each task has prompts for all styles."""
        for task_name, task_prompts in TASK_PROMPTS.items():
            for style in PromptStyle:
                assert style in task_prompts, f"Task {task_name} missing {style}"
    
    def test_prompts_are_non_empty(self):
        """Verify all prompts are non-empty strings."""
        # System prompts
        for style, prompt in SYSTEM_PROMPTS.items():
            assert isinstance(prompt, str)
            assert len(prompt) > 0
        
        # Tone modifiers
        for tone, modifier in TONE_MODIFIERS.items():
            assert isinstance(modifier, str)
            assert len(modifier) > 0
        
        # Task prompts
        for task_name, task_prompts in TASK_PROMPTS.items():
            for style, prompt in task_prompts.items():
                assert isinstance(prompt, str)
                assert len(prompt) > 0
