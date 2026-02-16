"""Abstract LLM provider interface with Ollama implementation.

Provides pluggable architecture for multiple LLM providers while maintaining
consistent event classification behavior.
"""

import json
import os
from abc import ABC, abstractmethod
from typing import Optional

from .prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
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


class OllamaProvider(LLMProvider):
    """Ollama LLM provider for local model inference.
    
    Connects to Ollama API (typically http://localhost:11434) and uses
    structured output mode to ensure JSON schema compliance.
    """
    
    def __init__(
        self,
        model: str = "mistral:7b-instruct",
        base_url: Optional[str] = None,
    ):
        """Initialize Ollama provider.
        
        Args:
            model: Ollama model name (e.g., "mistral:7b-instruct")
            base_url: Ollama API base URL (defaults to OLLAMA_HOST env or localhost)
        """
        self._model = model
        self._base_url = base_url or os.environ.get(
            "OLLAMA_HOST", "http://localhost:11434"
        )
        self._client = None
    
    def _get_client(self):
        """Lazy-load ollama client to avoid import errors if not installed."""
        if self._client is None:
            try:
                import ollama
                self._client = ollama.Client(host=self._base_url)
            except ImportError as e:
                raise RuntimeError(
                    "ollama package not installed. Install with: pip install 'swing-screener[llm]'"
                ) from e
        return self._client
    
    def is_available(self) -> bool:
        """Check if Ollama is running and model is available."""
        try:
            client = self._get_client()
            # List available models to verify connection
            models = client.list()
            # Check if our model is pulled
            model_names = [m["name"] for m in models.get("models", [])]
            return any(self._model in name for name in model_names)
        except Exception:
            return False
    
    @property
    def model_name(self) -> str:
        """Return the Ollama model identifier."""
        return self._model
    
    def classify_event(
        self,
        headline: str,
        snippet: str = "",
    ) -> EventClassification:
        """Classify event using Ollama model.
        
        Uses structured output (format='json') to ensure valid JSON response
        that matches EventClassification schema.
        
        Args:
            headline: News headline to classify
            snippet: Optional article snippet
        
        Returns:
            EventClassification object
        
        Raises:
            RuntimeError: If Ollama is unavailable
            ValueError: If response fails validation
        """
        if not self.is_available():
            raise RuntimeError(
                f"Ollama model '{self._model}' not available. "
                f"Ensure Ollama is running and model is pulled: ollama pull {self._model}"
            )
        
        client = self._get_client()
        user_prompt = build_user_prompt(headline, snippet)
        
        try:
            # Call Ollama with structured output mode
            response = client.chat(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                format="json",  # Force JSON output
                options={
                    "temperature": 0,  # Consistency over creativity
                    "num_predict": 500,  # Reasonable token limit for classification
                }
            )
            
            # Extract JSON from response
            content = response["message"]["content"]
            classification_data = json.loads(content)
            
            # Validate against schema
            classification = EventClassification.model_validate(classification_data)
            return classification
            
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM returned invalid JSON: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Classification failed: {e}") from e


class MockLLMProvider(LLMProvider):
    """Mock LLM provider for testing without Ollama dependency.
    
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
