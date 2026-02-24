"""Trade Thesis and Setup Quality Scoring.

This module implements the Pre-Trade Explanation Engine (PTEE) core functionality:
- Trade Thesis object: structured facts about why a trade exists
- Setup Quality Score: 0-100 rating based on multiple factors
- Trade Safety Labels: risk classification for traders
- Invalidation Rules: when the trade is no longer valid
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
import math


# Trade personality ratings (0-5 stars)
TradePersonalityRating = Literal[1, 2, 3, 4, 5]

# Trade safety classification
SafetyLabel = Literal[
    "BEGINNER_FRIENDLY",  # 🟢 Low complexity, clear rules
    "REQUIRES_DISCIPLINE",  # 🟡 Standard setup, needs experience
    "ADVANCED_ONLY"  # 🔴 Complex, for experienced traders
]

# Setup quality tiers
SetupQuality = Literal[
    "INSTITUTIONAL",  # 90-100
    "HIGH_QUALITY",  # 75-89
    "TRADABLE",  # 60-74
    "WEAK"  # <60
]


@dataclass(frozen=True)
class TradePersonality:
    """Visual personality scores for quick cognition."""
    trend_strength: TradePersonalityRating  # How strong is the trend?
    volatility_rating: TradePersonalityRating  # 1=low vol, 5=high vol
    conviction: TradePersonalityRating  # System confidence in setup
    complexity: str  # "Beginner-friendly", "Intermediate", "Advanced"


@dataclass(frozen=True)
class InvalidationRule:
    """Rule that invalidates the trade thesis."""
    rule_id: str
    condition: str  # Human-readable condition
    metric: Optional[str] = None  # Which metric to monitor
    threshold: Optional[float] = None  # Numerical threshold if applicable


@dataclass(frozen=True)
class StructuredExplanation:
    """Deterministic, rule-based explanation of the trade."""
    why_qualified: list[str]  # Bullet points: why trade appeared
    what_could_go_wrong: list[str]  # Risk factors
    setup_type: str  # e.g., "Momentum Continuation", "Breakout + Pullback"
    key_insight: str  # One-sentence professional insight


@dataclass(frozen=True)
class TradeThesis:
    """Complete thesis object - the GOLD that gets stored and analyzed."""
    ticker: str
    strategy: str  # e.g., "Momentum"
    entry_type: str  # e.g., "Breakout + Pullback", "Breakout", "Pullback"
    
    # Trend & Market Position
    trend_status: str  # "Strong", "Moderate", "Weak"
    relative_strength: str  # vs SPY: "Outperforming", "Inline", "Underperforming"
    regime_alignment: bool  # Does trade align with market regime?
    
    # Setup Characteristics
    volatility_state: str  # "Low", "Moderate", "High"
    risk_reward: float  # RR ratio
    setup_quality_score: int  # 0-100
    setup_quality_tier: SetupQuality
    
    # Confirmations & Signals
    institutional_signal: bool  # High-quality momentum signal
    price_action_quality: str  # "Clean", "Choppy", "Weak"
    
    # Classification
    safety_label: SafetyLabel
    personality: TradePersonality
    
    # Explanation & Rules
    explanation: StructuredExplanation
    invalidation_rules: list[InvalidationRule]
    
    # Optional LLM-enhanced insight (added later if available)
    professional_insight: Optional[str] = None


def calculate_setup_score(
    *,
    # Trend alignment (30% weight)
    distance_from_sma200_pct: float,  # How far above/below SMA200
    above_all_smas: bool,  # Above 20/50/200?
    
    # Risk/Reward (25% weight)
    rr: float,
    
    # Momentum (20% weight)
    momentum_6m: float,  # 6-month return
    rel_strength: float,  # vs market
    
    # Volatility (15% weight)
    atr_pct: float,  # ATR as % of price
    
    # Liquidity & Quality (10% weight)
    signal_strength: str,  # "both", "breakout", "pullback", or None
    confidence: float,  # Existing confidence score 0-100
) -> int:
    """
    Calculate Setup Quality Score (0-100).
    
    Weighted by:
    - Trend alignment: 30%
    - Risk/Reward: 25%
    - Momentum: 20%
    - Volatility: 15%
    - Signal quality: 10%
    
    Returns:
        Integer score 0-100
    """
    score = 0.0
    
    # 1. Trend Alignment (30 points max)
    # Perfect: >10% above SMA200 and above all SMAs = 30 points
    # Good: >5% above = 25 points
    # Moderate: above but <5% = 20 points
    # Weak: below any SMA = 10-15 points
    if above_all_smas:
        if distance_from_sma200_pct >= 0.10:
            trend_score = 30.0
        elif distance_from_sma200_pct >= 0.05:
            trend_score = 25.0
        else:
            trend_score = 20.0
    else:
        # Penalize if below SMAs
        trend_score = max(10.0, 15.0 + distance_from_sma200_pct * 50)
    score += trend_score
    
    # 2. Risk/Reward (25 points max)
    # Perfect RR >= 3.0 = 25 points
    # Good RR >= 2.5 = 20 points
    # Acceptable RR >= 2.0 = 15 points
    # Weak RR < 2.0 = scale down
    if rr >= 3.0:
        rr_score = 25.0
    elif rr >= 2.5:
        rr_score = 20.0
    elif rr >= 2.0:
        rr_score = 15.0
    else:
        rr_score = max(0.0, rr * 7.5)  # Scale: 1.0 RR = 7.5 points
    score += rr_score
    
    # 3. Momentum (20 points max)
    # Strong 6m momentum (>20%) + strong rel_strength (>0.1) = 20 points
    momentum_score = 0.0
    # 6m momentum contribution (12 points)
    if momentum_6m >= 0.20:
        momentum_score += 12.0
    elif momentum_6m >= 0.10:
        momentum_score += 9.0
    elif momentum_6m >= 0.0:
        momentum_score += 6.0
    else:
        momentum_score += max(0.0, 3.0 + momentum_6m * 10)
    
    # Relative strength contribution (8 points)
    if rel_strength >= 0.10:
        momentum_score += 8.0
    elif rel_strength >= 0.05:
        momentum_score += 6.0
    elif rel_strength >= 0.0:
        momentum_score += 4.0
    else:
        momentum_score += max(0.0, 2.0 + rel_strength * 20)
    score += momentum_score
    
    # 4. Volatility (15 points max)
    # Lower volatility is better for swing trading
    # ATR 1-2% = ideal (15 points)
    # ATR 2-4% = acceptable (10-12 points)
    # ATR >6% = too high (5 points)
    if 0.01 <= atr_pct <= 0.02:
        vol_score = 15.0
    elif 0.02 < atr_pct <= 0.04:
        vol_score = 12.0 - (atr_pct - 0.02) * 50  # Linear decay
    elif atr_pct > 0.04:
        vol_score = max(5.0, 12.0 - (atr_pct - 0.02) * 50)
    else:
        vol_score = 10.0  # Very low volatility
    score += vol_score
    
    # 5. Signal Quality (10 points max)
    # Both signals = 10 points
    # Single signal = 7 points
    # Confidence boost
    signal_score = 0.0
    if signal_strength == "both":
        signal_score = 10.0
    elif signal_strength in ("breakout", "pullback"):
        signal_score = 7.0
    else:
        signal_score = 3.0
    
    # Bonus from confidence score (normalize 0-100 to 0-2 bonus points)
    confidence_bonus = min(2.0, confidence / 50.0)
    signal_score = min(10.0, signal_score + confidence_bonus)
    score += signal_score
    
    # Round to integer
    return int(round(max(0, min(100, score))))


def get_setup_quality_tier(score: int) -> SetupQuality:
    """Convert score to quality tier."""
    if score >= 90:
        return "INSTITUTIONAL"
    elif score >= 75:
        return "HIGH_QUALITY"
    elif score >= 60:
        return "TRADABLE"
    else:
        return "WEAK"


def determine_safety_label(
    *,
    setup_score: int,
    volatility_state: str,
    signal_strength: str,
    rr: float,
) -> SafetyLabel:
    """
    Determine trade safety classification.
    
    Beginner-friendly: High score, low volatility, clear signals
    Requires Discipline: Standard setups
    Advanced Only: High volatility, complex setups, lower scores
    """
    # Advanced only criteria
    if setup_score < 60:
        return "ADVANCED_ONLY"
    if volatility_state == "High":
        return "ADVANCED_ONLY"
    if rr < 2.0:
        return "ADVANCED_ONLY"
    
    # Beginner-friendly criteria
    if (
        setup_score >= 75
        and volatility_state == "Low"
        and signal_strength == "both"
        and rr >= 2.5
    ):
        return "BEGINNER_FRIENDLY"
    
    # Default to requires discipline
    return "REQUIRES_DISCIPLINE"


def classify_volatility(atr_pct: float) -> str:
    """Classify volatility state from ATR percentage."""
    if atr_pct <= 0.02:
        return "Low"
    elif atr_pct <= 0.04:
        return "Moderate"
    else:
        return "High"


def classify_trend_strength(
    distance_from_sma200_pct: float,
    above_all_smas: bool,
) -> str:
    """Classify trend strength."""
    if above_all_smas:
        if distance_from_sma200_pct >= 0.10:
            return "Strong"
        elif distance_from_sma200_pct >= 0.05:
            return "Moderate"
        else:
            return "Developing"
    else:
        return "Weak"


def classify_relative_strength(rel_strength: float) -> str:
    """Classify relative strength vs market."""
    if rel_strength >= 0.05:
        return "Outperforming"
    elif rel_strength >= -0.05:
        return "Inline"
    else:
        return "Underperforming"


def classify_price_action(
    signal: Optional[str],
    momentum_6m: float,
) -> str:
    """Classify price action quality."""
    if signal == "both" and momentum_6m >= 0.15:
        return "Clean"
    elif signal in ("breakout", "pullback") and momentum_6m >= 0.0:
        return "Acceptable"
    else:
        return "Choppy"


def create_trade_personality(
    trend_strength: str,
    volatility_state: str,
    confidence: float,
    setup_score: int,
) -> TradePersonality:
    """Create trade personality ratings."""
    # Trend strength (1-5 stars)
    if trend_strength == "Strong":
        trend_rating = 5
    elif trend_strength == "Moderate":
        trend_rating = 4
    elif trend_strength == "Developing":
        trend_rating = 3
    else:
        trend_rating = 2
    
    # Volatility rating (inverse: 1=high vol, 5=low vol)
    if volatility_state == "Low":
        vol_rating = 5
    elif volatility_state == "Moderate":
        vol_rating = 3
    else:
        vol_rating = 1
    
    # Conviction (based on confidence 0-100)
    if confidence >= 80:
        conviction_rating = 5
    elif confidence >= 65:
        conviction_rating = 4
    elif confidence >= 50:
        conviction_rating = 3
    elif confidence >= 35:
        conviction_rating = 2
    else:
        conviction_rating = 1
    
    # Complexity description
    if setup_score >= 75 and volatility_state == "Low":
        complexity = "Beginner-friendly"
    elif setup_score >= 60:
        complexity = "Intermediate"
    else:
        complexity = "Advanced"
    
    return TradePersonality(
        trend_strength=trend_rating,
        volatility_rating=vol_rating,
        conviction=conviction_rating,
        complexity=complexity,
    )


def generate_structured_explanation(
    *,
    trend_status: str,
    relative_strength: str,
    signal: Optional[str],
    entry_type: str,
    volatility_state: str,
    rr: float,
    above_all_smas: bool,
) -> StructuredExplanation:
    """Generate deterministic, rule-based explanation."""
    why_qualified = []
    
    # Trend qualification
    if above_all_smas:
        why_qualified.append("Stock is in confirmed uptrend (above 20/50/200 SMA)")
    else:
        why_qualified.append("Stock shows momentum despite mixed trend signals")
    
    # Relative strength
    if relative_strength == "Outperforming":
        why_qualified.append("Outperforming the market benchmark")
    elif relative_strength == "Inline":
        why_qualified.append("Moving in line with market benchmark")
    
    # Signal type
    if signal == "both":
        why_qualified.append("Both breakout and pullback signals active")
    elif signal == "breakout":
        why_qualified.append("Breaking to new highs with momentum")
    elif signal == "pullback":
        why_qualified.append("Pulling back to moving average support")
    
    # Volatility
    if volatility_state == "Low":
        why_qualified.append("Volatility is within controlled levels")
    elif volatility_state == "Moderate":
        why_qualified.append("Volatility is at normal levels for swing trading")
    
    # Risk/Reward
    if rr >= 2.0:
        why_qualified.append(f"Risk/Reward ({rr:.1f}:1) exceeds minimum threshold")
    
    # What could go wrong
    what_could_go_wrong = []
    
    if entry_type in ("Breakout + Pullback", "Breakout"):
        what_could_go_wrong.append("Breakouts can fail in weak market regimes")
    
    if volatility_state == "High":
        what_could_go_wrong.append("High volatility increases stop distance and risk")
    elif volatility_state == "Moderate":
        what_could_go_wrong.append("If volatility expands, stop distance may need adjustment")
    
    what_could_go_wrong.append("Momentum strategies depend on trend persistence")
    
    if relative_strength == "Underperforming":
        what_could_go_wrong.append("Underperformance vs market may indicate weakness")
    
    # Setup type
    if entry_type == "Breakout + Pullback":
        setup_type = "Momentum Continuation Setup"
    elif entry_type == "Breakout":
        setup_type = "Breakout Setup"
    elif entry_type == "Pullback":
        setup_type = "Pullback Setup"
    else:
        setup_type = "Momentum Setup"
    
    # Key insight (professional, educational tone)
    if trend_status == "Strong" and relative_strength == "Outperforming":
        key_insight = (
            "This trade is based on sustained strength rather than anticipation. "
            "The stock is proving demand by making new highs while outperforming the broader market."
        )
    elif entry_type == "Pullback":
        key_insight = (
            "This setup attempts to enter on a pullback to support in an established trend. "
            "Risk is defined by the support level and requires patience for the bounce."
        )
    else:
        key_insight = (
            "This momentum-based setup requires the trend to persist. "
            "Controlled volatility allows for a clearly defined stop for risk management."
        )
    
    return StructuredExplanation(
        why_qualified=why_qualified,
        what_could_go_wrong=what_could_go_wrong,
        setup_type=setup_type,
        key_insight=key_insight,
    )


def generate_invalidation_rules(
    *,
    stop: Optional[float],
    entry: Optional[float],
    signal: Optional[str],
) -> list[InvalidationRule]:
    """Generate invalidation rules for the trade."""
    rules = []
    
    # Stop level breach (most critical)
    if stop is not None:
        rules.append(
            InvalidationRule(
                rule_id="STOP_BREACH",
                condition=f"Price closes below stop level (${stop:.2f})",
                metric="close",
                threshold=stop,
            )
        )
    
    # Breakout invalidation
    if signal in ("both", "breakout") and entry is not None:
        rules.append(
            InvalidationRule(
                rule_id="BREAKOUT_FAILURE",
                condition=f"Price closes back below breakout level (${entry:.2f})",
                metric="close",
                threshold=entry,
            )
        )
    
    # Relative strength weakening
    rules.append(
        InvalidationRule(
            rule_id="RELATIVE_STRENGTH_WEAK",
            condition="Relative strength weakens significantly vs SPY",
            metric="rel_strength",
            threshold=-0.10,
        )
    )
    
    # Trend break
    rules.append(
        InvalidationRule(
            rule_id="TREND_BREAK",
            condition="Price breaks below SMA50 with high volume",
            metric="sma_50",
            threshold=None,
        )
    )
    
    # Market regime shift
    rules.append(
        InvalidationRule(
            rule_id="REGIME_SHIFT",
            condition="Market regime shifts to risk-off (defensive rotation)",
            metric="regime",
            threshold=None,
        )
    )
    
    return rules


def thesis_to_dict(thesis: TradeThesis) -> dict:
    """Convert TradeThesis to dictionary for serialization."""
    return {
        "ticker": thesis.ticker,
        "strategy": thesis.strategy,
        "entry_type": thesis.entry_type,
        "trend_status": thesis.trend_status,
        "relative_strength": thesis.relative_strength,
        "regime_alignment": thesis.regime_alignment,
        "volatility_state": thesis.volatility_state,
        "risk_reward": thesis.risk_reward,
        "setup_quality_score": thesis.setup_quality_score,
        "setup_quality_tier": thesis.setup_quality_tier,
        "institutional_signal": thesis.institutional_signal,
        "price_action_quality": thesis.price_action_quality,
        "safety_label": thesis.safety_label,
        "personality": {
            "trend_strength": thesis.personality.trend_strength,
            "volatility_rating": thesis.personality.volatility_rating,
            "conviction": thesis.personality.conviction,
            "complexity": thesis.personality.complexity,
        },
        "explanation": {
            "why_qualified": thesis.explanation.why_qualified,
            "what_could_go_wrong": thesis.explanation.what_could_go_wrong,
            "setup_type": thesis.explanation.setup_type,
            "key_insight": thesis.explanation.key_insight,
        },
        "invalidation_rules": [
            {
                "rule_id": rule.rule_id,
                "condition": rule.condition,
                "metric": rule.metric,
                "threshold": rule.threshold,
            }
            for rule in thesis.invalidation_rules
        ],
        "professional_insight": thesis.professional_insight,
    }


def build_trade_thesis(
    *,
    ticker: str,
    strategy: str,
    signal: Optional[str],
    entry: Optional[float],
    stop: Optional[float],
    rr: float,
    close: float,
    sma_20: float,
    sma_50: float,
    sma_200: float,
    atr: float,
    momentum_6m: float,
    momentum_12m: float,
    rel_strength: float,
    confidence: float,
) -> TradeThesis:
    """
    Build complete Trade Thesis object.
    
    This is the main entry point for creating a thesis from candidate data.
    """
    # Calculate derived metrics
    atr_pct = atr / close if close > 0 else 0.0
    distance_from_sma200_pct = (close - sma_200) / sma_200 if sma_200 > 0 else 0.0
    above_all_smas = close > sma_20 and close > sma_50 and close > sma_200
    
    # Classify characteristics
    volatility_state = classify_volatility(atr_pct)
    trend_status = classify_trend_strength(distance_from_sma200_pct, above_all_smas)
    relative_strength_label = classify_relative_strength(rel_strength)
    price_action = classify_price_action(signal, momentum_6m)
    
    # Determine entry type
    if signal == "both":
        entry_type = "Breakout + Pullback"
    elif signal == "breakout":
        entry_type = "Breakout"
    elif signal == "pullback":
        entry_type = "Pullback"
    else:
        entry_type = "No Signal"
    
    # Calculate setup score
    setup_score = calculate_setup_score(
        distance_from_sma200_pct=distance_from_sma200_pct,
        above_all_smas=above_all_smas,
        rr=rr if rr and math.isfinite(rr) else 0.0,
        momentum_6m=momentum_6m,
        rel_strength=rel_strength,
        atr_pct=atr_pct,
        signal_strength=signal or "",
        confidence=confidence,
    )
    
    setup_tier = get_setup_quality_tier(setup_score)
    
    # Determine safety label
    safety = determine_safety_label(
        setup_score=setup_score,
        volatility_state=volatility_state,
        signal_strength=signal or "",
        rr=rr if rr and math.isfinite(rr) else 0.0,
    )
    
    # Create personality
    personality = create_trade_personality(
        trend_strength=trend_status,
        volatility_state=volatility_state,
        confidence=confidence,
        setup_score=setup_score,
    )
    
    # Generate explanation
    explanation = generate_structured_explanation(
        trend_status=trend_status,
        relative_strength=relative_strength_label,
        signal=signal,
        entry_type=entry_type,
        volatility_state=volatility_state,
        rr=rr if rr and math.isfinite(rr) else 0.0,
        above_all_smas=above_all_smas,
    )
    
    # Generate invalidation rules
    invalidation_rules = generate_invalidation_rules(
        stop=stop,
        entry=entry,
        signal=signal,
    )
    
    # Assess regime alignment (simplified - could be enhanced)
    regime_alignment = (
        above_all_smas
        and relative_strength_label in ("Outperforming", "Inline")
        and momentum_6m > 0
    )
    
    # Institutional signal (high-quality momentum)
    institutional_signal = (
        setup_score >= 75
        and signal == "both"
        and momentum_6m >= 0.15
    )
    
    return TradeThesis(
        ticker=ticker,
        strategy=strategy,
        entry_type=entry_type,
        trend_status=trend_status,
        relative_strength=relative_strength_label,
        regime_alignment=regime_alignment,
        volatility_state=volatility_state,
        risk_reward=rr if rr and math.isfinite(rr) else 0.0,
        setup_quality_score=setup_score,
        setup_quality_tier=setup_tier,
        institutional_signal=institutional_signal,
        price_action_quality=price_action,
        safety_label=safety,
        personality=personality,
        explanation=explanation,
        invalidation_rules=invalidation_rules,
        professional_insight=None,  # Will be filled by LLM if available
    )
