---
description: Check navigator server health and mode
allowed-tools: Bash(curl *)
---

# Navigator Health

## Health endpoint
!`URL=${NAVIGATOR_SERVER_URL:-http://localhost:9334}; curl -fsSL "${URL}/health" 2>&1 || echo "Server not reachable at ${URL}"`
