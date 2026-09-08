import pytest

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

    warnings = sector_concentration_warnings(
        tickers, sector_map, min_candidates=5, threshold=0.6
    )
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

    warnings = sector_concentration_warnings(
        tickers, sector_map, min_candidates=5, threshold=0.6
    )
    assert warnings == []


def test_sector_concentration_deduplicates_tickers_and_counts_unknowns_in_denominator():
    warnings = sector_concentration_warnings(
        ["AAA", "AAA", "BBB", "CCC", "DDD", "EEE"],
        {
            "AAA": "Tech",
            "BBB": "Tech",
            "CCC": "Health",
            "DDD": None,
            "EEE": "   ",
        },
        min_candidates=5,
        threshold=0.4,
    )

    assert warnings == ["Sector concentration: Tech is 40% of candidates (2/5)."]


def test_sector_concentration_uses_inclusive_threshold_and_unique_candidate_minimum():
    sector_map = {"AAA": "Tech", "BBB": "Tech", "CCC": "Health", "DDD": None}

    assert sector_concentration_warnings(
        ["AAA", "BBB", "CCC", "DDD"],
        sector_map,
        min_candidates=4,
        threshold=0.5,
    ) == ["Sector concentration: Tech is 50% of candidates (2/4)."]
    assert (
        sector_concentration_warnings(
            ["AAA", "BBB", "CCC", "DDD"],
            sector_map,
            min_candidates=5,
            threshold=0.5,
        )
        == []
    )
    assert (
        sector_concentration_warnings(
            ["AAA", "BBB", "CCC", "DDD"],
            sector_map,
            min_candidates=4,
            threshold=0.5001,
        )
        == []
    )


def test_sector_concentration_sorts_all_warnings_by_share_then_sector_name():
    warnings = sector_concentration_warnings(
        ["T1", "T2", "H1", "H2", "U1"],
        {"T1": "Tech", "T2": "Tech", "H1": "Health", "H2": "Health"},
        min_candidates=1,
        threshold=0.4,
    )

    assert warnings == [
        "Sector concentration: Health is 40% of candidates (2/5).",
        "Sector concentration: Tech is 40% of candidates (2/5).",
    ]


@pytest.mark.parametrize(
    ("min_candidates", "threshold"),
    [(0, 0.4), (-1, 0.4), (1, -0.01), (1, 1.01)],
)
def test_sector_concentration_rejects_invalid_configuration(min_candidates, threshold):
    with pytest.raises(ValueError):
        sector_concentration_warnings(
            ["AAA"],
            {"AAA": "Tech"},
            min_candidates=min_candidates,
            threshold=threshold,
        )
