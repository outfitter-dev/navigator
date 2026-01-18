---
name: ops-test-cli
description: Run Navigator CLI validation tests
argument-hint: "[category|--all]"
allowed-tools: Read Glob Grep Skill TodoWrite Bash(./.claude/scripts/run-tests.sh *) Bash(nav *) Bash(nav-dev *)
---

# Navigator CLI Tests

Run automated CLI tests via the test runner script.

## Quick Run

```bash
./.claude/scripts/run-tests.sh [category|--all]
```

## Categories

| Category | Tests | Focus |
|----------|-------|-------|
| `edge-cases` | 10 | Invalid refs, missing args, exit codes |
| `error-taxonomy` | 5 | All error codes validation |

## Usage

```bash
# Run single category
./.claude/scripts/run-tests.sh edge-cases

# Run all categories
./.claude/scripts/run-tests.sh --all

# Custom test URL
./.claude/scripts/run-tests.sh --all --url https://example.com
```

## Output

Results written to `.scratch/testing/`:
- `{date}-{id}-{category}.md` - Markdown report
- `{date}-{id}-{category}-debug.log` - Debug output

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Setup or usage error |

## Result Classifications

| Result | Meaning |
|--------|---------|
| **PASS** | Behaves as expected |
| **WARN** | Works but unexpected output |
| **FAIL** | Broken behavior or wrong exit code |

## When to Use

- After modifying CLI option parsing
- Before releases
- To validate error handling
- CI pipelines (deterministic, fast)
