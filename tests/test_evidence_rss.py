from swing_screener.intelligence.evidence.rss import parse_feed

RSS = b"""<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title>Apple declares dividend</title><link>http://ir/a</link>
<pubDate>Wed, 18 Jun 2026 12:00:00 GMT</pubDate><description>Board approved</description></item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Q2 results</title><link href="http://ir/b"/>
<published>2026-06-19T08:00:00Z</published><summary>Revenue up</summary></entry>
</feed>"""

XXE = b"""<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>
<rss version="2.0"><channel><item><title>&x;</title><link>http://x</link>
<pubDate>Wed, 18 Jun 2026 12:00:00 GMT</pubDate></item></channel></rss>"""


def test_parse_rss_normalizes_rfc822_date():
    entries = parse_feed(RSS)
    assert len(entries) == 1
    assert entries[0].title == "Apple declares dividend"
    assert entries[0].url == "http://ir/a"
    assert entries[0].published_at == "2026-06-18"
    assert entries[0].summary == "Board approved"


def test_parse_atom_iso_date_and_link_href():
    entries = parse_feed(ATOM)
    assert entries[0].url == "http://ir/b"
    assert entries[0].published_at == "2026-06-19"


def test_parse_empty_returns_empty():
    assert parse_feed(b"") == []


def test_xxe_entity_not_expanded():
    entries = parse_feed(XXE)
    # external entity must not resolve to file contents
    assert entries == [] or "root:" not in (entries[0].title or "")
