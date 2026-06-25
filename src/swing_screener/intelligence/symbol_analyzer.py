from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from openai import OpenAI

from swing_screener.intelligence.cache import write_to_cache
from swing_screener.intelligence.history import HistoryEntry, append_history, read_history
from swing_screener.intelligence.market_hours import is_us_pre_market, previous_session_close
from swing_screener.data.currency import detect_currency
from swing_screener.intelligence.models import (
    PreOpenOutlook,
    SymbolIntelligence,
    SymbolIntelligenceRequest,
    ThesisDelta,
)
from swing_screener.settings import get_settings_manager
from swing_screener.utils.logging_config import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """\
You are a swing-trading analyst. Given the technical context below and live web search results, \
produce a structured analysis for the symbol in English.

SEARCH STRATEGY — LIVE NEWS, MULTI-HOP:
• Start with a broad news search (recent headlines, earnings results, analyst views).
• Then FOLLOW THE LEADS you find: an earnings beat → search the guidance and analyst reaction; a downgrade → search the stated reason; a new product/partnership → search demand and competitive response. Iterate until you have a forward-looking view, not just a snapshot.
• Run a dedicated FORWARD-LOOKING CATALYST pass: search explicitly for upcoming earnings dates, product launches, macro events, and regulatory decisions that could move the price. These drive `upcoming_events` and `prediction_bullets`.
• CITE the URL of every news source you rely on in `sources`. Do not assert news without a citation.

CRITICAL RULES — TRADE PLAN NUMBERS:
• The "Close" in the input is the CURRENT MARKET PRICE — it is NOT the entry price.
• When a "Planned entry (pullback level)" is provided, ALWAYS use that price as the entry point in the narrative. Never use the Close as the entry.
• When a "Risk/Reward" value is provided in the Trade plan block, use it exactly as given. Do NOT compute your own R/R from Close.
• When action is BUY_ON_PULLBACK, the trade has not triggered yet. The stock is currently trading ABOVE the planned entry — the user is waiting for a pullback to that lower level before placing the order.

IMPORTANT RULE — EXISTING POSITION MODE:
If the input contains an "OPEN POSITION" block, the user already holds this stock.
In that case you MUST:
  • Set action = MANAGE_ONLY (never BUY_NOW / BUY_ON_PULLBACK / etc.)
  • Write the narrative from a position-management perspective — do NOT suggest initiating an entry.
  • Frame **What to do:** around holding, trimming, or exiting the current position.
  • Frame **Watch for:** around signals that would change your hold/trim/exit recommendation.
  • Set position_move_explanation: explain why the price moved from the entry to now over the
    holding window, citing live news / earnings / sector moves since the entry date, and account
    for the sign and size of the current P&L (R).

Return ONLY a JSON block (fenced with ```json) with exactly these fields:
- action: one of BUY_NOW | BUY_ON_PULLBACK | WAIT_FOR_BREAKOUT | WATCH | TACTICAL_ONLY | AVOID | MANAGE_ONLY
- conviction: one of high | medium | low
- catalyst_urgency: one of high | medium | low | none
- summary_line: one sentence synthetic read (max 120 chars)
- narrative: flowing prose in Markdown. Start with the actionable read: **What to do:** and **Watch for:** in the first two short paragraphs. Then add the supporting technical, fundamental, and catalyst rationale. No H1/H2 headings. Max 400 words.
  When writing the narrative, always include:
  - **When to act:** Explain the specific timing for order placement — after market close today, on a confirmed pullback to the entry level, or on a breakout above a key level. Be concrete about the condition.
  - **Expected growth:** Using the target price and fair value context, state the expected upside as a percentage and how long it might take to play out (days/weeks).
  - **Take profit reasoning:** Explain why the target price was set where it is — R-multiple from stop, resistance level, or fair value estimate.
  Keep the narrative flowing and discursive, integrating the screener decision context naturally rather than listing fields mechanically.
- upcoming_events: array of objects {type, date, direction, summary} for events that could move the price.
  type: earnings | macro | dividend | product_launch | regulatory | other
  date: ISO date string or null if unknown
  direction: bullish | bearish | neutral
  summary: one sentence description
- position_signal: null unless position context is provided — then:
  {action: HOLD | TRIM | EXIT, reason: one sentence,
   trim_pct: fraction to trim if TRIM (e.g. 0.5 for 50%), else null,
   trim_price: suggested execution price if TRIM (near current price or resistance), else null,
   re_entry_zone: {"low": <price>, "high": <price>} if TRIM or EXIT and a re-entry level exists, else null}
  HOLD = thesis intact, no change needed
  TRIM = take partial profit or reduce risk, thesis weakening
  EXIT = thesis broken or clearly better use of capital
- position_move_explanation: null unless position context is provided — then an object with:
  direction: up | down | flat (how price moved from entry to now)
  summary: one sentence — net reason the price is where it is versus the entry, consistent with the P&L sign
  drivers: array of 1-4 objects {label, detail}, most material first. label = short tag
    (e.g. "Q1 earnings beat", "sector selloff", "guidance cut"); detail = one sentence.
    Ground drivers in news/events since the entry date, not generic commentary.
- position_outlook: null unless position context is provided — then an object with:
  expected_holding_period: days | 1-2_weeks | 2-6_weeks | unknown
  hold_until: plain-English condition for staying in the trade, not a guaranteed date
  next_review_trigger: the next event, price action, or time condition that should force reassessment
  thesis_status: intact | weakening | broken | unclear
  invalidation_signals: 2-4 concrete price/news/catalyst signals that would weaken or break the trade
  profit_management: hold_full | consider_trim | trail_stop | protect_breakeven | exit
  opportunity_cost: low | medium | high
  confidence_decay: one sentence explaining when the idea becomes stale if nothing changes
- sources: list of URLs you cited (may be empty)
- price_hook: one sentence — why this symbol, why now (max 140 chars).
- key_numbers: array of 4–8 objects {label, value, sentiment}. Pick the most decision-relevant numbers: SMAs relative to price, momentum, revenue growth, valuation label, relative strength vs benchmark, 52-week high proximity. sentiment must be one of: bullish | bearish | neutral based on what the value implies for the trade.
- risk_factors: array of 3–5 strings. Each is a concrete, specific risk to the thesis. No generic filler.
- prediction_bullets: array of 2–5 objects {direction, reason, reference}. direction: bullish | bearish | neutral. reason: one sentence. reference: short label for the data point or event (e.g. "SMA20 support", "Q1 earnings", "fair value range", "prior stop-out level"). If past trades are provided, at least one bullet must reference them.
- past_trades_context: null unless a "Past trades" block is in the input. If past trades are present, write one paragraph: what the pattern tells us about this setup — name the levels, outcomes, and what they imply for stop placement or conviction. Use this analysis to calibrate conviction.
- pre_open_outlook: null UNLESS a "Pre-open outlook" block is present. When it is, return an object:
  {gap_direction: gap_up | gap_down | flat,
   magnitude: minor | moderate | large (a bucket — never a precise %),
   primary_driver: {summary: one sentence, source_url: cited URL or null},
   action_at_open: concrete instruction for the open,
   stop_gap_plan: what to do if it gaps through the stop,
   confidence: high | medium | low}
  Base it only on news since the previous session close.
- thesis_delta: null UNLESS a "Prior analyses" block is present. When it is, return an object:
  {status: new | confirmed | weakening | invalidated,
   summary: one sentence on what changed since the last analysis,
   what_played_out: array of strings — previously-flagged items that did or did not happen}
  Use status=confirmed if the prior read still holds, weakening if it is eroding, invalidated if broken.

PAST TRADES RULE:
If a "Past trades" block is present in the input:
  • Analyse entries, exits, stop levels, and R outcomes.
  • If 2+ stop-outs occurred, lower conviction one step (high→medium, medium→low) and flag the pattern in past_trades_context.
  • If there is a prior win on this ticker, note setup similarity or difference.
  • Always set past_trades_context (not null) when past trades are present.

Do not include any text outside the JSON block.\
"""


def _safe_submodel(model_cls, data):
    """Validate an optional LLM-emitted sub-object into `model_cls`, degrading to
    None (with a warning) if the model returns a malformed/partial dict. Keeps a
    bad optional field from failing the whole analysis."""
    if not data:
        return None
    try:
        return model_cls.model_validate(data)
    except Exception:
        logger.warning("Discarding malformed %s from LLM output", model_cls.__name__, exc_info=True)
        return None


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in LLM response: {text[:300]}")


def _format_past_trades(ticker: str, past_positions: list[dict]) -> str | None:
    """Summarise closed positions for ticker into a prompt block. Returns None if none."""
    closed = [
        p for p in past_positions
        if str(p.get("ticker", "")).upper() == ticker.upper()
        and p.get("status") == "closed"
        and p.get("exit_price") is not None
    ]
    if not closed:
        return None
    lines = [f"--- Past trades on {ticker} ---"]
    for p in closed:
        entry = float(p["entry_price"])
        stop = float(p["stop_price"])
        exit_p = float(p["exit_price"])
        denom = entry - stop
        r = (exit_p - entry) / denom if denom != 0 else 0.0
        entry_date = p.get("entry_date") or "?"
        exit_date = p.get("exit_date") or "?"
        outcome = "stopped out" if exit_p < entry else "target/manual exit"
        r_sign = "+" if r >= 0 else ""
        lines.append(
            f"  Trade: {entry_date}→{exit_date} | entry {entry:.2f} → exit {exit_p:.2f}"
            f" | {r_sign}{r:.2f}R | {outcome}"
        )
    return "\n".join(lines)


def _format_prior_digest(digest: list[HistoryEntry]) -> str | None:
    """Compact most-recent-first summary of past analyses for the prompt."""
    if not digest:
        return None
    lines = ["--- Prior analyses (most recent first) ---"]
    for e in digest:
        watch = f" | watched for: {'; '.join(e.watch_for)}" if e.watch_for else ""
        lines.append(
            f"  {e.generated_at} | {e.action} ({e.conviction}) | {e.summary_line}{watch}"
        )
    lines.append(
        "Compare today's read against these. Set thesis_delta.status to confirmed, weakening, "
        "or invalidated, and note in what_played_out which previously-flagged items did or did not happen."
    )
    return "\n".join(lines)


def _build_user_prompt(
    ticker: str,
    req: SymbolIntelligenceRequest,
    past_positions: list[dict] | None = None,
    *,
    pre_open: bool = False,
    pre_open_since: str | None = None,
    prior_digest: list[HistoryEntry] | None = None,
) -> str:
    def fmt(v: float | None) -> str:
        return f"{v:.2f}" if v is not None else "N/A"

    has_position = (
        req.entry_price is not None
        and req.r_now is not None
        and req.days_open is not None
    )

    lines: list[str] = []

    if has_position:
        r_sign = "+" if req.r_now >= 0 else ""  # type: ignore[operator]
        lines += [
            "⚠️  OPEN POSITION — the user already holds this stock. Do NOT suggest initiating.",
            f"  Filled entry:  {fmt(req.entry_price)} {req.currency}",
            f"  Entry date:    {req.entry_date or 'N/A'}",
            f"  Current price: {fmt(req.close)} {req.currency}",
            f"  Current P&L:   {r_sign}{req.r_now:.2f}R",
            f"  Days held:     {req.days_open}",
            f"  Current stop:  {fmt(req.stop)} {req.currency}",
            "",
            "Focus on whether to HOLD, TRIM, or EXIT. Set action = MANAGE_ONLY.",
            "Explain why the price moved from the entry to now over the holding window: "
            "use live news, earnings and sector moves since the entry date to account for the "
            "sign and size of the current P&L (R). Put this in position_move_explanation.",
            "Include position_signal, position_outlook and position_move_explanation in your JSON output.",
        ]
    else:
        currency = req.currency or ""
        lines += [
            f"Symbol: {ticker}",
            f"Signal: {req.signal}",
        ]

        # Trade plan block — placed FIRST so the planned entry is the dominant price.
        # The current market price follows below as context only.
        if not has_position and any(x is not None for x in (req.entry, req.stop, req.target, req.rr)):
            plan_lines: list[str] = ["", "--- Trade plan (use these prices in the narrative) ---"]
            entry_str = f"Planned entry: {fmt(req.entry)} {currency}" if req.entry is not None else ""
            stop_str = f"Stop loss: {fmt(req.stop)} {currency}" if req.stop is not None else ""
            target_str = f"Price target: {fmt(req.target)} {currency}" if req.target is not None else ""
            price_parts = [p for p in (entry_str, stop_str, target_str) if p]
            if price_parts:
                plan_lines.append(" | ".join(price_parts))
            rr_str = f"Risk/Reward: {req.rr}x" if req.rr is not None else ""
            if req.target is not None and req.close is not None:
                upside_pct = round((req.target - req.close) / req.close * 100, 1)
                upside_str = f"Upside to target: {upside_pct}%"
            else:
                upside_str = ""
            rr_parts = [p for p in (rr_str, upside_str) if p]
            if rr_parts:
                plan_lines.append(" | ".join(rr_parts))
            lines += plan_lines

        lines.append(f"Current market price (context only, NOT the entry): {fmt(req.close)} {currency}")

    lines += [
        "",
        "--- Technical context ---",
        f"SMA20: {fmt(req.sma_20)} | SMA50: {fmt(req.sma_50)} | SMA200: {fmt(req.sma_200)}",
        f"Momentum 6m: {fmt(req.momentum_6m)}% | 12m: {fmt(req.momentum_12m)}%",
        f"Sector: {req.sector or 'Unknown'}",
    ]

    if req.recent_patterns:
        readable = ", ".join(
            p.replace("@", " @ ").replace("_", " ") for p in req.recent_patterns
        )
        lines.append(f"Recent candlestick patterns: {readable}")

    has_fundamentals = any(
        x is not None
        for x in (
            req.trailing_pe,
            req.revenue_growth_yoy,
            req.gross_margin,
            req.net_margin,
            req.return_on_equity,
            req.debt_to_equity,
        )
    )
    if has_fundamentals:
        def _pct(v: float | None) -> str | None:
            return f"{v * 100:.1f}%" if v is not None else None

        fund_parts = [
            f"P/E: {req.trailing_pe:.2f}" if req.trailing_pe is not None else None,
            f"Revenue growth YoY: {_pct(req.revenue_growth_yoy)}" if req.revenue_growth_yoy is not None else None,
            f"Gross margin: {_pct(req.gross_margin)}" if req.gross_margin is not None else None,
            f"Net margin: {_pct(req.net_margin)}" if req.net_margin is not None else None,
            f"ROE: {_pct(req.return_on_equity)}" if req.return_on_equity is not None else None,
            f"Debt/Equity: {req.debt_to_equity:.2f}" if req.debt_to_equity is not None else None,
        ]
        lines += ["", "--- Fundamentals ---", " | ".join(p for p in fund_parts if p)]

    if not has_position:

        # Decision context block
        has_decision = any(
            x is not None and x != ""
            for x in (
                req.decision_action, req.decision_conviction,
                req.technical_label, req.fundamentals_label, req.valuation_label,
                req.fair_value_low, req.fair_value_base, req.fair_value_high,
            )
        )
        if has_decision:
            currency = req.currency or ""
            lines += ["", "--- Decision context (screener) ---"]
            action_str = f"Action: {req.decision_action}" if req.decision_action else ""
            conv_str = f"Conviction: {req.decision_conviction}" if req.decision_conviction else ""
            ac_parts = [p for p in (action_str, conv_str) if p]
            if ac_parts:
                lines.append(" | ".join(ac_parts))
            tech_str = f"Technical: {req.technical_label}" if req.technical_label else ""
            fund_str = f"Fundamentals: {req.fundamentals_label}" if req.fundamentals_label else ""
            val_str = f"Valuation: {req.valuation_label}" if req.valuation_label else ""
            label_parts = [p for p in (tech_str, fund_str, val_str) if p]
            if label_parts:
                lines.append(" | ".join(label_parts))
            if all(x is not None for x in (req.fair_value_low, req.fair_value_base, req.fair_value_high)):
                fv_low = fmt(req.fair_value_low)
                fv_high = fmt(req.fair_value_high)
                fv_base = fmt(req.fair_value_base)
                lines.append(
                    f"Fair value range: {fv_low}–{fv_high} (base {fv_base}) {currency}"
                )

    # Chart quality block — also shown for open positions (ATR / 52w distance help manage the trade).
    has_chart_quality = any(
        x is not None
        for x in (
            req.atr,
            req.rel_strength,
            req.sector_rs,
            req.dist_52w_high_pct,
            req.near_52w_high,
            req.sector_rotation_context,
        )
    )
    if has_chart_quality:
        lines += ["", "--- Chart quality ---"]
        atr_str = f"ATR: {fmt(req.atr)}" if req.atr is not None else ""
        rs_str = f"Relative strength vs benchmark: {req.rel_strength}%" if req.rel_strength is not None else ""
        sector_rs_str = f"Relative strength vs sector ETF: {req.sector_rs}%" if req.sector_rs is not None else ""
        cq_parts = [p for p in (atr_str, rs_str, sector_rs_str) if p]
        if cq_parts:
            lines.append(" | ".join(cq_parts))
        if req.dist_52w_high_pct is not None:
            pct = round(req.dist_52w_high_pct * 100, 1)
            near_str = " (near 52w high)" if req.near_52w_high else ""
            lines.append(f"Distance from 52w high: {pct:+.1f}%{near_str}")
        if req.sector_rotation_context:
            fast = req.sector_rotation_context.get("fast_rs")
            slow = req.sector_rotation_context.get("slow_rs")
            in_rotation = req.sector_rotation_context.get("in_rotation")
            parts = []
            if fast is not None:
                parts.append(f"4w sector ETF RS: {fmt(fast)}")
            if slow is not None:
                parts.append(f"13w sector ETF RS: {fmt(slow)}")
            if in_rotation is not None:
                parts.append(f"in rotation: {bool(in_rotation)}")
            if parts:
                lines.append("Sector rotation: " + " | ".join(parts))

    # Finnhub enrichment signals block — also shown for open positions.
    has_finnhub = any(x is not None for x in (
        req.insider_net_shares_90d, req.forward_eps_estimate, req.analyst_upgrade_downgrade_net_30d
    ))
    if has_finnhub:
        lines += ["", "--- Finnhub enrichment signals ---"]
        if req.insider_net_shares_90d is not None:
            direction = "net buyer" if req.insider_net_shares_90d > 0 else ("net seller" if req.insider_net_shares_90d < 0 else "flat")
            lines.append(f"Insider activity (90d): {req.insider_net_shares_90d:+,} shares ({direction})")
        if req.forward_eps_estimate is not None:
            lines.append(f"Forward EPS estimate (next Q): {req.forward_eps_estimate:.2f}")
        if req.analyst_upgrade_downgrade_net_30d is not None:
            net = req.analyst_upgrade_downgrade_net_30d
            direction = "net upgrades" if net > 0 else ("net downgrades" if net < 0 else "flat")
            lines.append(f"Analyst upgrades/downgrades (30d): {net:+d} ({direction})")

    # Earnings proximity block
    if req.days_to_earnings is not None:
        date_str = f" ({req.next_earnings_date})" if req.next_earnings_date else ""
        lines += [
            "",
            "--- Upcoming earnings ---",
            f"Next earnings report: {req.days_to_earnings} day{'s' if req.days_to_earnings != 1 else ''} away{date_str}",
            "Factor this into your risk assessment and timing. If earnings are within 2 weeks, flag the binary-event risk explicitly.",
        ]

    # Catalyst context block (before web search instruction)
    if req.catalyst_summary:
        lines += [
            "",
            "--- Existing catalyst context ---",
            req.catalyst_summary,
            "(Build on this context. Do not repeat it verbatim.)",
        ]

    # Deterministic catalyst evidence (source-attributed), in addition to web search
    if req.catalyst_evidence:
        lines.append("")
        lines.append("--- Recent catalyst evidence (source-attributed) ---")
        for ev in req.catalyst_evidence:
            head = " · ".join(p for p in (ev.published_at, ev.publisher, ev.title) if p)
            quote = (
                f' — "{ev.quote_or_summary}"'
                if ev.quote_or_summary and ev.quote_or_summary != ev.title
                else ""
            )
            lines.append(f"{head}{quote} · {ev.url}")
        lines.append("(Corroborate against your own web search. Cite these URLs when you use them.)")

    # Inject past trades block before the web-search instruction
    past_block = _format_past_trades(ticker, past_positions or [])
    if past_block:
        lines.append("")
        lines.append(past_block)

    # Prior-analyses digest (thesis drift) — most recent first
    digest_block = _format_prior_digest(prior_digest or [])
    if digest_block:
        lines.append("")
        lines.append(digest_block)

    # Pre-open mode — US symbol analyzed before the regular-session open
    if pre_open:
        since = f" (since the previous session close at {pre_open_since})" if pre_open_since else ""
        framing = (
            "Frame action_at_open and stop_gap_plan around the OPEN POSITION and its current stop."
            if has_position
            else "Frame action_at_open and stop_gap_plan around the PLANNED entry/stop — judge whether "
            "the setup still holds if the stock gaps away from the planned entry at the open."
        )
        lines += [
            "",
            "--- Pre-open outlook (US market not yet open) ---",
            f"The US regular session has NOT opened yet. Read the overnight tape{since}: "
            "search index/sector futures (S&P 500, Nasdaq) and this stock's pre-market move and "
            "overnight headlines, then call the opening gap.",
            framing,
            "Produce pre_open_outlook with: gap_direction (gap_up | gap_down | flat); "
            "magnitude as a bucket (minor | moderate | large) — do NOT invent a precise %; "
            "primary_driver {summary, source_url} = the single overnight item most likely to move the open; "
            "action_at_open = concrete instruction at the bell; stop_gap_plan = what to do if it gaps "
            "through the stop; confidence (high | medium | low). Use only news since the previous close.",
        ]

    lines.append(
        f"\nSearch broadly for recent news, earnings results, catalysts, and analyst views for {ticker}, "
        "then follow the most material leads with further searches and run a forward-looking catalyst pass. "
        "Cite every source. Finally produce the structured JSON analysis."
    )
    return "\n".join(lines)


class SymbolAnalyzer:
    def __init__(self) -> None:
        doc = get_settings_manager().load_intelligence_document()
        cfg = doc.get("config", {})
        llm_cfg = cfg.get("llm", {})
        self._model = llm_cfg.get("web_search_model", "gpt-4o")
        self._max_tokens = int(llm_cfg.get("web_search_max_tokens", 2000))
        history_cfg = cfg.get("analysis_history", {})
        self._history_max_entries = int(history_cfg.get("max_entries", 50))
        self._history_digest_size = int(history_cfg.get("digest_size", 5))
        self._pre_open_cfg = cfg.get("pre_open", {})
        self._client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def _is_us_listed(self, ticker: str, req: SymbolIntelligenceRequest) -> bool:
        """US-listed proxy. Prefer the ticker-based `detect_currency` (knows e.g.
        `ASML.AS` -> EUR), falling back to the request currency only when the
        ticker is unresolved (so a US candidate missing from the instrument
        master still qualifies via its request currency)."""
        detected = detect_currency(ticker)
        if detected == "USD":
            return True
        if detected == "UNKNOWN":
            return (req.currency or "").upper() == "USD"
        return False  # known non-US currency (EUR/GBP/...)

    def _pre_open_state(
        self, ticker: str, req: SymbolIntelligenceRequest, now: datetime
    ) -> tuple[bool, str | None]:
        if not bool(self._pre_open_cfg.get("enabled", True)):
            return False, None
        if not self._is_us_listed(ticker, req):
            return False, None
        tz = self._pre_open_cfg.get("timezone", "America/New_York")
        active = is_us_pre_market(
            now,
            market_open=self._pre_open_cfg.get("market_open", "09:30"),
            window_start=self._pre_open_cfg.get("window_start", "00:00"),
            tz=tz,
        )
        if not active:
            return False, None
        since = previous_session_close(
            now, session_close=self._pre_open_cfg.get("session_close", "16:00"), tz=tz
        ).isoformat()
        return True, since

    def analyze(
        self,
        ticker: str,
        req: SymbolIntelligenceRequest,
        past_positions: list[dict] | None = None,
        *,
        now: datetime | None = None,
    ) -> SymbolIntelligence:
        inputs_used: dict = {}
        now = now or datetime.now(timezone.utc)
        pre_open, pre_open_since = self._pre_open_state(ticker, req, now)
        prior_digest = read_history(ticker, limit=self._history_digest_size)

        trade_plan: dict = {}
        if req.entry is not None:
            trade_plan["entry"] = req.entry
        if req.stop is not None:
            trade_plan["stop"] = req.stop
        if req.target is not None:
            trade_plan["target"] = req.target
        if req.rr is not None:
            trade_plan["rr"] = req.rr
        if req.target is not None and req.close is not None:
            trade_plan["upside_pct"] = round((req.target - req.close) / req.close * 100, 1)
        if trade_plan:
            inputs_used["trade_plan"] = trade_plan

        technical: dict = {}
        if req.sma_20 is not None:
            technical["sma_20"] = req.sma_20
        if req.sma_50 is not None:
            technical["sma_50"] = req.sma_50
        if req.sma_200 is not None:
            technical["sma_200"] = req.sma_200
        if req.momentum_6m is not None:
            technical["momentum_6m"] = req.momentum_6m
        if req.momentum_12m is not None:
            technical["momentum_12m"] = req.momentum_12m
        if req.rel_strength is not None:
            technical["rel_strength"] = req.rel_strength
        if req.sector_rs is not None:
            technical["sector_rs"] = req.sector_rs
        if req.atr is not None:
            technical["atr"] = req.atr
        if req.dist_52w_high_pct is not None:
            technical["dist_52w_high_pct"] = round(req.dist_52w_high_pct * 100, 1)
        if req.near_52w_high is not None:
            technical["near_52w_high"] = req.near_52w_high
        if req.sector_rotation_context:
            technical["sector_rotation_context"] = req.sector_rotation_context
        if req.signal:
            technical["signal"] = req.signal
        if technical:
            inputs_used["technical"] = technical

        decision: dict = {}
        if req.decision_action:
            decision["action"] = req.decision_action
        if req.decision_conviction:
            decision["conviction"] = req.decision_conviction
        if req.technical_label:
            decision["technical_label"] = req.technical_label
        if req.fundamentals_label:
            decision["fundamentals_label"] = req.fundamentals_label
        if req.valuation_label:
            decision["valuation_label"] = req.valuation_label
        if req.fair_value_low is not None:
            decision["fair_value_low"] = req.fair_value_low
        if req.fair_value_base is not None:
            decision["fair_value_base"] = req.fair_value_base
        if req.fair_value_high is not None:
            decision["fair_value_high"] = req.fair_value_high
        if decision:
            inputs_used["decision_context"] = decision

        if req.catalyst_summary:
            inputs_used["catalyst"] = {"summary_available": True}

        if req.catalyst_evidence:
            inputs_used["catalyst_evidence"] = {
                "count": len(req.catalyst_evidence),
                "sources": sorted({ev.publisher for ev in req.catalyst_evidence if ev.publisher}),
            }

        finnhub_signals: dict = {}
        if req.insider_net_shares_90d is not None:
            finnhub_signals["insider_net_shares_90d"] = req.insider_net_shares_90d
        if req.insider_transaction_count_90d is not None:
            finnhub_signals["insider_transaction_count_90d"] = req.insider_transaction_count_90d
        if req.forward_eps_estimate is not None:
            finnhub_signals["forward_eps_estimate"] = req.forward_eps_estimate
        if req.analyst_upgrade_downgrade_net_30d is not None:
            finnhub_signals["analyst_upgrade_downgrade_net_30d"] = req.analyst_upgrade_downgrade_net_30d
        if finnhub_signals:
            inputs_used["finnhub_signals"] = finnhub_signals

        if req.recent_patterns:
            inputs_used["candles"] = {"patterns": ", ".join(req.recent_patterns)}

        if pre_open:
            inputs_used["pre_open"] = {"window": "us_pre_market", "since": pre_open_since}
        if prior_digest:
            inputs_used["history"] = {"prior_runs": len(prior_digest)}

        user_prompt = _build_user_prompt(
            ticker,
            req,
            past_positions=past_positions or [],
            pre_open=pre_open,
            pre_open_since=pre_open_since,
            prior_digest=prior_digest,
        )
        response = self._client.responses.create(
            model=self._model,
            tools=[{"type": "web_search_preview"}],
            instructions=_SYSTEM_PROMPT,
            input=user_prompt,
            max_output_tokens=self._max_tokens,
        )
        raw = _extract_json(response.output_text)
        result = SymbolIntelligence(
            symbol=ticker,
            generated_at=datetime.now(timezone.utc).isoformat(),
            action=raw["action"],
            conviction=raw["conviction"],
            catalyst_urgency=raw.get("catalyst_urgency", "none"),
            summary_line=raw["summary_line"],
            narrative=raw["narrative"],
            upcoming_events=raw.get("upcoming_events", []),
            position_signal=raw.get("position_signal"),
            position_outlook=raw.get("position_outlook"),
            position_move_explanation=raw.get("position_move_explanation"),
            sources=raw.get("sources", []),
            price_hook=raw.get("price_hook"),
            key_numbers=raw.get("key_numbers", []),
            risk_factors=raw.get("risk_factors", []),
            prediction_bullets=raw.get("prediction_bullets", []),
            past_trades_context=raw.get("past_trades_context"),
            pre_open_outlook=_safe_submodel(PreOpenOutlook, raw.get("pre_open_outlook")) if pre_open else None,
            thesis_delta=_safe_submodel(ThesisDelta, raw.get("thesis_delta")) if prior_digest else None,
        )
        result = result.model_copy(update={"inputs_used": inputs_used})
        try:
            write_to_cache(ticker, result)
        except Exception:
            logger.warning("Failed to write intelligence cache for %r; result will not be cached", ticker, exc_info=True)
        try:
            append_history(ticker, result, max_entries=self._history_max_entries)
        except Exception:
            logger.warning("Failed to append intelligence history for %r", ticker, exc_info=True)
        return result
