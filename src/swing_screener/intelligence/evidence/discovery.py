from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from lxml import etree

from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.rss import FeedEntry, fetch_feed

logger = logging.getLogger(__name__)

_CACHE_PATH = Path("data/intelligence/discovered_feeds_cache.json")
_RSS_LINK_TYPES = {"application/rss+xml", "application/atom+xml"}


def _default_info_provider(ticker: str) -> dict:
    try:
        import yfinance as yf

        return dict(yf.Ticker(ticker).info or {})
    except Exception:
        return {}


def _default_fetch_html(cfg: EvidenceConfig) -> Callable[[str], str | None]:
    def _get(url: str) -> str | None:
        timeout = httpx.Timeout(
            connect=cfg.connect_timeout_seconds,
            read=cfg.read_timeout_seconds,
            write=cfg.read_timeout_seconds,
            pool=cfg.read_timeout_seconds,
        )
        try:
            with httpx.Client(
                timeout=timeout, headers={"User-Agent": cfg.user_agent}, follow_redirects=True
            ) as client:
                response = client.get(url)
                response.raise_for_status()
                return response.text
        except Exception:
            return None

    return _get


def _candidate_pages(info: dict) -> list[str]:
    pages: list[str] = []
    for key in ("website", "irWebsite"):
        raw = str(info.get(key) or "").strip()
        if not raw:
            continue
        if not raw.startswith(("http://", "https://")):
            raw = "https://" + raw
        if raw not in pages:
            pages.append(raw)
    return pages


def _host_roots(pages: list[str]) -> list[str]:
    roots: list[str] = []
    for page in pages:
        parts = urlsplit(page)
        root = urlunsplit((parts.scheme, parts.netloc, "", "", ""))
        if root and root not in roots:
            roots.append(root)
    return roots


def _parse_feed_links(html: str, base_url: str) -> list[str]:
    if not html:
        return []
    data = html.encode("utf-8") if isinstance(html, str) else html
    try:
        root = etree.fromstring(data, parser=etree.HTMLParser(no_network=True, recover=True))
    except (etree.XMLSyntaxError, ValueError):
        return []
    if root is None:
        return []
    out: list[str] = []
    for link in root.iter("link"):
        rel = (link.get("rel") or "").lower()
        typ = (link.get("type") or "").lower()
        href = link.get("href")
        if "alternate" in rel and typ in _RSS_LINK_TYPES and href:
            out.append(urljoin(base_url, href))
    return out


def _validate(url: str, fetch_feed_entries: Callable[[str], list[FeedEntry]]) -> bool:
    try:
        return len(fetch_feed_entries(url)) >= 1
    except Exception:
        return False


def discover_ir_feed(
    ticker: str,
    *,
    cfg: EvidenceConfig,
    info_provider: Callable[[str], dict] | None = None,
    fetch_html: Callable[[str], str | None] | None = None,
    fetch_feed_entries: Callable[[str], list[FeedEntry]] | None = None,
) -> str | None:
    """Resolve a validated IR feed URL for the ticker, or None. Fail-soft."""
    info_provider = info_provider or _default_info_provider
    fetch_html = fetch_html or _default_fetch_html(cfg)
    if fetch_feed_entries is None:

        def fetch_feed_entries(url: str) -> list[FeedEntry]:
            return fetch_feed(
                url,
                user_agent=cfg.user_agent,
                connect_timeout=cfg.connect_timeout_seconds,
                read_timeout=cfg.read_timeout_seconds,
            )

    try:
        info = info_provider(ticker) or {}
    except Exception:
        return None
    pages = _candidate_pages(info)
    if not pages:
        return None

    for page in pages:
        html = fetch_html(page) or ""
        for feed_url in _parse_feed_links(html, page):
            if _validate(feed_url, fetch_feed_entries):
                return feed_url

    for root in _host_roots(pages):
        for path in cfg.discovery_paths:
            candidate = root + path
            if _validate(candidate, fetch_feed_entries):
                return candidate

    return None


def _load_cache(path: Path) -> dict:
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}


def _write_cache(path: Path, data: dict) -> None:
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(data))
    except OSError:
        logger.warning("Failed to write discovered-feeds cache %s", path, exc_info=True)


def _is_fresh(entry: dict, *, cfg: EvidenceConfig, today: date) -> bool:
    checked = entry.get("checked_at")
    if not checked:
        return False
    try:
        checked_date = date.fromisoformat(checked)
    except (TypeError, ValueError):
        return False
    ttl = cfg.discovery_found_ttl_days if entry.get("status") == "found" else cfg.discovery_negative_ttl_days
    return today <= checked_date + timedelta(days=ttl)


def cached_discover(
    ticker: str,
    *,
    cfg: EvidenceConfig,
    cache_path: Path | None = None,
    asof_date: date | None = None,
    info_provider: Callable[[str], dict] | None = None,
    fetch_html: Callable[[str], str | None] | None = None,
    fetch_feed_entries: Callable[[str], list[FeedEntry]] | None = None,
) -> str | None:
    """Return a cached or freshly-discovered IR feed URL (or None), updating the cache."""
    cache_path = cache_path or _CACHE_PATH
    today = asof_date or date.today()
    key = ticker.strip().upper()
    cache = _load_cache(cache_path)
    entry = cache.get(key)
    if entry and _is_fresh(entry, cfg=cfg, today=today):
        return entry.get("feed_url")
    feed_url = discover_ir_feed(
        key,
        cfg=cfg,
        info_provider=info_provider,
        fetch_html=fetch_html,
        fetch_feed_entries=fetch_feed_entries,
    )
    cache[key] = {
        "feed_url": feed_url,
        "status": "found" if feed_url else "none",
        "checked_at": today.isoformat(),
    }
    _write_cache(cache_path, cache)
    return feed_url
