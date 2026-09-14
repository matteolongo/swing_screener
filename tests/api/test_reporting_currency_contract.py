import pytest
from pydantic import ValidationError

from api.models.daily_review import DailyReviewCandidate
from api.models.screener import ScreenerCandidate


def _daily(currency: str) -> DailyReviewCandidate:
    return DailyReviewCandidate(
        ticker="NOVN", currency=currency, signal="breakout", close=100,
        entry=None, stop=None, shares=None, r_reward=None,
    )


@pytest.mark.parametrize("currency", ["USD", "EUR", "GBP", "CHF", "SEK", "DKK", "NOK"])
def test_reporting_candidates_accept_registered_currencies(currency: str) -> None:
    assert _daily(currency.lower()).currency == currency


def test_reporting_candidates_preserve_explicit_unknown_currency() -> None:
    assert _daily(" unknown ").currency == "UNKNOWN"


def test_reporting_candidates_do_not_default_missing_currency_to_a_market() -> None:
    candidate = DailyReviewCandidate(
        ticker="NOVN", signal="breakout", close=100,
        entry=None, stop=None, shares=None, r_reward=None,
    )
    assert candidate.currency == "UNKNOWN"

    screener = ScreenerCandidate(
        ticker="NOVN", close=100, atr=2, momentum_6m=0.2,
        momentum_12m=0.3, rel_strength=1.1, score=0.8, confidence=80, rank=1,
    )
    assert (screener.currency, screener.quote_currency, screener.account_currency) == (
        "UNKNOWN", "UNKNOWN", "UNKNOWN"
    )


@pytest.mark.parametrize("model", [DailyReviewCandidate, ScreenerCandidate])
def test_reporting_candidates_reject_unknown_currencies(model) -> None:
    kwargs = dict(
        ticker="NOVN", currency="XYZ", close=100, atr=2, momentum_6m=0.2,
        momentum_12m=0.3, rel_strength=1.1, score=0.8, confidence=80, rank=1,
    )
    if model is DailyReviewCandidate:
        kwargs.update(signal="breakout", entry=None, stop=None, shares=None, r_reward=None)
        for key in ("atr", "momentum_6m", "momentum_12m", "rel_strength", "score", "confidence", "rank"):
            kwargs.pop(key)
    with pytest.raises(ValidationError):
        model(**kwargs)
