---
description: Remove agent-browser analysis artifacts and optionally the clone
---

# Agent-Browser Cleanup

Remove ephemeral analysis artifacts. Keeps the git clone by default for faster future operations.

## Usage

```bash
/agent-browser:cleanup           # Remove analysis artifacts only
/agent-browser:cleanup --all     # Remove entire .agent-browser/ including clone
```

## What Gets Removed

**Default (no flags):**
- `.agent-browser/analysis/` — All SHA-based analysis directories

**With `--all`:**
- `.agent-browser/` — Entire directory including the git clone

## When to Use

- **After completing an upgrade** — Clean up old analysis artifacts
- **To free disk space** — Analysis directories can accumulate
- **To reset** — With `--all`, forces fresh clone on next operation

## Script

```bash
#!/bin/bash
set -e

AGENT_BROWSER_DIR=".agent-browser"
ANALYSIS_DIR="$AGENT_BROWSER_DIR/analysis"

if [[ "$1" == "--all" ]]; then
    if [[ -d "$AGENT_BROWSER_DIR" ]]; then
        echo "Removing entire $AGENT_BROWSER_DIR directory..."
        rm -rf "$AGENT_BROWSER_DIR"
        echo "✓ Removed $AGENT_BROWSER_DIR (will re-clone on next operation)"
    else
        echo "Nothing to clean — $AGENT_BROWSER_DIR does not exist"
    fi
else
    if [[ -d "$ANALYSIS_DIR" ]]; then
        # Count directories before removal
        COUNT=$(find "$ANALYSIS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
        rm -rf "$ANALYSIS_DIR"
        echo "✓ Removed $COUNT analysis directories"
        echo "  Git clone preserved at $AGENT_BROWSER_DIR/repo/"
    else
        echo "Nothing to clean — no analysis directories found"
    fi
fi
```

!`bash -c '
AGENT_BROWSER_DIR=".agent-browser"
ANALYSIS_DIR="$AGENT_BROWSER_DIR/analysis"

if [[ "$ARGUMENTS" == *"--all"* ]]; then
    if [[ -d "$AGENT_BROWSER_DIR" ]]; then
        echo "Removing entire $AGENT_BROWSER_DIR directory..."
        rm -rf "$AGENT_BROWSER_DIR"
        echo "✓ Removed $AGENT_BROWSER_DIR (will re-clone on next operation)"
    else
        echo "Nothing to clean — $AGENT_BROWSER_DIR does not exist"
    fi
else
    if [[ -d "$ANALYSIS_DIR" ]]; then
        COUNT=$(find "$ANALYSIS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d " ")
        rm -rf "$ANALYSIS_DIR"
        echo "✓ Removed $COUNT analysis directories"
        echo "  Git clone preserved at $AGENT_BROWSER_DIR/repo/"
    else
        echo "Nothing to clean — no analysis directories found"
    fi
fi
' 2>&1`
