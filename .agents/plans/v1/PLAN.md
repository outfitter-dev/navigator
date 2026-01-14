# Navigator v1 Implementation Plan

Browser automation for AI agents. Clean, simple, contributable.

## Project Overview

**Repository**: `@outfitter/navigator`
**CLI**: `nav`
**Dependency**: `@outfitter/agent-browser` (fork)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User / Agent                         │
├─────────────┬─────────────┬─────────────────────────────┤
│   CLI (nav) │  MCP Server │  Chrome Extension           │
├─────────────┴─────────────┴─────────────────────────────┤
│                  Navigator Core                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐│
│  │ Sessions │ │  Steps   │ │ Markers  │ │  Snapshots  ││
│  └──────────┘ └──────────┘ └──────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────┤
│              @outfitter/agent-browser                    │
│         (Playwright wrapper, element refs)               │
└─────────────────────────────────────────────────────────┘
```

## Terminology

| Concept | Name | Notes |
|---------|------|-------|
| Action log | **Steps** | User/agent actions recorded |
| Step grouping | **Sequence** | Internal only, not user-facing |
| Annotations | **Markers** | Click = point, drag = rectangle |
| User browser mode | **Paired** | Agent works in user's browser |

## Build Sequence

### Phase 1: Foundation
1. **Fork Setup** → `01-fork-setup.md`
   - Fork agent-browser to @outfitter/agent-browser
   - Set up build, CI, publish workflow
   - No changes to code initially

2. **Core Types** → `02-core-types.md`
   - Storage paths (XDG-compliant)
   - Zod schemas for actions, steps, sessions
   - Project root detection

### Phase 2: Data Model
3. **Sessions & Steps** → `03-sessions-steps.md`
   - Session model (meta.json, steps.jsonl)
   - Auto-continuation logic (same project + <30min)
   - `--session <id>` override
   - Git ref capture (optional)

4. **Markers** → `04-markers.md`
   - Point markers (click)
   - Region markers (drag rectangle)
   - Notes attached to markers
   - "Copy to Agent" markdown output

### Phase 3: Interfaces
5. **MCP & CLI** → `05-mcp-cli.md`
   - Single `navigator` MCP tool with action routing
   - Full CLI command parity (`nav open`, `nav click`, etc.)
   - Shared action executor

6. **Extension** → `06-extension.md`
   - Chrome extension for Paired mode
   - Marker creation UI
   - WebSocket connection to server
   - "Copy to Agent" clipboard integration

### Phase 4: Integration
7. **End-to-End** → `07-integration.md`
   - Wire all components together
   - Test scenarios
   - Claude plugin packaging
   - Documentation

## Package Structure

```
packages/
├── core/           # Types, schemas, storage paths
├── server/         # Hono HTTP/WS, browser control
├── mcp/            # MCP server wrapper
├── cli/            # CLI commands
├── extension/      # Chrome extension (Vite + React)
└── agents/         # Claude plugin
```

## Storage Layout

```
~/.local/share/navigator/           # XDG_DATA_HOME
└── {project-hash}/
    └── sessions/
        └── {session-id}/
            ├── meta.json           # Session metadata
            ├── steps.jsonl         # Action log
            └── markers/
                └── {marker-id}.json
```

## Success Criteria

- [ ] `nav open https://example.com` works
- [ ] `nav snap` captures with element refs
- [ ] `nav click @e1` clicks element
- [ ] Sessions auto-continue within 30min
- [ ] Extension creates markers in Paired mode
- [ ] "Copy to Agent" produces clean markdown
- [ ] MCP tool works in Claude Code

## Reference

Agents can reference the trails codebase at `../trails/` for implementation patterns:
- Session model: `packages/server/src/session/`
- Markers: `packages/server/src/markers/`
- Action executor: `packages/server/src/executor/`
- CLI: `packages/cli/src/`
