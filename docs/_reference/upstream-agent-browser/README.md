# Upstream Agent-Browser Reference

Reference documents from [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser).

**Purpose:** Learning from upstream's documentation patterns, not for shipping.

## Contents

- `SKILL.md` - Upstream's Claude Code skill documentation (comprehensive CLI reference)
- `marketplace.json` - Marketplace plugin registration (Vercel-branded, not used)

## What We Can Learn

1. **Command structure** - How they organize CLI commands
2. **Example patterns** - Practical usage examples
3. **Feature coverage** - What capabilities agent-browser exposes
4. **Documentation style** - How they document for agents

## Navigator Differences

Navigator wraps agent-browser with:
- **Unified MCP tool** instead of CLI commands
- **Element refs** (`e42`) instead of `@e1` format
- **Sessions with markers** for workflow persistence
- **Paired mode** for human-agent collaboration

See `packages/agents/` for Navigator's own plugin.

---

*Last synced: 2026-01-22 from upstream commit `c046de2`*
