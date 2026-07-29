"""FastAPI main application for Swing Screener."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
from swing_screener.errors import DomainError
from swing_screener.settings import get_settings_manager
from swing_screener.settings.migration import migrate_legacy_config_to_yaml
from swing_screener.runtime_env import ensure_runtime_env_loaded
from swing_screener.version import get_version

# Import routers
from api.routers import (
    auth,
    backtest,
    calendar,
    cache as cache_router,
    config,
    daily_review,
    datasources,
    fundamentals,
    intelligence,
    market_data,
    pool as pool_router,
    portfolio,
    screener,
    screener_history,
    strategy,
    universes,
    watchlist,
    weekly_reviews,
)
from api.security.middleware import RateLimitMiddleware, SecurityBoundaryMiddleware
from api.security.openapi import install_security_openapi
from api.security.settings import get_auth_settings
from api.db.readiness import check_database_readiness
from api.dependencies import get_database_runtime
from api.monitoring import HealthChecker

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, stream=sys.stdout)
logger = logging.getLogger("swing_screener.api")

# yfinance logs ERROR for expected "ticker not found" situations (delisted symbols,
# missing timezone). Our provider already logs these as WARNING with a useful summary.
# Silence yfinance below CRITICAL to avoid duplicate noise in the output.
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
# httpx logs full request URLs at INFO, including provider API tokens passed as
# query params by upstream APIs. Keep those out of application logs.
logging.getLogger("httpx").setLevel(logging.WARNING)

ensure_runtime_env_loaded()
AUTH_SETTINGS = get_auth_settings()

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_USER_DOC = get_settings_manager().load_user_document()
_API_SETTINGS = _USER_DOC.get("api", {}) if isinstance(_USER_DOC.get("api", {}), dict) else {}
_DEFAULT_WEB_UI_DIST = get_settings_manager().resolve_runtime_path("web_ui_dist_dir", PROJECT_ROOT / "web-app" / "dist")
WEB_UI_DIST_DIR = Path(os.getenv("WEB_UI_DIST_DIR", str(_DEFAULT_WEB_UI_DIST))).resolve()
WEB_UI_INDEX_FILE = WEB_UI_DIST_DIR / "index.html"


def _is_truthy(value: str | None) -> bool:
    """Parse common truthy env var values."""
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_web_ui_mode() -> str:
    """Return configured web UI serving mode: auto, enabled, disabled."""
    raw = os.getenv("SERVE_WEB_UI")
    if raw is None or raw.strip() == "":
        raw = str(_API_SETTINGS.get("serve_web_ui", "auto"))
    if raw.strip().lower() == "auto":
        return "auto"
    if _is_truthy(raw):
        return "enabled"
    return "disabled"


def should_serve_web_ui() -> bool:
    """Serve SPA when enabled/auto and build artifacts are present."""
    mode = _get_web_ui_mode()
    if mode == "disabled":
        return False
    return WEB_UI_INDEX_FILE.exists()


def _resolve_spa_file(path: str) -> Path | None:
    """
    Resolve requested SPA file under dist safely.

    Returns index.html for client-side routes.
    """
    normalized = path.strip("/")
    if not normalized:
        return WEB_UI_INDEX_FILE

    candidate = (WEB_UI_DIST_DIR / normalized).resolve()
    try:
        candidate.relative_to(WEB_UI_DIST_DIR)
    except ValueError:
        return None

    if candidate.is_file():
        return candidate
    return WEB_UI_INDEX_FILE


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    AUTH_SETTINGS.validate_runtime()
    try:
        migration_actions = migrate_legacy_config_to_yaml()
        for action in migration_actions:
            logger.info("Config migration: %s", action)
    except Exception:
        logger.exception("Failed to migrate legacy JSON configuration to YAML")
    try:
        database_runtime = get_database_runtime()
        database_readiness = check_database_readiness(database_runtime)
    except Exception as exc:
        logger.error(
            "Portfolio database startup failed: exception=%s", type(exc).__name__
        )
        raise RuntimeError("Portfolio database startup failed.") from None
    if not database_readiness.healthy:
        logger.error(
            "Portfolio database is not ready: checks=%s",
            database_readiness.checks,
        )
        raise RuntimeError("Portfolio database is not ready.")
    app.state.database_runtime = database_runtime
    logger.info("Swing Screener API starting up...")
    logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("OpenAPI schema: http://localhost:8000/openapi.json")
    mode = _get_web_ui_mode()
    index_exists = WEB_UI_INDEX_FILE.exists()
    logger.info(
        "Web UI mode=%s, index_exists=%s, path=%s",
        mode,
        index_exists,
        WEB_UI_INDEX_FILE,
    )
    if should_serve_web_ui():
        logger.info("Serving web UI from %s", WEB_UI_DIST_DIR)
    elif mode == "enabled":
        logger.warning(
            "SERVE_WEB_UI is enabled but %s is missing; API-only mode is active.",
            WEB_UI_INDEX_FILE,
        )
    try:
        yield
    finally:
        database_runtime.engine.dispose()
        logger.info("Shutting down...")


def register_domain_error_handler(target_app) -> None:
    """Translate DomainError subclasses to HTTP responses (status from err.http_status)."""

    @target_app.exception_handler(DomainError)
    async def _domain_error_handler(request, exc: DomainError):  # noqa: ANN001
        return JSONResponse(status_code=exc.http_status, content={"detail": exc.detail})


app = FastAPI(
    title="Swing Screener API",
    description="REST API for the Swing Screener trading system",
    version=get_version(),
    lifespan=lifespan,
    docs_url="/docs" if AUTH_SETTINGS.api_docs_enabled else None,
    redoc_url="/redoc" if AUTH_SETTINGS.api_docs_enabled else None,
    openapi_url="/openapi.json" if AUTH_SETTINGS.api_docs_enabled else None,
)
app.state.auth_settings = AUTH_SETTINGS
register_domain_error_handler(app)

_DEFAULT_ALLOW_ORIGINS = ["http://localhost:5173", "http://localhost:5174"]
_raw_allow_origins = _API_SETTINGS.get("allow_origins", _DEFAULT_ALLOW_ORIGINS)
if isinstance(_raw_allow_origins, list):
    _allow_origins: list[str] = [str(o) for o in _raw_allow_origins if o]
    if not _allow_origins:
        _allow_origins = _DEFAULT_ALLOW_ORIGINS
else:
    _allow_origins = _DEFAULT_ALLOW_ORIGINS

app.add_middleware(RateLimitMiddleware, settings=AUTH_SETTINGS)
app.add_middleware(SecurityBoundaryMiddleware, settings=AUTH_SETTINGS)
app.add_middleware(
    SessionMiddleware,
    secret_key=AUTH_SETTINGS.session_secret,
    session_cookie=AUTH_SETTINGS.session_cookie_name,
    max_age=AUTH_SETTINGS.session_ttl_seconds,
    same_site="lax",
    https_only=AUTH_SETTINGS.session_cookie_secure,
)
# Register CORS last so browser-visible headers cover security/rate-limit errors.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "X-Requested-With",
        "X-CSRF-Token",
        "Idempotency-Key",
    ],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler - masks error details for security."""
    from fastapi import HTTPException
    from pydantic import ValidationError
    from api.monitoring import get_metrics_collector
    
    # Preserve HTTPException status codes and messages (these are intentional)
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    
    # Preserve Pydantic validation errors (user input errors)
    if isinstance(exc, ValidationError):
        get_metrics_collector().record_validation_failure()
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()},
        )
    
    # For unexpected errors: log full details server-side, return generic message
    logger.exception(
        "Unhandled API error on %s %s",
        request.method,
        request.url.path,
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred. Please contact support if the issue persists.",
        },
    )


@app.get("/")
async def root():
    """Root endpoint: serve SPA when enabled, otherwise API health check."""
    if should_serve_web_ui():
        return FileResponse(WEB_UI_INDEX_FILE)

    return {
        "status": "ok",
        "service": "swing-screener-api",
        "version": "3.0.0",
        "api": "/api",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/api")
async def api_root():
    """API root endpoint for same-origin deployments."""
    return {
        "status": "ok",
        "service": "swing-screener-api",
        "version": "3.0.0",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health/live")
async def liveness():
    """Return process liveness without touching protected dependencies."""
    return {"status": "alive"}


@app.get("/health")
@app.get("/health/ready")
async def health_check():
    """Return readiness for SQL state and the frozen legacy source files."""
    from api.monitoring import get_metrics_collector

    metrics = get_metrics_collector().get_metrics()
    legacy_state = HealthChecker.check_file_access()
    try:
        readiness = check_database_readiness(get_database_runtime())
    except Exception as exc:
        logger.warning(
            "Portfolio database readiness failed: exception=%s", type(exc).__name__
        )
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "checks": {
                    "database": {
                        "connectivity": "error",
                        "migration": "unknown",
                        "legacy_import": "unknown",
                    },
                    "legacy_state": legacy_state,
                },
                "details": {
                    "database": "Portfolio database is unavailable.",
                    **(
                        {"legacy_state": "; ".join(legacy_state["issues"])}
                        if legacy_state["issues"]
                        else {}
                    ),
                },
                "metrics": metrics,
            },
        )

    healthy = readiness.healthy and legacy_state["status"] == "healthy"
    details = dict(readiness.details)
    if legacy_state["issues"]:
        details["legacy_state"] = "; ".join(legacy_state["issues"])
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "checks": {
                "database": readiness.checks,
                "legacy_state": legacy_state,
            },
            "details": details or None,
            "metrics": metrics,
        },
    )


@app.get("/metrics")
async def metrics():
    """
    Metrics endpoint for monitoring.
    
    Returns:
        - uptime_seconds: time since API started
        - lock_contention_total: number of times file lock acquisition timed out
        - validation_failures_total: number of Pydantic validation errors (422 status)
    """
    from api.monitoring import get_metrics_collector

    return get_metrics_collector().get_metrics()


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(calendar.router, prefix="/api", tags=["calendar"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])
app.include_router(screener.router, prefix="/api/screener", tags=["screener"])
app.include_router(screener_history.router, prefix="/api/screener", tags=["screener"])
app.include_router(universes.router, prefix="/api/universes", tags=["universes"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(fundamentals.router, prefix="/api/fundamentals", tags=["fundamentals"])
app.include_router(intelligence.router, prefix="/api", tags=["intelligence"])
app.include_router(daily_review.router, prefix="/api", tags=["daily-review"])
app.include_router(datasources.router, prefix="/api/datasources", tags=["datasources"])
app.include_router(market_data.router, prefix="/api", tags=["market-data"])
app.include_router(weekly_reviews.router, prefix="/api/weekly-reviews", tags=["weekly-reviews"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["backtest"])
app.include_router(cache_router.router, prefix="/api/cache", tags=["cache"])
app.include_router(pool_router.router, prefix="/api/pool", tags=["pool"])

install_security_openapi(app, cookie_name=AUTH_SETTINGS.session_cookie_name)


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def spa_fallback(full_path: str):
    """Serve SPA routes from the built web UI in single-app deployments."""
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    if not should_serve_web_ui():
        raise HTTPException(status_code=404, detail="Not Found")

    target = _resolve_spa_file(full_path)
    if target is None or not target.exists():
        raise HTTPException(status_code=404, detail="Not Found")

    return FileResponse(target)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
