"""OpenAPI cookie-auth annotations matching the session boundary."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from api.security.middleware import is_protected_path


def install_security_openapi(app: FastAPI, cookie_name: str) -> None:
    def custom_openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        components = schema.setdefault("components", {})
        schemes = components.setdefault("securitySchemes", {})
        schemes["apiSession"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": cookie_name,
        }
        for path, path_item in schema.get("paths", {}).items():
            protected = is_protected_path(path)
            for operation in path_item.values():
                if isinstance(operation, dict) and "responses" in operation:
                    operation["security"] = (
                        [{"apiSession": []}] if protected else []
                    )
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi
