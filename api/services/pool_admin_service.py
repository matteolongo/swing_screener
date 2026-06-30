"""Pool administration: refresh-all, structural rebuild, taxonomy enrichment.

These operations mutate the committed build artifacts (universe snapshots and
``symbol_pool.json``). They are the runtime equivalent of the one-off CLI
snippets documented in ``data/README.md``.

The structural rebuild preserves yfinance-derived enrichment fields for symbols
that survive the rebuild; only the structural fields (index memberships,
exchange, currency, region, instrument type, providers) are recomputed from the
universe snapshots. Enrichment fields are refreshed separately by the enrich job.

All pool writes (rebuild + enrich) are serialized through ``_POOL_WRITE_LOCK``
so concurrent operations can never interleave a read-modify-write on
``symbol_pool.json`` and clobber each other. A request that finds the lock held
gets ``PoolBusyError`` (mapped to HTTP 409 by the router).
"""

from __future__ import annotations

import datetime
import threading
from typing import Optional

from api.services.pool_enrich_run_manager import (
    ProgressReporter,
    get_pool_enrich_run_manager,
)
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

# Serializes every read-modify-write of symbol_pool.json across rebuild + enrich.
_POOL_WRITE_LOCK = threading.Lock()


class PoolBusyError(RuntimeError):
    """Raised when a pool write is requested while another is in progress."""


def _today() -> str:
    return datetime.date.today().isoformat()


def _normalize(value: object) -> object:
    """Order-insensitive view of list fields so diffs don't flag reordering."""
    if isinstance(value, list):
        return sorted(str(item) for item in value)
    return value


def compute_pool_diff(
    old_symbols: list[dict],
    new_symbols: list[dict],
    fields: tuple[str, ...],
) -> dict:
    """Diff two pool symbol lists over the given fields.

    Returns additions (full snapshot of symbols only in ``new``), removals
    (symbols only in ``old``), and modifications (per-field before/after for
    symbols present in both whose tracked fields changed). List-valued fields
    are compared order-insensitively.
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
            if _normalize(before) != _normalize(after):
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
    """Refresh every registry universe snapshot from its source, aggregating.

    Auto universes are skipped: they are not registry-backed and refresh only
    through their own discovery path (``materialize_auto_universe``). Per-universe
    failures are caught and surfaced inline; the call never raises on one error.
    """
    results: list[dict] = []
    total_additions = 0
    total_removals = 0
    total_changed = 0
    skipped_auto = 0

    for entry in list_package_universe_entries():
        uid = entry.get("id")
        if not uid:
            continue
        if entry.get("kind") == "auto":
            skipped_auto += 1
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
        "skipped_auto": skipped_auto,
    }


def rebuild_pool(repo) -> dict:
    """Rebuild ``symbol_pool.json`` structure from universe snapshots.

    Preserves enrichment fields for surviving symbols; new symbols start with
    null enrichment until an enrich run populates them. The diff is computed
    before the file is written, so a failure mid-diff leaves the artifact intact.
    """
    if not _POOL_WRITE_LOCK.acquire(blocking=False):
        raise PoolBusyError("A pool operation is already in progress.")
    try:
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

        new_payload = serialize_pool(base_pool, asof_date=_today())
        diff = compute_pool_diff(
            old_symbols, new_payload["symbols"], STRUCTURAL_DIFF_FIELDS
        )
        repo.write(new_payload)
        return {"applied": True, **diff}
    finally:
        _POOL_WRITE_LOCK.release()


def _default_info_fn():
    from swing_screener.data.providers.factory import get_default_provider

    provider = get_default_provider()

    def info(symbol: str):
        return provider.get_ticker_info(symbol) or None

    return info


def start_enrich_job(repo, info_fn=None) -> str:
    """Launch a background enrichment job. Raises PoolBusyError if one is running.

    The write lock is acquired before the job is queued and released by the
    worker thread when enrichment finishes (success or failure), so a second
    enrich/rebuild while this one runs is rejected rather than racing the write.
    """
    if not _POOL_WRITE_LOCK.acquire(blocking=False):
        raise PoolBusyError("A pool operation is already in progress.")

    info = info_fn or _default_info_fn()

    def run_fn(report: ProgressReporter) -> dict:
        try:
            payload = repo.read()
            pool = deserialize_pool(payload)
            before = [pool_symbol_to_dict(s) for s in pool]
            total = len(pool)
            report(0, total, 0)
            cap, liq, _ = load_symbol_pool_thresholds()
            state = {"processed": 0, "failed": 0}

            def tracked(symbol: str):
                try:
                    res = info(symbol)
                except Exception:
                    state["processed"] += 1
                    state["failed"] += 1
                    report(state["processed"], total, state["failed"])
                    raise
                state["processed"] += 1
                if not res:
                    state["failed"] += 1
                report(state["processed"], total, state["failed"])
                return res

            failed = enrich_pool_taxonomy(
                pool,
                info_fn=tracked,
                asof_date=_today(),
                cap_thresholds=cap,
                liquidity_thresholds=liq,
            )
            repo.write(serialize_pool(pool, asof_date=_today()))
            after = [pool_symbol_to_dict(s) for s in pool]
            diff = compute_pool_diff(before, after, ENRICH_DIFF_FIELDS)
            return {"modified": diff["modifications"], "failed_symbols": failed}
        finally:
            _POOL_WRITE_LOCK.release()

    try:
        return get_pool_enrich_run_manager().start_job(run_fn=run_fn)
    except Exception:
        # Worker never ran, so its finally never released the lock.
        _POOL_WRITE_LOCK.release()
        raise


def get_enrich_status(job_id: str) -> Optional[dict]:
    """API-shaped status for an enrich job, or None if unknown."""
    job = get_pool_enrich_run_manager().get_job(job_id)
    if job is None:
        return None
    return {
        "status": job.status,
        "progress": {
            "processed": job.processed,
            "total": job.total,
            "failed": job.failed,
        },
        "error": job.error,
        "diff": job.result if job.status == "done" else None,
    }
