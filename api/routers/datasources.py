"""Data source diagnostics endpoints (read-only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from api.dependencies import get_datasources_service
from api.models.datasources import (
    DataSourcesInventoryOut, SourceDescriptorOut, ProbeResultOut,
    FallbackEventsOut, FallbackEventOut,
)
from api.services.datasources_service import DatasourcesService

router = APIRouter(tags=["datasources"])


def _descriptor_out(descriptor, last_probe) -> SourceDescriptorOut:
    payload = descriptor.to_dict()
    payload["last_probe"] = ProbeResultOut(**last_probe.to_dict()) if last_probe else None
    return SourceDescriptorOut(**payload)


@router.get("", response_model=DataSourcesInventoryOut)
def get_inventory(service: DatasourcesService = Depends(get_datasources_service)) -> DataSourcesInventoryOut:
    sources = [_descriptor_out(d, p) for d, p in service.inventory_with_probes()]
    return DataSourcesInventoryOut(sources=sources)


@router.post("/probe", response_model=list[ProbeResultOut])
def probe_all(service: DatasourcesService = Depends(get_datasources_service)) -> list[ProbeResultOut]:
    return [ProbeResultOut(**r.to_dict()) for r in service.probe_all()]


@router.post("/{source_id}/probe", response_model=ProbeResultOut)
def probe_one(source_id: str, service: DatasourcesService = Depends(get_datasources_service)) -> ProbeResultOut:
    return ProbeResultOut(**service.probe_one(source_id).to_dict())


@router.get("/events", response_model=FallbackEventsOut)
def get_events(
    limit: int = Query(default=100, ge=1, le=200),
    service: DatasourcesService = Depends(get_datasources_service),
) -> FallbackEventsOut:
    return FallbackEventsOut(events=[FallbackEventOut(**e.to_dict()) for e in service.events(limit)])
