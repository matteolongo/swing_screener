import dataclasses

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.eval_cache import strategy_signature


def test_signature_is_stable_and_hex():
    cfg = ReportConfig()
    sig = strategy_signature(cfg)
    assert isinstance(sig, str)
    assert sig == strategy_signature(ReportConfig())  # deterministic
    assert all(c in "0123456789abcdef" for c in sig)


def test_signature_ignores_ranking_and_topn():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, ranking=dataclasses.replace(base.ranking, top_n=base.ranking.top_n + 5)
    )
    assert strategy_signature(base) == strategy_signature(changed)


def test_signature_changes_with_signals():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, signals=dataclasses.replace(base.signals, breakout_lookback=base.signals.breakout_lookback + 10)
    )
    assert strategy_signature(base) != strategy_signature(changed)
