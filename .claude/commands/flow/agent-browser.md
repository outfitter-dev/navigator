---
description: Seamless agent-browser upgrade flow with intelligent routing
---

# Agent-Browser Upgrade Flow

Orchestrated workflow for keeping navigator's agent-browser dependency current. Automatically routes to the right path based on what it finds.

## Steps

1. **Load** — Use the Skill tool to load the **agent-browser-upstream** skill
2. **Assess** — Analyze the status and determine the path:
   - **No changes** → Report "Already up to date" and stop
   - **Any changes** → Continue to investigation (never skip this)
3. **Investigate** — ALWAYS dispatch analyst for deep dive on changes:
   - New commands/actions that navigator should expose
   - Significant additions (plugins, new features) requiring decisions
   - Files changed in protocol.ts, types.ts, browser.ts
4. **Document** — Create integration docs BEFORE any merge:
   - Write `docs/_upstream/<version>/integration.md`
   - Create GitHub issue for tracking
   - Present findings to user
5. **Confirm** — Get explicit user approval before proceeding
6. **Execute** — Only after user confirms:
   - Merge upstream → Push fork
   - Create fork release tag (`v<upstream>-nav.<patch>`)
   - Update navigator's package.json to reference tag
   - Force refresh bun.lock (`rm bun.lock && bun install`)
   - Run typecheck + tests
7. **Report** — Summarize what was done and remaining work

## Guidance

### Using Diff Artifacts

The `/agent-browser:diff` command generates structured artifacts at `.agent-browser/analysis/<sha>/`:

```bash
# Find the latest analysis directory
SHA=$(ls -t .agent-browser/analysis/ | head -1)

# Start small - read summary first
cat .agent-browser/analysis/$SHA/summary.json

# If breaking > 0, drill into breaking changes
cat .agent-browser/analysis/$SHA/by-category/breaking.json

# Query with jq
jq '.[] | .shortSha + " " + .message' .agent-browser/analysis/$SHA/by-category/features.json

# Check navigator impact
cat .agent-browser/analysis/$SHA/navigator-impact.json

# Read specific file diff
cat .agent-browser/analysis/$SHA/diffs/protocol.ts.diff
```

**Key principle:** Load context incrementally. Don't read all files at once.

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
    └── Has commits → INVESTIGATE FIRST (never auto-merge)
            │
            ├── Dispatch analyst for deep dive:
            │     • New commands/actions
            │     • Protocol/type changes
            │     • Plugins and significant additions
            │
            ├── Write integration docs with:
            │     • New actions navigator should expose
            │     • Required schema changes
            │     • Decisions needed (include/exclude/rewrite)
            │
            ├── Create GitHub issue for tracking
            │
            ├── Present findings to user with options:
            │     • "Proceed with merge" (docs complete, no blockers)
            │     • "I'll review first" (user wants to check docs)
            │     • "Skip this version"
            │
            └── Only after user confirms:
                  ├── Merge upstream → Push fork
                  ├── Create release tag (v<upstream>-nav.<patch>)
                  ├── Update package.json with tag reference
                  ├── Force refresh bun.lock (rm + install)
                  ├── Run typecheck + tests
                  ├── Report results + remaining work
                  └── (Schema changes are separate PRs)
```

### Items Requiring Explicit Decision

These additions should ALWAYS be flagged for user review:

- **Plugins** (e.g., `.claude-plugin/`) — Include, exclude, or create navigator-specific version?
- **New commands** — Should navigator expose this action?
- **Breaking changes** — What navigator code needs to update?
- **Significant file changes** — protocol.ts, types.ts, browser.ts with >50 lines changed

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

**Before merge:**
- Integration docs written at `docs/_upstream/<version>/integration.md`
- GitHub issue created for tracking
- User has reviewed and approved proceeding

**After merge:**
- Fork merged with upstream
- Navigator's bun.lock updated
- `bun run typecheck` passes
- `bun test` passes
- Integration docs updated with "Fork synced" status

## Context

$ARGUMENTS

### Current Status

!`bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1`
