---
description: Seamless agent-browser upgrade flow with intelligent routing
---

# Agent-Browser Upgrade Flow

Orchestrated workflow for keeping navigator's agent-browser dependency current. Automatically routes to the right path based on what it finds.

## Steps

1. **Load** — Use the Skill tool to load the **agent-browser-upstream** skill
2. **Assess** — Analyze the status below and determine the path:
   - **No changes** → Report "Already up to date" and stop
   - **Clean updates** (no breaking changes) → Proceed to auto-sync
   - **Breaking changes** → Dispatch analyst subagent for impact assessment
3. **Execute** — Based on assessment:
   - **Clean**: Merge, update, test, report success
   - **Breaking**: Write integration docs, present findings, ask user how to proceed
4. **Verify** — After any changes, run navigator tests and typecheck
5. **Report** — Summarize what was done and current state

## Guidance

### Subagent Dispatch

Use Task tool to dispatch specialized agents:

- **analyst** — For impact assessment of breaking changes
  - Prompt: "Analyze how these agent-browser changes affect navigator. Check imports, API usage, type compatibility."

- **senior-dev** — For applying fixes after breaking changes
  - Prompt: "Apply the required changes from the integration docs to navigator."

- **tester** — For verification after updates
  - Prompt: "Verify navigator works correctly with the updated agent-browser. Run tests, check types, do smoke test."

### Decision Tree

```
Status check
    │
    ├── No commits → "Up to date" → STOP
    │
    ├── Only additive/fix commits → AUTO-SYNC
    │       │
    │       ├── Merge upstream → Push fork
    │       ├── Update navigator bun.lock
    │       ├── Run tests
    │       └── Report success
    │
    └── Breaking commits detected → CAREFUL PATH
            │
            ├── Dispatch analyst for impact assessment
            ├── Write integration docs
            ├── Create GitHub issue from template (for tracking)
            ├── Present to user with options:
            │     • "Proceed with guided update"
            │     • "I'll handle it manually"
            │     • "Skip this version"
            │
            └── If proceeding:
                  ├── Dispatch senior-dev to apply fixes
                  ├── Dispatch tester to verify
                  ├── Create PR linking to issue
                  └── Report final state
```

### GitHub Issue Creation

The integration doc *is* the issue. Use `/agent-browser:issue` to create it:

```bash
/agent-browser:issue docs/_upstream/v0.6.0/integration.md
```

The doc's frontmatter defines title and labels, the body becomes the issue body.

This provides:
- Trackable checklist through to PR
- Link to upstream comparison
- Record of what changed and why
- Single source of truth (doc = issue)

### Success Criteria

- Fork merged with upstream
- Navigator's bun.lock updated
- `bun run typecheck` passes
- `bun test` passes
- No uncommitted changes in navigator

## Context

$ARGUMENTS

### Current Status

!`bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1`
