# PR 4 — Combined Ranking Stage (Two-Stage Pipeline)

> Branch: `feat/combined-ranking`
> Base: `feature/ux-revamp`
> Depends on: PR3
> Blocks: PR5, PR6, PR7, PR8

---

## Problem

The screener selects top candidates using only three momentum columns (`mom_6m`, `mom_12m`, `rs_6m`) before fundamentals or intelligence are consulted (line 673 in `screener_service.py`, then enrichment at lines 840–841).

Consequence:
- A symbol with mediocre raw momentum but a strong catalyst and high-quality fundamentals never reaches the top-N list.
- Fundamentals and intelligence only re-order already-selected names — they do not influence who gets in.

---

## Design

### Stage 1 — Technical prefilter (existing logic, unchanged)

Keep `top_candidates()` as the fast broad filter.
Widen the prefilter to return `3 × final_top_n` candidates (configurable).
This is the only change to stage 1.

### Stage 2 — Combined priority scoring (new)

For the reduced prefilter set, compute a blended priority score:

```
combined_priority =
    0.45 × technical_readiness
  + 0.25 × fundamentals_quality
  + 0.20 × catalyst_strength
  + 0.10 × valuation_attractiveness
  - freshness_penalty
  - data_quality_penalty
```

All weights are configurable. Final top-N is taken from the combined ranking.
`raw_technical_rank` is preserved on every candidate.

---

## Changes

### 1. New file: `src/swing_screener/recommendation/priority.py`

```python
@dataclass(frozen=True)
class CombinedPriorityConfig:
    technical_weight: float = 0.45
    fundamentals_weight: float = 0.25
    catalyst_weight: float = 0.20
    valuation_weight: float = 0.10
    prefilter_multiplier: int = 3     # keep top N × this before combined stage

def compute_combined_priority(
    candidates: list[ScreenerCandidate],
    fundamentals_map: dict[str, FundamentalsSnapshot | None],
    catalyst_map: dict[str, CatalystScoreBreakdown | None],
    cfg: CombinedPriorityConfig = CombinedPriorityConfig(),
) -> list[ScreenerCandidate]:
    """
    Returns candidates sorted by combined_priority (descending).
    Attaches combined_priority_score and preserves raw_technical_rank on each candidate.
    """
```

Internal steps:
1. Normalize each sub-score to 0..1.
2. Derive `freshness_penalty` from `fundamentals.freshness_penalty` (added in PR6) — use 0.0 until PR6.
3. Derive `data_quality_penalty` from `fundamentals.coverage_penalty` + intelligence evidence quality — use 0.0 until PR6/PR7.
4. Compute `combined_priority` per candidate.
5. Sort descending, return.

### 2. `src/swing_screener/selection/ranking.py`

Add helper:
```python
def normalize_technical_score(df: pd.DataFrame) -> pd.Series:
    """Returns score column normalized to 0..1 range (min-max)."""
    s = df["score"]
    rng = s.max() - s.min()
    if rng == 0:
        return pd.Series(0.5, index=df.index)
    return (s - s.min()) / rng
```

### 3. `api/services/screener_service.py`

Modify `run_screener` / `build_screener_results`:

```python
# Stage 1: technical prefilter — keep 3× desired count
prefilter_n = final_top_n * cfg.combined_priority.prefilter_multiplier
technical_candidates = top_candidates(df, RankingConfig(top_n=prefilter_n))

# Attach raw_technical_rank before any enrichment
for i, c in enumerate(technical_candidates):
    c = c.model_copy(update={"raw_technical_rank": i + 1})

# Stage 2 (after fundamentals + intelligence enrichment):
final_candidates = compute_combined_priority(
    enriched_candidates, fundamentals_map, catalyst_map, combined_cfg
)[:final_top_n]
```

### 4. `ScreenerCandidate` model

Add fields:
```python
raw_technical_rank: int | None = None
combined_priority_score: float | None = None
```

### 5. Settings

Add `CombinedPriorityConfig` to the settings system under `selection.combined_priority`.

---

## Tests

### `tests/test_combined_priority.py` (new)

**Test 1 — strong catalyst lifts a mid-ranked technical candidate**
```python
def test_catalyst_lifts_mid_ranked_candidate():
    # Candidate "MID" is #5 technically but has catalyst_strength=0.95
    # Candidate "TOP" is #1 technically but has catalyst_strength=0.1
    result = compute_combined_priority([TOP, MID, ...], ...)
    assert result[0].ticker == "MID"
```

**Test 2 — weak fundamentals drops a top technical candidate**
```python
def test_weak_fundamentals_drops_top_technical():
    # Candidate "TECH1" ranks #1 technically, fundamentals_quality=0.1
    # Candidate "TECH2" ranks #2 technically, fundamentals_quality=0.9
    result = compute_combined_priority([TECH1, TECH2], ...)
    assert result[0].ticker == "TECH2"
```

**Test 3 — raw_technical_rank is preserved**
```python
def test_raw_technical_rank_preserved():
    result = compute_combined_priority(candidates, ...)
    ranks = [c.raw_technical_rank for c in result]
    assert all(r is not None for r in ranks)
    assert sorted(ranks) == list(range(1, len(candidates) + 1))
```

**Test 4 — weights sum to 1 (minus penalties)**
```python
def test_combined_priority_score_is_in_unit_interval():
    result = compute_combined_priority(candidates, ...)
    for c in result:
        assert 0.0 <= c.combined_priority_score <= 1.0 + 1e-9
```

---

## Acceptance criteria

- [ ] Final candidate ordering reflects combined technical + fundamental + catalyst signal.
- [ ] `raw_technical_rank` is always present on output candidates.
- [ ] `combined_priority_score` is in [0, 1].
- [ ] Prefilter multiplier and all weights are configurable via settings.
- [ ] All four new tests pass.
- [ ] Existing screener tests pass without modification.
