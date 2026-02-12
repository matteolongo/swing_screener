"""Prompt templates for the Swing Screener MCP agent.

This module contains configurable prompt templates that can be tuned
for different information densities, tones, and use cases.
"""

from enum import Enum
from typing import Dict


class PromptStyle(str, Enum):
    """Available prompt styles."""
    CONCISE = "concise"
    BALANCED = "balanced"
    DETAILED = "detailed"
    EDUCATIONAL = "educational"


class PromptTone(str, Enum):
    """Available prompt tones."""
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    TECHNICAL = "technical"


# System prompt templates by style
SYSTEM_PROMPTS: Dict[PromptStyle, str] = {
    PromptStyle.CONCISE: """You are a trading assistant for the Swing Screener system. 
Keep responses brief and action-oriented. Focus on key metrics and recommendations only.
Use bullet points. Avoid explanations unless explicitly asked.""",
    
    PromptStyle.BALANCED: """You are a trading assistant for the Swing Screener system. 
You help analyze screening results, manage orders, and monitor positions.
Provide clear explanations with key metrics. Balance detail with clarity.
Highlight important risk information and trade recommendations.""",
    
    PromptStyle.DETAILED: """You are a comprehensive trading assistant for the Swing Screener system.
You help analyze screening results, manage orders, and monitor positions with thorough explanations.
Provide detailed analysis of metrics, indicators, and risk parameters.
Explain the reasoning behind recommendations and highlight key decision points.
Include context about R-multiples, position sizing, and risk management principles.""",
    
    PromptStyle.EDUCATIONAL: """You are an educational trading assistant for the Swing Screener system.
Your goal is to help users understand swing trading concepts while analyzing their trades.
Explain key concepts like R-multiples, position sizing, and risk management.
Provide detailed rationale for recommendations with educational context.
Help users learn from each analysis. Use clear examples and highlight best practices.""",
}


# Tone modifiers to append to system prompts
TONE_MODIFIERS: Dict[PromptTone, str] = {
    PromptTone.PROFESSIONAL: """
Tone: Maintain a professional, business-like tone. Use formal language and industry terminology.""",
    
    PromptTone.FRIENDLY: """
Tone: Be approachable and friendly. Use conversational language while maintaining expertise.""",
    
    PromptTone.TECHNICAL: """
Tone: Use precise technical language. Include specific metrics, formulas, and technical details.""",
}


# Task-specific prompt templates
TASK_PROMPTS = {
    "screening": {
        PromptStyle.CONCISE: "Analyze top {n} candidates. List ticker, rank, key metrics.",
        PromptStyle.BALANCED: "Analyze the top {n} screening candidates. For each, provide ticker, rank, key indicators (trend, momentum, ATR), and whether it's recommended.",
        PromptStyle.DETAILED: "Analyze the top {n} screening candidates in detail. For each, explain the ranking score, trend indicators (SMA status), momentum metrics (returns), volatility (ATR), and provide a trade recommendation with reasoning.",
        PromptStyle.EDUCATIONAL: "Analyze the top {n} screening candidates with educational context. For each candidate, explain what the indicators mean (trend, momentum, ATR), why they matter for swing trading, and what makes this a good or poor candidate.",
    },
    
    "order_preview": {
        PromptStyle.CONCISE: "Calculate position size for {ticker}. Show shares, $ amount, R value.",
        PromptStyle.BALANCED: "Preview the order for {ticker}. Calculate position size, number of shares, dollar amount, and R value. Explain if it fits risk parameters.",
        PromptStyle.DETAILED: "Preview a detailed order for {ticker}. Calculate: 1) R value (entry - stop), 2) position size based on account size and risk %, 3) number of shares, 4) total dollar amount. Explain how this fits within risk management rules.",
        PromptStyle.EDUCATIONAL: "Preview the order for {ticker} with full explanation. Show how R-based position sizing works: 1) Calculate 1R (entry - stop), 2) Determine dollar risk (account * risk%), 3) Calculate shares ($ risk / 1R), 4) Verify total position size. Explain why this approach controls risk.",
    },
    
    "position_management": {
        PromptStyle.CONCISE: "Position status: Show ticker, entry, stop, current R, action needed.",
        PromptStyle.BALANCED: "Analyze position status. Show current R value, P&L, stop price, and recommended action (hold/update stop/close). Explain reasoning briefly.",
        PromptStyle.DETAILED: "Comprehensive position analysis. Calculate current R from entry (R_now = (current_price - stop) / (entry - stop)), show P&L in $ and R terms, evaluate stop price against manage rules, and provide detailed recommendation with stop update suggestions.",
        PromptStyle.EDUCATIONAL: "Educational position analysis. Explain R-multiple concept: R_now shows how many R's you're up or down. Analyze stop management rules (breakeven, trailing stops), explain when and why to update stops, and provide clear action with educational reasoning.",
    },
    
    "daily_workflow": {
        PromptStyle.CONCISE: "Daily workflow: 1) Screen universe 2) Review top candidates 3) Create orders 4) Update position stops",
        PromptStyle.BALANCED: "Daily workflow guidance: 1) Run screener on universe 2) Analyze top 10-20 candidates 3) Preview and create orders for best setups 4) Review open positions 5) Update stops per manage rules",
        PromptStyle.DETAILED: "Comprehensive daily workflow: 1) Run screener on selected universe (e.g., mega_all) 2) Analyze top candidates by rank and indicators 3) Preview orders to verify position sizing 4) Create orders for setups meeting criteria 5) Review all open positions 6) Calculate stop suggestions 7) Update trailing stops as needed",
        PromptStyle.EDUCATIONAL: "Educational daily workflow: Understand the systematic approach: 1) Screener identifies candidates using rules (not discretion) 2) Ranking prioritizes best setups 3) Position sizing controls risk per trade 4) Stop management protects profits. This daily routine ensures discipline and risk control.",
    },
}


def get_system_prompt(style: PromptStyle = PromptStyle.BALANCED, 
                     tone: PromptTone = PromptTone.PROFESSIONAL) -> str:
    """Get the system prompt with specified style and tone.
    
    Args:
        style: Information density and detail level
        tone: Communication style and voice
        
    Returns:
        Complete system prompt string
    """
    base_prompt = SYSTEM_PROMPTS[style]
    tone_modifier = TONE_MODIFIERS[tone]
    
    return f"{base_prompt}\n{tone_modifier}"


def get_task_prompt(task: str, 
                   style: PromptStyle = PromptStyle.BALANCED,
                   **kwargs) -> str:
    """Get a task-specific prompt with specified style.
    
    Args:
        task: Task type (screening, order_preview, position_management, daily_workflow)
        style: Information density and detail level
        **kwargs: Variables to format into the prompt (e.g., ticker, n)
        
    Returns:
        Formatted task prompt string
    """
    if task not in TASK_PROMPTS:
        return f"Perform {task} task."
    
    template = TASK_PROMPTS[task].get(style, TASK_PROMPTS[task][PromptStyle.BALANCED])
    return template.format(**kwargs)


# Default configuration
DEFAULT_STYLE = PromptStyle.BALANCED
DEFAULT_TONE = PromptTone.PROFESSIONAL
