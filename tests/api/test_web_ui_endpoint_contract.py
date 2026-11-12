"""Every API path the web UI calls must be served by the backend.

MSW handlers answer any path a frontend test asks for, so a backend route can
disappear while the UI and its tests stay green. This test reads the `/api/...`
path literals from the shipped web-ui source and checks each against the
FastAPI route table.
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.routing import APIRoute

from api.main import app

WEB_UI_SRC = Path(__file__).resolve().parents[2] / "web-ui" / "src"
_PATH_LITERAL = re.compile(r"""['"`](/api/[^'"`?\s]*)""")
_TEMPLATE_PARAM = re.compile(r"\$\{[^}]*\}")
_ROUTE_PARAM = re.compile(r"\{[^}]*\}")
_PLACEHOLDER = "{param}"


def _is_shipped_source(path: Path) -> bool:
    return (
        ".test." not in path.name
        and "test" not in path.relative_to(WEB_UI_SRC).parts
        and "mocks" not in path.parts
    )


def _ui_paths() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in sorted(WEB_UI_SRC.rglob("*.ts*")):
        if not _is_shipped_source(path):
            continue
        for literal in _PATH_LITERAL.findall(path.read_text(encoding="utf-8")):
            normalized = _TEMPLATE_PARAM.sub(_PLACEHOLDER, literal).rstrip("/")
            found.setdefault(normalized, []).append(str(path.relative_to(WEB_UI_SRC)))
    return found


def _backend_paths() -> set[str]:
    return {
        _ROUTE_PARAM.sub(_PLACEHOLDER, route.path).rstrip("/")
        for route in app.routes
        if isinstance(route, APIRoute)
    }


def _matches(ui_path: str, backend: set[str]) -> bool:
    if ui_path in backend:
        return True
    # A literal that ends in a template value (`/api/x/${id}`) or is a prefix
    # completed at runtime (`${API_ENDPOINTS.positions}${params}`) must still
    # name a real route segment-for-segment.
    pattern = re.compile(
        "^" + re.escape(ui_path).replace(re.escape(_PLACEHOLDER), "[^/]+") + "$"
    )
    return any(pattern.match(route) for route in backend)


def test_web_ui_source_has_api_paths():
    assert len(_ui_paths()) > 20


def test_every_web_ui_api_path_has_a_backend_route():
    backend = _backend_paths()
    missing = {
        path: files for path, files in _ui_paths().items() if not _matches(path, backend)
    }
    assert missing == {}
