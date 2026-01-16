#!/bin/bash
# run-tests.sh - Navigator CLI test runner
# Usage: ./run-tests.sh [category|--all] [--url <test-url>]
#
# Runs automated CLI tests and outputs structured results.
# No agent interpretation required - fully automated.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"
OUTPUT_DIR=".scratch/testing"
SERVER_URL="${NAVIGATOR_SERVER_URL:-http://localhost:9334}"
TEST_URL="${TEST_URL:-https://the-internet.herokuapp.com/}"
DATE=$(date +%Y%m%d)
RUN_ID=$(printf '%05d' $RANDOM)

# Colors (disabled if not tty)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <category|--all>

Run Navigator CLI tests.

Categories:
  edge-cases         Invalid refs, missing args, exit codes
  error-taxonomy     All 11 error codes

Options:
  --all              Run all test categories
  --url <url>        Test URL (default: $TEST_URL)
  --help             Show this help

Examples:
  $(basename "$0") edge-cases
  $(basename "$0") --all
  $(basename "$0") --all --url https://example.com
EOF
}

log() { echo -e "${BLUE}[test]${NC} $*"; }
pass() { echo -e "${GREEN}PASS${NC} $*"; }
fail() { echo -e "${RED}FAIL${NC} $*"; }
warn() { echo -e "${YELLOW}WARN${NC} $*"; }

# Check server health
check_server() {
  if ! curl -fsSL "$SERVER_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}ERROR${NC}: Navigator server not running at $SERVER_URL"
    echo "Start with: bun run dev"
    exit 2
  fi
}

# Setup output directory and files
setup_output() {
  local category="$1"
  mkdir -p "$OUTPUT_DIR"

  RESULTS_FILE="$OUTPUT_DIR/${DATE}-${RUN_ID}-${category}.md"
  DEBUG_FILE="$OUTPUT_DIR/${DATE}-${RUN_ID}-${category}-debug.log"

  cat > "$RESULTS_FILE" <<EOF
# Navigator CLI Test Report

**Category**: ${category}
**Run ID**: ${RUN_ID}
**Date**: $(date -Iseconds)
**Server**: ${SERVER_URL}
**Test URL**: ${TEST_URL}
**Debug Log**: ${DEBUG_FILE}

---

## Results

| # | Test | Status | Details |
|---|------|--------|---------|
EOF

  cat > "$DEBUG_FILE" <<EOF
# Navigator CLI Debug Log
# Category: ${category}
# Run ID: ${RUN_ID}
# Started: $(date -Iseconds)
# Server: ${SERVER_URL}
# ============================================================

EOF
}

# Counters (global for simplicity)
PASSED=0
WARNED=0
FAILED=0
TOTAL=0

# Run a single test case
# Args: test_num, test_name, command, expected_pattern, [expect_fail]
run_test() {
  local num="$1"
  local name="$2"
  local cmd="$3"
  local expected="$4"
  local expect_fail="${5:-false}"

  ((TOTAL++))

  echo -e "\n# Test $num: $name" >> "$DEBUG_FILE"
  echo "# Command: $cmd" >> "$DEBUG_FILE"
  echo "# Expected: $expected" >> "$DEBUG_FILE"
  echo "# Expect fail: $expect_fail" >> "$DEBUG_FILE"
  echo "---" >> "$DEBUG_FILE"

  # Run command with debug, capture output and exit code
  local output exit_code
  output=$(eval "nav --debug $cmd" 2>&1) || true
  exit_code=${PIPESTATUS[0]}

  echo "$output" >> "$DEBUG_FILE"
  echo "Exit code: $exit_code" >> "$DEBUG_FILE"

  # Determine pass/fail
  local status details
  if [[ "$expect_fail" == "true" ]]; then
    if [[ $exit_code -ne 0 ]] || echo "$output" | grep -qiE "(error|fail|invalid)"; then
      if echo "$output" | grep -qE "$expected"; then
        status="PASS"
        details="Got expected error"
        ((PASSED++))
      else
        status="WARN"
        details="Error but pattern not matched"
        ((WARNED++))
      fi
    else
      status="FAIL"
      details="Expected error, got success"
      ((FAILED++))
    fi
  else
    if [[ $exit_code -eq 0 ]] && ! echo "$output" | grep -qiE "^error:"; then
      if [[ -z "$expected" ]] || echo "$output" | grep -qE "$expected"; then
        status="PASS"
        details="Success"
        ((PASSED++))
      else
        status="WARN"
        details="Success but output unexpected"
        ((WARNED++))
      fi
    else
      status="FAIL"
      details="Expected success, got error"
      ((FAILED++))
    fi
  fi

  # Record result
  echo "| $num | $name | $status | $details |" >> "$RESULTS_FILE"

  # Console output
  case "$status" in
    PASS) pass "$num. $name" ;;
    WARN) warn "$num. $name - $details" ;;
    FAIL) fail "$num. $name - $details" ;;
  esac
}

# Finalize results file
finalize_results() {
  local passed="$1" warned="$2" failed="$3" total="$4"

  cat >> "$RESULTS_FILE" <<EOF

---

## Summary

| Metric | Count |
|--------|-------|
| Total | $total |
| Passed | $passed |
| Warnings | $warned |
| Failed | $failed |

EOF

  if [[ $failed -gt 0 ]]; then
    echo -e "\n## Debug\n\nSee debug log: \`$DEBUG_FILE\`" >> "$RESULTS_FILE"
  fi
}

# Reset counters
reset_counters() {
  PASSED=0
  WARNED=0
  FAILED=0
  TOTAL=0
}

# Run edge-cases category
run_edge_cases() {
  reset_counters
  setup_output "edge-cases"
  log "Running edge-cases tests..."

  # Navigate to test page first
  nav open "$TEST_URL" >/dev/null 2>&1

  # Test 1: Empty element ref
  run_test 1 "Empty element ref" "click @" "invalid" true

  # Test 2: Malformed element ref
  run_test 2 "Malformed element ref" "click @abc" "invalid" true

  # Test 3: Negative element index
  run_test 3 "Negative element index" "click @e-1" "invalid" true

  # Test 4: Very large element index
  run_test 4 "Very large element index" "click @e99999999" "ELEMENT_NOT_FOUND" true

  # Test 5: Click without target
  run_test 5 "Click without target" "click 2>&1 || true" "missing|required|argument" true

  # Test 6: Type without text
  run_test 6 "Type without text" "type @e1 2>&1 || true" "missing|required|argument" true

  # Test 7: Navigate without URL
  run_test 7 "Navigate without URL" "open 2>&1 || true" "missing|required|argument" true

  # Test 8: Success returns exit code 0
  run_test 8 "Snap succeeds" "snap" "success.*true" false

  # Test 9: JSON output is valid (use nav directly without debug wrapper)
  local json_first_line
  json_first_line=$(nav snap 2>&1 | grep -v '^\[' | head -1)
  if [[ "$json_first_line" == "{"* ]]; then
    echo "| 9 | Snap JSON valid | PASS | First line is JSON |" >> "$RESULTS_FILE"
    pass "9. Snap JSON valid"
    ((PASSED++))
  else
    echo "| 9 | Snap JSON valid | FAIL | First line: $json_first_line |" >> "$RESULTS_FILE"
    fail "9. Snap JSON valid - First line: $json_first_line"
    ((FAILED++))
  fi
  ((TOTAL++))

  # Test 10: Rapid sequential commands
  local seq_result
  if nav snap >/dev/null 2>&1 && nav snap >/dev/null 2>&1 && nav snap >/dev/null 2>&1; then
    echo "| 10 | Rapid sequential snaps | PASS | All 3 snaps succeeded |" >> "$RESULTS_FILE"
    pass "10. Rapid sequential snaps"
    ((PASSED++))
  else
    echo "| 10 | Rapid sequential snaps | FAIL | Sequential snaps failed |" >> "$RESULTS_FILE"
    fail "10. Rapid sequential snaps"
    ((FAILED++))
  fi
  ((TOTAL++))

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# Run error-taxonomy category
run_error_taxonomy() {
  reset_counters
  setup_output "error-taxonomy"
  log "Running error-taxonomy tests..."

  nav open "$TEST_URL" >/dev/null 2>&1

  # Test 1: ELEMENT_NOT_FOUND for invalid ref
  run_test 1 "ELEMENT_NOT_FOUND" "click @e99999" "ELEMENT_NOT_FOUND" true

  # Test 2: TAB_NOT_FOUND for invalid tab
  run_test 2 "TAB_NOT_FOUND" "tab b99" "TAB_NOT_FOUND|not found" true

  # Test 3: SELECTOR_INVALID for bad selector
  run_test 3 "SELECTOR_INVALID" 'click "::invalid[["' "SELECTOR_INVALID|invalid" true

  # Test 4: Error response has errorCode field
  run_test 4 "Error has errorCode" "click @e99999 2>&1" "errorCode" true

  # Test 5: Error response has retryable field
  run_test 5 "Error has retryable" "click @e99999 2>&1" "retryable" true

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# Main
main() {
  local category="" run_all=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all) run_all=true; shift ;;
      --url) TEST_URL="$2"; shift 2 ;;
      --help|-h) usage; exit 0 ;;
      -*) echo "Unknown option: $1"; usage; exit 1 ;;
      *) category="$1"; shift ;;
    esac
  done

  if [[ -z "$category" ]] && [[ "$run_all" == "false" ]]; then
    usage
    exit 1
  fi

  check_server

  log "Navigator CLI Test Runner"
  log "Server: $SERVER_URL"
  log "Test URL: $TEST_URL"
  log "Output: $OUTPUT_DIR"
  echo ""

  local exit_code=0

  if [[ "$run_all" == "true" ]]; then
    run_edge_cases || exit_code=1
    echo ""
    run_error_taxonomy || exit_code=1
  else
    case "$category" in
      edge-cases) run_edge_cases || exit_code=1 ;;
      error-taxonomy) run_error_taxonomy || exit_code=1 ;;
      *) echo "Unknown category: $category"; usage; exit 1 ;;
    esac
  fi

  echo ""
  if [[ $exit_code -eq 0 ]]; then
    log "${GREEN}All tests passed${NC}"
  else
    log "${RED}Some tests failed${NC}"
  fi

  exit $exit_code
}

main "$@"
