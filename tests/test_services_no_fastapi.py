import ast
import pathlib

_ROOT = pathlib.Path(__file__).resolve().parents[1]

_INFRA_DIRS = [
    _ROOT / "api" / "services",
    _ROOT / "api" / "repositories",
    _ROOT / "api" / "utils",
]


def _imports_fastapi(path: pathlib.Path) -> bool:
    try:
        tree = ast.parse(path.read_text())
    except SyntaxError as exc:
        raise SyntaxError(f"Syntax error in {path}: {exc}") from exc
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(a.name.split(".")[0] == "fastapi" for a in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] == "fastapi":
                return True
    return False


def test_infra_layers_have_no_fastapi():
    existing_dirs = [d for d in _INFRA_DIRS if d.exists()]
    assert existing_dirs, (
        "None of the expected infra dirs exist — check that the repo structure hasn't changed: "
        + str([str(d) for d in _INFRA_DIRS])
    )

    offenders: list[str] = []
    for d in existing_dirs:
        for p in d.rglob("*.py"):
            if _imports_fastapi(p):
                offenders.append(str(p.relative_to(_ROOT)))

    assert offenders == [], (
        "Infra layers (services/repositories/utils) must be framework-free; "
        f"found fastapi import in: {offenders}"
    )
