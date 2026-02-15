from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Any

from swing_screener.intelligence.config import ThemeConfig
from swing_screener.intelligence.models import CatalystSignal, ThemeCluster


def _normalize_symbol(value: Any) -> str:
    return str(value).strip().upper()


def _clean_peer_map(raw: dict[str, Any]) -> dict[str, tuple[str, ...]]:
    cleaned: dict[str, tuple[str, ...]] = {}
    for symbol_raw, peers_raw in raw.items():
        symbol = _normalize_symbol(symbol_raw)
        if not symbol:
            continue
        if isinstance(peers_raw, (list, tuple, set)):
            peers_iter = peers_raw
        elif peers_raw is None:
            peers_iter = []
        else:
            peers_iter = [peers_raw]

        peers: list[str] = []
        for peer_raw in peers_iter:
            peer = _normalize_symbol(peer_raw)
            if not peer or peer == symbol or peer in peers:
                continue
            peers.append(peer)
        cleaned[symbol] = tuple(peers)
    return cleaned


def load_curated_peer_map(path: str | Path) -> dict[str, tuple[str, ...]]:
    file_path = Path(path)
    if not file_path.exists():
        return {}
    raw_text = file_path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return {}

    suffix = file_path.suffix.lower()
    if suffix == ".json":
        payload = json.loads(raw_text)
    elif suffix in {".yaml", ".yml"}:
        try:
            import yaml  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                f"YAML peer map requires PyYAML: {file_path}"
            ) from exc
        payload = yaml.safe_load(raw_text)
    else:
        raise ValueError(f"Unsupported peer-map format: {file_path}")

    if not isinstance(payload, dict):
        return {}
    return _clean_peer_map(payload)


def apply_peer_confirmation(
    signals: list[CatalystSignal],
    peer_map: dict[str, tuple[str, ...]],
    *,
    min_return_z: float = 1.0,
) -> list[CatalystSignal]:
    active_symbols = {
        s.symbol
        for s in signals
        if not s.is_false_catalyst and s.return_z >= min_return_z
    }

    out: list[CatalystSignal] = []
    for signal in signals:
        peers = set(peer_map.get(signal.symbol, ()))
        confirmation = len(peers.intersection(active_symbols - {signal.symbol}))
        reasons = list(signal.reasons)
        if confirmation > 0:
            reasons.append(f"peer_confirmation:{confirmation}")
        out.append(
            CatalystSignal(
                symbol=signal.symbol,
                event_id=signal.event_id,
                return_z=signal.return_z,
                atr_shock=signal.atr_shock,
                peer_confirmation_count=confirmation,
                recency_hours=signal.recency_hours,
                is_false_catalyst=signal.is_false_catalyst,
                reasons=reasons,
            )
        )
    return out


def _cluster_strength(
    *,
    symbols: set[str],
    adjacency: dict[str, set[str]],
    signal_by_symbol: dict[str, CatalystSignal],
) -> float:
    if not symbols:
        return 0.0
    z_values = [max(0.0, signal_by_symbol[s].return_z) for s in symbols if s in signal_by_symbol]
    avg_z_norm = min(1.0, (sum(z_values) / max(1, len(z_values))) / 3.0)

    possible_edges = len(symbols) * (len(symbols) - 1)
    edge_count = 0
    for symbol in symbols:
        edge_count += len(adjacency.get(symbol, set()).intersection(symbols - {symbol}))
    density = 0.0 if possible_edges == 0 else min(1.0, edge_count / possible_edges)
    return round(0.6 * avg_z_norm + 0.4 * density, 6)


def detect_theme_clusters(
    signals: list[CatalystSignal],
    peer_map: dict[str, tuple[str, ...]],
    *,
    cfg: ThemeConfig,
    min_return_z: float = 1.0,
    theme_prefix: str = "theme",
) -> list[ThemeCluster]:
    if not cfg.enabled:
        return []

    active_symbols = {
        s.symbol
        for s in signals
        if not s.is_false_catalyst
        and s.return_z >= min_return_z
        and s.peer_confirmation_count >= cfg.min_peer_confirmation
    }
    if not active_symbols:
        return []

    adjacency: dict[str, set[str]] = {}
    for symbol in active_symbols:
        peers = set(peer_map.get(symbol, ()))
        neighbors = peers.intersection(active_symbols - {symbol})
        adjacency[symbol] = neighbors

    visited: set[str] = set()
    components: list[set[str]] = []
    for symbol in sorted(active_symbols):
        if symbol in visited:
            continue
        queue: deque[str] = deque([symbol])
        component: set[str] = set()
        visited.add(symbol)
        while queue:
            current = queue.popleft()
            component.add(current)
            for nxt in adjacency.get(current, set()):
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
        components.append(component)

    signal_by_symbol = {s.symbol: s for s in signals}
    clusters: list[ThemeCluster] = []
    idx = 1
    for component in components:
        if len(component) < cfg.min_cluster_size:
            continue
        symbols = sorted(component)
        driver_signals = sorted(
            {signal_by_symbol[s].event_id for s in symbols if s in signal_by_symbol}
        )
        clusters.append(
            ThemeCluster(
                theme_id=f"{theme_prefix}-{idx}",
                name=f"Peer Cluster {idx}",
                symbols=symbols,
                cluster_strength=_cluster_strength(
                    symbols=component,
                    adjacency=adjacency,
                    signal_by_symbol=signal_by_symbol,
                ),
                driver_signals=driver_signals,
            )
        )
        idx += 1

    clusters.sort(key=lambda c: (c.cluster_strength, len(c.symbols)), reverse=True)
    return clusters

