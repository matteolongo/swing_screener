"""Symbol pool service: taxonomy presets and pool listing."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from api.models.screener import TaxonomyFilter
from swing_screener.data.symbol_pool import (
    deserialize_pool,
    filter_pool_by_taxonomy,
    pool_symbol_to_dict,
)
from swing_screener.settings.io import CachedYamlFile
from swing_screener.settings.paths import config_dir

_presets_store: CachedYamlFile | None = None


def _presets_path() -> Path:
    return config_dir() / "taxonomy_presets.yaml"


def _load_presets_document() -> dict:
    # mtime-cached like the rest of the YAML config, so edits to
    # taxonomy_presets.yaml are picked up without a restart.
    global _presets_store
    if _presets_store is None or _presets_store.path != _presets_path():
        _presets_store = CachedYamlFile(_presets_path(), default_factory=dict)
    payload = _presets_store.load()
    return payload if isinstance(payload, dict) else {}


def load_taxonomy_presets() -> list[dict]:
    doc = _load_presets_document()
    presets = doc.get("presets", {}) or {}
    out: list[dict] = []
    for pid, body in presets.items():
        out.append(
            {
                "id": pid,
                "label": (body or {}).get("label", pid),
                "filter": (body or {}).get("filter", {}) or {},
            }
        )
    return out


def resolve_preset(preset_id: str) -> Optional[TaxonomyFilter]:
    for p in load_taxonomy_presets():
        if p["id"] == preset_id:
            return TaxonomyFilter(**p["filter"])
    return None


def list_pool_symbols(
    repo, tax_filter: TaxonomyFilter, page: int, page_size: int
) -> dict:
    pool = deserialize_pool({"symbols": repo.list_symbols()})
    filtered = filter_pool_by_taxonomy(pool, tax_filter.to_spec())
    total = len(filtered)
    start = max(0, (page - 1) * page_size)
    page_items = filtered[start : start + page_size]
    return {
        "symbols": [pool_symbol_to_dict(s) for s in page_items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
