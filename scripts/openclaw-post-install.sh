#!/usr/bin/env bash
# ── OpenClaw plugin post-install script ──────────────────────────────────────
# Runs after `openclaw plugin install theagentcompany` to auto-configure TAC
# for use as an OpenClaw plugin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  The Agent Company — OpenClaw Plugin Post-Install           ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── 1. Enable OpenClaw gateway adapter ──────────────────────────────────────
echo ""
echo "▸ Enabling OpenClaw gateway adapter..."
export TAC_OPENCLAW_AUTH_ENABLED=true

# ── 2. Generate BETTER_AUTH_SECRET if not already set ───────────────────────
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  echo "▸ Generating BETTER_AUTH_SECRET..."
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
  export BETTER_AUTH_SECRET

  # Persist to .env file if it exists or create one
  ENV_FILE="${PROJECT_ROOT}/.env"
  if [ -f "$ENV_FILE" ]; then
    # Append only if not already present
    if ! grep -q "^BETTER_AUTH_SECRET=" "$ENV_FILE"; then
      echo "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}" >> "$ENV_FILE"
      echo "  → Appended to ${ENV_FILE}"
    fi
  else
    echo "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}" > "$ENV_FILE"
    echo "  → Created ${ENV_FILE}"
  fi
else
  echo "▸ BETTER_AUTH_SECRET already set, skipping generation."
fi

# ── 3. Write OpenClaw auth env vars ────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env"

# Set TAC_OPENCLAW_AUTH_ENABLED=true
if ! grep -q "^TAC_OPENCLAW_AUTH_ENABLED=" "$ENV_FILE" 2>/dev/null; then
  echo "TAC_OPENCLAW_AUTH_ENABLED=true" >> "$ENV_FILE"
  echo "  → TAC_OPENCLAW_AUTH_ENABLED=true appended to .env"
fi

# Set TAC_OPENCLAW_GATEWAY_URL if OPENCLAW_GATEWAY_URL is provided
if [ -n "${OPENCLAW_GATEWAY_URL:-}" ]; then
  if ! grep -q "^TAC_OPENCLAW_GATEWAY_URL=" "$ENV_FILE" 2>/dev/null; then
    echo "TAC_OPENCLAW_GATEWAY_URL=${OPENCLAW_GATEWAY_URL}" >> "$ENV_FILE"
    echo "  → TAC_OPENCLAW_GATEWAY_URL set from OPENCLAW_GATEWAY_URL"
  fi
fi

# ── 4. Set deployment mode to authenticated ─────────────────────────────────
if ! grep -q "^TAC_DEPLOYMENT_MODE=" "$ENV_FILE" 2>/dev/null; then
  echo "TAC_DEPLOYMENT_MODE=authenticated" >> "$ENV_FILE"
  echo "  → TAC_DEPLOYMENT_MODE=authenticated appended to .env"
fi

# ── 5. Start the TAC server (Docker or direct) ─────────────────────────────
echo ""
echo "▸ Starting The Agent Company..."

if [ -f "${PROJECT_ROOT}/docker-compose.yml" ] && command -v docker &>/dev/null; then
  echo "  → Using Docker Compose"
  cd "$PROJECT_ROOT"
  docker compose up -d
else
  echo "  → Starting server directly (ensure dependencies are installed)"
  cd "$PROJECT_ROOT"
  if command -v pnpm &>/dev/null; then
    pnpm start 2>/dev/null || pnpm dev &
  elif command -v npm &>/dev/null; then
    npm start 2>/dev/null || npm run dev &
  else
    echo "  ✗ Neither pnpm nor npm found. Please start the server manually."
    exit 1
  fi
fi

echo ""
echo "✓ OpenClaw plugin post-install complete!"
echo "  TAC is available at http://localhost:3100"
echo "  Health check: http://localhost:3100/api/health"
