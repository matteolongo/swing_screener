"""Abstract LLM provider interface with multiple provider implementations.

Provides pluggable architecture for multiple LLM providers (OpenAI, Anthropic, Ollama)
while maintaining consistent event classification behavior.

Provider Factory:
    get_llm_provider() - Factory function to instantiate providers by name
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


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider for cloud-based model inference.
    
    Uses OpenAI's Chat Completions API with structured outputs (JSON mode)
    to ensure schema compliance. Requires OPENAI_API_KEY environment variable.
    """
    
    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
    ):
        """Initialize OpenAI provider.
        
        Args:
            model: OpenAI model name (e.g., "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo")
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        
        Raises:
            ValueError: If API key is not provided and not in environment
        """
        self._model = model
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY")
        
        if not self._api_key:
            raise ValueError(
                "OpenAI API key required. Set OPENAI_API_KEY environment variable "
                "or pass api_key parameter."
            )
        
        self._client = None
    
    def _get_client(self):
        """Lazy-load OpenAI client to avoid import errors if not installed."""
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self._api_key)
            except ImportError as e:
                raise RuntimeError(
                    "openai package not installed. Install with: pip install 'swing-screener[llm]'"
                ) from e
        return self._client
    
    def is_available(self) -> bool:
        """Check if OpenAI API is accessible.
        
        Makes a lightweight API call to verify credentials and connectivity.
        """
        try:
            client = self._get_client()
            # Simple models list call to verify API access
            client.models.list()
            return True
        except Exception:
            return False
    
    @property
    def model_name(self) -> str:
        """Return the OpenAI model identifier."""
        return self._model
    
    def classify_event(
        self,
        headline: str,
        snippet: str = "",
    ) -> EventClassification:
        """Classify event using OpenAI model.
        
        Uses JSON mode with response_format to ensure valid JSON response
        that matches EventClassification schema.
        
        Args:
            headline: News headline to classify
            snippet: Optional article snippet
        
        Returns:
            EventClassification object
        
        Raises:
            RuntimeError: If OpenAI API is unavailable
            ValueError: If response fails validation
        """
        if not self.is_available():
            raise RuntimeError(
                "OpenAI API unavailable. Check API key and network connectivity."
            )
        
        client = self._get_client()
        user_prompt = build_user_prompt(headline, snippet)
        
        try:
            # Call OpenAI with JSON mode
            response = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},  # Force JSON output
                temperature=0,  # Consistency over creativity
                max_tokens=500,  # Reasonable limit for classification
            )
            
            # Extract JSON from response
            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI returned empty response")
            
            classification_data = json.loads(content)
            
            # Validate against schema
            classification = EventClassification.model_validate(classification_data)
            return classification
            
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM returned invalid JSON: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Classification failed: {e}") from e


class AnthropicProvider(LLMProvider):
    """Anthropic (Claude) LLM provider for cloud-based model inference.
    
    Uses Anthropic's Messages API with prefilled assistant response
    to ensure JSON output. Requires ANTHROPIC_API_KEY environment variable.
    """
    
    def __init__(
        self,
        model: str = "claude-3-haiku-20240307",
        api_key: Optional[str] = None,
    ):
        """Initialize Anthropic provider.
        
        Args:
            model: Anthropic model name (e.g., "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022")
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
        
        Raises:
            ValueError: If API key is not provided and not in environment
        """
        self._model = model
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        
        if not self._api_key:
            raise ValueError(
                "Anthropic API key required. Set ANTHROPIC_API_KEY environment variable "
                "or pass api_key parameter."
            )
        
        self._client = None
    
    def _get_client(self):
        """Lazy-load Anthropic client to avoid import errors if not installed."""
        if self._client is None:
            try:
                from anthropic import Anthropic
                self._client = Anthropic(api_key=self._api_key)
            except ImportError as e:
                raise RuntimeError(
                    "anthropic package not installed. Install with: pip install 'swing-screener[llm]'"
                ) from e
        return self._client
    
    def is_available(self) -> bool:
        """Check if Anthropic API is accessible.
        
        Makes a lightweight API call to verify credentials and connectivity.
        """
        try:
            client = self._get_client()
            # Test with a minimal message
            client.messages.create(
                model=self._model,
                max_tokens=1,
                messages=[{"role": "user", "content": "test"}]
            )
            return True
        except Exception:
            return False
    
    @property
    def model_name(self) -> str:
        """Return the Anthropic model identifier."""
        return self._model
    
    def classify_event(
        self,
        headline: str,
        snippet: str = "",
    ) -> EventClassification:
        """Classify event using Anthropic model.
        
        Uses system prompt + user message with prefilled assistant response
        to guide JSON output format.
        
        Args:
            headline: News headline to classify
            snippet: Optional article snippet
        
        Returns:
            EventClassification object
        
        Raises:
            RuntimeError: If Anthropic API is unavailable
            ValueError: If response fails validation
        """
        if not self.is_available():
            raise RuntimeError(
                "Anthropic API unavailable. Check API key and network connectivity."
            )
        
        client = self._get_client()
        user_prompt = build_user_prompt(headline, snippet)
        
        try:
            # Call Anthropic with prefilled assistant response for JSON
            response = client.messages.create(
                model=self._model,
                max_tokens=500,
                temperature=0,  # Consistency over creativity
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": "{"},  # Prefill to force JSON
                ],
            )
            
            # Extract JSON from response (prepend the opening brace we prefilled)
            content = "{" + response.content[0].text if response.content else None
            if not content:
                raise ValueError("Anthropic returned empty response")
            
            classification_data = json.loads(content)
            
            # Validate against schema
            classification = EventClassification.model_validate(classification_data)
            return classification
            
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM returned invalid JSON: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Classification failed: {e}") from e


class MockLLMProvider(LLMProvider):
    """Mock LLM provider for testing without external dependencies.
    
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


def get_llm_provider(
    provider_name: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> LLMProvider:
    """Factory function to create LLM provider by name.
    
    Args:
        provider_name: Provider type ("openai", "anthropic", "ollama", "mock")
        model: Model name/identifier (provider-specific defaults if None)
        api_key: API key for cloud providers (uses env vars if None)
        base_url: Base URL for Ollama (uses OLLAMA_HOST env var if None)
    
    Returns:
        LLMProvider instance
    
    Raises:
        ValueError: If provider_name is not supported or required credentials missing
    
    Examples:
        >>> # OpenAI with defaults
        >>> provider = get_llm_provider("openai")
        
        >>> # Ollama with custom model
        >>> provider = get_llm_provider("ollama", model="llama2:13b")
        
        >>> # Mock for testing
        >>> provider = get_llm_provider("mock")
    """
    provider_lower = provider_name.lower().strip()
    
    if provider_lower == "openai":
        model = model or "gpt-4o-mini"
        return OpenAIProvider(model=model, api_key=api_key)
    
    elif provider_lower == "anthropic":
        model = model or "claude-3-haiku-20240307"
        return AnthropicProvider(model=model, api_key=api_key)
    
    elif provider_lower == "ollama":
        model = model or "mistral:7b-instruct"
        return OllamaProvider(model=model, base_url=base_url)
    
    elif provider_lower == "mock":
        return MockLLMProvider()
    
    else:
        raise ValueError(
            f"Unsupported LLM provider: {provider_name}. "
            f"Supported: openai, anthropic, ollama, mock"
        )

