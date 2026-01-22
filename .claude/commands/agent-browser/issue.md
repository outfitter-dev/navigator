---
description: Create GitHub issue from integration doc
argument-hint: <path-to-integration.md> [--dry-run]
---

# Create Agent-Browser Issue

Create a GitHub issue from an integration doc to track the upgrade through to PR.

## Steps

1. **Validate** — Check the file exists and has proper frontmatter
2. **Preview** — Show what will be created (title, labels, body preview)
3. **Confirm** — Ask user to confirm before creating
4. **Create** — Run the script to create the issue

## Usage

```bash
# From integration doc
/agent-browser:issue docs/_upstream/v0.6.0/integration.md

# Dry run first
/agent-browser:issue docs/_upstream/v0.6.0/integration.md --dry-run
```

## Guidance

- Always do a dry run first to preview
- The doc's frontmatter defines title and labels
- The doc's body (after frontmatter) becomes the issue body
- After creation, report the issue URL

## Script

```bash
bun run .claude/skills/agent-browser-upstream/scripts/create-issue.ts <file> [--dry-run]
```

## Context

$ARGUMENTS
