---
# GitHub Issue Metadata (used by create-issue.ts)
issue:
  title: "chore(deps): integrate agent-browser v0.6.1 (v0.6.0+14)"
  labels: [dependencies, chore, agent-browser, compatibility-fix]

# Version info
version: "v0.6.1"
upstream_sha: "c046de2"
fork_sha: "610e01f"
date: "2026-01-22"
---

# Agent-Browser v0.6.1 Integration

Upstream [agent-browser](https://github.com/vercel-labs/agent-browser) has 14 commits since v0.6.0 to integrate.

| | |
|---|---|
| **Upstream** | v0.6.0+14 (`c046de2`) |
| **Fork (current)** | `610e01f` (v0.6.0-nav.1) |
| **Commits** | 13 |
| **Breaking** | 0 (officially), **1 CRITICAL** (Navigator-specific) |

## Critical Compatibility Issue

### Socket Path Change (MUST FIX)

Upstream commit `946d236` changed socket file location:

| | Before | After |
|---|---|---|
| **Location** | `$TMPDIR/agent-browser-{session}.sock` | `~/.agent-browser/{session}.sock` |
| **Rationale** | Different TMPDIR values across terminals (tmux, VSCode, IntelliJ) caused CLI/daemon mismatches |

**Navigator impact:** `packages/server/src/browser/manager.ts:64` still uses the old path:
```typescript
function getSocketPath(session: string): string {
  return os.platform() === 'win32'
    ? String(getPortForSession(session))
    : `${os.tmpdir()}/agent-browser-${session}.sock`  // ← BROKEN
}
```

**Required fix:** Update to match upstream's new socket directory logic:
```typescript
function getSocketDir(): string {
  // Priority: explicit env > XDG > home fallback
  if (process.env.AGENT_BROWSER_SOCKET_DIR) {
    return process.env.AGENT_BROWSER_SOCKET_DIR
  }
  if (process.env.XDG_RUNTIME_DIR) {
    return `${process.env.XDG_RUNTIME_DIR}/agent-browser`
  }
  return `${os.homedir()}/.agent-browser`
}

function getSocketPath(session: string): string {
  return os.platform() === 'win32'
    ? String(getPortForSession(session))
    : `${getSocketDir()}/${session}.sock`
}
```

---

## Evaluation Summary

### Adopt

| Feature | Commit | Navigator Name | Category | Priority |
|---------|--------|----------------|----------|----------|
| Download commands | `55f4eaa` | `download` (with `wait` flag) | Interaction | Medium |
| Browser launch args | `083a946` | Config extension | Launch | Medium |
| Remote CDP WebSocket | `e892bce` | Config extension | Launch | Low |
| Persistent profiles | `36cca10` | `--profile` flag | Launch | Medium |
| Socket path fix | `946d236` | N/A (internal) | **Critical** | **Blocker** |
| WebSocket connect fix | `307f970` | N/A (internal) | Fix | Auto |
| Windows .exe fix | `cb37630` | N/A (internal) | Fix | Auto |

### Skip (from shipping)

| Feature | Commit | Reason |
|---------|--------|--------|
| Marketplace plugin docs | `c6a92a1` | Branding-specific; keep as reference only |

### Track (GitHub Issues)

| Feature | Commit | Issue | Notes |
|---------|--------|-------|-------|
| Browser Use cloud | `c4139fa` | [#112](https://github.com/outfitter-dev/navigator/issues/112) | Evaluate when cloud browser use case emerges |
| Browserbase support | `7123d46` | [#113](https://github.com/outfitter-dev/navigator/issues/113) | Evaluate when remote browser strategy defined |

---

## New Actions Required

### 1. `download` Action (Medium Priority)

Click an element to trigger download and save to specified path.

**Design decision:** Consolidate `download` + `waitForDownload` into single action with `wait` flag (Framework D: Consolidate vs. Mirror). Agents don't need two actions when one with a flag is clearer.

**Upstream** (`src/protocol.ts`):
```typescript
// Upstream has separate commands:
// download <selector> <path>
// wait --download [path] [--timeout ms]
```

**Navigator schema** (consolidated):
```typescript
export const downloadSchema = baseActionSchema.extend({
  action: z.literal('download'),
  ref: elementRefSchema.describe('Element ref that triggers download'),
  path: z.string().min(1).describe('Output path for downloaded file'),
  wait: z.boolean().default(true).describe('Wait for download to complete'),
  timeout: z.number().positive().optional().describe('Timeout in ms (only with wait)'),
})
```

**Usage examples:**
```typescript
// Click and wait for download (default behavior)
{ action: 'download', ref: 'e42', path: './report.pdf' }

// Click without waiting (fire and forget)
{ action: 'download', ref: 'e42', path: './report.pdf', wait: false }

// Click with custom timeout
{ action: 'download', ref: 'e42', path: './report.pdf', timeout: 30000 }
```

**Executor implementation:** When `wait: true` (default), executor sends `download` command then immediately sends `wait --download` to agent-browser.

---

## Launch Config Extensions

### Browser Args (`--args`)

Pass custom browser arguments.

```typescript
// In NavigatorConfig or launch options
browserArgs?: string[]
```

### User Agent (`--user-agent`)

Custom user agent string.

```typescript
userAgent?: string
```

### Proxy Bypass (`--proxy-bypass`)

Bypass proxy for specific hosts.

```typescript
proxy?: {
  server: string
  bypass?: string  // ← new
  username?: string
  password?: string
}
```

### Persistent Profile (`--profile`)

Persistent browser profile path for maintaining cookies/sessions.

```typescript
profile?: string  // Path to browser profile directory
```

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/server/src/browser/manager.ts` | **CRITICAL**: Fix `getSocketPath()` to use `~/.agent-browser/` |
| `packages/core/src/schema/index.ts` | Add `download` schema (consolidated with wait flag) |
| `packages/server/src/actions/executor.ts` | Wire new download actions |
| `packages/core/src/types.ts` | Add config types for new launch options |
| `packages/server/src/config.ts` | Support new launch options |

---

## Integration Checklist

### Phase 1: Critical Fix (Do First)

- [x] Update `getSocketPath()` in `packages/server/src/browser/manager.ts`
- [x] Test socket connection works with both old and new agent-browser versions
- [x] Run `bun test` to verify no regressions (515 pass)

### Phase 2: Fork Sync

- [x] Merge upstream into fork (15 commits)
- [x] Push fork with tag `v0.6.1-nav.1`
- [x] Update navigator's `bun.lock`
- [x] Run `bun run typecheck` (pass)
- [x] Run `bun test` (515 pass)

### Phase 3: New Features (Can Be Separate PRs)

- [ ] Add `download` action schema and executor (with `wait` flag)
- [ ] Add launch config extensions (browserArgs, userAgent, proxyBypass, profile)
- [ ] Update documentation

### Phase 4: Tracking Issues

- [x] Create issue: Browser Use cloud browser support → [#112](https://github.com/outfitter-dev/navigator/issues/112)
- [x] Create issue: Browserbase remote browser support → [#113](https://github.com/outfitter-dev/navigator/issues/113)
- [x] Copy upstream skill docs to `docs/_reference/upstream-agent-browser/`

### Phase 5: Cleanup

- [ ] Update CHANGELOG.md
- [ ] Update docs/_upstream/README.md index
- [ ] Close tracking issue

---

## Decision Rationale

### Socket Path (Framework E: Bug Fix → Always Adopt)

The TMPDIR inconsistency is a real problem that affects any multi-terminal workflow. The upstream fix is well-designed with clear priority order:
1. `AGENT_BROWSER_SOCKET_DIR` (explicit override)
2. `$XDG_RUNTIME_DIR/agent-browser` (Linux standard)
3. `~/.agent-browser` (fallback)

Navigator must adopt this immediately or risk broken daemon communication.

### Download Commands (Framework A: New Feature)

- Benefits agents: YES - downloading files is a valid automation use case
- Existing concept: NO
- Upstream naming: `download` and `wait --download` → Navigator uses `download` and `waitForDownload` (camelCase, verb-first)

### Cloud Browser Providers (Framework E: Vendor-Specific → Defer)

Browser Use and Browserbase integrations are vendor-specific cloud browser services. While potentially useful, they:
- Add vendor lock-in
- Require API keys and accounts
- Don't benefit local/self-hosted workflows

Defer until Navigator has a clear remote browser strategy.

---

## Links

- [Upstream commits](https://github.com/vercel-labs/agent-browser/compare/399fd7a...c046de2)
- [Fork repo](https://github.com/outfitter-dev/agent-browser)
- [Socket path fix PR (upstream)](https://github.com/vercel-labs/agent-browser/pull/180)
- [Download commands PR (upstream)](https://github.com/vercel-labs/agent-browser/pull/183)
