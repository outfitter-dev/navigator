---
description: One-shot sync of agent-browser fork with upstream (happy path)
---

# Sync Agent-Browser

Fast-track sync when upstream has non-breaking changes. Merges, updates navigator, and verifies.

## Steps

1. **Load** — Use the Skill tool to load the **agent-browser-upstream** skill
2. **Analyze** — Review the status below for breaking changes
3. **Gate** — If breaking changes exist, stop and recommend `/agent-browser:check` instead
4. **Execute** — If clean, run the full workflow:
   - Merge upstream into fork
   - Push to origin
   - Update navigator's bun.lock
   - Run typecheck and tests
   - Report success or failure

## Guidance

- This is the happy path — abort if anything looks risky
- Breaking changes (commits with `!` or "BREAKING") → stop, use check/update flow instead
- Test failures → stop, report what failed, do not commit
- Success → report versions and confirm navigator is on latest

## Context

$ARGUMENTS

### Current Status

!`bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1`
