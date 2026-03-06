from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import json
import logging
from pathlib import Path
import re
import threading
import time
from typing import Any, Protocol
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import httpx

from swing_screener.intelligence.config import IntelligenceConfig, SourcesConfig
from swing_screener.intelligence.llm.factory import build_event_classifier
from swing_screener.intelligence.models import (
    CatalystFeatureVector,
    EvidenceRecord,
    Event,
    InstrumentProfile,
    NormalizedEvent,
)
from swing_screener.utils import get_nested_dict

logger = logging.getLogger(__name__)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


class _RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        rpm = max(1, int(requests_per_minute))
        self._interval = 60.0 / float(rpm)
        self._lock = threading.Lock()
        self._last_at = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            if self._last_at <= 0.0:
                self._last_at = now
                return
            elapsed = now - self._last_at
            wait_sec = self._interval - elapsed
            if wait_sec > 0:
                time.sleep(wait_sec)
                now = time.monotonic()
            self._last_at = now


def _is_transient_http_error(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        status = int(exc.response.status_code)
        return status in {429, 500, 502, 503, 504}
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.NetworkError):
        return True
    return False


def _http_get_with_retries(
    *,
    client: httpx.Client,
    url: str,
    rate_limiter: _RateLimiter,
    max_retries: int = 2,
) -> httpx.Response:
    attempts = max(0, int(max_retries)) + 1
    last_exc: Exception | None = None
    for attempt in range(attempts):
        rate_limiter.wait()
        try:
            response = client.get(url)
            response.raise_for_status()
            return response
        except Exception as exc:
            last_exc = exc
            if attempt >= attempts - 1 or not _is_transient_http_error(exc):
                raise
            backoff = min(2.0, 0.2 * (2**attempt))
            time.sleep(backoff)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"Failed to GET url={url!r}")


@dataclass(frozen=True)
class SourceHealth:
    source_name: str
    enabled: bool
    status: str
    latency_ms: float
    error_count: int
    event_count: int
    last_ingest: str | None

    def to_dict(self) -> dict[str, Any]:
        total = self.event_count + self.error_count
        error_rate = 0.0 if total <= 0 else round(float(self.error_count) / float(total), 6)
        return {
            "source_name": self.source_name,
            "enabled": bool(self.enabled),
            "status": str(self.status),
            "latency_ms": round(float(self.latency_ms), 3),
            "error_count": int(self.error_count),
            "event_count": int(self.event_count),
            "error_rate": error_rate,
            "last_ingest": self.last_ingest,
        }


class EvidenceSourceAdapter(Protocol):
    name: str
    source_type: str
    supports_universe: bool
    supports_schedule: bool
    supports_filings: bool

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        ...


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _coerce_dt(raw: Any) -> datetime | None:
    if isinstance(raw, datetime):
        return _to_utc_naive(raw)
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return _to_utc_naive(datetime.fromisoformat(text.replace("Z", "+00:00")))
    except Exception:
        return None


def _coerce_rfc822(raw: str) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    patterns = (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    )
    for pattern in patterns:
        try:
            value = datetime.strptime(text, pattern)
            if value.tzinfo is None:
                return value
            return _to_utc_naive(value)
        except Exception:
            continue
    return None


def _build_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"


def _is_allowed_domain(url: str, *, allowed_domains: tuple[str, ...]) -> bool:
    host = (urlparse(str(url)).hostname or "").strip().lower()
    if not host:
        return False
    if not allowed_domains:
        return True
    for allowed in allowed_domains:
        domain = str(allowed).strip().lower()
        if not domain:
            continue
        if host == domain or host.endswith(f".{domain}"):
            return True
    return False


def _parse_feed_items(xml_text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items
    for item in root.findall(".//item") + root.findall(".//entry"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not link:
            link = (item.attrib.get("href") or "").strip() if hasattr(item, "attrib") else ""
        pub = (
            item.findtext("pubDate")
            or item.findtext("updated")
            or item.findtext("published")
            or ""
        )
        summary = (item.findtext("description") or item.findtext("summary") or "").strip()
        if not title:
            continue
        items.append(
            {
                "title": title,
                "link": link,
                "published": str(pub),
                "summary": summary,
            }
        )
    return items


def resolve_instrument_profiles(symbols: list[str] | tuple[str, ...]) -> dict[str, InstrumentProfile]:
    suffix_map: dict[str, tuple[str, str, str, str]] = {
        ".PA": ("XPAR", "FR", "EUR", "Europe/Paris"),
        ".AS": ("XAMS", "NL", "EUR", "Europe/Amsterdam"),
        ".MI": ("XMIL", "IT", "EUR", "Europe/Rome"),
        ".DE": ("XETR", "DE", "EUR", "Europe/Berlin"),
        ".L": ("XLON", "GB", "GBP", "Europe/London"),
        ".SW": ("XSWX", "CH", "CHF", "Europe/Zurich"),
        ".ST": ("XSTO", "SE", "SEK", "Europe/Stockholm"),
        ".MC": ("XMAD", "ES", "EUR", "Europe/Madrid"),
        ".HE": ("XHEL", "FI", "EUR", "Europe/Helsinki"),
        ".BR": ("XBRU", "BE", "EUR", "Europe/Brussels"),
    }
    overrides_path = Path("data/intelligence/instrument_profiles_overrides.json")
    overrides: dict[str, dict[str, Any]] = {}
    if overrides_path.exists():
        try:
            payload = json.loads(overrides_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                overrides = {
                    str(key).strip().upper(): value
                    for key, value in payload.items()
                    if isinstance(value, dict)
                }
        except Exception:
            overrides = {}

    out: dict[str, InstrumentProfile] = {}
    for raw_symbol in symbols:
        symbol = str(raw_symbol).strip().upper()
        if not symbol:
            continue
        exchange = "XNAS"
        country = "US"
        currency = "USD"
        timezone = "America/New_York"
        for suffix, payload in suffix_map.items():
            if symbol.endswith(suffix):
                exchange, country, currency, timezone = payload
                break
        base_alias = symbol.split(".", 1)[0]
        aliases = [symbol]
        if base_alias and base_alias not in aliases:
            aliases.append(base_alias)
        override = overrides.get(symbol, {})
        if isinstance(override.get("aliases"), list):
            for raw_alias in override.get("aliases", []):
                alias = str(raw_alias).strip().upper()
                if alias and alias not in aliases:
                    aliases.append(alias)
        out[symbol] = InstrumentProfile(
            symbol=symbol,
            exchange_mic=str(override.get("exchange_mic", exchange)).strip() or exchange,
            country_code=str(override.get("country_code", country)).strip() or country,
            currency=str(override.get("currency", currency)).strip() or currency,
            timezone=str(override.get("timezone", timezone)).strip() or timezone,
            aliases=aliases,
            provider_symbol_map={
                "yahoo_finance": str(
                    get_nested_dict(override, "provider_symbol_map").get("yahoo_finance", symbol)
                ).strip()
                or symbol,
                "stooq": str(get_nested_dict(override, "provider_symbol_map").get("stooq", base_alias.lower())).strip()
                or base_alias.lower(),
                "sec_edgar": str(get_nested_dict(override, "provider_symbol_map").get("sec_edgar", base_alias)).strip()
                or base_alias,
            },
        )
    return out


def _source_reliability(source_name: str, source_type: str) -> float:
    source_norm = str(source_name).strip().lower()
    type_norm = str(source_type).strip().lower()
    if source_norm in {"sec_edgar", "exchange_announcements"}:
        return 0.95
    if source_norm in {"company_ir_rss", "earnings_calendar"}:
        return 0.85
    if type_norm == "official":
        return 0.9
    if source_norm in {"yahoo_finance", "financial_news_rss"}:
        return 0.68
    if type_norm == "scrape":
        return 0.5
    return 0.6


def _infer_event_type(headline: str, event_type_raw: str, source_name: str) -> tuple[str, str, str]:
    base = str(event_type_raw or "news").strip().lower()
    text = f"{str(headline or '').lower()} {source_name.lower()}"

    if base in {"earnings_calendar", "earnings"} or "earnings" in text:
        return "earnings", "earnings", "scheduled"
    if "guidance" in text:
        return "guidance", "guidance_update", "unscheduled"
    if "investor day" in text or "capital markets day" in text:
        return "investor_day", "investor_day", "scheduled"
    if "launch" in text or "product" in text:
        return "product", "product_launch", "unscheduled"
    if "8-k" in text or "10-q" in text or "10-k" in text or "filing" in text:
        return "regulatory", "filing", "unscheduled"
    if "merger" in text or "acquisition" in text or "m&a" in text:
        return "m_and_a", "corporate_action", "unscheduled"
    if "analyst" in text or "upgrade" in text or "downgrade" in text:
        return "analyst", "rating_change", "unscheduled"
    return "other", base or "other", "unscheduled"


def _materiality_from_type(event_type: str, credibility: float) -> float:
    event_norm = str(event_type).strip().lower()
    base = {
        "earnings": 0.85,
        "guidance": 0.8,
        "regulatory": 0.82,
        "investor_day": 0.72,
        "m_and_a": 0.78,
        "product": 0.65,
        "analyst": 0.5,
        "other": 0.4,
    }.get(event_norm, 0.45)
    cred = max(0.0, min(1.0, float(credibility)))
    return round(max(0.0, min(1.0, 0.7 * base + 0.3 * cred)), 6)


def _severity_to_weight(severity: str) -> float:
    mapping = {"LOW": 0.35, "MEDIUM": 0.7, "HIGH": 1.0}
    return mapping.get(str(severity).strip().upper(), 0.5)


def _build_llm_structurer(cfg: IntelligenceConfig) -> Any | None:
    if not cfg.llm.enabled:
        return None
    try:
        classifier = build_event_classifier(
            provider_name=cfg.llm.provider,
            model=cfg.llm.model,
            base_url=cfg.llm.base_url,
            api_key=cfg.llm.api_key,
            system_prompt=cfg.llm.system_prompt,
            user_prompt_template=cfg.llm.user_prompt_template,
            cache_path=cfg.llm.cache_path,
            audit_path=cfg.llm.audit_path,
            enable_cache=cfg.llm.enable_cache,
            enable_audit=cfg.llm.enable_audit,
        )
        if not classifier.provider.is_available():
            return None
        return classifier
    except Exception:
        return None


def _enrich_event_with_llm(event: NormalizedEvent, classifier: Any) -> NormalizedEvent:
    headline = str(event.llm_fields.get("headline", "")).strip() or f"{event.symbol} {event.event_subtype}"
    snippet = str(event.llm_fields.get("summary", "")).strip()
    result = classifier.classify(
        headline=headline,
        snippet=snippet,
        source=event.source_name,
        timestamp=event.published_at,
    )
    classification = result.classification
    llm_type = str(classification.event_type.value).strip().lower() or event.event_type
    llm_severity = str(classification.severity.value).strip().upper()
    llm_confidence = _clamp01(float(classification.confidence))
    llm_materiality = _clamp01(
        0.5 * llm_confidence
        + 0.35 * _severity_to_weight(llm_severity)
        + (0.15 if bool(classification.is_material) else 0.0)
    )
    source_reliability = _clamp01(
        max(float(event.primary_source_reliability), 0.5 + 0.3 * llm_confidence)
    )

    llm_fields = dict(event.llm_fields)
    llm_fields["llm_event_type"] = llm_type
    llm_fields["llm_severity"] = llm_severity
    llm_fields["llm_confidence"] = round(llm_confidence, 6)
    llm_fields["llm_is_material"] = bool(classification.is_material)
    llm_fields["llm_summary"] = str(classification.summary)
    llm_fields["llm_cached"] = bool(result.cached)
    llm_fields["llm_model"] = str(result.model_name)
    if classification.primary_symbol:
        llm_fields["llm_primary_symbol"] = str(classification.primary_symbol).strip().upper()
    if classification.secondary_symbols:
        llm_fields["llm_secondary_symbols"] = ",".join(
            str(item).strip().upper() for item in classification.secondary_symbols if str(item).strip()
        )

    timing_type = event.timing_type
    if llm_type in {"earnings", "investor_day"}:
        timing_type = "scheduled"

    return NormalizedEvent(
        event_id=event.event_id,
        symbol=event.symbol,
        event_type=llm_type,
        event_subtype=event.event_subtype or llm_type,
        timing_type=timing_type,  # type: ignore[arg-type]
        materiality=round(llm_materiality, 6),
        confidence=round(llm_confidence, 6),
        primary_source_reliability=round(source_reliability, 6),
        confirmation_count=event.confirmation_count,
        published_at=event.published_at,
        event_at=event.event_at,
        source_name=event.source_name,
        raw_url=event.raw_url,
        llm_fields=llm_fields,
    )


def events_to_evidence(events: list[Event]) -> list[EvidenceRecord]:
    records: list[EvidenceRecord] = []
    for event in events:
        source_type = "news"
        source_norm = str(event.source).strip().lower()
        if source_norm in {"sec_edgar", "exchange_announcements"}:
            source_type = "official"
        elif source_norm in {"company_ir_rss", "earnings_calendar"}:
            source_type = "company"
        records.append(
            EvidenceRecord(
                evidence_id=_build_id("evd", event.event_id, source_norm),
                symbol=str(event.symbol).strip().upper(),
                source_name=source_norm,
                source_type=source_type,  # type: ignore[arg-type]
                url=event.url,
                headline=str(event.headline),
                body_snippet=str((event.metadata or {}).get("summary", "")),
                published_at=str(event.occurred_at),
                event_at=str(event.occurred_at),
                language="en",
                raw_payload_ref=None,
            )
        )
    return records


class SecEdgarEvidenceAdapter:
    name = "sec_edgar"
    source_type = "official"
    supports_universe = False
    supports_schedule = False
    supports_filings = True

    def __init__(
        self,
        *,
        user_agent: str = "swing-screener-intelligence/1.0 (research)",
        timeout_sec: float = 12.0,
    ) -> None:
        self._user_agent = user_agent
        self._timeout_sec = float(timeout_sec)

    def _load_ticker_map(
        self,
        *,
        rate_limiter: _RateLimiter,
        max_retries: int,
        timeout_sec: float,
    ) -> dict[str, str]:
        url = "https://www.sec.gov/files/company_tickers.json"
        headers = {"User-Agent": self._user_agent}
        with httpx.Client(timeout=timeout_sec, headers=headers) as client:
            response = _http_get_with_retries(
                client=client,
                url=url,
                rate_limiter=rate_limiter,
                max_retries=max_retries,
            )
            payload = response.json()
        out: dict[str, str] = {}
        if not isinstance(payload, dict):
            return out
        for item in payload.values():
            if not isinstance(item, dict):
                continue
            ticker = str(item.get("ticker", "")).strip().upper()
            cik = str(item.get("cik_str", "")).strip()
            if ticker and cik:
                out[ticker] = cik.zfill(10)
        return out

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        _ = profiles
        records: list[EvidenceRecord] = []
        timeout = max(1.0, min(60.0, float(cfg.timeouts.read_seconds or self._timeout_sec)))
        rate_limiter = _RateLimiter(cfg.rate_limits.requests_per_minute)
        max_retries = 2
        try:
            ticker_to_cik = self._load_ticker_map(
                rate_limiter=rate_limiter,
                max_retries=max_retries,
                timeout_sec=timeout,
            )
        except Exception as exc:
            logger.warning("SEC ticker map load failed: %s", exc)
            return records

        headers = {"User-Agent": self._user_agent}
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        with httpx.Client(timeout=timeout, headers=headers) as client:
            for symbol in symbols:
                ticker = str(symbol).strip().upper().split(".", 1)[0]
                cik = ticker_to_cik.get(ticker)
                if not cik:
                    continue
                try:
                    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
                    response = _http_get_with_retries(
                        client=client,
                        url=url,
                        rate_limiter=rate_limiter,
                        max_retries=max_retries,
                    )
                    payload = response.json()
                except Exception as exc:
                    logger.debug("SEC submissions fetch failed for %s: %s", ticker, exc)
                    continue

                recent = payload.get("filings", {}).get("recent", {}) if isinstance(payload, dict) else {}
                forms = recent.get("form", []) if isinstance(recent, dict) else []
                dates = recent.get("filingDate", []) if isinstance(recent, dict) else []
                docs = recent.get("primaryDocument", []) if isinstance(recent, dict) else []

                for idx, form in enumerate(forms[:20]):
                    form_text = str(form).strip().upper()
                    if form_text not in {"8-K", "10-Q", "10-K", "6-K"}:
                        continue
                    dt_raw = dates[idx] if idx < len(dates) else None
                    filed_dt = _coerce_dt(dt_raw)
                    if filed_dt is None or not (start_utc <= filed_dt <= end_utc):
                        continue
                    doc_name = str(docs[idx]).strip() if idx < len(docs) else ""
                    filing_url = (
                        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{doc_name}"
                        if doc_name
                        else None
                    )
                    headline = f"{ticker} filed {form_text}"
                    records.append(
                        EvidenceRecord(
                            evidence_id=_build_id("sec", ticker, form_text, filed_dt.isoformat()),
                            symbol=ticker,
                            source_name=self.name,
                            source_type="official",
                            url=filing_url,
                            headline=headline,
                            body_snippet=f"SEC filing {form_text} detected for {ticker}.",
                            published_at=filed_dt.isoformat(),
                            event_at=filed_dt.isoformat(),
                            language="en",
                            raw_payload_ref=f"CIK{cik}",
                        )
                    )
        return records


class CompanyIrRssEvidenceAdapter:
    name = "company_ir_rss"
    source_type = "company"
    supports_universe = True
    supports_schedule = True
    supports_filings = False

    def __init__(
        self,
        *,
        feeds_path: str | Path = "data/intelligence/ir_feeds.json",
        timeout_sec: float = 12.0,
    ) -> None:
        self._feeds_path = Path(feeds_path)
        self._timeout_sec = float(timeout_sec)

    def _load_feed_map(self) -> dict[str, list[str]]:
        if not self._feeds_path.exists():
            return {}
        try:
            payload = json.loads(self._feeds_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        if not isinstance(payload, dict):
            return {}
        out: dict[str, list[str]] = {}
        for symbol, raw_urls in payload.items():
            key = str(symbol).strip().upper()
            if not key:
                continue
            if isinstance(raw_urls, str):
                urls = [raw_urls]
            elif isinstance(raw_urls, list):
                urls = [str(item) for item in raw_urls]
            else:
                urls = []
            normalized = [url.strip() for url in urls if str(url).strip()]
            if normalized:
                out[key] = normalized
        return out

    def _parse_feed(self, xml_text: str) -> list[dict[str, str]]:
        return _parse_feed_items(xml_text)

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        _ = profiles
        feed_map = self._load_feed_map()
        records: list[EvidenceRecord] = []
        if not feed_map:
            return records

        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        timeout = max(1.0, min(60.0, float(cfg.timeouts.read_seconds or self._timeout_sec)))
        rate_limiter = _RateLimiter(cfg.rate_limits.requests_per_minute)
        max_retries = 2

        with httpx.Client(timeout=timeout) as client:
            for symbol in symbols:
                symbol_norm = str(symbol).strip().upper()
                for feed_url in feed_map.get(symbol_norm, []):
                    try:
                        response = _http_get_with_retries(
                            client=client,
                            url=feed_url,
                            rate_limiter=rate_limiter,
                            max_retries=max_retries,
                        )
                    except Exception as exc:
                        logger.debug("IR RSS fetch failed for %s (%s): %s", symbol_norm, feed_url, exc)
                        continue
                    for item in self._parse_feed(response.text):
                        published = _coerce_rfc822(item.get("published", "")) or end_utc
                        if not (start_utc <= published <= end_utc):
                            continue
                        records.append(
                            EvidenceRecord(
                                evidence_id=_build_id(
                                    "rss",
                                    symbol_norm,
                                    item.get("title", ""),
                                    item.get("link", ""),
                                    published.isoformat(),
                                ),
                                symbol=symbol_norm,
                                source_name=self.name,
                                source_type="company",
                                url=item.get("link") or None,
                                headline=item.get("title", ""),
                                body_snippet=item.get("summary", "")[:500],
                                published_at=published.isoformat(),
                                event_at=published.isoformat(),
                                language="en",
                                raw_payload_ref=feed_url,
                            )
                        )
        return records


class ExchangeAnnouncementsEvidenceAdapter:
    name = "exchange_announcements"
    source_type = "official"
    supports_universe = True
    supports_schedule = True
    supports_filings = False

    def __init__(
        self,
        *,
        feeds_path: str | Path = "data/intelligence/exchange_feeds.json",
        timeout_sec: float = 12.0,
    ) -> None:
        self._feeds_path = Path(feeds_path)
        self._timeout_sec = float(timeout_sec)

    def _load_feeds(self) -> dict[str, list[str]]:
        if not self._feeds_path.exists():
            return {}
        try:
            payload = json.loads(self._feeds_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        if not isinstance(payload, dict):
            return {}
        out: dict[str, list[str]] = {}
        for exchange_or_symbol, raw_urls in payload.items():
            key = str(exchange_or_symbol).strip().upper()
            if not key:
                continue
            if isinstance(raw_urls, str):
                urls = [raw_urls]
            elif isinstance(raw_urls, list):
                urls = [str(item) for item in raw_urls]
            else:
                urls = []
            normalized = [url.strip() for url in urls if str(url).strip()]
            if normalized:
                out[key] = normalized
        return out

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        feeds = self._load_feeds()
        if not feeds:
            return []
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        timeout = max(1.0, min(60.0, float(cfg.timeouts.read_seconds or self._timeout_sec)))
        rate_limiter = _RateLimiter(cfg.rate_limits.requests_per_minute)
        max_retries = 2
        records: list[EvidenceRecord] = []
        with httpx.Client(timeout=timeout) as client:
            for symbol in symbols:
                symbol_norm = str(symbol).strip().upper()
                profile = profiles.get(symbol_norm)
                keys = [symbol_norm]
                if profile is not None:
                    keys.insert(0, profile.exchange_mic)
                keys.append("*")
                seen_urls: set[str] = set()
                for key in keys:
                    for feed_url in feeds.get(key, []):
                        if feed_url in seen_urls:
                            continue
                        seen_urls.add(feed_url)
                        try:
                            response = _http_get_with_retries(
                                client=client,
                                url=feed_url,
                                rate_limiter=rate_limiter,
                                max_retries=max_retries,
                            )
                        except Exception as exc:
                            logger.debug("Exchange feed fetch failed (%s %s): %s", key, feed_url, exc)
                            continue
                        for item in _parse_feed_items(response.text):
                            title = item.get("title", "")
                            summary = item.get("summary", "")
                            text = f"{title} {summary}".upper()
                            aliases = [symbol_norm]
                            if profile is not None:
                                aliases.extend(profile.aliases)
                            if aliases and not any(alias and alias.upper() in text for alias in aliases):
                                continue
                            published = _coerce_rfc822(item.get("published", "")) or end_utc
                            if not (start_utc <= published <= end_utc):
                                continue
                            records.append(
                                EvidenceRecord(
                                    evidence_id=_build_id(
                                        "exch",
                                        symbol_norm,
                                        key,
                                        item.get("title", ""),
                                        item.get("link", ""),
                                        published.isoformat(),
                                    ),
                                    symbol=symbol_norm,
                                    source_name=self.name,
                                    source_type="official",
                                    url=item.get("link") or None,
                                    headline=item.get("title", ""),
                                    body_snippet=item.get("summary", "")[:500],
                                    published_at=published.isoformat(),
                                    event_at=published.isoformat(),
                                    language="en",
                                    raw_payload_ref=feed_url,
                                )
                            )
        return records


class FinancialNewsRssEvidenceAdapter:
    name = "financial_news_rss"
    source_type = "news"
    supports_universe = True
    supports_schedule = True
    supports_filings = False

    def __init__(
        self,
        *,
        feeds_path: str | Path = "data/intelligence/financial_news_feeds.json",
        timeout_sec: float = 12.0,
    ) -> None:
        self._feeds_path = Path(feeds_path)
        self._timeout_sec = float(timeout_sec)

    def _load_feeds(self) -> list[str]:
        if not self._feeds_path.exists():
            return []
        try:
            payload = json.loads(self._feeds_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        urls: list[str] = []
        if isinstance(payload, list):
            urls = [str(item).strip() for item in payload]
        elif isinstance(payload, dict):
            raw = payload.get("feeds")
            if isinstance(raw, list):
                urls = [str(item).strip() for item in raw]
        return [url for url in urls if url]

    def _resolve_symbol_from_text(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        text: str,
    ) -> str | None:
        text_upper = str(text or "").upper()
        for symbol in symbols:
            symbol_norm = str(symbol).strip().upper()
            if not symbol_norm:
                continue
            profile = profiles.get(symbol_norm)
            aliases = [symbol_norm] if profile is None else list(dict.fromkeys([symbol_norm, *profile.aliases]))
            if any(alias and alias.upper() in text_upper for alias in aliases):
                return symbol_norm
        return None

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        feeds = self._load_feeds()
        if not feeds:
            return []
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        timeout = max(1.0, min(60.0, float(cfg.timeouts.read_seconds or self._timeout_sec)))
        rate_limiter = _RateLimiter(cfg.rate_limits.requests_per_minute)
        max_retries = 2
        records: list[EvidenceRecord] = []
        with httpx.Client(timeout=timeout) as client:
            for feed_url in feeds:
                try:
                    response = _http_get_with_retries(
                        client=client,
                        url=feed_url,
                        rate_limiter=rate_limiter,
                        max_retries=max_retries,
                    )
                except Exception as exc:
                    logger.debug("Financial RSS fetch failed (%s): %s", feed_url, exc)
                    continue
                for item in _parse_feed_items(response.text):
                    title = item.get("title", "")
                    summary = item.get("summary", "")
                    resolved_symbol = self._resolve_symbol_from_text(
                        symbols=symbols,
                        profiles=profiles,
                        text=f"{title} {summary}",
                    )
                    if not resolved_symbol:
                        continue
                    published = _coerce_rfc822(item.get("published", "")) or end_utc
                    if not (start_utc <= published <= end_utc):
                        continue
                    records.append(
                        EvidenceRecord(
                            evidence_id=_build_id(
                                "fnr",
                                resolved_symbol,
                                title,
                                item.get("link", ""),
                                published.isoformat(),
                            ),
                            symbol=resolved_symbol,
                            source_name=self.name,
                            source_type="news",
                            url=item.get("link") or None,
                            headline=title,
                            body_snippet=summary[:500],
                            published_at=published.isoformat(),
                            event_at=published.isoformat(),
                            language="en",
                            raw_payload_ref=feed_url,
                        )
                    )
        return records


class CalendarFallbackScrapeEvidenceAdapter:
    name = "calendar_fallback_scrape"
    source_type = "scrape"
    supports_universe = True
    supports_schedule = True
    supports_filings = False

    def __init__(
        self,
        *,
        config_path: str | Path = "data/intelligence/calendar_fallback_urls.json",
        timeout_sec: float = 12.0,
    ) -> None:
        self._config_path = Path(config_path)
        self._timeout_sec = float(timeout_sec)

    def _load_urls(self) -> list[str]:
        if not self._config_path.exists():
            return []
        try:
            payload = json.loads(self._config_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        if isinstance(payload, list):
            return [str(item).strip() for item in payload if str(item).strip()]
        if isinstance(payload, dict):
            raw = payload.get("urls")
            if isinstance(raw, list):
                return [str(item).strip() for item in raw if str(item).strip()]
        return []

    def _extract_rows(self, html: str) -> list[tuple[str, str]]:
        rows: list[tuple[str, str]] = []
        row_pattern = re.compile(
            r"<tr[^>]*>\s*<td[^>]*>\s*([A-Za-z0-9\.\-]{1,16})\s*</td>\s*<td[^>]*>\s*([^<]{4,64})\s*</td>",
            re.IGNORECASE | re.DOTALL,
        )
        for match in row_pattern.finditer(str(html or "")):
            symbol = str(match.group(1) or "").strip().upper()
            date_text = str(match.group(2) or "").strip()
            if symbol and date_text:
                rows.append((symbol, date_text))
        return rows

    def _parse_event_dt(self, raw_date: str, fallback_year: int) -> datetime | None:
        text = str(raw_date or "").strip()
        if not text:
            return None
        dt = _coerce_dt(text)
        if dt is not None:
            return dt
        patterns = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y", "%b %d %Y", "%b %d")
        for pattern in patterns:
            try:
                parsed = datetime.strptime(text, pattern)
                if pattern == "%b %d":
                    parsed = parsed.replace(year=fallback_year)
                return parsed
            except Exception:
                continue
        return None

    def fetch_records(
        self,
        *,
        symbols: list[str],
        profiles: dict[str, InstrumentProfile],
        start_dt: datetime,
        end_dt: datetime,
        cfg: SourcesConfig,
    ) -> list[EvidenceRecord]:
        _ = profiles
        if not cfg.scraping_enabled:
            return []
        urls = self._load_urls()
        if not urls:
            return []
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        symbol_set = {str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()}
        timeout = max(1.0, min(60.0, float(cfg.timeouts.read_seconds or self._timeout_sec)))
        rate_limiter = _RateLimiter(cfg.rate_limits.requests_per_minute)
        max_retries = 2
        records: list[EvidenceRecord] = []
        with httpx.Client(timeout=timeout) as client:
            for url in urls:
                if not _is_allowed_domain(url, allowed_domains=cfg.allowed_domains):
                    continue
                try:
                    response = _http_get_with_retries(
                        client=client,
                        url=url,
                        rate_limiter=rate_limiter,
                        max_retries=max_retries,
                    )
                except Exception as exc:
                    logger.debug("Calendar fallback scrape failed (%s): %s", url, exc)
                    continue
                for symbol, date_text in self._extract_rows(response.text):
                    if symbol_set and symbol not in symbol_set:
                        continue
                    event_dt = self._parse_event_dt(date_text, fallback_year=end_utc.year)
                    if event_dt is None:
                        continue
                    if not (start_utc <= event_dt <= end_utc + (end_utc - start_utc)):
                        continue
                    records.append(
                        EvidenceRecord(
                            evidence_id=_build_id("cfs", symbol, date_text, url),
                            symbol=symbol,
                            source_name=self.name,
                            source_type="scrape",
                            url=url,
                            headline=f"{symbol} earnings scheduled",
                            body_snippet=f"Fallback calendar captured event date {date_text}.",
                            published_at=end_utc.isoformat(),
                            event_at=event_dt.isoformat(),
                            language="en",
                            raw_payload_ref=url,
                        )
                    )
        return records


def collect_additional_evidence(
    *,
    symbols: list[str],
    profiles: dict[str, InstrumentProfile],
    start_dt: datetime,
    end_dt: datetime,
    cfg: SourcesConfig,
) -> tuple[list[EvidenceRecord], dict[str, SourceHealth]]:
    enabled = set(str(name).strip().lower() for name in cfg.enabled)
    adapters: list[EvidenceSourceAdapter] = [
        SecEdgarEvidenceAdapter(),
        CompanyIrRssEvidenceAdapter(),
        ExchangeAnnouncementsEvidenceAdapter(),
        FinancialNewsRssEvidenceAdapter(),
        CalendarFallbackScrapeEvidenceAdapter(),
    ]
    handled_sources = {str(adapter.name).strip().lower() for adapter in adapters}
    all_records: list[EvidenceRecord] = []
    health: dict[str, SourceHealth] = {}

    def _run_adapter(adapter: EvidenceSourceAdapter) -> tuple[str, list[EvidenceRecord], SourceHealth]:
        source_name = str(adapter.name).strip().lower()
        started = datetime.utcnow()
        try:
            records = adapter.fetch_records(
                symbols=symbols,
                profiles=profiles,
                start_dt=start_dt,
                end_dt=end_dt,
                cfg=cfg,
            )
            errors = 0
            status = "ok"
        except Exception as exc:  # pragma: no cover - defensive degradation
            logger.warning("Evidence adapter failed (%s): %s", source_name, exc)
            records = []
            errors = 1
            status = "error"
        latency = max(0.0, (datetime.utcnow() - started).total_seconds() * 1000.0)
        source_health = SourceHealth(
            source_name=source_name,
            enabled=True,
            status=status,
            latency_ms=latency,
            error_count=errors,
            event_count=len(records),
            last_ingest=datetime.utcnow().replace(microsecond=0).isoformat(),
        )
        return source_name, records, source_health

    enabled_adapters: list[EvidenceSourceAdapter] = []
    for adapter in adapters:
        source_name = str(adapter.name).strip().lower()
        if source_name not in enabled:
            health[source_name] = SourceHealth(
                source_name=source_name,
                enabled=False,
                status="disabled",
                latency_ms=0.0,
                error_count=0,
                event_count=0,
                last_ingest=None,
            )
            continue
        enabled_adapters.append(adapter)

    if len(enabled_adapters) <= 1:
        for adapter in enabled_adapters:
            source_name, records, source_health = _run_adapter(adapter)
            all_records.extend(records)
            health[source_name] = source_health
    else:
        max_workers = max(1, min(len(enabled_adapters), int(cfg.rate_limits.max_concurrency)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_run_adapter, adapter): adapter for adapter in enabled_adapters}
            for future in as_completed(futures):
                adapter = futures[future]
                source_name = str(adapter.name).strip().lower()
                try:
                    resolved_source, records, source_health = future.result()
                    all_records.extend(records)
                    health[resolved_source] = source_health
                except Exception as exc:  # pragma: no cover - defensive degradation
                    logger.warning("Evidence adapter future failed (%s): %s", source_name, exc)
                    health[source_name] = SourceHealth(
                        source_name=source_name,
                        enabled=True,
                        status="error",
                        latency_ms=0.0,
                        error_count=1,
                        event_count=0,
                        last_ingest=datetime.utcnow().replace(microsecond=0).isoformat(),
                    )

    for source_name in sorted(enabled - handled_sources):
        health[source_name] = SourceHealth(
            source_name=source_name,
            enabled=True,
            status="not_implemented",
            latency_ms=0.0,
            error_count=0,
            event_count=0,
            last_ingest=datetime.utcnow().replace(microsecond=0).isoformat(),
        )

    return all_records, health


def _canonical_event_key(event: NormalizedEvent) -> str:
    dt = _coerce_dt(event.event_at) or _coerce_dt(event.published_at)
    day = dt.date().isoformat() if dt is not None else ""
    headline = str(event.llm_fields.get("headline") or "").strip().lower()
    if not headline:
        headline = f"{event.event_subtype}:{event.source_name}".lower()
    return f"{event.symbol}|{event.event_type}|{day}|{headline}"


def normalize_evidence_records(records: list[EvidenceRecord]) -> list[NormalizedEvent]:
    normalized: list[NormalizedEvent] = []
    for record in records:
        event_type, subtype, timing_type = _infer_event_type(
            record.headline,
            "news",
            record.source_name,
        )
        reliability = _source_reliability(record.source_name, record.source_type)
        confidence = round(max(0.0, min(1.0, 0.65 * reliability + 0.35)), 6)
        normalized.append(
            NormalizedEvent(
                event_id=_build_id("nev", record.evidence_id, record.symbol),
                symbol=str(record.symbol).strip().upper(),
                event_type=event_type,
                event_subtype=subtype,
                timing_type=timing_type,  # type: ignore[arg-type]
                materiality=_materiality_from_type(event_type, credibility=confidence),
                confidence=confidence,
                primary_source_reliability=round(reliability, 6),
                confirmation_count=1,
                published_at=record.published_at,
                event_at=record.event_at,
                source_name=record.source_name,
                raw_url=record.url,
                llm_fields={
                    "headline": record.headline,
                    "source_type": record.source_type,
                },
            )
        )

    grouped: dict[str, list[NormalizedEvent]] = {}
    for event in normalized:
        grouped.setdefault(_canonical_event_key(event), []).append(event)

    deduped: list[NormalizedEvent] = []
    for events in grouped.values():
        best = max(
            events,
            key=lambda item: (
                float(item.primary_source_reliability),
                float(item.confidence),
                float(item.materiality),
            ),
        )
        confirmation = len(events)
        deduped.append(
            NormalizedEvent(
                event_id=best.event_id,
                symbol=best.symbol,
                event_type=best.event_type,
                event_subtype=best.event_subtype,
                timing_type=best.timing_type,
                materiality=best.materiality,
                confidence=best.confidence,
                primary_source_reliability=best.primary_source_reliability,
                confirmation_count=confirmation,
                published_at=best.published_at,
                event_at=best.event_at,
                source_name=best.source_name,
                raw_url=best.raw_url,
                llm_fields=best.llm_fields,
            )
        )

    deduped.sort(
        key=lambda item: (
            _coerce_dt(item.event_at) or _coerce_dt(item.published_at) or datetime.min,
            item.event_id,
        ),
        reverse=True,
    )
    return deduped


def enrich_normalized_events_with_llm(
    *,
    events: list[NormalizedEvent],
    cfg: IntelligenceConfig,
    llm_classifier: Any | None = None,
) -> list[NormalizedEvent]:
    if not events:
        return []
    classifier = llm_classifier or _build_llm_structurer(cfg)
    if classifier is None:
        return events

    enriched: list[NormalizedEvent] = []
    for event in events:
        try:
            enriched.append(_enrich_event_with_llm(event, classifier))
        except Exception as exc:
            llm_fields = dict(event.llm_fields)
            llm_fields["llm_error"] = str(exc)
            llm_fields["llm_error_type"] = type(exc).__name__
            enriched.append(
                NormalizedEvent(
                    event_id=event.event_id,
                    symbol=event.symbol,
                    event_type=event.event_type,
                    event_subtype=event.event_subtype,
                    timing_type=event.timing_type,
                    materiality=event.materiality,
                    confidence=event.confidence,
                    primary_source_reliability=event.primary_source_reliability,
                    confirmation_count=event.confirmation_count,
                    published_at=event.published_at,
                    event_at=event.event_at,
                    source_name=event.source_name,
                    raw_url=event.raw_url,
                    llm_fields=llm_fields,
                )
            )
    return enriched


def normalize_events(events: list[Event]) -> list[NormalizedEvent]:
    records = events_to_evidence(events)
    return normalize_evidence_records(records)


def build_catalyst_feature_vectors(
    *,
    symbols: list[str],
    normalized_events: list[NormalizedEvent],
    asof_dt: datetime,
) -> dict[str, CatalystFeatureVector]:
    by_symbol: dict[str, list[NormalizedEvent]] = {}
    for event in normalized_events:
        symbol = str(event.symbol).strip().upper()
        by_symbol.setdefault(symbol, []).append(event)

    now = _to_utc_naive(asof_dt)
    out: dict[str, CatalystFeatureVector] = {}

    for raw_symbol in symbols:
        symbol = str(raw_symbol).strip().upper()
        events = by_symbol.get(symbol, [])
        if not events:
            out[symbol] = CatalystFeatureVector(
                symbol=symbol,
                proximity_score=0.0,
                materiality_score=0.0,
                source_quality_score=0.0,
                confirmation_score=0.0,
                uncertainty_penalty=1.0,
                filing_impact_score=0.0,
                calendar_risk_score=0.0,
                top_catalysts=[],
            )
            continue

        proximity_values: list[float] = []
        materiality_values: list[float] = []
        source_values: list[float] = []
        confirmation_values: list[float] = []
        uncertainty_values: list[float] = []
        filing_values: list[float] = []
        calendar_values: list[float] = []

        ranked: list[tuple[float, dict[str, str | float | int | bool]]] = []

        for event in events:
            published_dt = _coerce_dt(event.published_at) or now
            event_dt = _coerce_dt(event.event_at) or published_dt
            recency_hours = max(0.0, (now - published_dt).total_seconds() / 3600.0)

            proximity = 0.0
            if event.timing_type == "scheduled":
                delta_days = (event_dt - now).total_seconds() / 86400.0
                if 0.0 <= delta_days <= 30.0:
                    proximity = max(0.0, 1.0 - (delta_days / 30.0))

            materiality = max(0.0, min(1.0, float(event.materiality)))
            source_quality = max(0.0, min(1.0, float(event.primary_source_reliability)))
            confirmation = max(0.0, min(1.0, float(event.confirmation_count) / 3.0))
            uncertainty = max(0.0, min(1.0, 1.0 - (0.5 * event.confidence + 0.5 * source_quality)))
            filing_impact = materiality if event.event_type == "regulatory" else 0.0
            calendar_risk = materiality * proximity if event.timing_type == "scheduled" else 0.0

            proximity_values.append(proximity)
            materiality_values.append(materiality)
            source_values.append(source_quality)
            confirmation_values.append(confirmation)
            uncertainty_values.append(uncertainty)
            filing_values.append(filing_impact)
            calendar_values.append(calendar_risk)

            rank_score = (0.5 * materiality) + (0.3 * source_quality) + (0.2 * confirmation)
            ranked.append(
                (
                    rank_score,
                    {
                        "event_type": event.event_type,
                        "event_subtype": event.event_subtype,
                        "materiality": round(materiality, 6),
                        "confidence": round(float(event.confidence), 6),
                        "source": event.source_name,
                        "published_at": event.published_at,
                        "event_at": event.event_at or event.published_at,
                        "recency_hours": round(recency_hours, 3),
                        "url": event.raw_url or "",
                    },
                )
            )

        ranked.sort(key=lambda item: item[0], reverse=True)
        top_catalysts = [item[1] for item in ranked[:3]]

        def _avg(values: list[float]) -> float:
            if not values:
                return 0.0
            return round(sum(values) / float(len(values)), 6)

        out[symbol] = CatalystFeatureVector(
            symbol=symbol,
            proximity_score=_avg(proximity_values),
            materiality_score=_avg(materiality_values),
            source_quality_score=_avg(source_values),
            confirmation_score=_avg(confirmation_values),
            uncertainty_penalty=_avg(uncertainty_values),
            filing_impact_score=max(filing_values) if filing_values else 0.0,
            calendar_risk_score=max(calendar_values) if calendar_values else 0.0,
            top_catalysts=top_catalysts,
        )

    return out


def evidence_quality_flag(vector: CatalystFeatureVector) -> str:
    if (
        vector.source_quality_score >= 0.7
        and vector.confirmation_score >= 0.5
        and vector.uncertainty_penalty <= 0.35
    ):
        return "high"
    if vector.source_quality_score >= 0.45 and vector.uncertainty_penalty <= 0.65:
        return "medium"
    return "low"
