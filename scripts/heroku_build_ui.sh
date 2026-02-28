#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "Building web-ui for Heroku slug..."
# Vite persistence vars are compile-time; default Heroku builds to local browser storage.
export VITE_PERSISTENCE_MODE="${VITE_PERSISTENCE_MODE:-local}"
export VITE_ENABLE_LOCAL_PERSISTENCE="${VITE_ENABLE_LOCAL_PERSISTENCE:-true}"
npm --prefix web-ui ci --include=dev
npm --prefix web-ui run build
