---
description: Check for upstream agent-browser updates and assess impact
---

# Check Agent-Browser Upstream

Analyze upstream agent-browser changes and assess impact on navigator.

## Steps

1. **Load** — Use the Skill tool to load the **agent-browser-upstream** skill
2. **Consider** — Review the analysis output below
3. **Execute** — Follow Phases 1-4 of the skill (Sync → Analyze → Impact → Docs)

## Guidance

- If no upstream changes, report "Fork is up to date" and stop
- Summarize breaking changes, new features, and navigator impact
- Create integration docs at `docs/_upstream/<version>/` if significant changes exist
- Do NOT merge — use `/agent-browser:update` or `/agent-browser:sync` for that

## Context

$ARGUMENTS

### Current Status

!`( cd "$(git rev-parse --show-toplevel)" && bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1 )`
