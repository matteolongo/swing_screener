from swing_screener.reporting.concentration import sector_concentration_warnings


def test_sector_concentration_warning_triggers():
    tickers = ["AAA", "BBB", "CCC", "DDD", "EEE"]
    sector_map = {
        "AAA": "Tech",
        "BBB": "Tech",
        "CCC": "Tech",
        "DDD": "Health",
        "EEE": "Tech",
    }

    warnings = sector_concentration_warnings(tickers, sector_map, min_candidates=5, threshold=0.6)
    assert warnings
    assert "Tech" in warnings[0]


def test_sector_concentration_warning_skips_when_below_threshold():
    tickers = ["AAA", "BBB", "CCC", "DDD", "EEE"]
    sector_map = {
        "AAA": "Tech",
        "BBB": "Tech",
        "CCC": "Health",
        "DDD": "Health",
        "EEE": "Finance",
    }

    warnings = sector_concentration_warnings(tickers, sector_map, min_candidates=5, threshold=0.6)
    assert warnings == []
