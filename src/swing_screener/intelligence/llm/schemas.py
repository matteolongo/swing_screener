"""Pydantic schemas for LLM-based event classification.

Event taxonomy aligns with institutional classification patterns and reflects
how capital reacts to corporate actions and market forces.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class EventType(str, Enum):
    """Event taxonomy organized by market impact tiers.
    
    Tier 1 - Company Fundamentals (Highest Impact):
        EARNINGS: Quarterly/annual results, surprises, guidance
        GUIDANCE: Forward-looking revisions outside earnings
        M_AND_A: Acquisitions, mergers, buyouts, spin-offs
        CAPITAL: Stock offerings, buybacks, dividend changes, debt issuance
    
    Tier 2 - Operational Drivers:
        PRODUCT: Launches, clinical trials, regulatory approvals
        PARTNERSHIP: Joint ventures, distribution agreements, customer wins
        MANAGEMENT: Leadership changes, CEO departures, executive shakeups
    
    Tier 3 - External Forces:
        REGULATORY: Antitrust, bans, investigations by authorities
        LEGAL: Litigation, settlements, liability rulings
        MACRO: Interest rates, CPI, geopolitical events, commodity shocks
        SECTOR: Industry-wide developments affecting multiple companies
    
    Tier 4 - Market Mechanics (Lower Signal):
        ANALYST: Upgrades, downgrades, price target revisions
        FLOW: Short squeeze, gamma squeeze, unusual options activity
        OTHER: Fallback for unclassifiable events
    """
    
    # Tier 1 - Company Fundamentals
    EARNINGS = "EARNINGS"
    GUIDANCE = "GUIDANCE"
    M_AND_A = "M_AND_A"  # Using underscore instead of ampersand for enum compatibility
    CAPITAL = "CAPITAL"
    
    # Tier 2 - Operational Drivers
    PRODUCT = "PRODUCT"
    PARTNERSHIP = "PARTNERSHIP"
    MANAGEMENT = "MANAGEMENT"
    
    # Tier 3 - External Forces
    REGULATORY = "REGULATORY"
    LEGAL = "LEGAL"
    MACRO = "MACRO"
    SECTOR = "SECTOR"
    
    # Tier 4 - Market Mechanics
    ANALYST = "ANALYST"
    FLOW = "FLOW"
    OTHER = "OTHER"


class EventSeverity(str, Enum):
    """Event severity based on likely valuation impact.
    
    HIGH: Earnings surprises, guidance changes, M&A, regulatory rulings
    MEDIUM: Partnerships, product launches, management changes
    LOW: Minor analyst moves, small announcements
    """
    
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class EventClassification(BaseModel):
    """Structured output from LLM event classifier.
    
    All fields are required for valid classification. The LLM must populate
    each field according to strict guidelines to ensure consistency.
    """
    
    event_type: EventType = Field(
        description="Single event type from canonical taxonomy"
    )
    
    severity: EventSeverity = Field(
        description="Impact severity based on likely valuation effect"
    )
    
    primary_symbol: Optional[str] = Field(
        default=None,
        description="Primary ticker symbol if explicitly mentioned in headline"
    )
    
    secondary_symbols: list[str] = Field(
        default_factory=list,
        description="Additional ticker symbols directly referenced"
    )
    
    is_material: bool = Field(
        description="Would a professional investor reasonably reconsider valuation?"
    )
    
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Classifier confidence score between 0 and 1"
    )
    
    summary: str = Field(
        min_length=10,
        max_length=200,
        description="Single factual sentence with no speculation or prediction"
    )
    
    @field_validator("primary_symbol", "secondary_symbols", mode="after")
    @classmethod
    def validate_symbols(cls, v):
        """Ensure symbols are uppercase and valid format."""
        if v is None:
            return v
        if isinstance(v, str):
            # Basic validation - symbols should be uppercase letters, 1-5 chars
            if not v.isupper() or not v.isalpha() or len(v) > 5:
                raise ValueError(f"Invalid symbol format: {v}")
            return v
        if isinstance(v, list):
            validated = []
            for symbol in v:
                if not symbol.isupper() or not symbol.isalpha() or len(symbol) > 5:
                    raise ValueError(f"Invalid symbol format: {symbol}")
                validated.append(symbol)
            return validated
        return v
    
    @field_validator("summary")
    @classmethod
    def validate_summary(cls, v: str) -> str:
        """Ensure summary is factual and free of speculative language."""
        # Check for prohibited speculative phrases
        prohibited = [
            "could", "might", "may", "potentially", "likely", "expected to",
            "will drive", "should", "would", "predict", "forecast"
        ]
        lower_summary = v.lower()
        for phrase in prohibited:
            if phrase in lower_summary:
                raise ValueError(
                    f"Summary contains speculative language: '{phrase}'. "
                    "Use only factual, objective statements."
                )
        return v
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "event_type": "EARNINGS",
                    "severity": "HIGH",
                    "primary_symbol": "NVDA",
                    "secondary_symbols": ["AMD"],
                    "is_material": True,
                    "confidence": 0.95,
                    "summary": "NVIDIA reported Q4 earnings that exceeded analyst estimates by 15%."
                },
                {
                    "event_type": "PRODUCT",
                    "severity": "MEDIUM",
                    "primary_symbol": "AAPL",
                    "secondary_symbols": [],
                    "is_material": True,
                    "confidence": 0.88,
                    "summary": "Apple announced the launch of Vision Pro mixed-reality headset."
                }
            ]
        }
    }


class RawNewsItem(BaseModel):
    """Raw news headline input for classification."""
    
    headline: str = Field(
        min_length=10,
        description="News headline text"
    )
    
    snippet: Optional[str] = Field(
        default=None,
        description="Article snippet or summary text"
    )
    
    source: Optional[str] = Field(
        default=None,
        description="News source (e.g., 'Reuters', 'Bloomberg')"
    )
    
    timestamp: Optional[str] = Field(
        default=None,
        description="Publication timestamp in ISO 8601 format"
    )


class ClassificationResult(BaseModel):
    """Complete classification result with metadata."""
    
    news_item: RawNewsItem
    classification: EventClassification
    model_name: str = Field(description="LLM model used for classification")
    prompt_version: str = Field(description="Prompt template version")
    processing_time_ms: float = Field(description="Classification latency in milliseconds")
    cached: bool = Field(default=False, description="Whether result was from cache")
