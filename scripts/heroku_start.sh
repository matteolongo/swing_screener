#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"
export SERVE_WEB_UI=1
export SCREENER_RUN_MODE="${SCREENER_RUN_MODE:-async}"
export WEB_CONCURRENCY="${WEB_CONCURRENCY:-1}"
export PYTHONPATH="${REPO_ROOT}/src:${PYTHONPATH:-}"

exec uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8000}"
