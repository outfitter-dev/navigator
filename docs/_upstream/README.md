# Agent-Browser Upstream Integration Docs

This directory tracks navigator's integration with the upstream [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) repository.

## Fork Relationship

```
vercel-labs/agent-browser (upstream)
        │
        └──► outfitter-dev/agent-browser (fork)
                    │
                    └──► @outfitter/agent-browser (npm package)
                                │
                                └──► navigator (consumer)
```

## Version History

| Version | Date | Status | Breaking Changes | Notes |
|---------|------|--------|------------------|-------|
| [v0.6.0](./v0.6.0/integration.md) | 2025-01-20 | Fork synced, pending schema updates | 0 | `styles`, `recording*`, `proxy` actions |
| — | — | Initial | — | Initial setup |

<!-- New versions are added above this line -->

## Directory Structure

Each version gets its own directory:

```
docs/_upstream/
├── README.md           # This file
└── v0.6.0/             # Example version
    ├── integration.md  # Navigator-specific integration plan
    ├── changes.md      # Raw changelog from upstream
    └── status.md       # Implementation progress tracker
```

## Workflow

1. **Detect update**: Skill triggers on keywords like "upstream", "sync fork"
2. **Analyze**: Script diffs fork vs upstream, categorizes changes
3. **Document**: Creates versioned docs in this directory
4. **Merge**: After review, merges upstream into fork
5. **Update**: Updates navigator's dependency and applies changes

See `.claude/skills/agent-browser-upstream/SKILL.md` for full workflow.

## Quick Commands

```bash
# Run analysis (auto-clones .agent-browser/ if needed)
bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary

# Check current versions
cd .agent-browser
git describe --tags origin/main   # fork version
git describe --tags upstream/main # upstream version

# View pending changes
git log --oneline origin/main..upstream/main
```

## Contributing Upstream

When making changes to our fork that could benefit upstream:

1. Create a branch in the fork
2. Make changes
3. Test in navigator
4. Open PR to vercel-labs/agent-browser
5. Document in `contributed.md` (create if needed)
