# Intelligence Narrative Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured fields to LLM output (`price_hook`, `key_numbers`, `risk_factors`, `prediction_bullets`, `past_trades_context`), feed closed position history for the ticker to the LLM, and redesign `NarrativeAnalysisCard` to render them visually.

**Architecture:** Backend adds new Pydantic fields (all optional, backward-compat), extends the LLM system prompt, injects past trades from `positions.json` into the user prompt. Frontend adds matching TypeScript types, new i18n keys, and rewrites `NarrativeAnalysisCard` to render the structured sections with the prose `narrative` collapsed as fallback.

**Tech Stack:** Python/Pydantic (backend models), FastAPI (router), OpenAI responses API (LLM), React 18 + TypeScript, Tailwind CSS, react-i18next.

---

## File Map

| File | Change |
|---|---|
| `src/swing_screener/intelligence/models.py` | Add `KeyNumber`, `PredictionBullet` models; extend `SymbolIntelligence` |
| `src/swing_screener/intelligence/symbol_analyzer.py` | Extend `_SYSTEM_PROMPT`; add `_format_past_trades`; extend `_build_user_prompt`; update `analyze` to accept + pass `past_positions` |
| `api/routers/intelligence.py` | Inject `PositionsRepository` into `analyze_symbol`; filter closed positions by ticker; pass to `analyzer.analyze` |
| `tests/intelligence/test_symbol_analyzer.py` | Add tests for `_format_past_trades`, new fields parsed, prompt injection |
| `web-ui/src/features/intelligence/types.ts` | Add `KeyNumber`, `PredictionBullet` types; extend `SymbolIntelligenceAPI` + `SymbolIntelligence`; update `transformIntelligence` |
| `web-ui/src/i18n/messages.en.ts` | Add 6 new keys under `workspacePage.panels.analysis.intelligence` |
| `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx` | Full redesign: render new structured sections, collapse narrative |
| `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx` | Add tests for new sections, old-cache graceful degradation |

---

## Task 1: Backend models — add `KeyNumber`, `PredictionBullet`, extend `SymbolIntelligence`

**Files:**
- Modify: `src/swing_screener/intelligence/models.py`
- Test: `tests/intelligence/test_models.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/intelligence/test_models.py`:

```python
def test_symbol_intelligence_new_fields_default_empty():
    from swing_screener.intelligence.models import SymbolIntelligence
    intel = SymbolIntelligence(
        symbol="AAPL",
        generated_at="2026-06-02T10:00:00Z",
        action="BUY_NOW",
        conviction="high",
        summary_line="Test.",
        narrative="Test narrative.",
    )
    assert intel.price_hook is None
    assert intel.key_numbers == []
    assert intel.risk_factors == []
    assert intel.prediction_bullets == []
    assert intel.past_trades_context is None


def test_key_number_sentiment_values():
    from swing_screener.intelligence.models import KeyNumber
    kn = KeyNumber(label="SMA20", value="€266", sentiment="bullish")
    assert kn.sentiment == "bullish"


def test_prediction_bullet_direction_values():
    from swing_screener.intelligence.models import PredictionBullet
    pb = PredictionBullet(direction="bearish", reason="Stretched valuation", reference="fair value range")
    assert pb.direction == "bearish"
    assert pb.reference == "fair value range"


def test_symbol_intelligence_accepts_new_fields():
    from swing_screener.intelligence.models import SymbolIntelligence, KeyNumber, PredictionBullet
    intel = SymbolIntelligence(
        symbol="BESI.AS",
        generated_at="2026-06-02T10:00:00Z",
        action="BUY_ON_PULLBACK",
        conviction="medium",
        summary_line="Test.",
        narrative="Test narrative.",
        price_hook="Tight consolidation near 52w high with sector tailwind.",
        key_numbers=[KeyNumber(label="SMA20", value="€266", sentiment="bullish")],
        risk_factors=["Valuation stretched vs fair value."],
        prediction_bullets=[PredictionBullet(direction="bullish", reason="SMA20 support", reference="technical")],
        past_trades_context="Prior stop at €247 — now key support.",
    )
    assert intel.price_hook == "Tight consolidation near 52w high with sector tailwind."
    assert len(intel.key_numbers) == 1
    assert intel.key_numbers[0].label == "SMA20"
    assert len(intel.risk_factors) == 1
    assert len(intel.prediction_bullets) == 1
    assert intel.past_trades_context == "Prior stop at €247 — now key support."
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/intelligence/test_models.py -v -k "new_fields or key_number or prediction_bullet"
```

Expected: `ImportError` or `ValidationError` — `KeyNumber`, `PredictionBullet` don't exist yet.

- [ ] **Step 3: Add models to `src/swing_screener/intelligence/models.py`**

Add after the existing imports and before `SymbolIntelligenceRequest`:

```python
class KeyNumber(BaseModel):
    label: str
    value: str
    sentiment: Literal["bullish", "bearish", "neutral"]


class PredictionBullet(BaseModel):
    direction: Literal["bullish", "bearish", "neutral"]
    reason: str
    reference: str
```

Add to `SymbolIntelligence` (after `inputs_used` field):

```python
    price_hook: str | None = None
    key_numbers: list[KeyNumber] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    prediction_bullets: list[PredictionBullet] = Field(default_factory=list)
    past_trades_context: str | None = None
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/intelligence/test_models.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence/models.py tests/intelligence/test_models.py
git commit -m "feat(intelligence): add KeyNumber, PredictionBullet models and extend SymbolIntelligence"
```

---

## Task 2: Backend — `_format_past_trades` helper + prompt extension

**Files:**
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py`
- Test: `tests/intelligence/test_symbol_analyzer.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/intelligence/test_symbol_analyzer.py`:

```python
def test_format_past_trades_empty():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    assert _format_past_trades("AAPL", []) is None


def test_format_past_trades_no_closed():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{"ticker": "AAPL", "status": "open", "entry_price": 50.0}]
    assert _format_past_trades("AAPL", positions) is None


def test_format_past_trades_one_stopped_out():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "AAPL", "status": "closed",
        "entry_price": 48.15, "stop_price": 47.17, "exit_price": 47.29,
        "entry_date": "2026-01-15", "exit_date": "2026-01-23",
    }]
    result = _format_past_trades("AAPL", positions)
    assert result is not None
    assert "Past trades on AAPL" in result
    assert "48.15" in result
    assert "47.29" in result
    assert "stopped out" in result
    assert "2026-01-15" in result


def test_format_past_trades_win():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "BESI.AS", "status": "closed",
        "entry_price": 200.0, "stop_price": 190.0, "exit_price": 230.0,
        "entry_date": "2026-01-10", "exit_date": "2026-01-31",
    }]
    result = _format_past_trades("BESI.AS", positions)
    assert result is not None
    assert "+3.00R" in result
    assert "target/manual exit" in result


def test_format_past_trades_ignores_wrong_ticker():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "MSFT", "status": "closed",
        "entry_price": 400.0, "stop_price": 390.0, "exit_price": 380.0,
        "entry_date": "2026-01-10", "exit_date": "2026-01-20",
    }]
    assert _format_past_trades("AAPL", positions) is None


def test_prompt_includes_past_trades_block():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    past = [{
        "ticker": "AAPL", "status": "closed",
        "entry_price": 48.15, "stop_price": 47.17, "exit_price": 47.29,
        "entry_date": "2026-01-15", "exit_date": "2026-01-23",
    }]
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req, past_positions=past)
    assert "Past trades on AAPL" in prompt
    assert "48.15" in prompt


def test_prompt_no_past_trades_block_when_empty():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req, past_positions=[])
    assert "Past trades" not in prompt


def test_analyzer_parses_new_fields():
    import json
    from unittest.mock import MagicMock, patch
    from swing_screener.intelligence.models import SymbolIntelligenceRequest

    fake_json = {
        "action": "BUY_ON_PULLBACK",
        "conviction": "medium",
        "catalyst_urgency": "low",
        "summary_line": "Pullback candidate.",
        "narrative": "Text.",
        "upcoming_events": [],
        "position_signal": None,
        "position_outlook": None,
        "sources": [],
        "price_hook": "Near 52w high with sector tailwind.",
        "key_numbers": [
            {"label": "SMA20", "value": "€266", "sentiment": "bullish"},
            {"label": "Valuation", "value": "expensive", "sentiment": "bearish"},
        ],
        "risk_factors": ["Stretched valuation.", "No catalyst snapshot."],
        "prediction_bullets": [
            {"direction": "bullish", "reason": "SMA20 holds as support.", "reference": "technical"},
        ],
        "past_trades_context": "One prior stop at €247.",
    }
    fake_text = "```json\n" + json.dumps(fake_json) + "\n```"
    resp = MagicMock()
    resp.output_text = fake_text

    req = SymbolIntelligenceRequest(close=286.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = resp
        from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("BESI.AS", req, past_positions=[])

    assert result.price_hook == "Near 52w high with sector tailwind."
    assert len(result.key_numbers) == 2
    assert result.key_numbers[0].label == "SMA20"
    assert result.key_numbers[1].sentiment == "bearish"
    assert result.risk_factors == ["Stretched valuation.", "No catalyst snapshot."]
    assert len(result.prediction_bullets) == 1
    assert result.prediction_bullets[0].direction == "bullish"
    assert result.past_trades_context == "One prior stop at €247."
```

- [ ] **Step 2: Run to verify failures**

```bash
pytest tests/intelligence/test_symbol_analyzer.py -v -k "past_trades or new_fields or prompt_includes_past"
```

Expected: `ImportError` — `_format_past_trades` not defined yet.

- [ ] **Step 3: Add `_format_past_trades` to `symbol_analyzer.py`**

Add after the `_extract_json` function (around line 75):

```python
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
        outcome = "stopped out" if exit_p <= stop else "target/manual exit"
        r_sign = "+" if r >= 0 else ""
        lines.append(
            f"  Trade: {entry_date}→{exit_date} | entry {entry:.2f} → exit {exit_p:.2f}"
            f" | {r_sign}{r:.2f}R | {outcome}"
        )
    return "\n".join(lines)
```

- [ ] **Step 4: Extend `_build_user_prompt` signature and body**

Change the function signature from:
```python
def _build_user_prompt(ticker: str, req: SymbolIntelligenceRequest) -> str:
```
to:
```python
def _build_user_prompt(ticker: str, req: SymbolIntelligenceRequest, past_positions: list[dict] | None = None) -> str:
```

At the very end of `_build_user_prompt`, just before the final `return "\n".join(lines)`, add:

```python
    past_block = _format_past_trades(ticker, past_positions or [])
    if past_block:
        lines.insert(lines.index(
            next(l for l in lines if l.startswith("\nSearch for recent"))
        ), past_block)
        lines.insert(lines.index(past_block) + 1, "")
```

Wait — cleaner to append the past block before the search instruction line. Replace the last two lines of `_build_user_prompt`:

```python
    # Inject past trades block before the web-search instruction
    past_block = _format_past_trades(ticker, past_positions or [])
    if past_block:
        lines.append("")
        lines.append(past_block)

    lines.append(
        f"\nSearch for recent news, earnings results, catalysts, and analyst views for {ticker}. "
        "Then produce the structured JSON analysis."
    )
    return "\n".join(lines)
```

(Remove the existing `lines.append(f"\nSearch for ...")` line that was already there and replace with the block above.)

- [ ] **Step 5: Extend `_SYSTEM_PROMPT` with new field specs and PAST TRADES rule**

In `_SYSTEM_PROMPT`, after the `- sources: list of URLs...` line and before `Do not include any text outside the JSON block.`, add:

```python
- price_hook: one sentence — why this symbol, why now (max 140 chars).
- key_numbers: array of 4–8 objects {label, value, sentiment}. Pick the most decision-relevant numbers: \
SMAs relative to price, momentum, revenue growth, valuation label, relative strength vs benchmark, \
52-week high proximity. sentiment must be one of: bullish | bearish | neutral based on what the value implies for the trade.
- risk_factors: array of 3–5 strings. Each is a concrete, specific risk to the thesis. No generic filler.
- prediction_bullets: array of 2–5 objects {direction, reason, reference}. \
direction: bullish | bearish | neutral. reason: one sentence. reference: short label for the data point \
or event (e.g. "SMA20 support", "Q1 earnings", "fair value range", "prior stop-out level"). \
If past trades are provided, at least one bullet must reference them.
- past_trades_context: null unless a "Past trades" block is in the input. If past trades are present, \
write one paragraph: what the pattern tells us about this setup — name the levels, outcomes, and what \
they imply for stop placement or conviction. Use this analysis to calibrate conviction.

PAST TRADES RULE:
If a "Past trades" block is present in the input:
  • Analyse entries, exits, stop levels, and R outcomes.
  • If 2+ stop-outs occurred, lower conviction one step (high→medium, medium→low) and flag the pattern in past_trades_context.
  • If there is a prior win on this ticker, note setup similarity or difference.
  • Always set past_trades_context (not null) when past trades are present.\
```

- [ ] **Step 6: Update `analyze` method to accept and pass `past_positions`**

Change `analyze` signature:
```python
def analyze(self, ticker: str, req: SymbolIntelligenceRequest, past_positions: list[dict] | None = None) -> SymbolIntelligence:
```

Change the `_build_user_prompt` call inside `analyze`:
```python
        user_prompt = _build_user_prompt(ticker, req, past_positions=past_positions or [])
```

Update the `result = SymbolIntelligence(...)` block to parse new fields:
```python
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
            sources=raw.get("sources", []),
            price_hook=raw.get("price_hook"),
            key_numbers=raw.get("key_numbers", []),
            risk_factors=raw.get("risk_factors", []),
            prediction_bullets=raw.get("prediction_bullets", []),
            past_trades_context=raw.get("past_trades_context"),
        )
```

- [ ] **Step 7: Run all backend tests**

```bash
pytest tests/intelligence/ -v
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/swing_screener/intelligence/symbol_analyzer.py tests/intelligence/test_symbol_analyzer.py
git commit -m "feat(intelligence): extend prompt with new structured fields and past trades injection"
```

---

## Task 3: Router — inject past positions into `analyze_symbol`

**Files:**
- Modify: `api/routers/intelligence.py`

- [ ] **Step 1: Update `analyze_symbol` endpoint**

The router already imports `get_portfolio_service` and `PositionsRepository` is available via `get_positions_repo`. Add a `PositionsRepository` dependency:

```python
from api.dependencies import get_portfolio_service, get_positions_repo
from api.repositories.positions_repo import PositionsRepository
```

Change `analyze_symbol`:

```python
@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(
    ticker: str,
    request: SymbolIntelligenceRequest,
    positions_repo: PositionsRepository = Depends(get_positions_repo),
) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol."""
    _require_api_key()
    try:
        past_positions, _ = positions_repo.list_positions(status="closed")
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(ticker.upper(), request, past_positions=past_positions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

- [ ] **Step 2: Run backend tests**

```bash
pytest tests/ -q -m "not integration"
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add api/routers/intelligence.py
git commit -m "feat(intelligence): inject closed position history into symbol analysis"
```

---

## Task 4: Frontend types

**Files:**
- Modify: `web-ui/src/features/intelligence/types.ts`

- [ ] **Step 1: Add new types and extend existing interfaces**

Add at the top of the types section (before `CatalystUrgency`):

```typescript
export interface KeyNumber {
  label: string;
  value: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionBullet {
  direction: 'bullish' | 'bearish' | 'neutral';
  reason: string;
  reference: string;
}
```

Extend `SymbolIntelligenceAPI`:
```typescript
  price_hook?: string | null;
  key_numbers?: KeyNumber[];
  risk_factors?: string[];
  prediction_bullets?: PredictionBullet[];
  past_trades_context?: string | null;
```

Extend `SymbolIntelligence`:
```typescript
  priceHook?: string | null;
  keyNumbers?: KeyNumber[];
  riskFactors?: string[];
  predictionBullets?: PredictionBullet[];
  pastTradesContext?: string | null;
```

Update `transformIntelligence`:
```typescript
    priceHook: api.price_hook ?? null,
    keyNumbers: api.key_numbers ?? [],
    riskFactors: api.risk_factors ?? [],
    predictionBullets: api.prediction_bullets ?? [],
    pastTradesContext: api.past_trades_context ?? null,
```

- [ ] **Step 2: Type-check**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/features/intelligence/types.ts
git commit -m "feat(intelligence): add frontend types for new structured fields"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add keys under `workspacePage.panels.analysis.intelligence`**

Find the `intelligence:` block (around line 622 where `decisionFocus`, `aiRationale` etc. live) and add:

```typescript
          priceHook: 'Why now',
          keyNumbers: 'Key numbers',
          prediction: 'Prediction',
          riskFactors: 'Risks',
          pastTrades: 'Past trades on {{symbol}}',
          fullRationale: 'Full rationale',
```

- [ ] **Step 2: Type-check**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat(intelligence): add i18n keys for narrative redesign sections"
```

---

## Task 6: Redesign `NarrativeAnalysisCard`

**Files:**
- Modify: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx`
- Modify: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`

- [ ] **Step 1: Write failing tests first**

Add to `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`.

First check what `baseIntelligence` looks like (it's in the file already). Add these new tests after the existing describe block:

```typescript
describe('NarrativeAnalysisCard — new structured fields', () => {
  const richIntelligence: SymbolIntelligence = {
    ...baseIntelligence,
    priceHook: 'Tight consolidation near 52w high with sector tailwind.',
    keyNumbers: [
      { label: 'SMA20', value: '€266', sentiment: 'bullish' },
      { label: 'Valuation', value: 'expensive', sentiment: 'bearish' },
      { label: 'RS vs benchmark', value: '+11.3%', sentiment: 'bullish' },
    ],
    riskFactors: ['Valuation stretched vs fair value.', 'No catalyst snapshot cached.'],
    predictionBullets: [
      { direction: 'bullish', reason: 'SMA20 absorbs pullback.', reference: 'SMA20 support' },
      { direction: 'bearish', reason: 'Valuation caps upside.', reference: 'fair value range' },
    ],
    pastTradesContext: 'Prior stop at €247 — that level is now key support.',
  };

  it('renders price hook section', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Why now/i)).toBeInTheDocument();
    expect(screen.getByText('Tight consolidation near 52w high with sector tailwind.')).toBeInTheDocument();
  });

  it('renders key numbers chips', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Key numbers/i)).toBeInTheDocument();
    expect(screen.getByText('SMA20')).toBeInTheDocument();
    expect(screen.getByText('€266')).toBeInTheDocument();
    expect(screen.getByText('Valuation')).toBeInTheDocument();
  });

  it('renders prediction bullets with direction', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Prediction/i)).toBeInTheDocument();
    expect(screen.getByText('SMA20 absorbs pullback.')).toBeInTheDocument();
    expect(screen.getByText('SMA20 support')).toBeInTheDocument();
  });

  it('renders risk factors', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Risks/i)).toBeInTheDocument();
    expect(screen.getByText('Valuation stretched vs fair value.')).toBeInTheDocument();
  });

  it('renders past trades context', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Past trades on/i)).toBeInTheDocument();
    expect(screen.getByText('Prior stop at €247 — that level is now key support.')).toBeInTheDocument();
  });

  it('does not render new sections when fields absent (old cache)', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.queryByText(/Why now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Key numbers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prediction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Past trades on/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/NarrativeAnalysisCard.test.tsx
```

Expected: new tests fail (sections not rendered yet).

- [ ] **Step 3: Rewrite `NarrativeAnalysisCard.tsx`**

Replace the full file content with:

```typescript
import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import type { SymbolIntelligence, DecisionAction, DecisionConviction, KeyNumber, PredictionBullet } from '@/features/intelligence/types';
import type { DecisionCatalystLabel, DecisionSignalLabel, DecisionValuationLabel } from '@/features/screener/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';

interface NarrativeAnalysisCardProps {
  intelligence: SymbolIntelligence;
  candidate?: SymbolAnalysisCandidate | null;
}

function actionLabel(action: DecisionAction): string {
  const map: Record<DecisionAction, string> = {
    BUY_NOW: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
    BUY_ON_PULLBACK: t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'),
    WAIT_FOR_BREAKOUT: t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout'),
    WATCH: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
    TACTICAL_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly'),
    AVOID: t('workspacePage.panels.analysis.decisionSummary.actions.avoid'),
    MANAGE_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly'),
  };
  return map[action];
}

function convictionLabel(conviction: DecisionConviction): string {
  const map: Record<DecisionConviction, string> = {
    high: t('workspacePage.panels.analysis.decisionSummary.conviction.high'),
    medium: t('workspacePage.panels.analysis.decisionSummary.conviction.medium'),
    low: t('workspacePage.panels.analysis.decisionSummary.conviction.low'),
  };
  return map[conviction];
}

function signalLabel(label: DecisionSignalLabel): string {
  switch (label) {
    case 'strong': return t('workspacePage.panels.analysis.decisionSummary.signal.strong');
    case 'neutral': return t('workspacePage.panels.analysis.decisionSummary.signal.neutral');
    case 'weak': return t('workspacePage.panels.analysis.decisionSummary.signal.weak');
  }
}

function valuationLabel(label: DecisionValuationLabel): string {
  switch (label) {
    case 'cheap': return t('workspacePage.panels.analysis.decisionSummary.valuation.cheap');
    case 'fair': return t('workspacePage.panels.analysis.decisionSummary.valuation.fair');
    case 'expensive': return t('workspacePage.panels.analysis.decisionSummary.valuation.expensive');
    case 'unknown': return t('workspacePage.panels.analysis.decisionSummary.valuation.unknown');
  }
}

function catalystLabel(label: DecisionCatalystLabel): string {
  switch (label) {
    case 'active': return t('workspacePage.panels.analysis.decisionSummary.catalyst.active');
    case 'neutral': return t('workspacePage.panels.analysis.decisionSummary.catalyst.neutral');
    case 'weak': return t('workspacePage.panels.analysis.decisionSummary.catalyst.weak');
  }
}

function bannerClass(action: DecisionAction): string {
  switch (action) {
    case 'BUY_NOW': return 'bg-emerald-600 text-white';
    case 'BUY_ON_PULLBACK':
    case 'WAIT_FOR_BREAKOUT':
    case 'TACTICAL_ONLY': return 'bg-amber-400 text-amber-950';
    case 'AVOID': return 'bg-rose-600 text-white';
    default: return 'bg-gray-200 text-gray-800';
  }
}

function convictionVariant(conviction: DecisionConviction): 'default' | 'success' | 'primary' | 'warning' {
  switch (conviction) {
    case 'high': return 'success';
    case 'medium': return 'primary';
    default: return 'warning';
  }
}

function sentimentChipClass(sentiment: KeyNumber['sentiment']): string {
  switch (sentiment) {
    case 'bullish': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'bearish': return 'bg-rose-50 border-rose-200 text-rose-800';
    default: return 'bg-slate-100 border-slate-200 text-slate-700';
  }
}

function directionArrow(direction: PredictionBullet['direction']): string {
  switch (direction) {
    case 'bullish': return '↑';
    case 'bearish': return '↓';
    default: return '→';
  }
}

function directionClass(direction: PredictionBullet['direction']): string {
  switch (direction) {
    case 'bullish': return 'text-emerald-600';
    case 'bearish': return 'text-rose-600';
    default: return 'text-slate-500';
  }
}

export default function NarrativeAnalysisCard({
  intelligence,
  candidate,
}: NarrativeAnalysisCardProps) {
  const { action, conviction, summaryLine, narrative, symbol } = intelligence;
  const summary = candidate?.decisionSummary;
  const warnings = (summary?.explanation?.confidenceNotes ?? summary?.drivers.warnings ?? []).filter(Boolean);

  const hasNewFields = Boolean(intelligence.priceHook);
  const hasKeyNumbers = (intelligence.keyNumbers?.length ?? 0) > 0;
  const hasPrediction = (intelligence.predictionBullets?.length ?? 0) > 0;
  const hasRisks = (intelligence.riskFactors?.length ?? 0) > 0;
  const hasPastTrades = Boolean(intelligence.pastTradesContext);

  const decisionHighlights = [
    { label: t('workspacePage.panels.analysis.intelligence.whyNow'), value: summary?.whyNow },
    { label: t('workspacePage.panels.analysis.intelligence.whatToDo'), value: summary?.whatToDo },
    { label: t('workspacePage.panels.analysis.intelligence.watchFor'), value: summary?.mainRisk || warnings[0] },
  ].filter((item) => item.value);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Banner */}
      <div className={`px-3 py-2 flex items-center justify-between gap-3 ${bannerClass(action)}`}>
        <span className="font-semibold text-sm">
          {symbol} — {actionLabel(action)}
        </span>
        <Badge variant={convictionVariant(conviction)}>{convictionLabel(conviction)}</Badge>
      </div>

      <div className="bg-slate-50 p-3 space-y-3">
        {candidate?.decisionSummary?.action && action !== candidate.decisionSummary.action && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('workspacePage.panels.analysis.intelligence.aiActionMismatch', {
              aiAction: actionLabel(action),
              screenerAction: actionLabel(candidate.decisionSummary.action),
            })}
          </div>
        )}

        {/* Decision focus (screener-driven) — always shown */}
        <div className="rounded-md bg-white border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('workspacePage.panels.analysis.intelligence.decisionFocus')}
          </div>
          <p className="mt-2 text-base font-semibold text-slate-950">{summaryLine}</p>
          {decisionHighlights.length > 0 && (
            <dl className="mt-3 grid gap-2">
              {decisionHighlights.map((item) => (
                <div key={item.label} className="rounded-md bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-sm text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
              {t('workspacePage.panels.analysis.decisionSummary.warningsTitle')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* WHY NOW — price_hook */}
        {hasNewFields && intelligence.priceHook && (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              {t('workspacePage.panels.analysis.intelligence.priceHook')}
            </div>
            <p className="text-sm text-slate-800">{intelligence.priceHook}</p>
          </div>
        )}

        {/* KEY NUMBERS */}
        {hasKeyNumbers && (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('workspacePage.panels.analysis.intelligence.keyNumbers')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(intelligence.keyNumbers ?? []).map((kn, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${sentimentChipClass(kn.sentiment)}`}
                >
                  <span className="opacity-70">{kn.label}:</span>
                  <span>{kn.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PREDICTION */}
        {hasPrediction && (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('workspacePage.panels.analysis.intelligence.prediction')}
            </div>
            <ul className="space-y-2">
              {(intelligence.predictionBullets ?? []).map((pb, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`font-bold text-base leading-tight shrink-0 ${directionClass(pb.direction)}`}>
                    {directionArrow(pb.direction)}
                  </span>
                  <span className="flex-1 text-slate-800">{pb.reason}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                    {pb.reference}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RISKS */}
        {hasRisks && (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('workspacePage.panels.analysis.intelligence.riskFactors')}
            </div>
            <ul className="space-y-1">
              {(intelligence.riskFactors ?? []).map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PAST TRADES */}
        {hasPastTrades && (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              {t('workspacePage.panels.analysis.intelligence.pastTrades', { symbol })}
            </div>
            <p className="text-sm text-slate-700">{intelligence.pastTradesContext}</p>
          </div>
        )}

        {/* Full rationale — collapsed for new results, open for old cache */}
        <details className="rounded-md bg-white border border-slate-200 p-3" {...(!hasNewFields ? { open: true } : {})}>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 select-none">
            {t('workspacePage.panels.analysis.intelligence.fullRationale')}
          </summary>
          <div className="prose prose-sm prose-slate mt-2 max-w-none">
            <ReactMarkdown>{narrative}</ReactMarkdown>
          </div>
        </details>

        {/* Data inputs */}
        {intelligence.inputsUsed && Object.keys(intelligence.inputsUsed).length > 0 && (
          <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 select-none">
              {t('workspacePage.panels.analysis.intelligence.dataInputs')}
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(intelligence.inputsUsed).map(([group, fields]) => (
                <div key={group}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    {group.replace(/_/g, ' ')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(fields as Record<string, unknown>).filter(([, v]) => v != null).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                      >
                        <span className="font-medium text-slate-500">{key.replace(/_/g, ' ')}:</span>
                        <span>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : String(value)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Signals detail */}
        {summary && (
          <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 select-none">
              {t('workspacePage.panels.analysis.intelligence.signalsDetail')}
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={summary.technicalLabel === 'strong' ? 'success' : summary.technicalLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.technical')}: {signalLabel(summary.technicalLabel)}
              </Badge>
              <Badge variant={summary.fundamentalsLabel === 'strong' ? 'success' : summary.fundamentalsLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.fundamentals')}: {signalLabel(summary.fundamentalsLabel)}
              </Badge>
              <Badge variant={summary.valuationLabel === 'cheap' ? 'success' : summary.valuationLabel === 'expensive' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.valuation')}: {valuationLabel(summary.valuationLabel)}
              </Badge>
              <Badge variant={summary.catalystLabel === 'active' ? 'success' : summary.catalystLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.catalyst')}: {catalystLabel(summary.catalystLabel)}
              </Badge>
            </div>
            {summary.valuationContext.summary && (
              <p className="mt-2 text-sm text-slate-700">{summary.valuationContext.summary}</p>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run frontend tests**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/NarrativeAnalysisCard.test.tsx
```

Expected: all pass including new tests.

- [ ] **Step 5: Run full frontend test suite**

```bash
cd web-ui && npm test
```

Expected: all pass, no regressions.

- [ ] **Step 6: Typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx \
        web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx
git commit -m "feat(intelligence): redesign NarrativeAnalysisCard with structured sections"
```

---

## Task 7: Full suite check

- [ ] **Step 1: Run all backend tests**

```bash
pytest -q -m "not integration"
```

Expected: all pass.

- [ ] **Step 2: Run all frontend tests**

```bash
cd web-ui && npm test
```

Expected: all pass.

- [ ] **Step 3: Lint**

```bash
cd web-ui && npm run lint
ruff check src/swing_screener/intelligence/ api/routers/intelligence.py
```

Expected: zero warnings/errors.
