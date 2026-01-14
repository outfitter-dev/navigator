#!/bin/bash
# navigator SessionStart hook
# Checks navigator server health if NAVIGATOR_AUTOSTART is enabled.
# Set NAVIGATOR_AUTOSTART=1 in environment or .env to enable.

# Exit silently if autostart not enabled
[[ "${NAVIGATOR_AUTOSTART:-0}" != "1" ]] && exit 0

NAVIGATOR_SERVER_URL="${NAVIGATOR_SERVER_URL:-http://localhost:9334}"

if command -v curl >/dev/null 2>&1; then
  if curl -fsSL "${NAVIGATOR_SERVER_URL}/health" >/dev/null 2>&1; then
    echo "Navigator browser server ready. Use via CLI (nav) or MCP."
  else
    echo "Navigator server not running. Start with: nav serve"
  fi
fi

exit 0
