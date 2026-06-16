"""Logging convention for the backend.

Convention (see docs/engineering/MODULE_ARCHITECTURE.md):
- One module logger per file: `logger = get_logger(__name__)`.
- `logger.info`  — use-case boundaries (a screen run started/finished, a position closed).
- `logger.warning` — recoverable degradation, ALWAYS with the reason and the affected key.
- `logger.exception` — only inside the `except` that owns/handles the failure.
- Never `except: pass` silently. Either log a reason at debug/warning, or re-raise.
"""
from __future__ import annotations

import logging


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
