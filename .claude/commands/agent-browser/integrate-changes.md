---
description: Evaluate upstream changes using Navigator's design frameworks to decide what to adopt, skip, or adapt
---

# Integrate Agent-Browser Changes

Apply Navigator's design frameworks to evaluate upstream changes. This command focuses on **decision-making** — determining what to adopt, skip, defer, or adapt — not execution.

## Steps

1. **Load** — Use the Skill tool to load **upstream-evaluation**
2. **Review** — Check the analysis output below for changes to evaluate
3. **Evaluate** — For each change, apply the appropriate framework:
   - New features → Framework A
   - Renames → Framework B
   - Multiple related actions → Framework D
   - Bug fixes/branding → Framework E
4. **Output** — Produce structured tables:
   - **Adopt**: Features to add with Navigator naming + schema changes
   - **Skip**: Features to exclude with rationale
   - **Defer**: Features to revisit later
   - **Extend existing**: Changes to existing actions

## Guidance

- Read **docs/architecture/DESIGN.md** first — it defines the frameworks
- Every change needs a decision, even "0 breaking changes" updates
- Navigator naming conventions: camelCase for MCP, verb-noun for CLI
- Output format should match integration doc template

## Next Steps

After evaluation completes:
- `/agent-browser:issue` — Create GitHub issue from integration doc
- `/agent-browser:update` — Execute the merge (after user confirms)

## Context

$ARGUMENTS

### Current Status

!`( cd "$(git rev-parse --show-toplevel)" && bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1 )`
