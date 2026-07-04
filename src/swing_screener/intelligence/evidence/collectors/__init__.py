"""Catalyst evidence collectors.

Importing this package auto-imports every collector module so each class's
``@register`` decorator runs. Dropping a new ``collectors/<name>.py`` file that
registers a ``CatalystCollector`` is enough to make it discoverable — no edit to
``collect.py`` or any manual import list.
"""

from __future__ import annotations

import importlib
import pkgutil

for _module in pkgutil.iter_modules(__path__):
    importlib.import_module(f"{__name__}.{_module.name}")
