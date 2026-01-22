---
description: Generate structured diff artifacts for agent consumption
---

# Agent-Browser Diff

Generate structured, jq-able artifacts showing what changed upstream. Outputs to `.agent-browser/analysis/<sha>/` for selective reading. The SHA-based directory allows comparing multiple upstream versions.

## Usage

```bash
/agent-browser:diff              # Generate diff artifacts
/agent-browser:diff --refresh    # Force refresh (re-fetch upstream)
```

## Steps

1. **Generate** — Run the script to produce artifacts
2. **Read summary** — Start with `summary.json` to understand scope
3. **Drill down** — Read category files or individual diffs as needed

## Output Structure

```
.agent-browser/
├── repo/                       # Git clone of the fork
└── analysis/<sha>/             # Artifacts for specific upstream SHA
    ├── summary.json            # Load first - versions, counts, flags
    ├── release-notes.md        # GitHub release notes (if available)
    ├── commits.json            # All commits (jq-able)
    ├── by-category/
    │   ├── breaking.json       # Breaking changes only
    │   ├── features.json       # New features only
    │   └── fixes.json          # Bug fixes only
    ├── diffs/
    │   ├── protocol.ts.diff    # Key file diffs
    │   ├── browser.ts.diff
    │   └── ...
    └── navigator-impact.json   # Navigator files using changed APIs
```

## Reading Artifacts

**Start small:**
```bash
# Find the latest analysis directory
SHA=$(ls -t .agent-browser/analysis/ | head -1)
cat .agent-browser/analysis/$SHA/summary.json
```

**Query with jq:**
```bash
# List breaking changes
jq '.[] | .shortSha + " " + .message' .agent-browser/analysis/$SHA/by-category/breaking.json

# Find commits touching protocol.ts
jq '.[] | select(.files | contains(["src/protocol.ts"]))' .agent-browser/analysis/$SHA/commits.json

# Get commit count by type
jq 'group_by(.type) | map({type: .[0].type, count: length})' .agent-browser/analysis/$SHA/commits.json
```

**Read specific diff:**
```bash
cat .agent-browser/analysis/$SHA/diffs/protocol.ts.diff
```

## Guidance

- Always read `summary.json` first — it tells you if there's anything to review
- Only load what you need — don't read all diffs unless necessary
- Use jq filters to narrow down to relevant commits
- `navigator-impact.json` shows which navigator files might need changes
- Use `/agent-browser:cleanup` to remove old analysis directories

## Script

!`bun run .claude/skills/agent-browser-upstream/scripts/generate-diff.ts $ARGUMENTS 2>&1`
