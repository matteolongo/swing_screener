from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import io
import logging
import re
import threading
from typing import Any, Optional

import pandas as pd
import httpx

from swing_screener.data.providers.factory import get_default_provider
from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.evidence import (
    build_catalyst_feature_vectors,
    collect_additional_evidence,
    enrich_normalized_events_with_llm,
    events_to_evidence,
    historical_precision_map_from_stats,
    normalize_evidence_records_with_diagnostics,
    resolve_instrument_profiles,
    update_source_quality_stats,
)
from swing_screener.intelligence.ingestion.service import collect_events
from swing_screener.intelligence.models import (
    CatalystSignal,
    EvidenceRecord,
    Event,
    NormalizedEvent,
    Opportunity,
    SymbolState,
    ThemeCluster,
)
from swing_screener.intelligence.reaction import build_catalyst_signals
from swing_screener.intelligence.relations import (
    apply_peer_confirmation,
    detect_theme_clusters,
    load_curated_peer_map,
)
from swing_screener.intelligence.scoring import (
    build_catalyst_score_map_v2,
    build_opportunities,
)
from swing_screener.intelligence.state import update_symbol_states
from swing_screener.intelligence.storage import IntelligenceStorage
from swing_screener.intelligence.llm.factory import build_event_classifier

logger = logging.getLogger(__name__)


def _publish_intelligence_metrics_to_collector(
    *,
    source_health: dict[str, dict[str, Any]],
    deduped_count: int,
) -> None:
    try:
        from api.monitoring import get_metrics_collector

        collector = get_metrics_collector()
        if hasattr(collector, "record_intelligence_metrics"):
            collector.record_intelligence_metrics(
                source_health=source_health,
                deduped_count=deduped_count,
            )
    except Exception:
        return


@dataclass(frozen=True)
class IntelligenceSnapshot:
    asof_date: str
    symbols: tuple[str, ...]
    events: list[Event]
    signals: list[CatalystSignal]
    themes: list[ThemeCluster]
    opportunities: list[Opportunity]
    states: dict[str, SymbolState]
    evidence_records: list[EvidenceRecord]
    normalized_events: list[NormalizedEvent]
    source_health: dict[str, dict[str, Any]]
    dedupe_pre_count: int = 0
    dedupe_post_count: int = 0
    dedupe_ratio: float = 0.0
    events_kept_count: int = 0
    events_dropped_count: int = 0
    duplicate_suppressed_count: int = 0


@dataclass(frozen=True)
class EventQualityDiagnostics:
    kept_count: int
    dropped_count: int
    duplicate_suppressed_count: int


def _normalize_symbols(symbols: list[str] | tuple[str, ...]) -> list[str]:
    mic_to_suffix = {
        "XPAR": ".PA",
        "XAMS": ".AS",
        "XMIL": ".MI",
        "XETR": ".DE",
        "XLON": ".L",
        "XSWX": ".SW",
        "XSTO": ".ST",
        "XMAD": ".MC",
        "XHEL": ".HE",
        "XBRU": ".BR",
    }

    def _canonicalize(raw: str) -> str:
        text = str(raw).strip().upper()
        if not text:
            return ""
        if ":" in text:
            ticker, mic = [part.strip() for part in text.split(":", 1)]
            suffix = mic_to_suffix.get(mic)
            if ticker and suffix:
                return f"{ticker}{suffix}"
            return ticker
        match = re.match(r"^([A-Z0-9\.\-]{1,16})\s+([A-Z0-9]{4})$", text)
        if match:
            ticker = str(match.group(1)).strip().upper()
            mic = str(match.group(2)).strip().upper()
            suffix = mic_to_suffix.get(mic)
            if ticker and suffix and "." not in ticker:
                return f"{ticker}{suffix}"
            return ticker
        return text

    out: list[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        text = _canonicalize(symbol)
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _symbol_aliases(symbol: str) -> tuple[str, ...]:
    text = str(symbol).strip().upper()
    if not text:
        return tuple()
    aliases = [text]
    base = text.split(".", 1)[0]
    if base and base not in aliases:
        aliases.append(base)
    return tuple(aliases)


def _contains_symbol_token(text: str, symbol_token: str) -> bool:
    token = str(symbol_token).strip().upper()
    if not token:
        return False
    if "." in token:
        return token in text
    return bool(re.search(rf"(?<![A-Z0-9]){re.escape(token)}(?![A-Z0-9])", text))


def _parse_secondary_symbols(raw: Any) -> set[str]:
    if raw is None:
        return set()
    if isinstance(raw, str):
        values = [part.strip().upper() for part in raw.split(",")]
    elif isinstance(raw, (list, tuple, set)):
        values = [str(item).strip().upper() for item in raw]
    else:
        values = [str(raw).strip().upper()]
    return {value for value in values if value}


def _event_relevance_score(event: Event) -> float:
    if str(event.source).strip().lower() == "earnings_calendar":
        return 10.0

    aliases = set(_symbol_aliases(event.symbol))
    if not aliases:
        return 0.0

    metadata = event.metadata or {}
    headline = str(event.headline or "")
    summary = str(metadata.get("summary", "") or "")
    llm_summary = str(metadata.get("llm_summary", "") or "")
    text = f"{headline} {summary} {llm_summary}".upper()
    url_text = str(event.url or "").upper()

    score = 0.0
    if any(_contains_symbol_token(text, alias) for alias in aliases):
        score += 2.0
    if any(alias and alias in url_text for alias in aliases):
        score += 1.0

    llm_primary = str(metadata.get("llm_primary_symbol", "")).strip().upper()
    llm_secondary = _parse_secondary_symbols(metadata.get("llm_secondary_symbols"))
    if llm_primary:
        if llm_primary in aliases:
            score += 3.0
        elif llm_primary not in aliases and llm_primary not in llm_secondary:
            score -= 2.5
    if aliases.intersection(llm_secondary):
        score += 1.0

    return score


def _canonical_event_key(event: Event) -> str:
    url = str(event.url or "").strip().lower()
    if url:
        return f"url::{url}"
    headline = " ".join(str(event.headline or "").split()).strip().lower()
    return f"headline::{headline}"


def _looks_transient_provider_error(exc: Exception) -> bool:
    text = str(exc or "").lower()
    markers = (
        "error code: 500",
        "server_error",
        "internal server error",
        "error code: 502",
        "error code: 503",
        "error code: 504",
    )
    return any(marker in text for marker in markers)


def _apply_event_quality_filters(events: list[Event]) -> tuple[list[Event], EventQualityDiagnostics]:
    if not events:
        return [], EventQualityDiagnostics(kept_count=0, dropped_count=0, duplicate_suppressed_count=0)

    relevance_threshold = 1.0
    candidates: list[tuple[Event, float]] = []
    for event in events:
        score = _event_relevance_score(event)
        if score >= relevance_threshold:
            candidates.append((event, score))

    deduped: dict[str, tuple[Event, float]] = {}
    for event, score in candidates:
        key = _canonical_event_key(event)
        current = deduped.get(key)
        if current is None:
            deduped[key] = (event, score)
            continue
        prev_event, prev_score = current
        prev_cred = float(prev_event.credibility)
        next_cred = float(event.credibility)
        if (score, next_cred) > (prev_score, prev_cred):
            deduped[key] = (event, score)

    filtered = [event for event, _score in deduped.values()]
    filtered.sort(key=lambda item: (item.occurred_at, item.event_id), reverse=True)

    duplicate_suppressed = max(0, len(candidates) - len(filtered))
    dropped = max(0, len(events) - len(filtered))
    diagnostics = EventQualityDiagnostics(
        kept_count=len(filtered),
        dropped_count=dropped,
        duplicate_suppressed_count=duplicate_suppressed,
    )
    return filtered, diagnostics


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _severity_to_weight(severity: str) -> float:
    mapping = {"LOW": 0.35, "MEDIUM": 0.7, "HIGH": 1.0}
    return mapping.get(str(severity).strip().upper(), 0.5)


def _build_llm_classifier(cfg: IntelligenceConfig) -> Any | None:
    if not cfg.llm.enabled:
        return None

    try:
        classifier = build_event_classifier(
            provider_name=cfg.llm.provider,
            model=cfg.llm.model,
            base_url=cfg.llm.base_url,
            api_key=None,
            system_prompt=cfg.llm.system_prompt,
            user_prompt_template=cfg.llm.user_prompt_template,
            cache_path=cfg.llm.cache_path,
            audit_path=cfg.llm.audit_path,
            enable_cache=cfg.llm.enable_cache,
            enable_audit=cfg.llm.enable_audit,
        )
        if not classifier.provider.is_available():
            logger.warning(
                "LLM provider '%s' model '%s' unavailable at '%s'; skipping enrichment.",
                cfg.llm.provider,
                cfg.llm.model,
                cfg.llm.base_url,
            )
            return None
        return classifier
    except Exception as exc:
        logger.warning("Failed to initialize LLM classifier, skipping LLM enrichment: %s", exc)
        return None


def _enrich_events_with_llm(
    *,
    events: list[Event],
    cfg: IntelligenceConfig,
    llm_classifier: Any | None = None,
) -> list[Event]:
    classifier = llm_classifier or _build_llm_classifier(cfg)
    if classifier is None:
        return events

    state_lock = threading.Lock()
    transient_error_count = 0
    llm_disabled = False

    def classify_single_event(event: Event) -> Event:
        nonlocal transient_error_count, llm_disabled
        with state_lock:
            skip_llm = llm_disabled
        if skip_llm:
            metadata = dict(event.metadata)
            metadata["llm_skipped"] = "provider_temporarily_unavailable"
            return Event(
                event_id=event.event_id,
                symbol=event.symbol,
                source=event.source,
                occurred_at=event.occurred_at,
                headline=event.headline,
                event_type=event.event_type,
                credibility=event.credibility,
                url=event.url,
                metadata=metadata,
            )

        snippet = str(event.metadata.get("summary", "")).strip()
        try:
            result = classifier.classify(
                headline=event.headline,
                snippet=snippet,
                source=event.source,
                timestamp=event.occurred_at,
            )
            classification = result.classification
            llm_confidence = _clamp01(float(classification.confidence))
            llm_severity = str(classification.severity.value).strip().upper()
            # Non-material events are intentionally capped below full credibility.
            llm_credibility = _clamp01(
                0.45 * llm_confidence
                + 0.45 * _severity_to_weight(llm_severity)
                + (0.1 if bool(classification.is_material) else 0.0)
            )
            blended_credibility = round(_clamp01(0.6 * event.credibility + 0.4 * llm_credibility), 6)

            metadata = dict(event.metadata)
            metadata["llm_event_type"] = str(classification.event_type.value)
            metadata["llm_severity"] = llm_severity
            metadata["llm_confidence"] = round(llm_confidence, 6)
            metadata["llm_is_material"] = bool(classification.is_material)
            metadata["llm_summary"] = str(classification.summary)
            metadata["llm_cached"] = bool(result.cached)
            metadata["llm_model"] = str(result.model_name)
            if classification.primary_symbol:
                metadata["llm_primary_symbol"] = str(classification.primary_symbol)
            if classification.secondary_symbols:
                metadata["llm_secondary_symbols"] = ",".join(
                    str(symbol) for symbol in classification.secondary_symbols
                )

            event_type = str(classification.event_type.value).strip().lower() or event.event_type
            return Event(
                event_id=event.event_id,
                symbol=event.symbol,
                source=event.source,
                occurred_at=event.occurred_at,
                headline=event.headline,
                event_type=event_type,
                credibility=blended_credibility,
                url=event.url,
                metadata=metadata,
            )
        except Exception as exc:  # pragma: no cover - defensive degradation
            headline_preview = " ".join(str(event.headline or "").split())
            if len(headline_preview) > 120:
                headline_preview = f"{headline_preview[:117]}..."
            logger.warning(
                "LLM enrichment failed for event_id=%s symbol=%s source=%s error_type=%s headline=%r error=%s",
                event.event_id,
                event.symbol,
                event.source,
                type(exc).__name__,
                headline_preview,
                exc,
            )
            if _looks_transient_provider_error(exc):
                disable_message = None
                with state_lock:
                    transient_error_count += 1
                    if transient_error_count >= 2 and not llm_disabled:
                        llm_disabled = True
                        disable_message = (
                            "Disabling LLM enrichment for remaining events in this run after repeated provider errors."
                        )
                if disable_message:
                    logger.warning(disable_message)
            metadata = dict(event.metadata)
            metadata["llm_error"] = str(exc)
            metadata["llm_error_type"] = type(exc).__name__
            return Event(
                event_id=event.event_id,
                symbol=event.symbol,
                source=event.source,
                occurred_at=event.occurred_at,
                headline=event.headline,
                event_type=event.event_type,
                credibility=event.credibility,
                url=event.url,
                metadata=metadata,
            )

    max_workers = max(1, int(getattr(cfg.llm, "max_concurrency", 4)))
    if max_workers <= 1 or len(events) <= 1:
        return [classify_single_event(event) for event in events]

    worker_count = min(max_workers, len(events))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        return list(executor.map(classify_single_event, events))


def _normalize_technical(
    symbols: list[str],
    technical_readiness: Optional[dict[str, float]],
) -> dict[str, float]:
    if technical_readiness is None:
        logger.debug(
            "_normalize_technical: no technical_readiness provided, all %d symbol(s) default to 0.5",
            len(symbols),
        )
        return {symbol: 0.5 for symbol in symbols}
    out: dict[str, float] = {}
    for symbol in symbols:
        value = technical_readiness.get(symbol)
        if value is None:
            value = technical_readiness.get(symbol.lower())
        try:
            out[symbol] = max(0.0, min(1.0, float(value if value is not None else 0.5)))
        except (TypeError, ValueError):
            out[symbol] = 0.5
        if value is None:
            logger.debug(
                "_normalize_technical: no value for %s, using fallback 0.5", symbol
            )
    return out


def _fetch_ohlcv(
    symbols: list[str],
    *,
    start_dt: datetime,
    end_dt: datetime,
    ohlcv: Optional[pd.DataFrame] = None,
):
    if ohlcv is not None:
        return ohlcv
    start_date = (start_dt - timedelta(days=45)).date().isoformat()
    end_date = (end_dt + timedelta(days=1)).date().isoformat()
    provider = get_default_provider()
    try:
        return provider.fetch_ohlcv(symbols, start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.warning("Primary OHLCV provider failed, trying Stooq fallback: %s", exc)
        return _fetch_stooq_ohlcv(symbols=symbols, start_date=start_date, end_date=end_date)


def _fetch_stooq_ohlcv(*, symbols: list[str], start_date: str, end_date: str) -> pd.DataFrame:
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)
    series_by_col: dict[tuple[str, str], pd.Series] = {}
    index_union: pd.DatetimeIndex | None = None

    with httpx.Client(timeout=10.0) as client:
        for symbol in symbols:
            query_symbol = str(symbol).strip().lower()
            if not query_symbol:
                continue
            try:
                response = client.get(
                    "https://stooq.com/q/d/l/",
                    params={"s": query_symbol, "i": "d"},
                )
                response.raise_for_status()
                frame = pd.read_csv(
                    io.StringIO(response.text),
                    parse_dates=["Date"],
                )
            except Exception:
                continue

            if frame.empty or "Date" not in frame.columns:
                continue
            frame = frame.rename(columns={c: str(c).strip() for c in frame.columns})
            frame = frame.set_index("Date").sort_index()
            frame = frame[(frame.index >= pd.Timestamp(start_dt)) & (frame.index <= pd.Timestamp(end_dt))]
            if frame.empty:
                continue

            ticker = str(symbol).strip().upper()
            for src, dst in (
                ("Open", "Open"),
                ("High", "High"),
                ("Low", "Low"),
                ("Close", "Close"),
                ("Volume", "Volume"),
            ):
                if src in frame.columns:
                    series_by_col[(dst, ticker)] = frame[src].astype(float)
            index_union = frame.index if index_union is None else index_union.union(frame.index)

    if not series_by_col:
        return pd.DataFrame()
    assert index_union is not None
    out = pd.DataFrame(index=index_union.sort_values())
    for col_key, series in series_by_col.items():
        out[col_key] = series.reindex(out.index)
    out.columns = pd.MultiIndex.from_tuples(list(series_by_col.keys()))
    return out


def run_intelligence_pipeline(
    *,
    symbols: list[str] | tuple[str, ...],
    cfg: IntelligenceConfig,
    technical_readiness: Optional[dict[str, float]] = None,
    asof_dt: Optional[datetime] = None,
    storage: Optional[IntelligenceStorage] = None,
    ohlcv: Optional[pd.DataFrame] = None,
    peer_map: Optional[dict[str, tuple[str, ...]]] = None,
    llm_classifier: Any | None = None,
) -> IntelligenceSnapshot:
    if asof_dt is None:
        now = datetime.utcnow()
    elif asof_dt.tzinfo is None:
        now = asof_dt
    else:
        now = asof_dt.astimezone(UTC).replace(tzinfo=None)
    asof_date = now.date().isoformat()
    symbols_clean = _normalize_symbols(list(symbols))
    storage = storage or IntelligenceStorage()

    if not symbols_clean:
        return IntelligenceSnapshot(
            asof_date=asof_date,
            symbols=tuple(),
            events=[],
            signals=[],
            themes=[],
            opportunities=[],
            states=storage.load_symbol_state(),
            evidence_records=[],
            normalized_events=[],
            source_health={},
            events_kept_count=0,
            events_dropped_count=0,
            duplicate_suppressed_count=0,
        )

    start_dt = now - timedelta(hours=cfg.catalyst.lookback_hours)
    events = collect_events(
        symbols=symbols_clean,
        start_dt=start_dt,
        end_dt=now,
        provider_names=list(cfg.providers),
    )
    raw_events = list(events)
    pre_llm_events, pre_llm_quality = _apply_event_quality_filters(raw_events)
    enriched_events = _enrich_events_with_llm(events=pre_llm_events, cfg=cfg, llm_classifier=llm_classifier)
    events, post_llm_quality = _apply_event_quality_filters(enriched_events)
    event_quality = EventQualityDiagnostics(
        kept_count=len(events),
        dropped_count=max(0, len(raw_events) - len(events)),
        duplicate_suppressed_count=(
            int(pre_llm_quality.duplicate_suppressed_count)
            + int(post_llm_quality.duplicate_suppressed_count)
        ),
    )

    profiles = resolve_instrument_profiles(symbols_clean)
    additional_records, additional_health = collect_additional_evidence(
        symbols=symbols_clean,
        profiles=profiles,
        start_dt=start_dt,
        end_dt=now,
        cfg=cfg.sources,
    )
    evidence_records = events_to_evidence(events) + additional_records
    previous_quality_stats = storage.load_source_quality_stats()
    historical_precision = historical_precision_map_from_stats(previous_quality_stats)
    normalized_events, normalize_diag = normalize_evidence_records_with_diagnostics(
        evidence_records,
        asof_dt=now,
        historical_precision_by_source=historical_precision,
    )
    profile_index: dict[str, Any] = {}
    for profile in profiles.values():
        profile_index[str(profile.symbol).strip().upper()] = profile
        for alias in profile.aliases:
            key = str(alias).strip().upper()
            if key and key not in profile_index:
                profile_index[key] = profile
    normalized_events = [
        NormalizedEvent(
            event_id=event.event_id,
            symbol=event.symbol,
            event_type=event.event_type,
            event_subtype=event.event_subtype,
            timing_type=event.timing_type,
            materiality=event.materiality,
            confidence=event.confidence,
            primary_source_reliability=event.primary_source_reliability,
            confirmation_count=event.confirmation_count,
            published_at=event.published_at,
            event_at=event.event_at,
            source_name=event.source_name,
            raw_url=event.raw_url,
            llm_fields=event.llm_fields,
            dynamic_source_quality=event.dynamic_source_quality,
            resolution_source=(
                getattr(profile_index.get(event.symbol), "resolution_source", None)
                or event.resolution_source
                or "heuristic"
            ),
            dedupe_method=event.dedupe_method,
        )
        for event in normalized_events
    ]
    normalized_events = enrich_normalized_events_with_llm(
        events=normalized_events,
        cfg=cfg,
        llm_classifier=llm_classifier,
    )
    source_quality_stats = update_source_quality_stats(
        previous_stats=previous_quality_stats,
        normalized_events=normalized_events,
        asof_dt=now,
    )
    source_health: dict[str, dict[str, Any]] = {}
    source_event_counts: dict[str, int] = {}
    source_symbol_coverage: dict[str, set[str]] = {}
    source_confidence_sums: dict[str, float] = {}
    for record in evidence_records:
        source_name = str(record.source_name).strip().lower()
        source_event_counts[source_name] = source_event_counts.get(source_name, 0) + 1
        source_symbol_coverage.setdefault(source_name, set()).add(str(record.symbol).strip().upper())
    for event in normalized_events:
        source_name = str(event.source_name).strip().lower()
        source_confidence_sums[source_name] = source_confidence_sums.get(source_name, 0.0) + float(event.confidence)
    for source_name, count in source_event_counts.items():
        symbols_count = len(source_symbol_coverage.get(source_name, set()))
        coverage_ratio = 0.0 if not symbols_clean else float(symbols_count) / float(len(symbols_clean))
        mean_confidence = 0.0 if count <= 0 else float(source_confidence_sums.get(source_name, 0.0)) / float(count)
        source_health[source_name] = {
            "source_name": source_name,
            "enabled": True,
            "status": "ok",
            "latency_ms": 0.0,
            "error_count": 0,
            "event_count": int(count),
            "error_rate": 0.0,
            "blocked_count": 0,
            "blocked_reasons": [],
            "coverage_ratio": round(coverage_ratio, 6),
            "mean_confidence": round(max(0.0, min(1.0, mean_confidence)), 6),
            "last_ingest": now.replace(microsecond=0).isoformat(),
        }
    for source_name, health_obj in additional_health.items():
        current = source_health.get(source_name, {})
        payload = health_obj.to_dict()
        payload["event_count"] = int(payload.get("event_count", 0)) + int(current.get("event_count", 0))
        total = int(payload.get("event_count", 0)) + int(payload.get("error_count", 0))
        payload["error_rate"] = 0.0 if total <= 0 else round(float(payload["error_count"]) / float(total), 6)
        payload["coverage_ratio"] = current.get("coverage_ratio", payload.get("coverage_ratio", 0.0))
        payload["mean_confidence"] = current.get("mean_confidence", payload.get("mean_confidence", 0.0))
        source_health[source_name] = payload

    coverage_global = 0.0
    if symbols_clean:
        symbols_with_events = {str(event.symbol).strip().upper() for event in normalized_events if str(event.symbol).strip()}
        coverage_global = float(len(symbols_with_events)) / float(len(symbols_clean))
    mean_conf_global = 0.0
    if normalized_events:
        mean_conf_global = sum(float(event.confidence) for event in normalized_events) / float(len(normalized_events))
    intelligence_metrics = {
        "asof_date": asof_date,
        "coverage_global": round(max(0.0, min(1.0, coverage_global)), 6),
        "mean_confidence_global": round(max(0.0, min(1.0, mean_conf_global)), 6),
        "dedupe_ratio": round(float(normalize_diag.dedupe_ratio), 6),
        "events_per_source": {source: int(count) for source, count in sorted(source_event_counts.items())},
    }

    ohlcv_data = _fetch_ohlcv(symbols_clean, start_dt=start_dt, end_dt=now, ohlcv=ohlcv)
    raw_signals = build_catalyst_signals(events=events, ohlcv=ohlcv_data, cfg=cfg.catalyst, asof_dt=now)

    resolved_peer_map = peer_map if peer_map is not None else load_curated_peer_map(cfg.theme.curated_peer_map_path)
    signals = apply_peer_confirmation(raw_signals, resolved_peer_map, min_return_z=cfg.catalyst.false_catalyst_return_z)
    themes = detect_theme_clusters(
        signals,
        resolved_peer_map,
        cfg=cfg.theme,
        min_return_z=cfg.catalyst.false_catalyst_return_z,
        theme_prefix=f"{asof_date}-theme",
    )

    previous_states = storage.load_symbol_state()
    states = update_symbol_states(previous_states=previous_states, signals=signals, themes=themes, asof_dt=now)
    feature_vectors = build_catalyst_feature_vectors(
        symbols=symbols_clean,
        normalized_events=normalized_events,
        asof_dt=now,
    )
    catalyst_scores = build_catalyst_score_map_v2(
        signals=signals,
        events=events,
        themes=themes,
        feature_vectors=feature_vectors,
        scoring_cfg=cfg.scoring_v2,
        recency_half_life_hours=cfg.catalyst.recency_half_life_hours,
    )
    technical = _normalize_technical(symbols_clean, technical_readiness)
    opportunities = build_opportunities(
        technical_readiness=technical,
        catalyst_scores=catalyst_scores,
        symbol_states=states,
        cfg=cfg.opportunity,
        feature_vectors=feature_vectors,
        scoring_cfg=cfg.scoring_v2,
        calendar_cfg=cfg.calendar,
    )

    storage.write_events(events, asof_date)
    storage.write_evidence(evidence_records, asof_date)
    storage.write_normalized_events(normalized_events, asof_date)
    storage.write_signals(signals, asof_date)
    storage.write_themes(themes, asof_date)
    storage.write_opportunities(opportunities, asof_date)
    storage.write_symbol_state(states.values())
    storage.write_source_health(source_health)
    storage.write_source_quality_stats(source_quality_stats)
    storage.write_intelligence_metrics(intelligence_metrics)
    _publish_intelligence_metrics_to_collector(
        source_health=source_health,
        deduped_count=max(0, normalize_diag.pre_dedupe_count - normalize_diag.post_dedupe_count),
    )

    return IntelligenceSnapshot(
        asof_date=asof_date,
        symbols=tuple(symbols_clean),
        events=events,
        signals=signals,
        themes=themes,
        opportunities=opportunities,
        states=states,
        evidence_records=evidence_records,
        normalized_events=normalized_events,
        source_health=source_health,
        dedupe_pre_count=normalize_diag.pre_dedupe_count,
        dedupe_post_count=normalize_diag.post_dedupe_count,
        dedupe_ratio=normalize_diag.dedupe_ratio,
        events_kept_count=event_quality.kept_count,
        events_dropped_count=event_quality.dropped_count,
        duplicate_suppressed_count=event_quality.duplicate_suppressed_count,
    )
