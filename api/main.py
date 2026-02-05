"""FastAPI main application for Swing Screener."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Import routers
from api.routers import config, screener, portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    print("🚀 Swing Screener API starting up...")
    print("📊 API docs available at: http://localhost:8000/docs")
    print("🔧 OpenAPI schema: http://localhost:8000/openapi.json")
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title="Swing Screener API",
    description="REST API for the Swing Screener trading system",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware - allow web UI to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Vite dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "error_type": type(exc).__name__,
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
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Include routers
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(screener.router, prefix="/api/screener", tags=["screener"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
