"""Approximate volume-at-price (volume profile) from OHLCV bars.

This is approximate. Real volume-at-price needs tick/trade data. Here each bar's
single volume total is distributed evenly across the price bins its high-low range
touches: a deterministic proxy, never true order flow.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class VolumeProfileConfig:
    bins: int = 24
    hvn_peak_ratio: float = 0.70
    lvn_peak_ratio: float = 0.20
    min_bars: int = 20


@dataclass(frozen=True)
class VolumeBin:
    price_low: float
    price_high: float
    center: float
    volume: float
    volume_share: float


@dataclass(frozen=True)
class ProfileZone:
    kind: str
    price_low: float
    price_high: float
    center: float
    volume_share: float


@dataclass(frozen=True)
class VolumeProfile:
    price_low: float
    price_high: float
    bin_width: float
    total_volume: float
    bins: list[VolumeBin]
    poc: ProfileZone
    hvns: list[ProfileZone]
    lvns: list[ProfileZone]


def _merge_runs(indices: list[int]) -> list[tuple[int, int]]:
    """Collapse a sorted list of bin indices into (start, end) contiguous runs."""
    runs: list[tuple[int, int]] = []
    for i in indices:
        if runs and i == runs[-1][1] + 1:
            runs[-1] = (runs[-1][0], i)
        else:
            runs.append((i, i))
    return runs


def _zone_from_run(
    kind: str, bins: list[VolumeBin], start: int, end: int
) -> ProfileZone:
    lo = bins[start].price_low
    hi = bins[end].price_high
    share = sum(b.volume_share for b in bins[start : end + 1])
    return ProfileZone(
        kind=kind,
        price_low=lo,
        price_high=hi,
        center=(lo + hi) / 2.0,
        volume_share=share,
    )


def build_volume_profile(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
    cfg: VolumeProfileConfig = VolumeProfileConfig(),
) -> VolumeProfile | None:
    if cfg.bins < 2:
        raise ValueError("bins must be >= 2")

    frame = pd.concat({"h": high, "l": low, "c": close, "v": volume}, axis=1).dropna()
    if len(frame) < cfg.min_bars:
        return None

    total_volume = float(frame["v"].sum())
    if total_volume <= 0:
        return None

    price_low = float(frame["l"].min())
    price_high = float(frame["h"].max())
    if price_high <= price_low:
        return None

    bin_width = (price_high - price_low) / cfg.bins
    bin_vol = [0.0] * cfg.bins

    def _bin_index(price: float) -> int:
        idx = int((price - price_low) / bin_width)
        return min(max(idx, 0), cfg.bins - 1)

    for high_value, low_value, volume_value in zip(
        frame["h"].to_numpy(), frame["l"].to_numpy(), frame["v"].to_numpy(), strict=True
    ):
        first = _bin_index(float(low_value))
        last = _bin_index(float(high_value))
        n = last - first + 1
        per = float(volume_value) / n
        for b in range(first, last + 1):
            bin_vol[b] += per

    bins: list[VolumeBin] = []
    for i in range(cfg.bins):
        lo = price_low + i * bin_width
        hi = price_low + (i + 1) * bin_width
        bins.append(
            VolumeBin(
                price_low=lo,
                price_high=hi,
                center=(lo + hi) / 2.0,
                volume=bin_vol[i],
                volume_share=bin_vol[i] / total_volume,
            )
        )

    poc_idx = max(range(cfg.bins), key=lambda i: bins[i].volume_share)
    poc_share = bins[poc_idx].volume_share
    poc = ProfileZone(
        kind="poc",
        price_low=bins[poc_idx].price_low,
        price_high=bins[poc_idx].price_high,
        center=bins[poc_idx].center,
        volume_share=poc_share,
    )

    hvn_idx = [
        i
        for i in range(cfg.bins)
        if i != poc_idx and bins[i].volume_share >= cfg.hvn_peak_ratio * poc_share
    ]
    lvn_idx = [
        i
        for i in range(cfg.bins)
        if bins[i].volume_share <= cfg.lvn_peak_ratio * poc_share
    ]

    hvns = [_zone_from_run("hvn", bins, s, e) for s, e in _merge_runs(hvn_idx)]
    lvns = [_zone_from_run("lvn", bins, s, e) for s, e in _merge_runs(lvn_idx)]

    return VolumeProfile(
        price_low=price_low,
        price_high=price_high,
        bin_width=bin_width,
        total_volume=total_volume,
        bins=bins,
        poc=poc,
        hvns=hvns,
        lvns=lvns,
    )
