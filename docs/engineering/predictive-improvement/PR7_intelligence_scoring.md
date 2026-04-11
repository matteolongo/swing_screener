# PR 7 — Intelligence Scoring Cleanup

> Branch: `feat/intelligence-scoring`
> Base: `feature/ux-revamp`
> Depends on: PR4
> Blocks: PR8

---

## Note on prior work

The inverted stale-event decay bug was already fixed in branch `fix/code-review-bugs` (PR #214).
This PR covers what remains: event-type differentiation, evidence quality caps, state-to-multiplier mapping, and follow-through stubs.

---

## Problem

After the decay fix, three weaknesses remain:

1. Scheduled binary events (earnings, FDA) are not distinguished from general news mentions. Both receive the same scoring treatment.
2. Low-quality evidence sources (low `source_quality_score`) can still push a symbol to the top of the opportunity list.
3. Lifecycle state (`WATCH`, `CATALYST_ACTIVE`, `TRENDING`, `COOLING_OFF`) is not translated into a consistent ranking multiplier.

---

## Changes

### 1. `src/swing_screener/intelligence/scoring.py`

**Event-type weight**

Add an `event_type_weight` lookup used when computing `materiality_score`:

```python
EVENT_TYPE_WEIGHTS: dict[str, float] = {
    "earnings": 1.20,
    "fda_decision": 1.20,
    "merger_acquisition": 1.15,
    "guidance_update": 1.10,
    "analyst_upgrade": 1.00,
    "news": 0.85,
    "social_mention": 0.70,
}
```

- Multiply `materiality_score` by the event-type weight before normalizing to [0,1].
- Unknown event types default to `1.0`.
- Keep the weight table configurable via settings.

**Evidence quality cap**

After computing the final catalyst score:

```python
# Cap score when evidence quality is low to avoid surfacing unconfirmed noise.
if breakdown.source_quality_score < 0.40:
    score = min(score, 0.60)
```

### 2. `src/swing_screener/intelligence/state.py`

Add `STATE_RANKING_MULTIPLIER` used by both scoring and the combined priority formula:

```python
STATE_RANKING_MULTIPLIER: dict[str, float] = {
    "CATALYST_ACTIVE": 1.10,
    "TRENDING":        1.05,
    "WATCH":           1.00,
    "COOLING_OFF":     0.85,
    "QUIET":           0.80,
}
```

Expose a helper:
```python
def get_state_multiplier(state: str) -> float:
    return STATE_RANKING_MULTIPLIER.get(state, 1.00)
```

Apply in `build_opportunities()` in `scoring.py`: multiply `opportunity_score` by the symbol's state multiplier before returning.

### 3. `src/swing_screener/intelligence/reaction.py`

Add `post_event_followthrough` stub — storage only, no model inference yet:

```python
@dataclass
class PostEventFollowthrough:
    symbol: str
    event_id: str
    selection_date: date
    forward_1d: float | None = None
    forward_3d: float | None = None
    forward_5d: float | None = None
```

Persist when a new opportunity is stored. Forward-return values are populated separately (by PR8).

---

## Tests

### `tests/test_intelligence_scoring.py` (extend existing)

**Test 1 — earnings event type scores higher than news mention**
```python
def test_earnings_event_scores_higher_than_news():
    signal = _signal("AAPL", "e1", return_z=1.5, atr_shock=1.0, peers=1, recency=6)
    earnings_event = Event("e1", "AAPL", "src", "2026-04-11T00:00:00", "T", "earnings", 0.8)
    news_event    = Event("e1", "AAPL", "src", "2026-04-11T00:00:00", "T", "news", 0.8)
    score_earnings = _score_with_event(signal, earnings_event)
    score_news     = _score_with_event(signal, news_event)
    assert score_earnings > score_news
```

**Test 2 — low source quality caps catalyst score at 0.6**
```python
def test_low_source_quality_caps_score():
    # Build a signal with high return_z but low source_quality_score in feature vector
    fv = CatalystFeatureVector(..., source_quality_score=0.30, ...)
    score_map = build_catalyst_score_map_v2(signals=[strong_signal], ..., feature_vectors={"X": fv})
    assert score_map["X"].score <= 0.60 + 1e-9
```

**Test 3 — COOLING_OFF state produces lower opportunity score than CATALYST_ACTIVE**
```python
def test_cooling_off_scores_lower_than_catalyst_active():
    base_opportunity_score = 0.75
    active_score   = base_opportunity_score * get_state_multiplier("CATALYST_ACTIVE")
    cooling_score  = base_opportunity_score * get_state_multiplier("COOLING_OFF")
    assert active_score > cooling_score
```

**Test 4 — unknown state defaults to multiplier 1.0**
```python
def test_unknown_state_defaults_to_one():
    assert get_state_multiplier("UNKNOWN_STATE") == approx(1.0)
```

---

## Acceptance criteria

- [ ] Earnings and FDA events score higher than equivalent news mentions.
- [ ] `source_quality_score < 0.4` caps catalyst score at 0.60.
- [ ] `COOLING_OFF` state produces a lower multiplier than `CATALYST_ACTIVE`.
- [ ] `PostEventFollowthrough` stub is stored alongside new opportunities.
- [ ] All four new tests pass.
- [ ] Existing intelligence scoring tests pass (including the stale-event regression tests from PR #214).
