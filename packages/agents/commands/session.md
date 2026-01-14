---
description: Show current navigator session state
allowed-tools: Bash(curl *)
---

# Navigator Session

## Session state
!`URL=${NAVIGATOR_SERVER_URL:-http://localhost:9334}; curl -fsSL "${URL}/session" 2>&1 || echo "Server not reachable at ${URL}"`
