"""EU market metadata: suffixes, country codes, currencies, and exchanges."""

MARKET_SUFFIX: dict[str, str] = {
    ".PA": "fr",
    ".AS": "nl",
    ".MI": "it",
    ".DE": "de",
    ".L": "uk",
    ".SW": "ch",
    ".ST": "se",
    ".MC": "es",
    ".HE": "fi",
    ".BR": "be",
}

COUNTRY_BY_MARKET: dict[str, str] = {
    "us": "US",
    "fr": "FR",
    "nl": "NL",
    "it": "IT",
    "de": "DE",
    "uk": "GB",
    "ch": "CH",
    "se": "SE",
    "es": "ES",
    "fi": "FI",
    "be": "BE",
}

CURRENCY_BY_MARKET: dict[str, str] = {
    "us": "USD",
    "fr": "EUR",
    "nl": "EUR",
    "it": "EUR",
    "de": "EUR",
    "uk": "GBP",
    "ch": "CHF",
    "se": "SEK",
    "es": "EUR",
    "fi": "EUR",
    "be": "EUR",
}

EXCHANGE_BY_MARKET: dict[str, str] = {
    "us": "US",
    "fr": "XPAR",
    "nl": "XAMS",
    "it": "XMIL",
    "de": "XETR",
    "uk": "XLON",
    "ch": "XSWX",
    "se": "XSTO",
    "es": "XMAD",
    "fi": "XHEL",
    "be": "XBRU",
}


def market_from_ticker(ticker: str) -> str:
    """Return market code (e.g. 'nl', 'fr', 'us') inferred from ticker suffix."""
    upper = ticker.upper()
    for suffix, market in MARKET_SUFFIX.items():
        if upper.endswith(suffix):
            return market
    return "us"
