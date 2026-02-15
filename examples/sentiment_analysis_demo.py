#!/usr/bin/env python3
"""
Example: Using the pluggable sentiment analysis system.

This script demonstrates how to:
1. Analyze sentiment using different providers
2. Switch between sentiment analyzers
3. Combine multiple data sources
"""

from swing_screener.social.analysis import analyze_social_symbol
from swing_screener.social.sentiment.factory import list_available_analyzers


def example_reddit_only():
    """Example 1: Reddit-only analysis with keyword sentiment."""
    print("\n=== Example 1: Reddit-only with keyword sentiment ===")
    
    result = analyze_social_symbol(
        "AAPL",
        lookback_hours=24,
        min_sample_size=5,
        provider_names=["reddit"],
        sentiment_analyzer_name="keyword",
    )
    
    print(f"Symbol: {result['symbol']}")
    print(f"Status: {result['status']}")
    print(f"Sample size: {result['sample_size']}")
    sentiment = result.get('sentiment_score')
    print(f"Sentiment score: {sentiment:.3f}" if sentiment is not None else "Sentiment score: N/A")
    confidence = result.get('sentiment_confidence')
    print(f"Sentiment confidence: {confidence:.3f}" if confidence is not None else "Sentiment confidence: N/A")
    print(f"Attention score: {result['attention_score']:.1f}")
    
    if result.get('source_breakdown'):
        print("Source breakdown:")
        for source, count in result['source_breakdown'].items():
            print(f"  {source}: {count} events")


def example_yahoo_finance():
    """Example 2: Yahoo Finance news analysis."""
    print("\n=== Example 2: Yahoo Finance news ===")
    
    result = analyze_social_symbol(
        "TSLA",
        lookback_hours=48,
        min_sample_size=3,
        provider_names=["yahoo_finance"],
        sentiment_analyzer_name="keyword",
    )
    
    print(f"Symbol: {result['symbol']}")
    print(f"Status: {result['status']}")
    print(f"Sample size: {result['sample_size']}")
    sentiment = result.get('sentiment_score')
    print(f"Sentiment: {sentiment:.3f}" if sentiment is not None else "Sentiment: N/A")
    
    print("\nRecent headlines:")
    for i, event in enumerate(result['raw_events'][:3], 1):
        print(f"{i}. {event.text[:80]}...")


def example_multi_source():
    """Example 3: Combine Reddit and Yahoo Finance."""
    print("\n=== Example 3: Multi-source (Reddit + Yahoo Finance) ===")
    
    result = analyze_social_symbol(
        "NVDA",
        lookback_hours=24,
        min_sample_size=5,
        provider_names=["reddit", "yahoo_finance"],
        sentiment_analyzer_name="keyword",
    )
    
    print(f"Symbol: {result['symbol']}")
    print(f"Total events: {result['sample_size']}")
    sentiment = result.get('sentiment_score')
    print(f"Sentiment: {sentiment:.3f}" if sentiment is not None else "Sentiment: N/A")
    confidence = result.get('sentiment_confidence')
    print(f"Confidence: {confidence:.3f}" if confidence is not None else "Confidence: N/A")
    
    if result.get('source_breakdown'):
        print("\nEvents by source:")
        for source, count in result['source_breakdown'].items():
            pct = (count / result['sample_size'] * 100) if result['sample_size'] > 0 else 0
            print(f"  {source}: {count} ({pct:.1f}%)")


def example_vader_analyzer():
    """Example 4: Using VADER sentiment analyzer."""
    print("\n=== Example 4: VADER sentiment analyzer ===")
    
    # Check if VADER is available
    available = list_available_analyzers()
    print(f"Available analyzers: {available}")
    
    if "vader" not in available:
        print("\nVADER not available. Install with: pip install vaderSentiment")
        return
    
    result = analyze_social_symbol(
        "MSFT",
        lookback_hours=24,
        min_sample_size=5,
        provider_names=["reddit", "yahoo_finance"],
        sentiment_analyzer_name="vader",
    )
    
    print(f"\nSymbol: {result['symbol']}")
    sentiment = result.get('sentiment_score')
    print(f"Sentiment (VADER): {sentiment:.3f}" if sentiment is not None else "Sentiment (VADER): N/A")
    confidence = result.get('sentiment_confidence')
    print(f"Confidence: {confidence:.3f}" if confidence is not None else "Confidence: N/A")
    print("Note: VADER typically provides more nuanced sentiment analysis")


def main():
    """Run all examples."""
    print("=" * 60)
    print("Pluggable Sentiment Analysis Examples")
    print("=" * 60)
    
    try:
        example_reddit_only()
    except Exception as e:
        print(f"Error in Example 1: {e}")
    
    try:
        example_yahoo_finance()
    except Exception as e:
        print(f"Error in Example 2: {e}")
    
    try:
        example_multi_source()
    except Exception as e:
        print(f"Error in Example 3: {e}")
    
    try:
        example_vader_analyzer()
    except Exception as e:
        print(f"Error in Example 4: {e}")
    
    print("\n" + "=" * 60)
    print("Examples complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
