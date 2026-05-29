from __future__ import annotations

import datetime as dt
import logging
from dataclasses import replace
from typing import Any

import httpx

from swing_screener.fundamentals.models import ProviderFundamentalsRecord

logger = logging.getLogger(__name__)

_BASE_URL = "https://finnhub.io/api/v1"
_TIMEOUT = 10.0

# Maps Finnhub metric key → (model field name, scale factor).
# Margin/ROE fields: Finnhub returns percent×100 (e.g. 46.56 → 0.4656), divide by 100 (scale=0.01).
# Growth/ratio fields: already in model units, scale=1.0.
_FINNHUB_METRIC_MAP: dict[str, tuple[str, float]] = {
    "grossMarginAnnual": ("gross_margin", 0.01),
    "netProfitMarginAnnual": ("net_margin", 0.01),
    "operatingMarginAnnual": ("operating_margin", 0.01),
    "revenueGrowthAnnualYoy": ("revenue_growth_yoy", 1.0),
    "epsGrowthAnnualYoy": ("earnings_growth_yoy", 1.0),
    "roeAnnual": ("return_on_equity", 0.01),
    "currentRatioAnnual": ("current_ratio", 1.0),
    "totalDebt/totalEquityAnnual": ("debt_to_equity", 1.0),
    "peAnnual": ("trailing_pe", 1.0),
    "pbAnnual": ("price_to_book", 1.0),
}


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


class FinnhubEnrichmentClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _get(self, path: str, params: dict) -> dict:
        resp = httpx.get(
            f"{_BASE_URL}{path}",
            params={**params, "token": self._api_key},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()

    def _fetch_metric_supplement(self, symbol: str) -> dict[str, float]:
        """Returns mapped model-field → value for non-None Finnhub metrics."""
        try:
            data = self._get("/stock/metric", {"symbol": symbol, "metric": "all"})
            raw_metrics = data.get("metric") or {}
        except Exception as exc:
            logger.debug("Finnhub /stock/metric failed for %s: %s", symbol, exc)
            return {}

        result: dict[str, float] = {}
        for finnhub_key, (model_field, scale) in _FINNHUB_METRIC_MAP.items():
            raw = _safe_float(raw_metrics.get(finnhub_key))
            if raw is not None:
                result[model_field] = raw * scale
        return result

    def _fetch_recommendation_score(self, symbol: str) -> float | None:
        """Net bull count from most recent analyst recommendation period."""
        try:
            items = self._get("/stock/recommendation", {"symbol": symbol})
            if not items:
                return None
            item = items[0]
            return float(
                (item.get("strongBuy") or 0)
                + (item.get("buy") or 0)
                - (item.get("sell") or 0)
                - (item.get("strongSell") or 0)
            )
        except Exception as exc:
            logger.debug("Finnhub /stock/recommendation failed for %s: %s", symbol, exc)
            return None

    def _fetch_price_target(self, symbol: str) -> float | None:
        """Median analyst price target."""
        try:
            data = self._get("/stock/price-target", {"symbol": symbol})
            return _safe_float(data.get("targetMedian"))
        except Exception as exc:
            logger.debug("Finnhub /stock/price-target failed for %s: %s", symbol, exc)
            return None

    def _fetch_beat_streak(self, symbol: str) -> int | None:
        """Consecutive EPS beats from most recent quarter back."""
        try:
            items = self._get("/stock/earnings", {"symbol": symbol, "limit": 8})
            if not items:
                return None
            streak = 0
            for item in items:
                actual = _safe_float(item.get("actual"))
                estimate = _safe_float(item.get("estimate"))
                if actual is None or estimate is None:
                    break
                if actual > estimate:
                    streak += 1
                else:
                    break
            return streak
        except Exception as exc:
            logger.debug("Finnhub /stock/earnings failed for %s: %s", symbol, exc)
            return None

    def _fetch_insider_transactions(self, symbol: str) -> tuple[int | None, int | None]:
        """Returns (net_shares_90d, transaction_count_90d). net_shares > 0 = net buy."""
        from_date = (dt.date.today() - dt.timedelta(days=90)).isoformat()
        try:
            data = self._get("/stock/insider-transactions", {"symbol": symbol, "from": from_date})
            rows = data.get("data") or []
        except Exception as exc:
            logger.debug("Finnhub /stock/insider-transactions failed for %s: %s", symbol, exc)
            return None, None

        if not rows:
            return None, None

        net = 0
        for row in rows:
            change = _safe_float(row.get("change"))
            if change is not None:
                net += int(change)
        return net, len(rows)

    def _fetch_forward_eps_estimate(self, symbol: str) -> float | None:
        """Next quarter EPS consensus estimate."""
        try:
            data = self._get("/stock/eps-estimate", {"symbol": symbol, "freq": "quarterly"})
            rows = data.get("data") or []
            if not rows:
                return None
            return _safe_float(rows[0].get("eps"))
        except Exception as exc:
            logger.debug("Finnhub /stock/eps-estimate failed for %s: %s", symbol, exc)
            return None

    def _fetch_upgrade_downgrade_net(self, symbol: str) -> int | None:
        """Net analyst actions (upgrades minus downgrades) in the last 30 days."""
        from_date = (dt.date.today() - dt.timedelta(days=30)).isoformat()
        try:
            items = self._get("/stock/upgrade-downgrade", {"symbol": symbol, "from": from_date})
            if not items:
                return None
        except Exception as exc:
            logger.debug("Finnhub /stock/upgrade-downgrade failed for %s: %s", symbol, exc)
            return None

        upgrades = 0
        downgrades = 0
        for item in items:
            action = str(item.get("action") or "").lower()
            if action == "up":
                upgrades += 1
            elif action == "down":
                downgrades += 1

        if upgrades == 0 and downgrades == 0:
            return None
        return upgrades - downgrades

    def enrich(self, record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
        """Fill None fields and add analyst signals. Never raises."""
        updates: dict[str, Any] = {}

        supplement = self._fetch_metric_supplement(record.symbol)
        for field_name, value in supplement.items():
            if value is not None and getattr(record, field_name, None) is None:
                updates[field_name] = value

        score = self._fetch_recommendation_score(record.symbol)
        if score is not None and record.analyst_recommendation_score is None:
            updates["analyst_recommendation_score"] = score

        target = self._fetch_price_target(record.symbol)
        if target is not None and record.analyst_price_target is None:
            updates["analyst_price_target"] = target

        streak = self._fetch_beat_streak(record.symbol)
        if streak is not None and record.earnings_beat_streak is None:
            updates["earnings_beat_streak"] = streak

        net_shares, txn_count = self._fetch_insider_transactions(record.symbol) if record.insider_net_shares_90d is None else (None, None)
        if net_shares is not None and record.insider_net_shares_90d is None:
            updates["insider_net_shares_90d"] = net_shares
        if txn_count is not None and record.insider_transaction_count_90d is None:
            updates["insider_transaction_count_90d"] = txn_count

        fwd_eps = self._fetch_forward_eps_estimate(record.symbol) if record.forward_eps_estimate is None else None
        if fwd_eps is not None and record.forward_eps_estimate is None:
            updates["forward_eps_estimate"] = fwd_eps

        updown_net = self._fetch_upgrade_downgrade_net(record.symbol) if record.analyst_upgrade_downgrade_net_30d is None else None
        if updown_net is not None and record.analyst_upgrade_downgrade_net_30d is None:
            updates["analyst_upgrade_downgrade_net_30d"] = updown_net

        if not updates:
            return record
        return replace(record, **updates)
