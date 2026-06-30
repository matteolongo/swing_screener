"""Pool administration: refresh-all, structural rebuild, taxonomy enrichment.

These operations mutate the committed build artifacts (universe snapshots and
``symbol_pool.json``). They are the runtime equivalent of the one-off CLI
snippets documented in ``data/README.md``.

The structural rebuild preserves yfinance-derived enrichment fields for symbols
that survive the rebuild; only the structural fields (index memberships,
exchange, currency, region, instrument type, providers) are recomputed from the
universe snapshots. Enrichment fields are refreshed separately by the enrich job.
"""

from __future__ import annotations

import datetime
import threading
import uuid
from dataclasses import dataclass, field
from typing import Optional

from swing_screener.data.symbol_pool import (
    build_pool_base,
    deserialize_pool,
    enrich_pool_taxonomy,
    load_symbol_pool_thresholds,
    pool_symbol_to_dict,
    serialize_pool,
)
from swing_screener.data.universe import (
    list_package_universe_entries,
    refresh_package_universe,
)

# Structural fields recomputed by a base rebuild from universe snapshots.
STRUCTURAL_DIFF_FIELDS = (
    "index_memberships",
    "exchange_mic",
    "currency",
    "region",
    "instrument_type",
    "available_providers",
    "primary_provider",
)
# yfinance-derived fields refreshed by enrichment (carried over on rebuild).
ENRICHMENT_FIELDS = (
    "sector",
    "industry",
    "market_cap_tier",
    "liquidity_tier",
    "instrument_type_detail",
    "taxonomy_refreshed_at",
)
# Fields whose change is treated as a real modification in the enrich diff.
ENRICH_DIFF_FIELDS = (
    "sector",
    "industry",
    "market_cap_tier",
    "liquidity_tier",
    "instrument_type_detail",
)


def _today() -> str:
    return datetime.date.today().isoformat()


def compute_pool_diff(
    old_symbols: list[dict],
    new_symbols: list[dict],
    fields: tuple[str, ...],
) -> dict:
    """Diff two pool symbol lists over the given fields.

    Returns additions (full snapshot of symbols only in ``new``), removals
    (symbols only in ``old``), and modifications (per-field before/after for
    symbols present in both whose tracked fields changed).
    """
    old_by_sym = {s["symbol"]: s for s in old_symbols}
    new_by_sym = {s["symbol"]: s for s in new_symbols}

    additions = [new_by_sym[s] for s in new_by_sym if s not in old_by_sym]
    removals = [old_by_sym[s] for s in old_by_sym if s not in new_by_sym]

    modifications: list[dict] = []
    for sym, new_rec in new_by_sym.items():
        old_rec = old_by_sym.get(sym)
        if old_rec is None:
            continue
        changes = []
        for f in fields:
            before = old_rec.get(f)
            after = new_rec.get(f)
            if before != after:
                changes.append({"field": f, "before": before, "after": after})
        if changes:
            modifications.append({"symbol": sym, "changes": changes})

    return {
        "additions": additions,
        "removals": removals,
        "modifications": modifications,
        "summary": {
            "added": len(additions),
            "removed": len(removals),
            "modified": len(modifications),
            "unchanged": len(new_by_sym) - len(additions) - len(modifications),
        },
    }


def refresh_all_universes() -> dict:
    """Refresh every universe snapshot from its source, aggregating results.

    Per-universe failures are caught and surfaced inline; the call never raises
    on a single universe error.
    """
    results: list[dict] = []
    total_additions = 0
    total_removals = 0
    total_changed = 0

    for entry in list_package_universe_entries():
        uid = entry.get("id")
        if not uid:
            continue
        try:
            res = refresh_package_universe(uid, apply=True)
            results.append(
                {
                    "id": uid,
                    "applied": res.get("applied", False),
                    "changed": res.get("changed", False),
                    "current_member_count": res.get("current_member_count"),
                    "proposed_member_count": res.get("proposed_member_count"),
                    "additions": res.get("additions", []),
                    "removals": res.get("removals", []),
                    "notes": res.get("notes", []),
                }
            )
            total_additions += len(res.get("additions", []))
            total_removals += len(res.get("removals", []))
            if res.get("changed"):
                total_changed += 1
        except Exception as exc:  # noqa: BLE001 - one bad source must not abort all
            results.append({"id": uid, "error": str(exc)})

    return {
        "universes": results,
        "total_additions": total_additions,
        "total_removals": total_removals,
        "total_changed": total_changed,
    }


def rebuild_pool(repo) -> dict:
    """Rebuild ``symbol_pool.json`` structure from universe snapshots.

    Preserves enrichment fields for surviving symbols; new symbols start with
    null enrichment until an enrich run populates them.
    """
    payload = repo.read()
    old_symbols = payload.get("symbols", [])
    old_by_sym = {s["symbol"]: s for s in old_symbols}

    base_pool = build_pool_base()
    for sym in base_pool:
        prior = old_by_sym.get(sym.symbol)
        if prior is None:
            continue
        for f in ENRICHMENT_FIELDS:
            if prior.get(f) is not None:
                setattr(sym, f, prior[f])

    new_payload = serialize_pool(base_pool, asof_date=payload.get("asof"))
    repo.write(new_payload)

    diff = compute_pool_diff(
        old_symbols, new_payload["symbols"], STRUCTURAL_DIFF_FIELDS
    )
    return {"applied": True, **diff}


# --- Enrichment jobs (in-memory, ephemeral) ---------------------------------


@dataclass
class EnrichJob:
    job_id: str
    status: str = "running"  # running | done | failed
    processed: int = 0
    total: int = 0
    failed: int = 0
    error: Optional[str] = None
    diff: Optional[dict] = field(default=None)


_ENRICH_JOBS: dict[str, EnrichJob] = {}
_JOBS_LOCK = threading.Lock()


def _default_info_fn():
    from swing_screener.data.providers.factory import get_default_provider

    provider = get_default_provider()

    def info(symbol: str):
        return provider.get_ticker_info(symbol) or None

    return info


def _run_enrich(job: EnrichJob, repo, info_fn) -> None:
    try:
        payload = repo.read()
        pool = deserialize_pool(payload)
        before = {s.symbol: pool_symbol_to_dict(s) for s in pool}
        job.total = len(pool)
        cap, liq, _ = load_symbol_pool_thresholds()

        def tracked(symbol: str):
            try:
                res = info_fn(symbol)
            except Exception:
                with _JOBS_LOCK:
                    job.processed += 1
                    job.failed += 1
                raise
            with _JOBS_LOCK:
                job.processed += 1
                if not res:
                    job.failed += 1
            return res

        failed = enrich_pool_taxonomy(
            pool,
            info_fn=tracked,
            asof_date=_today(),
            cap_thresholds=cap,
            liquidity_thresholds=liq,
        )
        repo.write(serialize_pool(pool, asof_date=_today()))

        after_symbols = [pool_symbol_to_dict(s) for s in pool]
        diff = compute_pool_diff(
            list(before.values()), after_symbols, ENRICH_DIFF_FIELDS
        )
        with _JOBS_LOCK:
            job.diff = {
                "modified": diff["modifications"],
                "failed_symbols": failed,
            }
            job.status = "done"
    except Exception as exc:  # noqa: BLE001 - surface as failed job, never crash thread
        with _JOBS_LOCK:
            job.error = str(exc)
            job.status = "failed"


def start_enrich_job(repo, info_fn=None) -> str:
    job_id = uuid.uuid4().hex
    job = EnrichJob(job_id=job_id)
    with _JOBS_LOCK:
        _ENRICH_JOBS[job_id] = job
    info = info_fn or _default_info_fn()
    thread = threading.Thread(target=_run_enrich, args=(job, repo, info), daemon=True)
    thread.start()
    return job_id


def get_enrich_job(job_id: str) -> Optional[EnrichJob]:
    with _JOBS_LOCK:
        return _ENRICH_JOBS.get(job_id)


def enrich_job_to_dict(job: EnrichJob) -> dict:
    return {
        "status": job.status,
        "progress": {
            "processed": job.processed,
            "total": job.total,
            "failed": job.failed,
        },
        "error": job.error,
        "diff": job.diff,
    }
