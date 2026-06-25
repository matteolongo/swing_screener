from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime

import httpx
from lxml import etree

_ATOM = "{http://www.w3.org/2005/Atom}"


@dataclass(frozen=True)
class FeedEntry:
    title: str
    url: str
    published_at: str | None
    summary: str | None


def _parser() -> etree.XMLParser:
    return etree.XMLParser(resolve_entities=False, no_network=True, recover=True)


def _text(el) -> str | None:
    if el is None or el.text is None:
        return None
    text = el.text.strip()
    return text or None


def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed is not None:
            return parsed.date().isoformat()
    except (TypeError, ValueError):
        pass
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return value


def _rss_item(item) -> FeedEntry | None:
    title = _text(item.find("title"))
    link = _text(item.find("link"))
    if not (title or link):
        return None
    return FeedEntry(
        title=title or "(untitled)",
        url=link or "",
        published_at=_normalize_date(_text(item.find("pubDate"))),
        summary=_text(item.find("description")),
    )


def _atom_entry(entry) -> FeedEntry | None:
    title = _text(entry.find(f"{_ATOM}title"))
    link_el = entry.find(f"{_ATOM}link")
    url = link_el.get("href") if link_el is not None else None
    if not (title or url):
        return None
    pub = _text(entry.find(f"{_ATOM}published")) or _text(entry.find(f"{_ATOM}updated"))
    return FeedEntry(
        title=title or "(untitled)",
        url=url or "",
        published_at=_normalize_date(pub),
        summary=_text(entry.find(f"{_ATOM}summary")),
    )


def parse_feed(content: bytes) -> list[FeedEntry]:
    if not content:
        return []
    try:
        root = etree.fromstring(content, parser=_parser())
    except etree.XMLSyntaxError:
        return []
    if root is None:
        return []
    entries: list[FeedEntry | None] = [_rss_item(i) for i in root.findall(".//item")]
    entries += [_atom_entry(e) for e in root.findall(f".//{_ATOM}entry")]
    return [e for e in entries if e is not None]


def fetch_feed(
    url: str,
    *,
    user_agent: str,
    connect_timeout: float,
    read_timeout: float,
    client: httpx.Client | None = None,
) -> list[FeedEntry]:
    timeout = httpx.Timeout(connect=connect_timeout, read=read_timeout, write=read_timeout, pool=read_timeout)
    owns = client is None
    client = client or httpx.Client(timeout=timeout, headers={"User-Agent": user_agent}, follow_redirects=True)
    try:
        response = client.get(url)
        response.raise_for_status()
        return parse_feed(response.content)
    finally:
        if owns:
            client.close()
