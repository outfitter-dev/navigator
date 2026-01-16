---
name: ops-test-mcp
description: Run Navigator MCP server tests
argument-hint: "[category|--all]"
allowed-tools: Read Glob Grep Skill TodoWrite Bash(./.claude/scripts/run-mcp-tests.sh *) Bash(nav *) Bash(nav-dev *)
---

# Navigator MCP Tests

Run automated MCP server tests via JSON-RPC protocol.

## Quick Run

```bash
./.claude/scripts/run-mcp-tests.sh [category|--all]
```

## Categories

| Category | Tests | Focus |
|----------|-------|-------|
| `schema-validation` | 7 | Input schema validation (Zod) |
| `action-routing` | 7 | Action dispatch and routing |
| `error-responses` | 4 | Error codes and formatting |
| `response-formatting` | 4 | Response structure validation |

## Usage

```bash
# Run single category
./.claude/scripts/run-mcp-tests.sh schema-validation

# Run all categories
./.claude/scripts/run-mcp-tests.sh --all
```

## Output

Results written to `.scratch/testing/`:
- `{date}-{id}-mcp-{category}.md` - Markdown report
- `{date}-{id}-mcp-{category}-debug.log` - Debug output

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Setup or usage error (server not running, jq missing) |

## Result Classifications

| Result | Meaning |
|--------|---------|
| **PASS** | Behaves as expected |
| **WARN** | Works but unexpected output |
| **FAIL** | Broken behavior or wrong exit code |

## When to Use

- After modifying MCP server handlers
- Before releases
- To validate protocol compliance
- CI pipelines (deterministic, fast)
