# PR 8 — Evaluation and Measurement Framework

> Branch: `feat/measurement-framework`
> Base: `feature/ux-revamp`
> Depends on: PR4, PR5, PR6, PR7
> Blocks: nothing (closes the feedback loop)

---

## Problem

The app currently has no closed evaluation loop. There is no way to measure whether:

- a combined-ranking change actually improved candidate quality;
- a catalyst event was followed by price continuation;
- false positives cluster around a particular event type or sector.

Without measurement, "more predictive" is a claim, not a fact.

---

## Design

Persist one `EvaluationRecord` per candidate per screener run. Forward return data is filled in later when prices are available. Metrics are computed on demand from the stored records.

---

## Changes

### 1. New file: `src/swing_screener/reporting/evaluation.py`

```python
@dataclass
class EvaluationRecord:
    symbol: str
    run_date: date
    raw_technical_rank: int | None
    combined_priority_rank: int | None
    technical_readiness: float | None
    fundamentals_quality: float | None
    catalyst_strength: float | None
    combined_priority_score: float | None
    decision_action: str           # BUY, WATCH, SKIP, etc.
    signal: str                    # breakout, pullback, both, none
    entry_price: float | None
    stop_price: float | None
    target_price: float | None

@dataclass
class ForwardReturnRecord:
    symbol: str
    selection_date: date
    forward_1d: float | None = None
    forward_5d: float | None = None
    forward_10d: float | None = None
    forward_20d: float | None = None
    mfe: float | None = None     # max favorable excursion (% from entry)
    mae: float | None = None     # max adverse excursion (% from entry)
    outcome: str | None = None   # "hit_target" | "hit_stop" | "open" | "expired"
```

Serialization: JSON lines (`.jsonl`) — one record per line, append-only. One file per month under `data/evaluation/`.

```python
def append_evaluation_record(record: EvaluationRecord, store_path: Path) -> None: ...
def load_evaluation_records(store_path: Path, since: date | None = None) -> list[EvaluationRecord]: ...
def update_forward_returns(symbol: str, selection_date: date, returns: ForwardReturnRecord, store_path: Path) -> None: ...
```

### 2. New file: `src/swing_screener/reporting/metrics.py`

```python
def compute_hit_rate_by_action(
    records: list[EvaluationRecord],
    forward_returns: list[ForwardReturnRecord],
    horizon_days: int = 5,
) -> dict[str, float]:
    """
    Returns fraction of records with positive forward return at horizon_days,
    grouped by decision_action.
    """

def compute_rank_quality(
    records: list[EvaluationRecord],
    forward_returns: list[ForwardReturnRecord],
    horizon_days: int = 5,
) -> float:
    """
    Spearman rank correlation between combined_priority_score and forward return.
    Higher = ranking is more predictive.
    """

def compute_false_positive_rate_by_catalyst(
    records: list[EvaluationRecord],
    forward_returns: list[ForwardReturnRecord],
    horizon_days: int = 5,
) -> dict[str, float]:
    """
    For records where catalyst was a factor, fraction that produced negative forward return.
    Grouped by catalyst type / signal.
    """

def compute_outcome_distribution(
    forward_returns: list[ForwardReturnRecord],
) -> dict[str, int]:
    """Counts by outcome: hit_target, hit_stop, open, expired."""
```

### 3. `api/services/screener_service.py`

After finalizing combined candidates, persist one `EvaluationRecord` per candidate:

```python
for rank, candidate in enumerate(final_candidates, start=1):
    record = EvaluationRecord(
        symbol=candidate.ticker,
        run_date=run_date,
        raw_technical_rank=candidate.raw_technical_rank,
        combined_priority_rank=rank,
        technical_readiness=candidate.technical_readiness,
        fundamentals_quality=fundamentals_map.get(candidate.ticker, {}).get("business_quality_score"),
        catalyst_strength=catalyst_map.get(candidate.ticker, {}).get("score"),
        combined_priority_score=candidate.combined_priority_score,
        decision_action=candidate.decision_summary.action if candidate.decision_summary else None,
        signal=candidate.signal,
        entry_price=candidate.entry,
        stop_price=candidate.stop,
        target_price=candidate.target,
    )
    append_evaluation_record(record, evaluation_store_path)
```

Write is fire-and-forget (log failure, do not raise).

### 4. New API endpoint (optional, low priority)

`GET /api/evaluation/summary?since=YYYY-MM-DD` — returns hit rate, rank quality, and false positive summary. Can be implemented as a simple JSON dump initially.

---

## Tests

### `tests/test_evaluation.py` (new)

**Test 1 — serialization round-trip**
```python
def test_evaluation_record_serialization_roundtrip(tmp_path):
    record = EvaluationRecord(symbol="AAPL", run_date=date(2026, 4, 11), ...)
    store = tmp_path / "eval.jsonl"
    append_evaluation_record(record, store)
    loaded = load_evaluation_records(store)
    assert len(loaded) == 1
    assert loaded[0].symbol == "AAPL"
```

**Test 2 — append is non-destructive**
```python
def test_append_does_not_overwrite(tmp_path):
    store = tmp_path / "eval.jsonl"
    append_evaluation_record(record1, store)
    append_evaluation_record(record2, store)
    loaded = load_evaluation_records(store)
    assert len(loaded) == 2
```

**Test 3 — hit rate by action**
```python
def test_hit_rate_by_action():
    records = [make_record("AAPL", action="BUY"), make_record("TSLA", action="WATCH")]
    returns = [make_return("AAPL", forward_5d=0.05), make_return("TSLA", forward_5d=-0.02)]
    hit_rates = compute_hit_rate_by_action(records, returns, horizon_days=5)
    assert hit_rates["BUY"] == approx(1.0)
    assert hit_rates["WATCH"] == approx(0.0)
```

**Test 4 — rank quality is positive for good ranking**
```python
def test_rank_quality_positive_for_correct_ordering():
    # Records ranked 1–3 with returns 0.10, 0.05, 0.01 (rank matches return order)
    rq = compute_rank_quality(records, returns, horizon_days=5)
    assert rq > 0
```

---

## Acceptance criteria

- [ ] `EvaluationRecord` is persisted per candidate on every screener run.
- [ ] Records are append-only; existing records are never overwritten.
- [ ] `ForwardReturnRecord` can be updated independently when prices become available.
- [ ] `compute_hit_rate_by_action` and `compute_rank_quality` return meaningful values from stored records.
- [ ] All four new tests pass.
- [ ] Screener run does not fail if evaluation store write fails (log and continue).
