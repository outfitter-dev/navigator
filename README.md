# Navigator

Browser automation for AI agents. Clean, simple, contributable.

Navigator exposes a single action-based MCP tool, supports selector-first interactions, and includes a marker system for durable UI annotations.

## Built on agent-browser

Navigator extends [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser), adding paired mode (work in your browser via Chrome extension), a marker system for UI annotations, session continuity, and other UX enhancements for AI agents.

We maintain a fork at [@outfitter/agent-browser](https://github.com/outfitter-dev/agent-browser). As we develop enhancements that benefit the broader community, we contribute them back upstream.

**Contribution process:**
1. Implement and test changes in our fork
2. File a PR against [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)

## Features

- **Single MCP tool** — One `navigator` tool with action routing (not 26+ separate tools)
- **CLI** — `nav open`, `nav click`, `nav snap`, `nav marker`
- **Paired mode** — Agent works in your browser via Chrome extension
- **Markers** — Click to annotate, copy to agent with notes
- **Sessions** — Auto-continuation within 30min, step logging
- **Element refs** — `e{index}` format (e.g., `e42`) with symbol prefixes (`@` link, `$` button, `#` input)

## Quick Start

```bash
# Install dependencies
bun install

# Start the server (HTTP + WebSocket on :9334)
bun run dev

# Start MCP server (optional)
bun run dev:mcp
```

### CLI

```bash
# Navigate and interact
nav open https://example.com
nav snap                      # Snapshot with element refs
nav snap -i                   # Interactive elements only
nav click @e1                 # Click element by ref
nav type "#e2" "hello"        # Type into input

# Markers
nav marker set homepage        # Save current page as marker
nav marker list                # List all markers
nav marker read homepage       # Get marker content

# Sessions
nav session                   # Show current session
nav steps                     # List recent steps
```

### MCP (Claude Code)

Install the navigator plugin:

```bash
nav install --plugin claude
```

Then use the `navigator` tool with action routing:

```json
{ "action": "navigate", "url": "https://example.com" }
{ "action": "snap", "interactive": true }
{ "action": "click", "ref": "e1" }
```

## Storage

```
~/.local/share/navigator/{project-hash}/sessions/
├── {session-id}/
│   ├── meta.json           # Session metadata
│   ├── steps.jsonl         # Action log
│   └── markers/
│       └── {marker-id}.json
```

## Documentation

See [`.agents/plans/v1/PLAN.md`](.agents/plans/v1/PLAN.md) for architecture and implementation details.

## License

MIT
