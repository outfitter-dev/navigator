# 07 - Integration

Wire all components together and prepare for release.

## Overview

This phase connects all Navigator components:

1. Server ← agent-browser integration
2. MCP ← Server communication
3. CLI ← Server communication
4. Extension ← Server WebSocket
5. Claude plugin packaging
6. Documentation and testing

## Server Setup

### Main Entry

```typescript
// packages/server/src/index.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createBunWebSocket } from 'hono/bun'
import { BrowserManager } from './browser/manager'
import { ActionExecutor } from './executor'
import { SessionManager } from './session/manager'

const app = new Hono()
const { upgradeWebSocket, websocket } = createBunWebSocket()

// Browser instance
const browser = new BrowserManager()

// HTTP routes
app.post('/action', async (c) => {
  const body = await c.req.json()
  const projectPath = c.req.header('X-Project-Path') || process.cwd()
  const sessionId = c.req.header('X-Session-Id')

  const executor = new ActionExecutor(projectPath, browser)
  const result = await executor.execute(body, sessionId)

  return c.json(result)
})

app.get('/health', (c) => c.json({ status: 'ok' }))

// WebSocket for extension (Paired mode)
app.get('/ws', upgradeWebSocket((c) => ({
  onOpen(event, ws) {
    console.log('Extension connected')
  },
  onMessage(event, ws) {
    const message = JSON.parse(event.data)
    handleExtensionMessage(message, ws)
  },
  onClose() {
    console.log('Extension disconnected')
  },
})))

// Start server
const port = process.env.PORT || 9334
console.log(`Navigator server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  websocket,
}
```

### Browser Manager

```typescript
// packages/server/src/browser/manager.ts
import { Browser, launch } from '@outfitter/agent-browser'

export class BrowserManager {
  private browser: Browser | null = null
  private mode: 'headless' | 'windowed' | 'paired' = 'headless'

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await launch({
        headless: this.mode === 'headless',
      })
    }
    return this.browser
  }

  setMode(mode: 'headless' | 'windowed' | 'paired') {
    this.mode = mode
    // Paired mode uses extension, not Playwright
    if (mode === 'paired') {
      this.browser?.close()
      this.browser = null
    }
  }

  async close() {
    await this.browser?.close()
    this.browser = null
  }
}
```

## Monorepo Configuration

### Root package.json

```json
{
  "name": "navigator",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --filter @outfitter/navigator-server dev",
    "dev:mcp": "bun run --filter @outfitter/navigator-mcp dev",
    "build": "bun run --filter '*' build",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "bun test"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.6.0"
  }
}
```

### Root tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/server" },
    { "path": "./packages/mcp" },
    { "path": "./packages/cli" },
    { "path": "./packages/extension" }
  ]
}
```

## Claude Plugin

### Plugin Structure

```
packages/agents/
├── .claude-plugin
├── agents/
│   └── navigator.yaml
├── skills/
│   └── browser-automation.md
└── commands/
    └── nav.yaml
```

### Plugin Manifest

```yaml
# .claude-plugin
name: navigator
version: 0.1.0
description: Browser automation for AI agents

mcp:
  command: navigator-mcp

agents:
  - agents/navigator.yaml

skills:
  - skills/browser-automation.md

commands:
  - commands/nav.yaml
```

### Navigator Agent

```yaml
# agents/navigator.yaml
name: navigator
description: Launches browser automation agent
trigger: browser, navigate, web, scrape

skills:
  - browser-automation

system: |
  You are a browser automation specialist using Navigator.

  Key patterns:
  - Use `snap` to get element refs before interaction
  - Refs look like `@e42` - use these for click/type
  - Take fresh snapshots after navigation changes DOM
  - Create markers to annotate important UI elements
```

### Browser Automation Skill

```markdown
# Browser Automation

Control browsers through the Navigator MCP tool.

## Quick Reference

| Action | Example |
|--------|---------|
| Navigate | `{ "action": "navigate", "url": "..." }` |
| Snapshot | `{ "action": "snap" }` |
| Click | `{ "action": "click", "ref": "@e42" }` |
| Type | `{ "action": "type", "ref": "@e15", "text": "..." }` |

## Workflow

1. Navigate to page
2. Take snapshot to get element refs
3. Interact using refs
4. Take new snapshot if DOM changes

## Element Refs

After `snap`, elements have refs like `@e42`. Symbol prefixes:
- `#` = text input
- `@` = link
- `$` = button/clickable
- `%` = image

## Markers

Create markers to annotate:
- `{ "action": "marker", "geometry": {...}, "note": "..." }`
- `{ "action": "markerRead" }` → markdown for context
```

## Test Scenarios

### E2E Test: Navigation Flow

```typescript
// tests/e2e/navigation.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

describe('Navigation Flow', () => {
  let server: Subprocess

  beforeAll(async () => {
    server = Bun.spawn(['bun', 'run', 'dev'], { cwd: 'packages/server' })
    await new Promise(r => setTimeout(r, 2000)) // Wait for startup
  })

  afterAll(() => {
    server.kill()
  })

  test('navigate and snapshot', async () => {
    // Navigate
    const nav = await fetch('http://localhost:9334/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'navigate', url: 'https://example.com' }),
    })
    expect(nav.ok).toBe(true)

    // Snapshot
    const snap = await fetch('http://localhost:9334/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snap' }),
    })
    const result = await snap.json()
    expect(result.tree).toBeDefined()
    expect(result.refs).toBeDefined()
  })

  test('click element', async () => {
    // First get snapshot
    const snap = await fetch('http://localhost:9334/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snap' }),
    })
    const { refs } = await snap.json()

    // Click first link
    const linkRef = Object.entries(refs).find(([, v]) => v.type === 'link')?.[0]
    if (linkRef) {
      const click = await fetch('http://localhost:9334/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', ref: linkRef }),
      })
      expect(click.ok).toBe(true)
    }
  })
})
```

### CLI Integration Test

```typescript
// tests/e2e/cli.test.ts
import { describe, test, expect } from 'bun:test'
import { $ } from 'bun'

describe('CLI', () => {
  test('nav --help', async () => {
    const result = await $`nav --help`.text()
    expect(result).toContain('Browser automation CLI')
    expect(result).toContain('Commands:')
  })

  test('nav open', async () => {
    const result = await $`nav open https://example.com`.text()
    expect(result).toContain('Navigated to')
  })

  test('nav snap', async () => {
    const result = await $`nav snap`.text()
    expect(result).toContain('e1') // Should have element refs
  })
})
```

## Documentation

### README.md (root)

```markdown
# Navigator

Browser automation for AI agents.

## Quick Start

\`\`\`bash
# Install
bun install

# Start server
bun run dev

# CLI
nav open https://example.com
nav snap                    # Get element refs
nav click @e1               # Click element
\`\`\`

## MCP (Claude Code)

Install the Navigator plugin, then use the `navigator` tool:

\`\`\`json
{ "action": "navigate", "url": "https://example.com" }
{ "action": "snap" }
{ "action": "click", "ref": "@e42" }
\`\`\`

## Chrome Extension

1. Load unpacked from `packages/extension/dist`
2. Click Navigator icon
3. Enable marker mode to annotate
4. "Copy to Agent" for markdown context
\`\`\`
```

## Verification Checklist

### Core Functionality

- [ ] `nav open <url>` opens URL in browser
- [ ] `nav snap` returns element tree with refs
- [ ] `nav click @e1` clicks correct element
- [ ] `nav type @e1 "text"` types into input
- [ ] Screenshots capture correctly

### Session Management

- [ ] Sessions auto-continue within 30 minutes
- [ ] `--session <id>` overrides auto-continuation
- [ ] Steps log to JSONL correctly
- [ ] Git ref captured when in repo

### Markers

- [ ] Extension creates point markers
- [ ] Extension creates region markers
- [ ] Notes attach to markers
- [ ] `markerRead` produces clean markdown

### MCP Integration

- [ ] MCP tool lists in Claude Code
- [ ] Actions execute correctly
- [ ] Error messages are clear

### Paired Mode

- [ ] Extension connects via WebSocket
- [ ] Actions execute in user's browser
- [ ] Results return to server

## Release Checklist

- [ ] All tests passing
- [ ] TypeScript compiles without errors
- [ ] Biome lint clean
- [ ] Documentation complete
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] npm packages published
- [ ] GitHub release created
- [ ] Claude plugin published

## Dependencies

- All previous phases complete
- `@outfitter/agent-browser` published to npm
