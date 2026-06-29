from api.models.screener import TaxonomyFilter


def test_taxonomy_filter_to_spec():
    tf = TaxonomyFilter(
        region=["us"], market_cap_tier=["large", "mid"], provider=["yfinance"]
    )
    spec = tf.to_spec()
    assert spec.region == ("us",)
    assert spec.market_cap_tier == ("large", "mid")
    assert spec.provider == ("yfinance",)
    assert spec.sector is None


def test_load_taxonomy_presets_returns_seeded_presets():
    from api.services.pool_service import load_taxonomy_presets

    presets = load_taxonomy_presets()
    ids = {p["id"] for p in presets}
    assert "us_large_cap_equities" in ids
