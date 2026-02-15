from pathlib import Path

from swing_screener.intelligence.config import ThemeConfig
from swing_screener.intelligence.models import CatalystSignal
from swing_screener.intelligence.relations import (
    apply_peer_confirmation,
    detect_theme_clusters,
    load_curated_peer_map,
)


def _fixture(name: str) -> Path:
    return Path("tests/fixtures/intelligence") / name


def test_load_curated_peer_map_json_normalizes_and_deduplicates():
    peer_map = load_curated_peer_map(_fixture("peer_map.json"))

    assert peer_map["AAPL"] == ("MSFT", "NVDA")
    assert "AAPL" not in peer_map["AAPL"]
    assert peer_map["TSLA"] == ("F",)


def test_apply_peer_confirmation_counts_active_peers():
    peer_map = load_curated_peer_map(_fixture("peer_map.json"))
    signals = [
        CatalystSignal("AAPL", "e1", 2.1, 1.2, 0, 3.0, False, []),
        CatalystSignal("MSFT", "e2", 1.8, 1.1, 0, 3.0, False, []),
        CatalystSignal("NVDA", "e3", 0.9, 0.8, 0, 3.0, False, []),  # below threshold
        CatalystSignal("AVGO", "e4", 2.2, 1.3, 0, 3.0, True, []),   # false catalyst
    ]

    enriched = apply_peer_confirmation(signals, peer_map, min_return_z=1.0)
    by_symbol = {s.symbol: s for s in enriched}

    assert by_symbol["AAPL"].peer_confirmation_count == 1
    assert by_symbol["MSFT"].peer_confirmation_count == 1
    assert by_symbol["NVDA"].peer_confirmation_count == 2
    assert by_symbol["AVGO"].peer_confirmation_count == 0
    assert "peer_confirmation:1" in by_symbol["AAPL"].reasons


def test_detect_theme_clusters_finds_connected_component():
    peer_map = load_curated_peer_map(_fixture("peer_map.json"))
    signals = [
        CatalystSignal("AAPL", "e1", 2.3, 1.2, 2, 3.0, False, []),
        CatalystSignal("MSFT", "e2", 2.1, 1.0, 2, 3.0, False, []),
        CatalystSignal("NVDA", "e3", 2.5, 1.4, 2, 3.0, False, []),
        CatalystSignal("TSLA", "e4", 2.0, 1.3, 0, 3.0, False, []),
    ]

    clusters = detect_theme_clusters(
        signals,
        peer_map,
        cfg=ThemeConfig(enabled=True, min_cluster_size=3, min_peer_confirmation=1),
        min_return_z=1.0,
        theme_prefix="t",
    )

    assert len(clusters) == 1
    cluster = clusters[0]
    assert cluster.theme_id == "t-1"
    assert cluster.name == "Peer Cluster 1"
    assert cluster.symbols == ["AAPL", "MSFT", "NVDA"]
    assert cluster.cluster_strength > 0
    assert set(cluster.driver_signals) == {"e1", "e2", "e3"}


def test_detect_theme_clusters_respects_min_cluster_size_and_toggle():
    peer_map = load_curated_peer_map(_fixture("peer_map.json"))
    signals = [
        CatalystSignal("AAPL", "e1", 2.3, 1.2, 1, 3.0, False, []),
        CatalystSignal("MSFT", "e2", 2.1, 1.0, 1, 3.0, False, []),
    ]

    clusters_disabled = detect_theme_clusters(
        signals,
        peer_map,
        cfg=ThemeConfig(enabled=False, min_cluster_size=2, min_peer_confirmation=1),
        min_return_z=1.0,
    )
    assert clusters_disabled == []

    clusters_too_small = detect_theme_clusters(
        signals,
        peer_map,
        cfg=ThemeConfig(enabled=True, min_cluster_size=3, min_peer_confirmation=1),
        min_return_z=1.0,
    )
    assert clusters_too_small == []
