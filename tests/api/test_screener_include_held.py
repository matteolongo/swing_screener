from __future__ import annotations

from types import SimpleNamespace

from api.models.screener import ScreenerRequest
from api.services import screener_service
from api.services.screener_service import ScreenerService, _RunContext
from tests.api._test_helpers import make_position
from tests.api.test_same_symbol_reentry import _make_candidate, _make_recommendation


def _build_service() -> ScreenerService:
    portfolio_service = SimpleNamespace(
        list_positions=lambda status=None: SimpleNamespace(
            positions=[make_position(ticker="REP.MC", status="open")] if status == "open" else []
        ),
        suggest_position_stop=lambda position_id: SimpleNamespace(action="NO_ACTION"),
    )
    return ScreenerService(
        strategy_repo=SimpleNamespace(),
        portfolio_service=portfolio_service,
        provider=SimpleNamespace(),
        orders_service=None,
        eval_cache=SimpleNamespace(),
    )


def _build_ctx(*, include_held: bool) -> _RunContext:
    return _RunContext(
        request=ScreenerRequest(include_held=include_held),
        strategy={},
        risk_cfg=SimpleNamespace(
            account_size=500.0, risk_pct=0.02, max_position_pct=0.4, min_shares=1
        ),
    )


def _held_candidate():
    candidate = _make_candidate()
    candidate.recommendation = _make_recommendation(verdict="NOT_RECOMMENDED")
    return candidate


def test_held_symbol_is_suppressed_by_default():
    service = _build_service()
    ctx = _build_ctx(include_held=False)

    filtered, suppressed, _ = service._apply_same_symbol_filter(ctx, [_held_candidate()])

    assert filtered == []
    assert suppressed == 1


def test_held_symbol_is_kept_when_include_held_is_set():
    service = _build_service()
    ctx = _build_ctx(include_held=True)

    filtered, suppressed, _ = service._apply_same_symbol_filter(ctx, [_held_candidate()])

    assert len(filtered) == 1
    assert filtered[0].ticker == "REP.MC"
    assert suppressed == 0
    assert filtered[0].same_symbol is not None
    assert filtered[0].same_symbol.mode == "MANAGE_ONLY"
