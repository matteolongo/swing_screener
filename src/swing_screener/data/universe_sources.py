from __future__ import annotations

import datetime as dt
import html
import json
import re
from dataclasses import dataclass
from typing import Callable, Iterable
from urllib.error import URLError
from urllib.request import Request, urlopen


SEPTEMBER_2025_REVIEW_URL = (
    "https://www.euronext.com/en/about/media/euronext-press-releases/"
    "euronext-announces-september-2025-review-results-aexr-family"
)
MARCH_2026_REVIEW_URL = (
    "https://www.euronext.com/en/about/media/euronext-press-releases/"
    "euronext-announces-march-2026-annual-review-results-aexr-family"
)


def normalize_company_name(value: str) -> str:
    text = html.unescape(str(value or "")).replace("\xa0", " ").strip().upper()
    text = text.replace("’", "'")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


EURONEXT_COMPANY_TO_SYMBOL: dict[str, str] = {
    normalize_company_name("ABN AMRO BANK N.V."): "ABN.AS",
    normalize_company_name("ADYEN"): "ADYEN.AS",
    normalize_company_name("AEGON"): "AGN.AS",
    normalize_company_name("AHOLD DEL"): "AD.AS",
    normalize_company_name("AKZO NOBEL"): "AKZA.AS",
    normalize_company_name("ARCELORMITTAL SA"): "MT.AS",
    normalize_company_name("ASM INTERNATIONAL"): "ASM.AS",
    normalize_company_name("ASML HOLDING"): "ASML.AS",
    normalize_company_name("ASR NEDERLAND"): "ASRNL.AS",
    normalize_company_name("BE SEMICONDUCTOR"): "BESI.AS",
    normalize_company_name("CVC CAPITAL"): "CVC.AS",
    normalize_company_name("DSM FIRMENICH AG"): "DSFIR.AS",
    normalize_company_name("EXOR NV"): "EXO.AS",
    normalize_company_name("HEINEKEN"): "HEIA.AS",
    normalize_company_name("IMCD"): "IMCD.AS",
    normalize_company_name("ING GROEP N.V."): "INGA.AS",
    normalize_company_name("INPOST"): "INPST.AS",
    normalize_company_name("JDE PEET'S"): "JDEP.AS",
    normalize_company_name("JUST EAT TAKEAWAY"): "TKWY.AS",
    normalize_company_name("KPN KON"): "KPN.AS",
    normalize_company_name("NN GROUP"): "NN.AS",
    normalize_company_name("PHILIPS KON"): "PHIA.AS",
    normalize_company_name("PROSUS"): "PRX.AS",
    normalize_company_name("RANDSTAD NV"): "RAND.AS",
    normalize_company_name("RELX"): "REN.AS",
    normalize_company_name("SBM OFFSHORE"): "SBMO.AS",
    normalize_company_name("SHELL PLC"): "SHELL.AS",
    normalize_company_name("UMG"): "UMG.AS",
    normalize_company_name("UNILEVER"): "UNA.AS",
    normalize_company_name("WDP"): "WDP.AS",
    normalize_company_name("WOLTERS KLUWER"): "WKL.AS",
    normalize_company_name("AALBERTS NV"): "AALB.AS",
    normalize_company_name("AIR FRANCE -KLM"): "AF.PA",
    normalize_company_name("ALLFUNDS GROUP"): "ALLFG.AS",
    normalize_company_name("AMG"): "AMG.AS",
    normalize_company_name("APERAM"): "APAM.AS",
    normalize_company_name("ARCADIS"): "ARCAD.AS",
    normalize_company_name("BAM GROEP KON"): "BAMNB.AS",
    normalize_company_name("BASIC-FIT"): "BFIT.AS",
    normalize_company_name("CORBION"): "CRBN.AS",
    normalize_company_name("CTP"): "CTPNV.AS",
    normalize_company_name("EUROCOMMERCIAL"): "ECMPA.AS",
    normalize_company_name("FAGRON"): "FAGR.AS",
    normalize_company_name("FLOW TRADERS"): "FLOW.AS",
    normalize_company_name("FUGRO"): "FUR.AS",
    normalize_company_name("GALAPAGOS"): "GLPG.AS",
    normalize_company_name("HAL TRUST"): "HAL.AS",
    normalize_company_name("HAVAS"): "HAVAS.AS",
    normalize_company_name("HEIJMANS KON"): "HEIJM.AS",
    normalize_company_name("PHARMING GROUP"): "PHARM.AS",
    normalize_company_name("SIGNIFY NV"): "LIGHT.AS",
    normalize_company_name("THEON INTERNATIONAL"): "THEON.AS",
    normalize_company_name("THEON INTERNAT"): "THEON.AS",
    normalize_company_name("TKH GROUP"): "TWEKA.AS",
    normalize_company_name("V LANSCHOT KEMPEN"): "VLK.AS",
    normalize_company_name("VOPAK"): "VPK.AS",
}


class UniverseSourceError(RuntimeError):
    pass


@dataclass(frozen=True)
class UniverseSourceResult:
    source_adapter: str
    source_asof: str
    source_documents: list[dict]
    constituents: list[dict]
    notes: list[str]


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read()
    except URLError as exc:  # pragma: no cover - network failures depend on env
        raise UniverseSourceError(f"Failed to fetch source document: {url}") from exc
    return raw.decode("utf-8", errors="ignore")


def _clean_cell(cell_html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", cell_html)
    text = html.unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def _extract_table_after_marker(page_text: str, marker_pattern: str) -> list[list[str]]:
    match = re.search(marker_pattern, page_text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        raise UniverseSourceError(f"Could not find source section matching: {marker_pattern}")
    tbody = match.group(1)
    rows = re.findall(r"<tr>(.*?)</tr>", tbody, flags=re.IGNORECASE | re.DOTALL)
    parsed: list[list[str]] = []
    for row in rows:
        cells = [
            _clean_cell(cell)
            for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.IGNORECASE | re.DOTALL)
        ]
        if cells:
            parsed.append(cells)
    return parsed


def _extract_composition_rows(page_text: str, index_name: str) -> list[str]:
    rows = _extract_table_after_marker(
        page_text,
        rf"{index_name}[^<]*Composition\s+\(ISIN.*?</p>\s*<div class=\"table-responsive\" >\s*<table.*?<tbody>(.*?)</tbody>",
    )
    names: list[str] = []
    for row in rows:
        if not row:
            continue
        name = row[0]
        if normalize_company_name(name) == "NAME":
            continue
        names.append(name)
    if not names:
        raise UniverseSourceError(f"No composition rows found for {index_name}")
    return names


def _extract_delta_rows(page_text: str, index_name: str) -> tuple[list[str], list[str]]:
    rows = _extract_table_after_marker(
        page_text,
        rf"<p><strong>{index_name}.*?</p>\s*<div class=\"table-responsive\" >\s*<table.*?<tbody>(.*?)</tbody>",
    )
    additions: list[str] = []
    removals: list[str] = []
    for row in rows:
        if len(row) < 2:
            continue
        if "INCLUSION OF" in normalize_company_name(row[0]):
            continue
        if row[0]:
            additions.append(row[0])
        if row[1]:
            removals.append(row[1])
    return additions, removals


def _apply_delta(base_names: Iterable[str], additions: Iterable[str], removals: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen = set()
    removed = {normalize_company_name(name) for name in removals}
    for name in base_names:
        normalized = normalize_company_name(name)
        if normalized in removed:
            continue
        if normalized not in seen:
            out.append(name)
            seen.add(normalized)
    for name in additions:
        normalized = normalize_company_name(name)
        if normalized not in seen:
            out.append(name)
            seen.add(normalized)
    return out


def _build_constituents(names: Iterable[str], instrument_master: dict[str, dict]) -> list[dict]:
    constituents: list[dict] = []
    for name in names:
        normalized = normalize_company_name(name)
        symbol = EURONEXT_COMPANY_TO_SYMBOL.get(normalized)
        if not symbol:
            raise UniverseSourceError(f"No symbol mapping configured for '{name}'")
        rec = instrument_master.get(symbol)
        if rec is None:
            raise UniverseSourceError(f"Instrument master is missing '{symbol}' for '{name}'")
        provider_symbol_map = dict(rec.get("provider_symbol_map") or {})
        source_symbol = provider_symbol_map.get("yahoo_finance", symbol).split(".")[0]
        constituents.append(
            {
                "symbol": symbol,
                "exchange_mic": rec.get("exchange_mic"),
                "currency": rec.get("currency"),
                "source_name": _clean_cell(name),
                "source_symbol": source_symbol,
            }
        )
    return constituents


def refresh_amsterdam_from_euronext_review(
    universe_id: str,
    current_snapshot: dict,
    instrument_master: dict[str, dict],
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> UniverseSourceResult:
    september_text = fetch_text(SEPTEMBER_2025_REVIEW_URL)
    march_text = fetch_text(MARCH_2026_REVIEW_URL)

    aex_base = _extract_composition_rows(september_text, "AEX")
    amx_base = _extract_composition_rows(september_text, "AMX")
    aex_add, aex_remove = _extract_delta_rows(march_text, "AEX")
    amx_add, amx_remove = _extract_delta_rows(march_text, "AMX")

    aex_names = _apply_delta(aex_base, aex_add, aex_remove)
    amx_names = _apply_delta(amx_base, amx_add, amx_remove)

    if universe_id == "amsterdam_aex":
        names = aex_names
        notes = [
            "Built from the official September 2025 AEX composition table plus the March 2026 annual review delta.",
        ]
    elif universe_id == "amsterdam_amx":
        names = amx_names
        notes = [
            "Built from the official September 2025 AMX composition table plus the March 2026 annual review delta.",
            "Official AMX composition includes AIR FRANCE-KLM (mnemonic AF), which resolves to the local provider symbol AF.PA.",
        ]
    elif universe_id == "amsterdam_all":
        names = aex_names + [name for name in amx_names if normalize_company_name(name) not in {normalize_company_name(value) for value in aex_names}]
        notes = [
            "Built from official AEX and AMX review sources and merged into one Amsterdam index-family basket.",
        ]
    else:
        raise UniverseSourceError(f"Unsupported universe for Euronext adapter: {universe_id}")

    constituents = _build_constituents(names, instrument_master)
    return UniverseSourceResult(
        source_adapter="euronext_aex_family_review",
        source_asof="2026-03-23",
        source_documents=[
            {
                "label": "Euronext September 2025 review results",
                "url": SEPTEMBER_2025_REVIEW_URL,
            },
            {
                "label": "Euronext March 2026 annual review results",
                "url": MARCH_2026_REVIEW_URL,
            },
        ],
        constituents=constituents,
        notes=notes,
    )


def manual_snapshot_result(current_snapshot: dict) -> UniverseSourceResult:
    return UniverseSourceResult(
        source_adapter="manual_snapshot",
        source_asof=str(current_snapshot.get("source_asof") or ""),
        source_documents=list(current_snapshot.get("source_documents") or []),
        constituents=list(current_snapshot.get("constituents") or []),
        notes=["This universe is manually curated and has no remote refresh adapter configured."],
    )


def refresh_snapshot_from_source(
    universe_id: str,
    current_snapshot: dict,
    instrument_master: dict[str, dict],
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> UniverseSourceResult:
    adapter = str(current_snapshot.get("source_adapter") or "manual_snapshot").strip().lower()
    if adapter == "euronext_aex_family_review":
        return refresh_amsterdam_from_euronext_review(
            universe_id,
            current_snapshot,
            instrument_master,
            fetch_text=fetch_text,
        )
    return manual_snapshot_result(current_snapshot)


def build_refreshed_snapshot(
    universe_id: str,
    current_snapshot: dict,
    instrument_master: dict[str, dict],
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> dict:
    source_result = refresh_snapshot_from_source(
        universe_id,
        current_snapshot,
        instrument_master,
        fetch_text=fetch_text,
    )
    proposed = json.loads(json.dumps(current_snapshot))
    proposed["constituents"] = source_result.constituents
    proposed["source_asof"] = source_result.source_asof
    proposed["source_adapter"] = source_result.source_adapter
    proposed["source_documents"] = source_result.source_documents
    proposed["last_reviewed_at"] = dt.date.today().isoformat()
    rules = dict(proposed.get("rules") or {})
    exchange_mics = sorted(
        {
            str(item.get("exchange_mic", "")).upper()
            for item in source_result.constituents
            if item.get("exchange_mic")
        }
    )
    currencies = sorted(
        {
            str(item.get("currency", "")).upper()
            for item in source_result.constituents
            if item.get("currency")
        }
    )
    if exchange_mics:
        rules["exchange_mics"] = exchange_mics
    if currencies:
        rules["currencies"] = currencies
    proposed["rules"] = rules
    return proposed
