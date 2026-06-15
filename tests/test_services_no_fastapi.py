import ast
import pathlib

SERVICES_DIR = pathlib.Path(__file__).resolve().parents[1] / "api" / "services"


def _imports_fastapi(path: pathlib.Path) -> bool:
    tree = ast.parse(path.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(a.name.split(".")[0] == "fastapi" for a in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] == "fastapi":
                return True
    return False


def test_no_service_imports_fastapi():
    offenders = [p.name for p in SERVICES_DIR.glob("*.py") if _imports_fastapi(p)]
    assert offenders == [], f"services must be framework-free, found fastapi import in: {offenders}"
