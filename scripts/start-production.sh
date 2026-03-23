#!/bin/bash
# Build UI and start server in static mode (no vite dev middleware)
set -e

cd "$(dirname "$0")/.."

# Build UI with latest source
echo "[tac] Building UI..."
cd ui && pnpm build && cd ..

# Start server (without TAC_UI_DEV_MIDDLEWARE, so it serves from dist/)
echo "[tac] Starting server..."
exec pnpm --filter @theagentcompany/server dev:watch
