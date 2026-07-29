#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "Building web-app for Heroku slug..."
# Vite persistence vars are compile-time; deployed builds use the authenticated API.
export VITE_PERSISTENCE_MODE="${VITE_PERSISTENCE_MODE:-api}"
export VITE_ENABLE_LOCAL_PERSISTENCE="${VITE_ENABLE_LOCAL_PERSISTENCE:-false}"
npm --prefix web-app ci --include=dev
npm --prefix web-app run build
