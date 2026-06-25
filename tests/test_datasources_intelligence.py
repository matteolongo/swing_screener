from api.services.datasources_service import DatasourcesService, INTELLIGENCE_SOURCES


def test_three_collectors_probeable_in_inventory():
    ids = {d.id for d in DatasourcesService().inventory() if d.probeable}
    assert {"sec_edgar_catalysts", "company_ir_rss", "exchange_announcements"} <= ids


def test_remaining_intelligence_sources_inert():
    inert_ids = {d.id for d in INTELLIGENCE_SOURCES}
    assert inert_ids == {"yahoo_finance", "earnings_calendar", "financial_news_rss"}
