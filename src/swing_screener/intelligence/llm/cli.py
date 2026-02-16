"""CLI commands for LLM-based news classification."""

import json
import sys
from pathlib import Path
from typing import Optional

import pandas as pd


def classify_news_command(
    symbols: list[str],
    mock: bool = False,
    provider: str = "ollama",
    model: str = "mistral:7b-instruct",
    base_url: Optional[str] = None,
    output: Optional[str] = None,
) -> None:
    """Classify news headlines for given symbols using LLM.
    
    Args:
        symbols: List of ticker symbols to fetch news for
        mock: Use mock news provider (no real API calls)
        provider: LLM provider (ollama, mock)
        model: Model name for provider
        base_url: Base URL for Ollama (default: http://localhost:11434)
        output: Optional output JSON file path
    """
    from swing_screener.intelligence.llm import EventClassifier, OllamaProvider, MockLLMProvider
    
    # Initialize LLM provider
    if provider == "mock":
        llm_provider = MockLLMProvider()
    elif provider == "ollama":
        llm_provider = OllamaProvider(model=model, base_url=base_url)
        if not llm_provider.is_available():
            print(f"ERROR: Ollama model '{model}' not available.", file=sys.stderr)
            print(f"Ensure Ollama is running: docker compose up ollama", file=sys.stderr)
            print(f"And model is pulled: ollama pull {model}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"ERROR: Unknown provider: {provider}", file=sys.stderr)
        sys.exit(1)
    
    # Initialize classifier
    classifier = EventClassifier(provider=llm_provider)
    
    print(f"Using LLM: {llm_provider.model_name}")
    print(f"Classifying news for symbols: {', '.join(symbols)}")
    
    # Fetch news (mock or real)
    if mock:
        print("\nUsing MOCK news data...")
        news_items = _get_mock_news(symbols)
    else:
        print(f"\nERROR: Real news fetching not yet implemented.", file=sys.stderr)
        print("Use --mock flag to test with mock data.", file=sys.stderr)
        sys.exit(1)
    
    if not news_items:
        print("No news items found.")
        return
    
    print(f"Found {len(news_items)} news items")
    print("\nClassifying...")
    
    # Classify each item
    results = []
    for headline, snippet in news_items:
        try:
            result = classifier.classify(headline, snippet)
            results.append(result)
            
            # Print classification
            c = result.classification
            cached_marker = " [CACHED]" if result.cached else ""
            print(f"\n{c.primary_symbol or 'N/A'} | {c.event_type.value} | {c.severity.value}{cached_marker}")
            print(f"  {c.summary}")
            print(f"  Material: {c.is_material} | Confidence: {c.confidence:.2f} | {result.processing_time_ms:.0f}ms")
            
        except Exception as e:
            print(f"\nERROR classifying: {headline[:50]}...", file=sys.stderr)
            print(f"  {e}", file=sys.stderr)
    
    # Summary statistics
    print(f"\n{'='*80}")
    print(f"Classified {len(results)} items")
    
    if results:
        avg_time = sum(r.processing_time_ms for r in results) / len(results)
        cached_count = sum(1 for r in results if r.cached)
        material_count = sum(1 for r in results if r.classification.is_material)
        
        print(f"Average processing time: {avg_time:.0f}ms")
        print(f"Cached responses: {cached_count}/{len(results)}")
        print(f"Material events: {material_count}/{len(results)}")
        
        # Event type distribution
        event_types = {}
        for r in results:
            et = r.classification.event_type.value
            event_types[et] = event_types.get(et, 0) + 1
        
        print(f"\nEvent type distribution:")
        for et, count in sorted(event_types.items(), key=lambda x: -x[1]):
            print(f"  {et}: {count}")
    
    # Save to file if requested
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        output_data = [
            {
                "headline": r.news_item.headline,
                "snippet": r.news_item.snippet,
                "event_type": r.classification.event_type.value,
                "severity": r.classification.severity.value,
                "primary_symbol": r.classification.primary_symbol,
                "secondary_symbols": r.classification.secondary_symbols,
                "is_material": r.classification.is_material,
                "confidence": r.classification.confidence,
                "summary": r.classification.summary,
                "model": r.model_name,
                "cached": r.cached,
                "processing_time_ms": r.processing_time_ms,
            }
            for r in results
        ]
        
        with open(output_path, "w") as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\nSaved results to: {output_path.resolve()}")
    
    # Print cache stats
    cache_stats = classifier.get_cache_stats()
    print(f"\nCache: {cache_stats['total_entries']} total entries")


def _get_mock_news(symbols: list[str]) -> list[tuple[str, str]]:
    """Generate mock news items for testing.
    
    Returns:
        List of (headline, snippet) tuples
    """
    # Realistic mock headlines covering different event types
    mock_data = [
        ("NVDA beats Q4 earnings expectations with 20% revenue growth",
         "NVIDIA Corporation reported quarterly results exceeding analyst estimates."),
        
        ("Apple announces Vision Pro launch date for early 2024",
         "Apple Inc. revealed the official release date for its mixed-reality headset."),
        
        ("Tesla CEO Elon Musk steps down from board position",
         "Tesla Inc. announced changes to its board of directors."),
        
        ("AMD partners with Microsoft on AI chip development",
         "Advanced Micro Devices and Microsoft announced a strategic partnership."),
        
        ("Semiconductors rally broadly on AI demand optimism",
         "Chip stocks rose across the sector on expectations for AI-driven growth."),
        
        ("Morgan Stanley upgrades META to Overweight on advertising recovery",
         "Analyst revised rating citing improved ad market conditions."),
        
        ("AAPL raises dividend by 4% and announces $90B buyback program",
         "Apple Inc. increased its quarterly dividend and expanded share repurchase authorization."),
        
        ("FDA approves Eli Lilly obesity drug for broader use",
         "Drug received expanded approval for weight management treatment."),
        
        ("GOOGL faces antitrust investigation from EU regulators",
         "European Commission opened formal investigation into search practices."),
        
        ("Fed signals potential rate cuts in second half of 2024",
         "Federal Reserve officials indicated possible shift in monetary policy."),
    ]
    
    # Filter to only requested symbols if specific ones match
    # For mock purposes, just return all items
    return mock_data[:7]  # Return first 7 for reasonable demo
