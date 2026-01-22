---
description: Merge upstream agent-browser changes into fork and update navigator
---

# Update Agent-Browser

Merge upstream agent-browser into the fork and update navigator's dependency.

## Steps

1. **Check** — Run `/agent-browser:check` first if not already done this session
2. **Load** — Use the Skill tool to load the **agent-browser-upstream** skill
3. **Confirm** — Review breaking changes with user before proceeding
4. **Execute** — Follow Phase 5 of the skill (merge, push, update navigator, test)

## Guidance

- Require explicit user confirmation before merging
- If breaking changes exist, ensure integration docs are written first
- Run `bun test` and `bun run typecheck` after updating navigator
- Stop and report if tests fail — do not commit broken state

## Context

$ARGUMENTS

### Current Status

!`bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1`
