"""Abstract LLM provider interface and deterministic mock implementation."""

from abc import ABC, abstractmethod

from .prompts import (
    PROMPT_VERSION,
    build_prompt_fingerprint,
    build_user_prompt,
    resolve_system_prompt,
    resolve_user_prompt_template,
)
from .schemas import EventClassification, RawNewsItem


class LLMProvider(ABC):
    """Abstract base class for LLM providers.
    
    Implementations must handle model communication and return structured
    EventClassification objects. All providers use temperature=0 for
    consistency over creativity.
    """
    
    @abstractmethod
    def classify_event(
        self,
        headline: str,
        snippet: str = "",
    ) -> EventClassification:
        """Classify a news headline into a structured event.
        
        Args:
            headline: News headline text
            snippet: Optional article snippet for context
        
        Returns:
            EventClassification object with structured event data
        
        Raises:
            ValueError: If classification fails validation
            RuntimeError: If LLM provider is unavailable
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM provider is available and ready.
        
        Returns:
            True if provider can accept requests, False otherwise
        """
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier being used."""
        pass

    @property
    def prompt_version(self) -> str:
        """Return prompt version/fingerprint for metadata and audit trails."""
        return PROMPT_VERSION

    @property
    def prompt_cache_key(self) -> str:
        """Return cache key segment that changes when prompt semantics change."""
        return self.prompt_version


class MockLLMProvider(LLMProvider):
    """Mock LLM provider for testing without remote dependencies.
    
    Returns deterministic classifications based on headline keywords.
    Useful for unit tests and CI environments.
    """
    
    def __init__(self):
        """Initialize mock provider."""
        self._model = "mock-classifier"
    
    def is_available(self) -> bool:
        """Mock provider is always available."""
        return True
    
    @property
    def model_name(self) -> str:
        """Return mock model identifier."""
        return self._model
    
    def classify_event(
        self,
        headline: str,
        snippet: str = "",
    ) -> EventClassification:
        """Return mock classification based on keyword matching.
        
        Args:
            headline: News headline
            snippet: Optional snippet (unused in mock)
        
        Returns:
            EventClassification with deterministic values
        """
        from .schemas import EventSeverity, EventType
        
        # Simple keyword-based classification for testing
        headline_lower = headline.lower()
        
        # Determine event type
        if "earnings" in headline_lower or "revenue" in headline_lower:
            event_type = EventType.EARNINGS
            severity = EventSeverity.HIGH
        elif "m&a" in headline_lower or "acquisition" in headline_lower:
            event_type = EventType.M_AND_A
            severity = EventSeverity.HIGH
        elif "product" in headline_lower or "launch" in headline_lower:
            event_type = EventType.PRODUCT
            severity = EventSeverity.MEDIUM
        elif "analyst" in headline_lower or "upgrade" in headline_lower:
            event_type = EventType.ANALYST
            severity = EventSeverity.LOW
        else:
            event_type = EventType.OTHER
            severity = EventSeverity.LOW
        
        # Extract ticker symbols (simple uppercase words)
        import re
        symbols = re.findall(r'\b[A-Z]{2,5}\b', headline)
        primary_symbol = symbols[0] if symbols else None
        secondary_symbols = symbols[1:3] if len(symbols) > 1 else []
        
        return EventClassification(
            event_type=event_type,
            severity=severity,
            primary_symbol=primary_symbol,
            secondary_symbols=secondary_symbols,
            is_material=severity in (EventSeverity.HIGH, EventSeverity.MEDIUM),
            confidence=0.85,
            summary=f"Mock classification: {headline[:100]}"
        )
