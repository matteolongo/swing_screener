from api.services.datasources_service import DatasourcesService, INTELLIGENCE_SOURCES


def test_sec_collector_probeable_in_inventory():
    ids = {d.id for d in DatasourcesService().inventory() if d.probeable and d.domain == "intelligence"}
    assert ids == {"sec_edgar_catalysts"}


def test_no_inert_intelligence_sources():
    assert INTELLIGENCE_SOURCES == []
    intel = [d for d in DatasourcesService().inventory() if d.domain == "intelligence"]
    assert {d.id for d in intel} == {"sec_edgar_catalysts"}
    assert all(d.probeable for d in intel)
