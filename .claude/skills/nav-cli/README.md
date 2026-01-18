# Navigator CLI Testing

Automated stress tests for Navigator CLI.

## Quick Start

```bash
# Start server
bun run dev

# Run tests
./.claude/scripts/run-tests.sh edge-cases
./.claude/scripts/run-tests.sh --all
```

## Structure

```
.claude/
├── commands/test/cli.md     # Command definition
├── scripts/run-tests.sh     # Test runner (all logic here)
└── skills/nav-cli/README.md # This file
```

## Test Categories

| Category | Tests | What It Validates |
|----------|-------|-------------------|
| `edge-cases` | 10 | Invalid refs, missing args, exit codes |
| `error-taxonomy` | 5 | Error codes from PR #30 |

## Output

```
.scratch/testing/
├── 20260116-abc12-edge-cases.md        # Results table
├── 20260116-abc12-edge-cases-debug.log # Debug output
└── ...
```

## Adding Tests

Edit `.claude/scripts/run-tests.sh`:

```bash
# Add a test to existing category
run_test 11 "New test name" "nav command" "expected_pattern" true  # true = expect error

# Add new category
run_new_category() {
  reset_counters
  setup_output "new-category"
  log "Running new-category tests..."

  nav open "$TEST_URL" >/dev/null 2>&1

  run_test 1 "Test name" "command" "pattern" false
  # ... more tests

  finalize_results $PASSED $WARNED $FAILED $TOTAL
  # ... standard footer
}
```

Then add to `main()`:
```bash
new-category) run_new_category || exit_code=1 ;;
```

## Exit Codes

- `0` - All passed
- `1` - Failures
- `2` - Setup error
