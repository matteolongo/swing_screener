"""Tests for Trade Thesis generation."""

import pytest
from swing_screener.recommendations.thesis import (
    build_trade_thesis,
    calculate_setup_score,
    get_setup_quality_tier,
    determine_safety_label,
    classify_volatility,
    classify_trend_strength,
    thesis_to_dict,
)


def test_calculate_setup_score_high_quality():
    """Test high-quality setup scores highly."""
    score = calculate_setup_score(
        distance_from_sma200_pct=0.15,  # 15% above SMA200
        above_all_smas=True,
        rr=3.0,
        momentum_6m=0.25,
        rel_strength=0.12,
        atr_pct=0.015,
        signal_strength="both",
        confidence=85.0,
    )
    assert score >= 85, f"High-quality setup should score >= 85, got {score}"
    assert score <= 100


def test_calculate_setup_score_weak_setup():
    """Test weak setup scores low."""
    score = calculate_setup_score(
        distance_from_sma200_pct=-0.05,  # Below SMA200
        above_all_smas=False,
        rr=1.5,
        momentum_6m=-0.10,
        rel_strength=-0.15,
        atr_pct=0.08,
        signal_strength="",
        confidence=30.0,
    )
    assert score < 60, f"Weak setup should score < 60, got {score}"
    assert score >= 0


def test_setup_quality_tier_classification():
    """Test quality tier classification."""
    assert get_setup_quality_tier(95) == "INSTITUTIONAL"
    assert get_setup_quality_tier(80) == "HIGH_QUALITY"
    assert get_setup_quality_tier(65) == "TRADABLE"
    assert get_setup_quality_tier(45) == "WEAK"


def test_safety_label_beginner_friendly():
    """Test beginner-friendly classification."""
    label = determine_safety_label(
        setup_score=80,
        volatility_state="Low",
        signal_strength="both",
        rr=3.0,
    )
    assert label == "BEGINNER_FRIENDLY"


def test_safety_label_advanced_only():
    """Test advanced-only classification."""
    # Low score
    label1 = determine_safety_label(
        setup_score=50,
        volatility_state="Low",
        signal_strength="both",
        rr=2.5,
    )
    assert label1 == "ADVANCED_ONLY"
    
    # High volatility
    label2 = determine_safety_label(
        setup_score=80,
        volatility_state="High",
        signal_strength="both",
        rr=2.5,
    )
    assert label2 == "ADVANCED_ONLY"


def test_classify_volatility():
    """Test volatility classification."""
    assert classify_volatility(0.015) == "Low"
    assert classify_volatility(0.03) == "Moderate"
    assert classify_volatility(0.06) == "High"


def test_classify_trend_strength():
    """Test trend strength classification."""
    assert classify_trend_strength(0.12, True) == "Strong"
    assert classify_trend_strength(0.07, True) == "Moderate"
    assert classify_trend_strength(0.03, True) == "Developing"
    assert classify_trend_strength(0.03, False) == "Weak"


def test_build_trade_thesis_complete():
    """Test complete thesis building."""
    thesis = build_trade_thesis(
        ticker="AAPL",
        strategy="Momentum",
        signal="both",
        entry=150.0,
        stop=145.0,
        rr=3.0,
        close=150.0,
        sma_20=148.0,
        sma_50=145.0,
        sma_200=140.0,
        atr=2.5,
        momentum_6m=0.20,
        momentum_12m=0.35,
        rel_strength=0.08,
        confidence=80.0,
    )
    
    assert thesis.ticker == "AAPL"
    assert thesis.strategy == "Momentum"
    assert thesis.entry_type == "Breakout + Pullback"
    assert thesis.trend_status in ("Strong", "Moderate", "Developing", "Weak")
    assert thesis.setup_quality_score >= 0
    assert thesis.setup_quality_score <= 100
    assert thesis.safety_label in ("BEGINNER_FRIENDLY", "REQUIRES_DISCIPLINE", "ADVANCED_ONLY")
    assert len(thesis.explanation.why_qualified) > 0
    assert len(thesis.explanation.what_could_go_wrong) > 0
    assert len(thesis.invalidation_rules) > 0


def test_thesis_to_dict_serialization():
    """Test thesis serialization to dict."""
    thesis = build_trade_thesis(
        ticker="MSFT",
        strategy="Momentum",
        signal="breakout",
        entry=300.0,
        stop=295.0,
        rr=2.5,
        close=300.0,
        sma_20=298.0,
        sma_50=295.0,
        sma_200=290.0,
        atr=4.0,
        momentum_6m=0.15,
        momentum_12m=0.25,
        rel_strength=0.05,
        confidence=75.0,
    )
    
    thesis_dict = thesis_to_dict(thesis)
    
    assert isinstance(thesis_dict, dict)
    assert thesis_dict["ticker"] == "MSFT"
    assert thesis_dict["setup_quality_score"] >= 0
    assert "personality" in thesis_dict
    assert "explanation" in thesis_dict
    assert "invalidation_rules" in thesis_dict


def test_invalidation_rules_generation():
    """Test that invalidation rules are properly generated."""
    thesis = build_trade_thesis(
        ticker="NVDA",
        strategy="Momentum",
        signal="both",
        entry=500.0,
        stop=490.0,
        rr=2.8,
        close=500.0,
        sma_20=495.0,
        sma_50=490.0,
        sma_200=480.0,
        atr=7.5,
        momentum_6m=0.30,
        momentum_12m=0.50,
        rel_strength=0.15,
        confidence=85.0,
    )
    
    rules = thesis.invalidation_rules
    assert len(rules) > 0
    
    # Should have stop breach rule
    stop_rules = [r for r in rules if r.rule_id == "STOP_BREACH"]
    assert len(stop_rules) > 0
    assert stop_rules[0].threshold == 490.0
    
    # Should have breakout failure rule for "both" signal
    breakout_rules = [r for r in rules if r.rule_id == "BREAKOUT_FAILURE"]
    assert len(breakout_rules) > 0


def test_trade_personality_ratings():
    """Test trade personality ratings."""
    thesis = build_trade_thesis(
        ticker="TSLA",
        strategy="Momentum",
        signal="both",
        entry=200.0,
        stop=195.0,
        rr=3.0,
        close=200.0,
        sma_20=198.0,
        sma_50=195.0,
        sma_200=185.0,
        atr=3.0,
        momentum_6m=0.25,
        momentum_12m=0.40,
        rel_strength=0.10,
        confidence=85.0,
    )
    
    personality = thesis.personality
    assert 1 <= personality.trend_strength <= 5
    assert 1 <= personality.volatility_rating <= 5
    assert 1 <= personality.conviction <= 5
    assert personality.complexity in ("Beginner-friendly", "Intermediate", "Advanced")


def test_structured_explanation_content():
    """Test that structured explanation has meaningful content."""
    thesis = build_trade_thesis(
        ticker="GOOGL",
        strategy="Momentum",
        signal="pullback",
        entry=140.0,
        stop=137.0,
        rr=2.2,
        close=140.0,
        sma_20=139.0,
        sma_50=137.0,
        sma_200=130.0,
        atr=2.1,
        momentum_6m=0.18,
        momentum_12m=0.28,
        rel_strength=0.06,
        confidence=70.0,
    )
    
    explanation = thesis.explanation
    
    # Should have reasons why it qualified
    assert len(explanation.why_qualified) >= 2
    assert any("trend" in reason.lower() for reason in explanation.why_qualified)
    
    # Should have risk warnings
    assert len(explanation.what_could_go_wrong) >= 1
    
    # Should have a setup type
    assert explanation.setup_type != ""
    
    # Should have key insight
    assert len(explanation.key_insight) > 20  # Meaningful sentence
