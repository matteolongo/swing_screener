"""FastAPI main application for Swing Screener."""
from __future__ import annotations

import logging
import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Import routers
from api.routers import config, screener, portfolio, backtest, strategy, social

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, stream=sys.stdout)
logger = logging.getLogger("swing_screener.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    logger.info("Swing Screener API starting up...")
    logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("OpenAPI schema: http://localhost:8000/openapi.json")
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
    """Root endpoint - API health check."""
    return {
        "status": "ok",
        "service": "swing-screener-api",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
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
        - lock_contention_total: number of times file lock acquisition was delayed
        - validation_failures_total: number of validation errors
    """
    from api.monitoring import get_metrics_collector
    
    return get_metrics_collector().get_metrics()


# Include routers
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])
app.include_router(screener.router, prefix="/api/screener", tags=["screener"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["backtest"])
app.include_router(social.router, prefix="/api/social", tags=["social"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
