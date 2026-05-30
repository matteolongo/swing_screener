from api.models.portfolio import (
    DegiroAvailabilityMode,
    DegiroStatus,
    DegiroOrder,
    DegiroOrdersResponse,
    FillFromDegiroRequest,
    FillFromDegiroResponse,
    DegiroSyncRequest,
    SyncDiffResponse,
    DegiroSyncPreviewResponse,
    DegiroApplyResponse,
)

def test_degiro_models_importable():
    r = DegiroSyncRequest(from_date="2026-01-01", to_date="2026-05-01")
    assert r.include_portfolio is True
    s = DegiroStatus(
        installed=True, credentials_configured=True,
        available=True, mode="ready", detail="ok"
    )
    assert s.available is True
