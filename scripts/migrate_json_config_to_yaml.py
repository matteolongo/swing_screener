from __future__ import annotations

import argparse

from swing_screener.settings.migration import migrate_legacy_config_to_yaml


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy JSON config files to YAML.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing YAML documents.")
    parser.add_argument("--cleanup", action="store_true", help="Delete legacy config files after migration.")
    args = parser.parse_args()

    actions = migrate_legacy_config_to_yaml(force=args.force, cleanup=args.cleanup)
    if not actions:
        print("No migration actions were needed.")
        return 0

    for action in actions:
        print(action)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
