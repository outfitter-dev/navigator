# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Development
bun run dev                    # Start navigator-server (HTTP + WebSocket on :9334)
bun run dev:mcp                # Start MCP server

# Build
bun run build                  # Build all packages
bun run --filter @outfitter/navigator-server build
bun run --filter @outfitter/navigator-extension build

# Quality
bun run lint                   # Biome check
bun run lint:fix               # Biome check --write
bun run format                 # Biome format --write
bun run typecheck              # TypeScript --noEmit for all packages

# Testing
bun test                       # Run all tests
bun test packages/server/tests/marker-store.test.ts  # Single test file

# CLI (after bun link in packages/cli)
nav --help
nav open https://example.com
nav snap -i                    # Interactive elements only
nav click @e1                  # Click element ref
nav install --plugin claude    # Install Claude plugin
```

## Architecture

Navigator is a unified browser control system for AI agents. Single-action MCP pattern: one `navigator` tool with action routing instead of 26+ separate tools.

### Built on agent-browser

Navigator extends [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser), adding paired mode, markers, sessions, and UX enhancements. We maintain a fork at [@outfitter/agent-browser](https://github.com/outfitter-dev/agent-browser) and contribute general-purpose improvements back upstream.

**Keeping the fork current:** Use `/flow:agent-browser` to sync with upstream. It automatically detects changes, handles clean updates, and guides through breaking changes with subagent dispatch. See also `/agent-browser:check`, `/agent-browser:sync`, `/agent-browser:update`.

### Packages

```
packages/
├── core/       # Types, Zod schemas, config loader
├── server/     # Hono HTTP/WS server, browser control via @outfitter/agent-browser (Playwright)
├── mcp/        # MCP server wrapping navigator-server
├── cli/        # CLI wrapper sending actions to server
├── extension/  # Chrome extension for paired mode (Vite + React)
├── ui/         # Shared React components (shadcn-style)
└── agents/     # Claude Code plugin (.claude-plugin)
```

### Browser Modes

- **headless**: Agent-controlled, invisible (tabs: b0, b1, b2)
- **windowed**: Visible browser for debugging
- **paired**: User's browser via Chrome extension (tabs: 0, 1, 2)

### Sessions

Navigator supports session continuity with auto-continuation:
- Sessions auto-continue by default within a project
- Override with `--session <id>` to resume a specific session
- Sessions persist action history, markers, and browser state

### Element Reference System

Element refs use format `e{index}_{version}` (e.g., `e42_1`). Shorthand `e42` implies current snap.

**Workflow note**: Refs point to DOM elements by index. After page-changing actions (click, navigate), DOM may change - take a fresh snap if refs fail. Use shorthand (`e1`) to skip version validation.

### Action Categories (MCP)

Actions are validated via Zod discriminated union in `packages/core/src/schema/index.ts`:
- Navigation: navigate, back, forward, reload
- Tabs: tab, tabs, newTab, closeTab
- Interaction: click, type, select, hover, focus, scroll
- Wait: waitFor, waitForNavigation, wait
- Capture: screenshot, snap, html, text
- Markers: marker, markers, markerGet, markerRead, markerCompare, etc.
- Display: viewport, colorScheme, mode
- Routes: run, replay

### Data Flow

```
CLI/MCP → HTTP POST /action → navigator-server → agent-browser (Playwright)
Extension → WebSocket /ws → paired-manager → action-executor
```

### Storage Locations

- Data: `~/.local/share/navigator/`
- Markers: `~/.local/share/navigator/{project}/markers/`
- Steps: `~/.local/share/navigator/{project}/steps/`
- Step log: `~/.local/share/navigator/{project}/step-log.jsonl`

## Code Style

- Biome for linting/formatting (tabs, single quotes, no semicolons)
- Strict TypeScript with Zod runtime validation
- Hono for HTTP server
- Bun runtime and test runner
- Tests: `*.test.ts` in `packages/server/tests/`

## Git Conventions

- Branch names: `feature/area/slug`, `fix/area/slug`, or `fix/issue-123`
- Commits: Conventional format with optional scope (`feat: ...`, `fix(extension): ...`, `refactor: ...`)
- Graphite workflow: use `gt create` / `gt submit` for stacked PRs
- PRs: small and focused (<300 lines), include description, linked issue, test output
