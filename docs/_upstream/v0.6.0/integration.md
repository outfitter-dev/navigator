---
# GitHub Issue Metadata (used by create-issue.ts)
issue:
  title: "chore(deps): integrate agent-browser v0.6.0"
  labels: [dependencies, chore, agent-browser]

# Version info
version: "v0.6.0"
upstream_sha: "399fd7a"
fork_sha: "b4c7c47"
date: "2025-01-20"
---

# Agent-Browser v0.6.0 Integration

Upstream [agent-browser](https://github.com/vercel-labs/agent-browser) has updates to integrate into our fork.

| | |
|---|---|
| **Upstream** | v0.6.0 (`399fd7a`) |
| **Fork (before)** | `b4c7c47` |
| **Fork (after)** | `3963ec0` |
| **Commits** | 26 |
| **Breaking** | 0 |

## Fork Status

> **Already merged.** The fork has been synced with upstream and pushed to origin.
> Navigator's `bun.lock` updated but **not committed**.

## Changes

### Breaking Changes

None

### New Features

| Commit | Feature | Navigator Action | Priority |
|--------|---------|------------------|----------|
| `a8dcbb1` | CDP connect for persistent sessions | N/A (already supported) | - |
| `03a53c9` | Claude marketplace plugin | **Exclude** (see below) | - |
| `b1c0c6a` | Network request details in response | Auto-inherited | - |
| `c88734d` | NO_COLOR env support | Auto-inherited | Low |
| `e6e832d` | `styles` command - computed styles | **Add `styles` action** | High |
| `1f31452` | Native video recording | **Add `recording` actions** | High |
| `3675e6b` | `--proxy` flag for browser | **Add `proxy` option** | Medium |
| `7bdfcf8` | `--version` flag | N/A (navigator has own) | - |

### Bug Fixes

12 fixes included (general stability improvements)

## Navigator Impact

### New Actions Required

#### 1. `styles` Action (High Priority)

Get computed styles for visual testing and UI verification.

**Upstream schema** (`src/protocol.ts:307-310`):
```typescript
const stylesSchema = baseCommandSchema.extend({
  action: z.literal('styles'),
  selector: z.string().min(1),
});
```

**Return type** (`src/types.ts`):
```typescript
interface ElementStyleInfo {
  tag: string;
  text: string | null;
  box: { x: number; y: number; width: number; height: number };
  styles: {
    fontSize: string;
    fontWeight: string;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    borderRadius: string;
    border: string | null;
    boxShadow: string | null;
    padding: string;
  };
}
```

**Navigator schema addition** (`packages/core/src/schema/index.ts`):
```typescript
export const stylesSchema = baseActionSchema.extend({
  action: z.literal('styles'),
  selector: z.string().min(1).describe('CSS selector for elements'),
})
```

#### 2. `recording` Actions (High Priority)

Playwright native video recording for demos and debugging.

**Upstream schemas** (`src/protocol.ts:321-335`):
```typescript
const recordingStartSchema = baseCommandSchema.extend({
  action: z.literal('recording_start'),
  path: z.string().min(1),
  url: z.string().min(1).optional(),
});

const recordingStopSchema = baseCommandSchema.extend({
  action: z.literal('recording_stop'),
});

const recordingRestartSchema = baseCommandSchema.extend({
  action: z.literal('recording_restart'),
  path: z.string().min(1),
  url: z.string().min(1).optional(),
});
```

**Navigator schema additions**:
```typescript
export const recordingStartSchema = baseActionSchema.extend({
  action: z.literal('recordingStart'),
  path: z.string().min(1).describe('Output path for video file'),
  url: z.string().url().optional().describe('URL to navigate to before recording'),
})

export const recordingStopSchema = baseActionSchema.extend({
  action: z.literal('recordingStop'),
})

export const recordingRestartSchema = baseActionSchema.extend({
  action: z.literal('recordingRestart'),
  path: z.string().min(1).describe('Output path for new video file'),
  url: z.string().url().optional(),
})
```

#### 3. `proxy` Launch Option (Medium Priority)

Browser proxy configuration for testing behind proxies or with MITM tools.

**Upstream schema** (`src/protocol.ts:22-30`):
```typescript
proxy: z
  .object({
    server: z.string().min(1),
    bypass: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .optional(),
```

**Navigator integration**: Add to launch/connect options in server config.

### Modified Actions

#### `tab_new` / `newTab`

Now accepts optional `url` parameter. Navigator's `newTab` action should be updated:

```typescript
export const newTabSchema = baseActionSchema.extend({
  action: z.literal('newTab'),
  url: z.string().url().optional().describe('URL to open in new tab'),
})
```

### Files Affected

| File | Change Required |
|------|-----------------|
| `packages/core/src/schema/index.ts` | Add `styles`, `recordingStart/Stop/Restart` schemas |
| `packages/server/src/action-executor.ts` | Wire new actions to agent-browser |
| `packages/mcp/src/tools/navigator.ts` | Document new actions in tool schema |

## Marketplace Plugin Decision

**Recommendation: Exclude from fork**

The upstream `.claude-plugin/marketplace.json` is:
- Vercel-branded (`owner.name: "Vercel"`)
- Generic agent-browser focused
- Not aligned with Navigator's plugin at `packages/agents/`

**Action items:**
- [ ] Add `.claude-plugin/` to fork's `.gitignore` or delete after merge
- [ ] Ensure navigator's own plugin (`packages/agents/`) is the source of truth
- [ ] Consider cherry-picking useful parts of upstream's `skills/agent-browser/SKILL.md` into navigator docs

## Integration Checklist

- [x] Review upstream changes
- [x] Merge upstream into fork (`b4c7c47` → `3963ec0`)
- [x] Push fork to GitHub
- [x] Update navigator's `bun.lock`
- [x] Run `bun run typecheck` (passes)
- [x] Run `bun test` (515 tests pass)
- [ ] **Add `styles` action to navigator schema**
- [ ] **Add `recording*` actions to navigator schema**
- [ ] **Add `proxy` option to launch config**
- [ ] **Update `newTab` to accept URL**
- [ ] Remove/gitignore upstream marketplace plugin from fork
- [ ] Update navigator's CHANGELOG.md
- [ ] Commit `bun.lock` update
- [ ] Create PR

## Links

- **Tracking issue**: [#109](https://github.com/outfitter-dev/navigator/issues/109)
- [Upstream diff](https://github.com/vercel-labs/agent-browser/compare/b4c7c47...399fd7a)
- [Fork repo](https://github.com/outfitter-dev/agent-browser)
- [Navigator schemas](../../../packages/core/src/schema/index.ts)
