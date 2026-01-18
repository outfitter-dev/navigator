---
name: test-cli
description: Run Navigator CLI stress tests
argument-hint: "[category|--all]"
allowed-tools: Bash(./.claude/scripts/run-tests.sh *)
---

# Navigator CLI Tests

Run automated CLI tests via the test runner script.

## Usage

```bash
# Run single category
./.claude/scripts/run-tests.sh edge-cases

# Run all categories
./.claude/scripts/run-tests.sh --all

# Custom test URL
./.claude/scripts/run-tests.sh --all --url https://example.com
```

## Categories

- `edge-cases` - Invalid refs, missing args, exit codes
- `error-taxonomy` - All 11 error codes

## Output

Results go to `.scratch/testing/`:
- `{date}-{id}-{category}.md` - Structured results
- `{date}-{id}-{category}-debug.log` - Raw debug output

## Exit Codes

- `0` - All tests passed
- `1` - Some tests failed
- `2` - Setup error (server not running)
