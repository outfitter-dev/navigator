---
description: Seamless agent-browser upgrade flow
---

# Agent-Browser Upgrade Flow

Orchestrates the full upstream sync workflow. Each step is self-contained — run them in sequence.

## Sequence

1. `/agent-browser:check` — Detect upstream changes
   - If "up to date" → stop here

2. `/agent-browser:integrate-changes` — Evaluate what to adopt/skip/adapt
   - Loads `upstream-evaluation` skill
   - Uses frameworks from `docs/architecture/DESIGN.md`
   - Outputs adopt/skip/defer tables

3. `/agent-browser:issue` — Create GitHub issue from integration doc

4. **User confirms** — Present findings, get approval before merge

5. `/agent-browser:update` — Execute merge, tag, lockfile, tests

## Context

$ARGUMENTS

### Current Status

!`bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1`
