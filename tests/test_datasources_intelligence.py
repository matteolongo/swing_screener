from api.services.datasources_service import DatasourcesService, INTELLIGENCE_SOURCES


def test_two_collectors_probeable_in_inventory():
    ids = {d.id for d in DatasourcesService().inventory() if d.probeable}
    assert {"sec_edgar_catalysts", "company_ir_rss"} <= ids


def test_no_inert_intelligence_sources():
    assert INTELLIGENCE_SOURCES == []
    intel = [d for d in DatasourcesService().inventory() if d.domain == "intelligence"]
    assert {d.id for d in intel} == {"sec_edgar_catalysts", "company_ir_rss"}
    assert all(d.probeable for d in intel)
