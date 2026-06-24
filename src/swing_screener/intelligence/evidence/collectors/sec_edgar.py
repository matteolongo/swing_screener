from __future__ import annotations

import time
from datetime import date
from typing import Callable

import httpx

from swing_screener.data.source_health import ProbeResult, SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig, load_evidence_config
from swing_screener.intelligence.evidence.models import SourceEvidence

_TICKER_MAP_CACHE: dict[str, tuple[str, str | None]] | None = None


def _default_get_json(cfg: EvidenceConfig) -> Callable[[str], dict]:
    def _get(url: str) -> dict:
        with httpx.Client(
            timeout=cfg.read_timeout_seconds, headers={"User-Agent": cfg.user_agent}
        ) as client:
            response = client.get(url)
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Unexpected SEC response for {url}")
        return payload

    return _get


def _load_ticker_map(get_json: Callable[[str], dict]) -> dict[str, tuple[str, str | None]]:
    global _TICKER_MAP_CACHE
    if _TICKER_MAP_CACHE is not None:
        return _TICKER_MAP_CACHE
    payload = get_json("https://www.sec.gov/files/company_tickers.json")
    out: dict[str, tuple[str, str | None]] = {}
    for item in payload.values():
        if not isinstance(item, dict):
            continue
        ticker = str(item.get("ticker", "")).strip().upper()
        cik = str(item.get("cik_str", "")).strip()
        title = str(item.get("title", "")).strip() or None
        if ticker and cik:
            out[ticker] = (cik.zfill(10), title)
    _TICKER_MAP_CACHE = out
    return out


class SecEdgarCatalystCollector:
    SOURCE_ID = "sec_edgar_catalysts"

    @classmethod
    def describe(cls) -> SourceDescriptor:
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="SEC EDGAR (catalysts)",
            domain="intelligence",
            role="primary",
            requires=None,
            configured=True,
            probeable=True,
            canary_market="us",
            note="8-K / 6-K material-event filings",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        get_json: Callable[[str], dict] | None = None,
    ) -> list[SourceEvidence]:
        get_json = get_json or _default_get_json(cfg)
        base = ticker.strip().upper().split(".", 1)[0]
        info = _load_ticker_map(get_json).get(base)
        if info is None:
            return []
        cik, _name = info
        data = get_json(f"https://data.sec.gov/submissions/CIK{cik}.json")
        recent = (data.get("filings") or {}).get("recent") or {}
        forms = recent.get("form") or []
        dates = recent.get("filingDate") or []
        accns = recent.get("accessionNumber") or []
        descs = recent.get("primaryDocDescription") or []
        items = recent.get("items") or []
        wanted = set(cfg.sec_forms)
        cik_int = str(int(cik))
        out: list[SourceEvidence] = []
        for i, form in enumerate(forms):
            if form not in wanted:
                continue
            accn = accns[i] if i < len(accns) else ""
            nodash = accn.replace("-", "")
            url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{nodash}/{accn}-index.htm"
            desc = (descs[i] if i < len(descs) else "") or ""
            item_codes = (items[i] if i < len(items) else "") or ""
            summary = desc or item_codes or form
            if item_codes and item_codes not in summary:
                summary = f"{summary} (items {item_codes})"
            out.append(
                SourceEvidence(
                    title=f"{form}: {desc}".rstrip(": ") if desc else form,
                    url=url,
                    publisher="SEC EDGAR",
                    published_at=dates[i] if i < len(dates) else None,
                    quote_or_summary=summary,
                    relevance=f"SEC material-event filing ({form})",
                )
            )
        return out

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        started = time.perf_counter()
        cfg = load_evidence_config()
        try:
            items = cls.collect(canary, asof_date=date.today(), cfg=cfg, get_json=_default_get_json(cfg))
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(
                id=cls.SOURCE_ID,
                status="ok",
                latency_ms=round(elapsed, 1),
                detail=f"{len(items)} recent {'/'.join(cfg.sec_forms)} filings",
                sample={"symbol": canary, "count": len(items), "latest": items[0].published_at if items else None},
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(id=cls.SOURCE_ID, status="down", latency_ms=round(elapsed, 1), error=str(exc))
