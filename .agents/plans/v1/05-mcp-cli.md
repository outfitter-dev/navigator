# 05 - MCP & CLI

Implement the MCP server and CLI for Navigator.

## Overview

Navigator exposes browser automation through two interfaces:

- **MCP**: Single `navigator` tool for AI agents (Claude Code, etc.)
- **CLI**: `nav` command for direct terminal usage

Both interfaces share the same action executor and session management.

## Architecture

```
┌──────────────┐     ┌──────────────┐
│   MCP Tool   │     │   CLI (nav)  │
│  (navigator) │     │              │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │   HTTP POST        │
       └────────┬───────────┘
                │
                ▼
       ┌────────────────┐
       │ navigator-server│
       │   (Hono)       │
       └────────┬───────┘
                │
                ▼
       ┌────────────────┐
       │  agent-browser │
       │  (Playwright)  │
       └────────────────┘
```

## MCP Server

### Single Tool Pattern

Instead of 26+ separate tools, Navigator uses one `navigator` tool with action routing via discriminated union.

```typescript
// packages/mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ActionSchema } from '@outfitter/navigator-core/schema'

const server = new Server(
  { name: 'navigator', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'navigator',
    description: 'Browser automation for AI agents. Single tool with action routing.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: [
            'navigate', 'back', 'forward', 'reload',
            'click', 'type', 'select', 'hover', 'scroll',
            'snap', 'screenshot', 'html', 'text',
            'marker', 'markers', 'markerGet', 'markerRead',
            'tab', 'tabs', 'newTab', 'closeTab',
            'viewport', 'colorScheme', 'mode',
            'wait', 'waitFor', 'waitForNavigation',
          ],
        },
        // Action-specific parameters follow
        url: { type: 'string', description: 'URL for navigate action' },
        ref: { type: 'string', description: 'Element ref (e.g., @e42) for click/type' },
        text: { type: 'string', description: 'Text to type' },
        // ... more parameters
      },
      required: ['action'],
    },
  }],
}))

server.setRequestHandler('tools/call', async (request) => {
  const { action, ...params } = request.params.arguments

  // Validate with Zod
  const parsed = ActionSchema.parse({ action, ...params })

  // Execute via HTTP to navigator-server
  const response = await fetch('http://localhost:9334/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  const result = await response.json()
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
```

### Tool Description

The tool description should guide agents on usage:

```markdown
Browser automation for AI agents.

**Actions:**
- Navigation: navigate, back, forward, reload
- Interaction: click, type, select, hover, scroll
- Capture: snap (with element refs), screenshot, html, text
- Markers: marker, markers, markerGet, markerRead
- Tabs: tab, tabs, newTab, closeTab
- Display: viewport, colorScheme, mode

**Element Refs:**
After `snap`, elements have refs like `@e42`. Use these for click/type.
Refs may become stale after navigation—take a fresh snap if needed.

**Examples:**
- `{ "action": "navigate", "url": "https://example.com" }`
- `{ "action": "snap" }` → Returns element tree with refs
- `{ "action": "click", "ref": "@e42" }`
- `{ "action": "type", "ref": "@e15", "text": "hello" }`
```

## CLI

### Command Structure

```
nav <command> [options]

Commands:
  nav open <url>              Open URL in browser
  nav snap                    Snapshot with element refs
  nav click <ref>             Click element
  nav type <ref> <text>       Type into element
  nav back                    Go back
  nav forward                 Go forward
  nav reload                  Reload page

  nav mark                    Create marker (interactive)
  nav markers                 List markers
  nav marker <id>             Get marker details

  nav tabs                    List open tabs
  nav tab <id>                Switch to tab

  nav screenshot [path]       Take screenshot

Global Options:
  -s, --session <id>          Use specific session
  -p, --project <path>        Project root (auto-detected)
  --port <number>             Server port (default: 9334)
  -h, --help                  Show help
```

### Implementation

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander'
import { createClient } from './client'
import { detectProjectRoot } from '@outfitter/navigator-core/project'

const program = new Command()
  .name('nav')
  .description('Browser automation CLI')
  .version('0.1.0')

// Global options
program
  .option('-s, --session <id>', 'Use specific session')
  .option('-p, --project <path>', 'Project root')
  .option('--port <number>', 'Server port', '9334')

// Navigation commands
program
  .command('open <url>')
  .description('Open URL in browser')
  .action(async (url) => {
    const client = createClient(program.opts())
    const result = await client.execute({ action: 'navigate', url })
    console.log('Navigated to:', result.url)
  })

program
  .command('snap')
  .description('Snapshot page with element refs')
  .option('-i, --interactive', 'Interactive elements only')
  .option('-f, --full', 'Full page')
  .action(async (options) => {
    const client = createClient(program.opts())
    const result = await client.execute({
      action: 'snap',
      fullPage: options.full,
      interactive: options.interactive,
    })
    console.log(result.tree)
  })

program
  .command('click <ref>')
  .description('Click element by ref')
  .action(async (ref) => {
    const client = createClient(program.opts())
    await client.execute({ action: 'click', ref })
    console.log('Clicked:', ref)
  })

program
  .command('type <ref> <text>')
  .description('Type text into element')
  .option('-c, --clear', 'Clear existing text first')
  .action(async (ref, text, options) => {
    const client = createClient(program.opts())
    await client.execute({
      action: 'type',
      ref,
      text,
      clear: options.clear,
    })
    console.log('Typed into:', ref)
  })

// Marker commands
program
  .command('mark')
  .description('Create marker (opens browser for selection)')
  .action(async () => {
    const client = createClient(program.opts())
    // This would trigger marker mode in the browser
    console.log('Click or drag on the page to create a marker...')
    // ... wait for marker creation via WebSocket
  })

program
  .command('markers')
  .description('List all markers')
  .option('--md', 'Output as markdown')
  .action(async (options) => {
    const client = createClient(program.opts())
    const result = await client.execute({
      action: 'markers',
      format: options.md ? 'markdown' : 'json',
    })
    console.log(result)
  })

// Parse and run
program.parse()
```

### HTTP Client

```typescript
// packages/cli/src/client.ts
import { ActionSchema } from '@outfitter/navigator-core/schema'
import { detectProjectRoot } from '@outfitter/navigator-core/project'
import type { Action } from '@outfitter/navigator-core/schema'

interface ClientOptions {
  port?: string
  session?: string
  project?: string
}

export function createClient(options: ClientOptions) {
  const port = options.port || '9334'
  const baseUrl = `http://localhost:${port}`
  const projectPath = options.project || detectProjectRoot() || process.cwd()

  return {
    async execute(action: Action): Promise<unknown> {
      // Validate action
      ActionSchema.parse(action)

      const response = await fetch(`${baseUrl}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Path': projectPath,
          ...(options.session && { 'X-Session-Id': options.session }),
        },
        body: JSON.stringify(action),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Action failed')
      }

      return response.json()
    },
  }
}
```

## Server Endpoints

```typescript
// packages/server/src/routes/action.ts
import { Hono } from 'hono'
import { ActionSchema } from '@outfitter/navigator-core/schema'
import { ActionExecutor } from '../executor'

const app = new Hono()

app.post('/action', async (c) => {
  const body = await c.req.json()

  // Validate
  const action = ActionSchema.parse(body)

  // Get context from headers
  const projectPath = c.req.header('X-Project-Path') || process.cwd()
  const sessionId = c.req.header('X-Session-Id')

  // Execute
  const executor = new ActionExecutor(projectPath, browser)
  const result = await executor.execute(action, sessionId)

  return c.json(result)
})
```

## Package Configuration

### MCP Package

```json
// packages/mcp/package.json
{
  "name": "@outfitter/navigator-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "navigator-mcp": "./dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@outfitter/navigator-core": "workspace:*"
  }
}
```

### CLI Package

```json
// packages/cli/package.json
{
  "name": "@outfitter/navigator-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "nav": "./dist/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "@outfitter/navigator-core": "workspace:*"
  }
}
```

## Verification

- [ ] MCP tool responds to `tools/list`
- [ ] MCP tool executes actions correctly
- [ ] CLI commands map to correct actions
- [ ] Session ID passed through headers
- [ ] Project path auto-detected
- [ ] Error messages clear and actionable

## Dependencies

- Phase 2 complete (core types)
- Phase 3 complete (sessions)
- Server running (phase 5 parallel)

## Reference

See trails codebase patterns:
- `packages/mcp/` for MCP server structure
- `packages/cli/` for CLI organization
