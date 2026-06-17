from __future__ import annotations

import dataclasses
import hashlib
import json

from swing_screener.strategy.report_config import ReportConfig


def strategy_signature(cfg: ReportConfig) -> str:
    """Stable short hash of the config that affects per-symbol features.

    Only ``universe``, ``signals`` and ``risk`` participate. Ranking weights,
    ``top_n``, ``only_active_signals`` and ``strategy_module`` are excluded so
    that changing them still reuses cached per-symbol features.
    """
    payload = {
        "universe": dataclasses.asdict(cfg.universe),
        "signals": dataclasses.asdict(cfg.signals),
        "risk": dataclasses.asdict(cfg.risk),
    }
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()[:12]
