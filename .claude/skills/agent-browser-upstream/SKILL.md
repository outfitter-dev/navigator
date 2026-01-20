---
name: agent-browser-upstream
description: Safely sync navigator's agent-browser fork with upstream vercel-labs/agent-browser, analyze changes, and generate integration documentation
triggers:
  - upstream
  - agent-browser update
  - sync fork
  - integration plan
  - update agent-browser
  - merge upstream
archetype: dev-workflow
user_invocable: false
---

# Agent-Browser Upstream Sync Skill

Manages the process of keeping navigator's agent-browser fork in sync with the upstream vercel-labs/agent-browser repository.

## Prerequisites

**None required** - the skill auto-manages everything:

1. **Auto-clone**: If `.agent-browser/` doesn't exist, the script clones the fork automatically
2. **Auto-configure**: Upstream remote is added if missing
3. **Override**: Set `AGENT_BROWSER_LOCAL` env var to use an existing local clone instead

The `.agent-browser/` directory is gitignored and lives in the navigator repo root.

## Workflow Overview

```
Phase 1: Sync Fork
    ↓
Phase 2: Analyze Changes
    ↓
Phase 3: Impact Assessment
    ↓
Phase 4: Write Integration Docs
    ↓
Phase 5: Execute Merge (requires confirmation)
```

---

## Phase 1: Sync Fork

### Steps

1. **Run the analysis script** (handles everything automatically)
   ```bash
   bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary
   ```

   The script will:
   - Clone `.agent-browser/` if missing
   - Add upstream remote if needed
   - Fetch latest from both remotes
   - Show divergence summary

2. **Or check manually**
   ```bash
   cd .agent-browser

   # Current fork version
   git describe --tags origin/main 2>/dev/null || git rev-parse --short origin/main

   # Latest upstream version
   git describe --tags upstream/main 2>/dev/null || git rev-parse --short upstream/main

   # Divergence
   git log --oneline origin/main..upstream/main
   ```

### Decision Point

If no commits in divergence → **STOP** with "Fork is up to date with upstream"

---

## Phase 2: Analyze Changes

### Steps

1. **Run analysis script**
   ```bash
   bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts \
     --repo "$REPO_PATH" \
     --base origin/main \
     --target upstream/main
   ```

2. **Review commit categories**
   The script outputs JSON with commits categorized as:
   - `breaking` - API changes, removed exports
   - `additive` - New features, new exports
   - `fix` - Bug fixes
   - `docs` - Documentation only
   - `chore` - Build, deps, tooling

3. **Identify key files changed**
   Focus on these files for navigator impact:
   - `src/protocol.ts` - MCP protocol definitions
   - `src/browser.ts` - Browser control API
   - `src/index.ts` - Public exports
   - `src/cli/` - CLI commands (may inform navigator CLI)

### Output

Present a summary table:

| Category | Count | Key Changes |
|----------|-------|-------------|
| Breaking | N | List significant ones |
| Additive | N | List new features |
| Fix | N | List relevant fixes |

---

## Phase 3: Impact Assessment

### Steps

1. **Map upstream changes to navigator usage**

   Check which navigator files import from agent-browser:
   ```bash
   grep -r "@outfitter/agent-browser" packages/*/src --include="*.ts" -l
   ```

2. **Cross-reference with changed APIs**

   For each breaking change, check if navigator uses it:
   ```bash
   # Example: if upstream changed BrowserOptions
   grep -r "BrowserOptions" packages/*/src --include="*.ts"
   ```

3. **Flag breaking changes**

   Create a list:
   - [ ] Change X affects `packages/server/src/browser.ts:42`
   - [ ] Change Y affects `packages/core/src/types.ts:18`

4. **Identify required navigator changes**

   For each breaking change, document:
   - What changed upstream
   - How navigator currently uses it
   - What navigator code needs to change

### Decision Point

If breaking changes exist → **STOP** and confirm with user before proceeding

---

## Phase 4: Write Integration Docs

### Steps

1. **Determine version**
   ```bash
   VERSION=$(git describe --tags upstream/main 2>/dev/null || echo "v$(date +%Y.%m.%d)")
   ```

2. **Create version directory**
   ```bash
   mkdir -p docs/_upstream/$VERSION
   ```

3. **Generate changes.md**
   Raw changelog with all commits and diffs.

4. **Generate integration.md**
   Use template from `references/integration-template.md`:
   - Version metadata
   - Breaking changes with navigator impact
   - Additive features with adoption plan
   - Required code changes
   - Test plan

5. **Generate status.md**
   Tracking checklist:
   ```markdown
   ## Implementation Status

   - [ ] Merge upstream into fork
   - [ ] Update navigator bun.lock
   - [ ] Apply breaking change fixes
   - [ ] Run navigator tests
   - [ ] Update navigator CHANGELOG
   ```

6. **Update index**
   Add entry to `docs/_upstream/README.md`

7. **Create GitHub issue** (optional, recommended for breaking changes)
   The integration doc *is* the issue — its frontmatter has title/labels:
   ```bash
   bun run .claude/skills/agent-browser-upstream/scripts/create-issue.ts \
     docs/_upstream/$VERSION/integration.md
   ```
   Or use the command: `/agent-browser:issue docs/_upstream/$VERSION/integration.md`

---

## Phase 5: Execute Merge (Optional)

> **REQUIRES USER CONFIRMATION** - Do not proceed without explicit approval

### Steps

1. **Merge upstream into fork**
   ```bash
   cd .agent-browser
   git checkout main
   git merge upstream/main --no-edit
   ```

2. **Resolve conflicts if any**
   - Prefer upstream changes unless navigator-specific customization
   - Document any conflict resolutions in integration.md

3. **Push to fork**
   ```bash
   git push origin main
   ```

4. **Update navigator**
   ```bash
   cd /path/to/navigator
   bun update @outfitter/agent-browser
   ```

5. **Run navigator tests**
   ```bash
   bun test
   bun run typecheck
   ```

6. **Update status.md**
   Mark completed items

### Decision Point

If tests fail → **STOP** and document failures, do not commit

---

## Integration Patterns

### Pattern: API Signature Change

When upstream changes a function signature:

1. Find all navigator usages
2. Update to new signature
3. Add backward-compat wrapper if needed (temporary)
4. Document in integration.md

### Pattern: New Feature Adoption

When upstream adds a useful feature:

1. Evaluate if navigator should expose it
2. Add to navigator's schema if needed
3. Wire through action-executor
4. Add tests
5. Document in navigator CHANGELOG

### Pattern: Breaking Type Change

When upstream changes a type definition:

1. Update navigator's re-exports
2. Check all type usages compile
3. Update any Zod schemas that reference it

---

## Quick Reference

### Commands

```bash
# Run analysis (auto-clones if needed)
bun run .claude/skills/agent-browser-upstream/scripts/analyze-upstream.ts --format summary

# Check current versions
cd .agent-browser && git describe --tags origin/main upstream/main

# View pending changes
cd .agent-browser && git log --oneline origin/main..upstream/main

# Diff specific file
cd .agent-browser && git diff origin/main..upstream/main -- src/protocol.ts
```

### Key Files

| Location | Purpose |
|----------|---------|
| `.agent-browser/` | Local clone of the fork (gitignored) |
| `docs/_upstream/README.md` | Index of all integration docs |
| `docs/_upstream/<version>/integration.md` | Version-specific integration plan |
| `docs/_upstream/<version>/changes.md` | Raw changelog |
| `docs/_upstream/<version>/status.md` | Implementation tracker |
| `references/integration-template.md` | Template for integration docs (also the issue) |
| `scripts/create-issue.ts` | Creates GitHub issue from integration doc |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENT_BROWSER_LOCAL` | Override repo path | `.agent-browser/` in repo root |
