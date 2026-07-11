from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

_SEARCH_TEXT = (
    "**What to do:** Buy on a pullback to 98. **Watch for:** loss of SMA20.\n"
    "Action: BUY_ON_PULLBACK. Conviction: medium. Catalyst urgency: low.\n"
    "Sources:\nhttps://example.com/a\n"
)

_CANDIDATE_PARSED = {
    "action": "BUY_ON_PULLBACK",
    "conviction": "medium",
    "catalyst_urgency": "low",
    "summary_line": "Constructive setup on a pullback.",
    "narrative": "What to do: buy the pullback. Watch for: SMA20 loss.",
    "upcoming_events": [],
    "position_signal": None,
    "position_outlook": None,
    "position_move_explanation": None,
    "sources": ["https://example.com/a"],
    "price_hook": "Pullback entry near support.",
    "key_numbers": [{"label": "SMA20", "value": "98.0", "sentiment": "bullish"}],
    "risk_factors": ["Earnings in 12 days."],
    "prediction_bullets": [
        {"direction": "bullish", "reason": "Above SMA50.", "reference": "SMA50"}
    ],
    "news": [
        {
            "headline": "Upgrade",
            "url": "https://example.com/a",
            "date": "2026-07-01",
            "sentiment": "bullish",
        }
    ],
    "classified_catalysts": [],
    "past_trades_context": None,
    "pre_open_outlook": None,
    "thesis_delta": None,
}

_POSITION_PARSED = {
    **_CANDIDATE_PARSED,
    "action": "MANAGE_ONLY",
    "summary_line": "Manage the existing position.",
    "narrative": "What to do: hold and manage risk. Watch for: SMA20 loss.",
    "position_signal": {
        "action": "HOLD",
        "reason": "Thesis remains intact while price holds above stop.",
    },
    "position_outlook": {
        "expected_holding_period": "1-2_weeks",
        "hold_until": "Hold while price remains above the current stop.",
        "next_review_trigger": "Review on SMA20 loss or fresh earnings news.",
        "thesis_status": "intact",
        "invalidation_signals": ["Close below SMA20", "Loss of current stop"],
        "profit_management": "trail_stop",
        "opportunity_cost": "medium",
        "confidence_decay": "Stale if no follow-through within two weeks.",
    },
    "position_move_explanation": {
        "direction": "up",
        "summary": "Price moved up as the setup held above support.",
        "drivers": [
            {
                "label": "Support held",
                "detail": "The stock remained above the entry and current stop.",
            }
        ],
    },
}


def _candidate_req() -> SymbolIntelligenceRequest:
    return SymbolIntelligenceRequest(
        close=100.0,
        signal="BUY_ON_PULLBACK",
        entry=98.0,
        stop=94.0,
        target=112.0,
        rr=3.5,
        sma_20=98.0,
        sma_50=95.0,
        sma_200=90.0,
        momentum_6m=12.0,
        momentum_12m=20.0,
        sector="Technology",
        currency="USD",
        rel_strength=8.0,
        atr=2.1,
        trailing_pe=22.0,
        revenue_growth_yoy=0.18,
        insider_net_shares_90d=15000,
        analyst_upgrade_downgrade_net_30d=2,
        valuation_label="fair",
    )


def _position_req() -> SymbolIntelligenceRequest:
    return SymbolIntelligenceRequest(
        close=105.0,
        signal="MANAGE",
        entry_price=98.0,
        entry_date="2026-06-01",
        r_now=1.75,
        days_open=20,
        stop=96.0,
        currency="USD",
        sma_20=101.0,
        sma_50=97.0,
        sma_200=90.0,
        momentum_6m=10.0,
    )


def _mock_openai(monkeypatch):
    from swing_screener.intelligence import symbol_analyzer as mod

    def fake_init(self):
        self._model = "gpt-4o"
        self._format_model = "gpt-4o-mini"
        self._max_tokens = 2000
        self._timeout = 60.0
        self._max_retries = 2
        self._history_max_entries = 50
        self._history_digest_size = 5
        self._pre_open_cfg = {"enabled": False}
        client = MagicMock()
        client.responses.create.return_value = SimpleNamespace(
            output_text=_SEARCH_TEXT,
            usage=SimpleNamespace(total_tokens=1000),
        )

        def _parse(model, instructions, input, text_format):
            payload = (
                _POSITION_PARSED
                if text_format.__name__.endswith("PositionAnalysis")
                else _CANDIDATE_PARSED
            )
            return SimpleNamespace(
                output_parsed=text_format(**payload),
                usage=SimpleNamespace(total_tokens=200),
            )

        client.responses.parse.side_effect = _parse
        self._client = client
        self._graph = None

    monkeypatch.setattr(mod.SymbolAnalyzer, "__init__", fake_init)


def _strip_dynamic(result):
    dumped = result.model_dump(mode="json")
    dumped.pop("generated_at", None)
    dumped.pop("run_id", None)
    return dumped


_EXPECTED_STABLE_BY_CASE = {
    "candidate": {
        "symbol": "AAPL",
        "action": "BUY_ON_PULLBACK",
        "conviction": "medium",
        "catalyst_urgency": "low",
        "summary_line": "Constructive setup on a pullback.",
        "narrative": "What to do: buy the pullback. Watch for: SMA20 loss.",
        "upcoming_events": [],
        "position_signal": None,
        "position_outlook": None,
        "position_move_explanation": None,
        "sources": ["https://example.com/a"],
        "inputs_used": {
            "trade_plan": {
                "entry": 98.0,
                "stop": 94.0,
                "target": 112.0,
                "rr": 3.5,
                "upside_pct": 12.0,
            },
            "technical": {
                "sma_20": 98.0,
                "sma_50": 95.0,
                "sma_200": 90.0,
                "momentum_6m": 12.0,
                "momentum_12m": 20.0,
                "rel_strength": 8.0,
                "atr": 2.1,
                "signal": "BUY_ON_PULLBACK",
            },
            "decision_context": {"valuation_label": "fair"},
            "finnhub_signals": {
                "insider_net_shares_90d": 15000,
                "analyst_upgrade_downgrade_net_30d": 2,
            },
            "sources": {
                "attempted": [
                    "degiro_news",
                    "polygon_news",
                    "sec_edgar_catalysts",
                ],
                "returned": {},
            },
        },
        "price_hook": "Pullback entry near support.",
        "key_numbers": [
            {"label": "SMA20", "value": "98.0", "sentiment": "bullish"}
        ],
        "risk_factors": ["Earnings in 12 days."],
        "prediction_bullets": [
            {
                "direction": "bullish",
                "reason": "Above SMA50.",
                "reference": "SMA50",
            }
        ],
        "news": [
            {
                "headline": "Upgrade",
                "url": "https://example.com/a",
                "date": "2026-07-01",
                "sentiment": "bullish",
            }
        ],
        "classified_catalysts": [],
        "past_trades_context": None,
        "pre_open_outlook": None,
        "thesis_delta": None,
        "evidence_ledger": {
            "contributions": [
                {
                    "key": "insider_activity",
                    "label": "Insider activity (90d)",
                    "category": "positioning",
                    "direction": "bullish",
                    "weight": 10.0,
                    "contribution": 10.0,
                    "source": "Finnhub insider 90d",
                    "event_date": None,
                    "explanation": (
                        "Recent insider activity is net positive, which suggests "
                        "insiders have been adding exposure."
                    ),
                },
                {
                    "key": "analyst_actions",
                    "label": "Analyst upgrades/downgrades (30d)",
                    "category": "catalyst",
                    "direction": "bullish",
                    "weight": 9.0,
                    "contribution": 9.0,
                    "source": "Finnhub analyst 30d",
                    "event_date": None,
                    "explanation": (
                        "Recent analyst revisions lean positive, adding external "
                        "confirmation to the setup."
                    ),
                },
                {
                    "key": "sma_trend",
                    "label": "SMA trend",
                    "category": "technical",
                    "direction": "bullish",
                    "weight": 6.0,
                    "contribution": 6.0,
                    "source": "OHLCV SMAs",
                    "event_date": None,
                    "explanation": (
                        "Price is aligned above the key moving averages, so trend "
                        "structure supports the setup."
                    ),
                },
                {
                    "key": "momentum",
                    "label": "Momentum 6m",
                    "category": "technical",
                    "direction": "bullish",
                    "weight": 6.0,
                    "contribution": 6.0,
                    "source": "OHLCV momentum",
                    "event_date": None,
                    "explanation": (
                        "Six-month momentum is positive, supporting continued "
                        "relative demand."
                    ),
                },
                {
                    "key": "relative_strength",
                    "label": "Relative strength",
                    "category": "technical",
                    "direction": "bullish",
                    "weight": 7.0,
                    "contribution": 7.0,
                    "source": "Benchmark RS",
                    "event_date": None,
                    "explanation": (
                        "The symbol is outperforming its benchmark, which supports "
                        "a long setup."
                    ),
                },
                {
                    "key": "news",
                    "label": "Upgrade",
                    "category": "news",
                    "direction": "bullish",
                    "weight": 4.0,
                    "contribution": 4.0,
                    "source": "https://example.com/a",
                    "event_date": "2026-07-01",
                    "explanation": (
                        "This cited news item supports the long setup: Upgrade"
                    ),
                },
            ],
            "bull_weight": 42.0,
            "bear_weight": 0.0,
            "net": 42.0,
            "balance_label": "strongly_bullish",
        },
    },
    "position": {
        "symbol": "AAPL",
        "action": "MANAGE_ONLY",
        "conviction": "medium",
        "catalyst_urgency": "low",
        "summary_line": "Manage the existing position.",
        "narrative": "What to do: hold and manage risk. Watch for: SMA20 loss.",
        "upcoming_events": [],
        "position_signal": {
            "action": "HOLD",
            "reason": "Thesis remains intact while price holds above stop.",
            "trim_pct": None,
            "trim_price": None,
        },
        "position_outlook": {
            "expected_holding_period": "1-2_weeks",
            "hold_until": "Hold while price remains above the current stop.",
            "next_review_trigger": "Review on SMA20 loss or fresh earnings news.",
            "thesis_status": "intact",
            "invalidation_signals": ["Close below SMA20", "Loss of current stop"],
            "profit_management": "trail_stop",
            "opportunity_cost": "medium",
            "confidence_decay": "Stale if no follow-through within two weeks.",
        },
        "position_move_explanation": {
            "direction": "up",
            "summary": "Price moved up as the setup held above support.",
            "drivers": [
                {
                    "label": "Support held",
                    "detail": "The stock remained above the entry and current stop.",
                }
            ],
        },
        "sources": ["https://example.com/a"],
        "inputs_used": {
            "trade_plan": {"stop": 96.0},
            "technical": {
                "sma_20": 101.0,
                "sma_50": 97.0,
                "sma_200": 90.0,
                "momentum_6m": 10.0,
                "signal": "MANAGE",
            },
            "position_context": {
                "ticker": "AAPL",
                "entry_price": 98.0,
                "entry_date": "2026-06-01",
                "stop": 96.0,
                "current_price": 105.0,
                "r_now": 1.75,
                "days_open": 20,
            },
            "sources": {
                "attempted": [
                    "degiro_news",
                    "polygon_news",
                    "sec_edgar_catalysts",
                ],
                "returned": {},
            },
        },
        "price_hook": "Pullback entry near support.",
        "key_numbers": [
            {"label": "SMA20", "value": "98.0", "sentiment": "bullish"}
        ],
        "risk_factors": ["Earnings in 12 days."],
        "prediction_bullets": [
            {
                "direction": "bullish",
                "reason": "Above SMA50.",
                "reference": "SMA50",
            }
        ],
        "news": [
            {
                "headline": "Upgrade",
                "url": "https://example.com/a",
                "date": "2026-07-01",
                "sentiment": "bullish",
            }
        ],
        "classified_catalysts": [],
        "past_trades_context": None,
        "pre_open_outlook": None,
        "thesis_delta": None,
        "evidence_ledger": {
            "contributions": [
                {
                    "key": "sma_trend",
                    "label": "SMA trend",
                    "category": "technical",
                    "direction": "bullish",
                    "weight": 6.0,
                    "contribution": 6.0,
                    "source": "OHLCV SMAs",
                    "event_date": None,
                    "explanation": (
                        "Price is aligned above the key moving averages, so trend "
                        "structure supports the setup."
                    ),
                },
                {
                    "key": "momentum",
                    "label": "Momentum 6m",
                    "category": "technical",
                    "direction": "bullish",
                    "weight": 6.0,
                    "contribution": 6.0,
                    "source": "OHLCV momentum",
                    "event_date": None,
                    "explanation": (
                        "Six-month momentum is positive, supporting continued "
                        "relative demand."
                    ),
                },
                {
                    "key": "news",
                    "label": "Upgrade",
                    "category": "news",
                    "direction": "bullish",
                    "weight": 4.0,
                    "contribution": 4.0,
                    "source": "https://example.com/a",
                    "event_date": "2026-07-01",
                    "explanation": (
                        "This cited news item supports the long setup: Upgrade"
                    ),
                },
            ],
            "bull_weight": 16.0,
            "bear_weight": 0.0,
            "net": 16.0,
            "balance_label": "bullish",
        },
    },
}


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    yield


@pytest.mark.parametrize("req_factory", [_candidate_req, _position_req])
def test_analyze_output_is_stable(monkeypatch, req_factory):
    _mock_openai(monkeypatch)
    from swing_screener.intelligence import symbol_analyzer as mod

    side_effects = []
    monkeypatch.setattr(
        mod,
        "write_to_cache",
        lambda ticker, result: side_effects.append(
            ("cache", ticker, _strip_dynamic(result))
        ),
    )
    monkeypatch.setattr(
        mod,
        "append_history",
        lambda ticker, result, max_entries: side_effects.append(
            ("history", ticker, max_entries, _strip_dynamic(result))
        ),
    )
    monkeypatch.setattr(
        mod,
        "record_analysis_metrics",
        lambda ticker, tokens=None: side_effects.append(("metrics", ticker, tokens)),
    )

    now = datetime(2026, 7, 3, 15, 0, tzinfo=timezone.utc)
    analyzer = SymbolAnalyzer()
    result = analyzer.analyze("AAPL", req_factory(), now=now)

    assert result.symbol == "AAPL"
    assert result.action == (
        "BUY_ON_PULLBACK" if req_factory is _candidate_req else "MANAGE_ONLY"
    )
    stable = _strip_dynamic(result)
    case = "candidate" if req_factory is _candidate_req else "position"
    if case not in _EXPECTED_STABLE_BY_CASE:
        print(case, stable)
        pytest.fail("Paste this stable dump into _EXPECTED_STABLE_BY_CASE")
    assert stable == _EXPECTED_STABLE_BY_CASE[case]
    assert [call[0] for call in side_effects] == ["cache", "history", "metrics"]
    assert side_effects[0][2] == stable
    assert side_effects[1][3] == stable
    assert side_effects[2][2] == 1200
