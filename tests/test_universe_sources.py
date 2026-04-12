from swing_screener.data.universe_sources import (
    MARCH_2026_REVIEW_URL,
    SEPTEMBER_2025_REVIEW_URL,
    _apply_delta,
    _extract_composition_rows,
    _extract_delta_rows,
    refresh_amsterdam_from_euronext_review,
)


SEPTEMBER_HTML = """
<p><br><strong>AEX® Composition (ISIN NL0000000107)</strong></p>
<div class="table-responsive" ><table class="table"><tbody>
<tr><td><strong>Name</strong></td><td><strong>ISIN Code</strong></td></tr>
<tr><td>ABN AMRO BANK N.V.</td><td>NL0011540547</td></tr>
<tr><td>RANDSTAD NV</td><td>NL0000379121</td></tr>
<tr><td>WDP</td><td>BE0974349814</td></tr>
</tbody></table></div>
<p><strong>AMX® Composition (ISIN NL0000249274)</strong></p>
<div class="table-responsive" ><table class="table"><tbody>
<tr><td><strong>Name</strong></td><td><strong>ISIN Code</strong></td></tr>
<tr><td>AIR FRANCE -KLM</td><td>FR0000031122</td></tr>
<tr><td>OCI</td><td>NL0010558797</td></tr>
<tr><td>SBM OFFSHORE</td><td>NL0000360618</td></tr>
</tbody></table></div>
"""


MARCH_HTML = """
<p><strong>AEX®</strong></p>
<div class="table-responsive" ><table class="table"><tbody>
<tr><td><strong>Inclusion of:</strong></td><td><strong>Exclusion of:</strong></td></tr>
<tr><td><strong>SBM OFFSHORE</strong></td><td>RANDSTAD NV</td></tr>
</tbody></table></div>
<p><strong>AMX®</strong></p>
<div class="table-responsive" ><table class="table"><tbody>
<tr><td><strong>Inclusion of:</strong></td><td><strong>Exclusion of:</strong></td></tr>
<tr><td><strong>RANDSTAD NV</strong></td><td>SBM OFFSHORE</td></tr>
<tr><td><strong>THEON INTERNATIONAL</strong></td><td>OCI</td></tr>
</tbody></table></div>
"""


def test_extract_full_composition_rows_from_official_review_page():
    assert _extract_composition_rows(SEPTEMBER_HTML, "AEX") == [
        "ABN AMRO BANK N.V.",
        "RANDSTAD NV",
        "WDP",
    ]
    assert _extract_composition_rows(SEPTEMBER_HTML, "AMX") == [
        "AIR FRANCE -KLM",
        "OCI",
        "SBM OFFSHORE",
    ]


def test_extract_delta_rows_from_march_review_page():
    assert _extract_delta_rows(MARCH_HTML, "AEX") == (["SBM OFFSHORE"], ["RANDSTAD NV"])
    assert _extract_delta_rows(MARCH_HTML, "AMX") == (
        ["RANDSTAD NV", "THEON INTERNATIONAL"],
        ["SBM OFFSHORE", "OCI"],
    )


def test_apply_delta_keeps_existing_members_and_applies_changes():
    result = _apply_delta(
        ["AIR FRANCE -KLM", "OCI", "SBM OFFSHORE"],
        ["RANDSTAD NV", "THEON INTERNATIONAL"],
        ["SBM OFFSHORE", "OCI"],
    )
    assert result == ["AIR FRANCE -KLM", "RANDSTAD NV", "THEON INTERNATIONAL"]


def test_refresh_amsterdam_adapter_maps_official_names_to_symbols():
    instrument_master = {
        "AALB.AS": {"exchange_mic": "XAMS", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "AALB.AS"}},
        "AF.PA": {"exchange_mic": "XPAR", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "AF.PA"}},
        "RAND.AS": {"exchange_mic": "XAMS", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "RAND.AS"}},
        "SBMO.AS": {"exchange_mic": "XAMS", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "SBMO.AS"}},
        "THEON.AS": {"exchange_mic": "XAMS", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "THEON.AS"}},
        "OCI.AS": {"exchange_mic": "XAMS", "currency": "EUR", "provider_symbol_map": {"yahoo_finance": "OCI.AS"}},
    }

    def fake_fetch(url: str) -> str:
        if url == SEPTEMBER_2025_REVIEW_URL:
            return """
            <p><strong>AMX® Composition (ISIN NL0000249274)</strong></p>
            <div class="table-responsive" ><table><tbody>
            <tr><td><strong>Name</strong></td><td><strong>ISIN Code</strong></td></tr>
            <tr><td>AALBERTS NV</td><td>1</td></tr>
            <tr><td>AIR FRANCE -KLM</td><td>2</td></tr>
            <tr><td>OCI</td><td>3</td></tr>
            <tr><td>SBM OFFSHORE</td><td>4</td></tr>
            </tbody></table></div>
            <p><br><strong>AEX® Composition (ISIN NL0000000107)</strong></p>
            <div class="table-responsive" ><table><tbody>
            <tr><td><strong>Name</strong></td><td><strong>ISIN Code</strong></td></tr>
            <tr><td>RANDSTAD NV</td><td>1</td></tr>
            </tbody></table></div>
            """
        if url == MARCH_2026_REVIEW_URL:
            return MARCH_HTML
        raise AssertionError(url)

    result = refresh_amsterdam_from_euronext_review(
        "amsterdam_amx",
        {},
        instrument_master,
        fetch_text=fake_fetch,
    )

    assert result.source_adapter == "euronext_aex_family_review"
    assert [item["symbol"] for item in result.constituents] == [
        "AALB.AS",
        "AF.PA",
        "RAND.AS",
        "THEON.AS",
    ]
