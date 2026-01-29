---
description: One-shot sync of agent-browser fork with upstream (redirects to flow)
---

# Sync Agent-Browser

**Redirects to `/flow:agent-browser`** — The sync command now uses the full orchestrated flow.

## Why?

The v0.6.0 sync incident showed that "0 breaking changes" doesn't mean "safe to auto-merge":
- Marketplace plugin was merged without review (Vercel-branded, not navigator-appropriate)
- 8 new features weren't assessed for navigator integration
- No documentation created before merge

All upstream changes — even "clean" ones — now require investigation before merge.

## Steps

1. **Redirect** — Run `/flow:agent-browser` instead
2. The flow will:
   - Analyze changes
   - Dispatch analyst for deep dive
   - Create integration docs
   - Get user confirmation
   - Then merge with proper tagging

## Quick Status

The status below shows what's pending. Use `/flow:agent-browser` to proceed.

## Context

$ARGUMENTS

### Current Status

!`( cd "$(git rev-parse --show-toplevel)" && bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary 2>&1 )`
