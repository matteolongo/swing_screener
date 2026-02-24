from __future__ import annotations

import ast
from pathlib import Path


FORBIDDEN_PREFIXES = (
    "swing_screener.strategies",
    "swing_screener.screeners",
    "swing_screener.signals",
    "swing_screener.recommendations",
    "swing_screener.reporting.config",
)

FORBIDDEN_FROM_SWING = {
    "strategies",
    "screeners",
    "signals",
    "recommendations",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _python_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for folder in ("src", "api", "tests"):
        files.extend((root / folder).rglob("*.py"))
    return files


def _scan_forbidden_imports(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    tree = ast.parse(text, filename=str(path))
    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if any(name == p or name.startswith(p + ".") for p in FORBIDDEN_PREFIXES):
                    violations.append(f"{path}:{node.lineno} import {name}")
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            if any(mod == p or mod.startswith(p + ".") for p in FORBIDDEN_PREFIXES):
                violations.append(f"{path}:{node.lineno} from {mod}")
                continue
            if mod == "swing_screener":
                for alias in node.names:
                    if alias.name in FORBIDDEN_FROM_SWING:
                        violations.append(
                            f"{path}:{node.lineno} from swing_screener import {alias.name}"
                        )

    return violations


def test_no_legacy_module_import_paths() -> None:
    root = _repo_root()
    violations: list[str] = []

    for file in _python_files(root):
        if "__pycache__" in file.parts:
            continue
        violations.extend(_scan_forbidden_imports(file))

    assert not violations, "Legacy import paths found:\n" + "\n".join(sorted(violations))
