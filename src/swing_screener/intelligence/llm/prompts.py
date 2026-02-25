"""Versioned prompt templates for LLM event classification.

Prompts are treated as production code - versioned, tested, and carefully maintained
to prevent taxonomy drift and ensure consistent classification behavior.
"""

import hashlib

from .schemas import EventType, EventSeverity

# Prompt version identifier - increment when making breaking changes
PROMPT_VERSION = "v1.1.0"

SYSTEM_PROMPT = """You are a financial event classifier.

Your task is to convert financial news headlines into structured market events.

You must follow the taxonomy EXACTLY.

Do not invent categories.

Do not speculate.

Do not predict price direction.

Focus only on what objectively happened."""

DEFAULT_USER_PROMPT_TEMPLATE = """Classify the following financial headline.

Return ONLY valid JSON matching the EventClassification schema.

Headline: "{{headline}}"
{{snippet_block}}
{{taxonomy}}

{{instructions}}

Return your response as a JSON object with these exact fields:
{
  "event_type": "one of the types from taxonomy",
  "severity": "LOW | MEDIUM | HIGH",
  "primary_symbol": "TICKER or null",
  "secondary_symbols": ["TICKER1", "TICKER2"] or [],
  "is_material": true or false,
  "confidence": 0.0 to 1.0,
  "summary": "Single factual sentence, no speculation"
}
"""


def build_event_taxonomy_description() -> str:
    """Build detailed event taxonomy for the LLM."""
    return f"""
EVENT TAXONOMY (choose exactly ONE):

Tier 1 - Company Fundamentals (Highest Impact):
- {EventType.EARNINGS.value}: Quarterly/annual results, earnings surprises, revenue beats/misses, margin expansion
- {EventType.GUIDANCE.value}: Forward-looking revisions, FY outlook changes, demand warnings
- {EventType.M_AND_A.value}: Acquisitions, mergers, buyouts, spin-offs, divestitures
- {EventType.CAPITAL.value}: Stock offerings, buybacks, dividend changes, debt issuance

Tier 2 - Operational Drivers:
- {EventType.PRODUCT.value}: Major product launches, clinical trial results, regulatory drug approvals, platform releases
- {EventType.PARTNERSHIP.value}: Joint ventures, distribution agreements, strategic relationships, large customer wins
- {EventType.MANAGEMENT.value}: CEO departure, founder return, executive shakeup, board changes

Tier 3 - External Forces:
- {EventType.REGULATORY.value}: Antitrust rulings, government bans, regulatory investigations, compliance actions
- {EventType.LEGAL.value}: Lawsuits, settlements, liability rulings (non-regulatory)
- {EventType.MACRO.value}: Interest rate decisions, CPI reports, geopolitical events, commodity shocks
- {EventType.SECTOR.value}: Industry-wide developments, sector rotation, thematic moves

Tier 4 - Market Mechanics:
- {EventType.ANALYST.value}: Analyst upgrades/downgrades, price target revisions
- {EventType.FLOW.value}: Short squeeze, gamma squeeze, unusual options activity, technical breakout
- {EventType.OTHER.value}: Events not fitting other categories (use sparingly)

SEVERITY LEVELS:
- {EventSeverity.HIGH.value}: Earnings surprises, guidance changes, M&A, regulatory rulings
- {EventSeverity.MEDIUM.value}: Partnerships, product launches, management changes
- {EventSeverity.LOW.value}: Minor analyst moves, small operational updates

MATERIALITY:
Mark is_material = true if a professional investor would reasonably reconsider valuation.
Mark is_material = false for noise, rumors, or insignificant updates.
"""


def build_classification_instructions() -> str:
    """Build detailed classification instructions."""
    return """
CLASSIFICATION INSTRUCTIONS:

1. Choose exactly ONE event_type from the taxonomy above
2. Assign severity based on likely valuation impact (not just headline drama)
3. Identify primary_symbol ONLY if explicitly mentioned (e.g., "AAPL" or "Apple Inc.")
4. List secondary_symbols ONLY if directly referenced in the text
5. Set is_material = false if unlikely to affect valuation
6. Provide confidence score (0.0 to 1.0) based on clarity of the headline
7. Write a single factual summary with NO speculation

CRITICAL RULES:
- Do NOT invent or guess ticker symbols
- Do NOT use speculative language: "could", "might", "may", "likely", "expected to"
- Do NOT predict price movements or trading opportunities
- Do NOT create new event categories
- If unsure about classification, choose OTHER and mark confidence low
- Clinical drug approvals go under PRODUCT (not REGULATORY) because they affect revenue

EXAMPLES OF CORRECT CLASSIFICATION:

Headline: "NVIDIA beats Q4 earnings expectations, revenue up 20%"
→ event_type: EARNINGS, severity: HIGH, primary_symbol: "NVDA", is_material: true
→ summary: "NVIDIA reported Q4 earnings exceeding expectations with 20% revenue growth."

Headline: "Apple announces Vision Pro launch date"
→ event_type: PRODUCT, severity: MEDIUM, primary_symbol: "AAPL", is_material: true
→ summary: "Apple announced the launch date for its Vision Pro mixed-reality headset."

Headline: "Semiconductors rally on AI demand optimism"
→ event_type: SECTOR, severity: MEDIUM, primary_symbol: null, is_material: false
→ summary: "Semiconductor stocks rose broadly on expectations for AI-related demand."

Headline: "Morgan Stanley upgrades Tesla to Overweight"
→ event_type: ANALYST, severity: LOW, primary_symbol: "TSLA", is_material: false
→ summary: "Morgan Stanley upgraded Tesla to Overweight rating."
"""


def resolve_system_prompt(system_prompt_override: str | None = None) -> str:
    """Resolve system prompt with optional override."""
    override = str(system_prompt_override or "").strip()
    return override or SYSTEM_PROMPT


def resolve_user_prompt_template(user_prompt_template_override: str | None = None) -> str:
    """Resolve user prompt template with optional override."""
    override = str(user_prompt_template_override or "").replace("\r\n", "\n")
    return override if override.strip() else DEFAULT_USER_PROMPT_TEMPLATE


def build_prompt_fingerprint(
    *,
    system_prompt_override: str | None = None,
    user_prompt_template_override: str | None = None,
) -> str:
    """Build a deterministic prompt fingerprint for cache/version tagging."""
    system_prompt = resolve_system_prompt(system_prompt_override)
    user_prompt_template = resolve_user_prompt_template(user_prompt_template_override)

    if system_prompt == SYSTEM_PROMPT and user_prompt_template == DEFAULT_USER_PROMPT_TEMPLATE:
        return PROMPT_VERSION

    payload = f"{system_prompt}\n\n---\n\n{user_prompt_template}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    return f"{PROMPT_VERSION}+custom-{digest}"


def _build_snippet_block(snippet: str) -> str:
    snippet_text = str(snippet or "").strip()
    if not snippet_text:
        return ""
    return f'Snippet: "{snippet_text}"'


def _render_user_prompt_template(template: str, headline: str, snippet: str = "") -> str:
    rendered = str(template).replace("\r\n", "\n")
    rendered = rendered.replace("{{headline}}", str(headline))
    rendered = rendered.replace("{{snippet}}", str(snippet or "").strip())
    rendered = rendered.replace("{{snippet_block}}", _build_snippet_block(snippet))
    rendered = rendered.replace("{{taxonomy}}", build_event_taxonomy_description().strip())
    rendered = rendered.replace("{{instructions}}", build_classification_instructions().strip())
    return rendered


def build_user_prompt(headline: str, snippet: str = "", user_prompt_template: str | None = None) -> str:
    """Build the complete user prompt for classification."""
    template = resolve_user_prompt_template(user_prompt_template)
    prompt = _render_user_prompt_template(template, headline, snippet)
    if prompt.strip():
        return prompt
    return _render_user_prompt_template(DEFAULT_USER_PROMPT_TEMPLATE, headline, snippet)


def get_prompt_metadata() -> dict[str, str]:
    """Return metadata about current prompt version."""
    return {
        "version": PROMPT_VERSION,
        "temperature": "0",
        "system_prompt": SYSTEM_PROMPT,
        "taxonomy_size": str(len(EventType)),
        "severity_levels": str(len(EventSeverity)),
    }
