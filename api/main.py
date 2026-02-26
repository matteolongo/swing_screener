"""FastAPI main application for Swing Screener."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager

# Import routers
from api.routers import (
    config,
    daily_review,
    intelligence,
    portfolio,
    screener,
    social,
    strategy,
)

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, stream=sys.stdout)
logger = logging.getLogger("swing_screener.api")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WEB_UI_DIST_DIR = Path(os.getenv("WEB_UI_DIST_DIR", str(PROJECT_ROOT / "web-ui" / "dist"))).resolve()
WEB_UI_INDEX_FILE = WEB_UI_DIST_DIR / "index.html"


def _is_truthy(value: str | None) -> bool:
    """Parse common truthy env var values."""
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def should_serve_web_ui() -> bool:
    """Enable SPA serving only when explicitly requested and build is present."""
    return _is_truthy(os.getenv("SERVE_WEB_UI")) and WEB_UI_INDEX_FILE.exists()


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
    logger.info("Swing Screener API starting up...")
    logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("OpenAPI schema: http://localhost:8000/openapi.json")
    if should_serve_web_ui():
        logger.info("Serving web UI from %s", WEB_UI_DIST_DIR)
    elif _is_truthy(os.getenv("SERVE_WEB_UI")):
        logger.warning(
            "SERVE_WEB_UI is enabled but %s is missing; API-only mode is active.",
            WEB_UI_INDEX_FILE,
        )
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Swing Screener API",
    description="REST API for the Swing Screener trading system",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware - allow web UI to connect
# Security: Use explicit allowed methods and headers instead of wildcards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Vite dev servers
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Explicit instead of ["*"]
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "X-Requested-With",
    ],  # Explicit instead of ["*"]
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
        "version": "0.1.0",
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
        "version": "0.1.0",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        - status: overall health (healthy, degraded, unhealthy)
        - checks: individual component checks
        - uptime: time since API started
    """
    from api.monitoring import HealthChecker, get_metrics_collector
    
    file_check = HealthChecker.check_file_access()
    data_check = HealthChecker.check_data_directory()
    metrics = get_metrics_collector().get_metrics()
    
    # Determine overall status
    if file_check["status"] == "unhealthy" or data_check["status"] == "error":
        overall_status = "unhealthy"
        status_code = 503
    elif file_check["status"] == "degraded" or data_check["status"] == "warning":
        overall_status = "degraded"
        status_code = 200  # Still serving traffic
    else:
        overall_status = "healthy"
        status_code = 200
    
    from fastapi.responses import JSONResponse
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": overall_status,
            "checks": {
                "files": file_check,
                "data_directory": data_check,
            },
            "metrics": metrics,
        }
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
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])
app.include_router(screener.router, prefix="/api/screener", tags=["screener"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(social.router, prefix="/api/social", tags=["social"])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["intelligence"])
app.include_router(daily_review.router, prefix="/api", tags=["daily-review"])


@app.get("/{full_path:path}", include_in_schema=False)
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
