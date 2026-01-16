#!/bin/bash
# run-tests.sh - Navigator CLI test runner
# Usage: ./run-tests.sh [category|--all] [--url <test-url>]
#
# Runs automated CLI tests and outputs structured results.
# Uses shared test-runner-lib.sh for common patterns.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared library
source "$SCRIPT_DIR/lib/test-runner-lib.sh"

# ============================================================================
# Navigator-specific configuration
# ============================================================================

SERVER_URL="${NAVIGATOR_SERVER_URL:-http://localhost:9334}"
TEST_URL="${TEST_URL:-https://the-internet.herokuapp.com/}"
OUTPUT_DIR=".scratch/testing"

# ============================================================================
# CLI Usage
# ============================================================================

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

# ============================================================================
# Dependency Checks
# ============================================================================

check_server() {
  if ! curl -fsSL "$SERVER_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}ERROR${NC}: Navigator server not running at $SERVER_URL"
    echo "Start with: bun run dev"
    exit 2
  fi
}

# ============================================================================
# Navigator-specific test runner
# ============================================================================

# Override setup_category to include Navigator-specific fields in report header
setup_nav_category() {
  local category="$1"

  # Call base setup
  setup_category "$category"

  # Patch the results file to include Server and Test URL info
  # Insert after the "Debug Log" line
  local temp_file="${RESULTS_FILE}.tmp"
  sed "s|^\*\*Debug Log\*\*: .*$|**Debug Log**: ${DEBUG_FILE##*/}\n**Server**: ${SERVER_URL}\n**Test URL**: ${TEST_URL}|" "$RESULTS_FILE" > "$temp_file"
  mv "$temp_file" "$RESULTS_FILE"
}

# Navigator-specific run_test that uses nav --debug
run_nav_test() {
  local num="$1"
  local name="$2"
  local cmd="$3"
  local pattern="$4"
  local expect_fail="${5:-false}"

  TOTAL=$((TOTAL + 1))

  # Console output (test start)
  echo -e "${BLUE}Test $num: $name${NC}"

  # Log to debug file
  cat >> "$DEBUG_FILE" << EOF

# Test $num: $name
# Command: nav --debug $cmd
# Expected pattern: $pattern
# Expect fail: $expect_fail
---
EOF

  # Execute command with nav --debug prefix
  local output=""
  local exit_code=0

  set +e
  output=$(eval "nav --debug $cmd" 2>&1)
  exit_code=$?
  set -e

  # Log output to debug file
  echo "$output" >> "$DEBUG_FILE"
  echo "Exit code: $exit_code" >> "$DEBUG_FILE"
  echo "---" >> "$DEBUG_FILE"

  # Determine pass/fail (Navigator-specific logic)
  local status="FAIL"
  local details=""

  if [[ "$expect_fail" == "true" ]]; then
    if [[ $exit_code -ne 0 ]] || echo "$output" | grep -qiE "(error|fail|invalid)"; then
      if echo "$output" | grep -qE "$pattern"; then
        status="PASS"
        details="Got expected error"
      else
        status="WARN"
        details="Error but pattern not matched"
      fi
    else
      status="FAIL"
      details="Expected error, got success"
    fi
  else
    if [[ $exit_code -eq 0 ]] && ! echo "$output" | grep -qiE "^error:"; then
      if [[ -z "$pattern" ]] || echo "$output" | grep -qE "$pattern"; then
        status="PASS"
        details="Success"
      else
        status="WARN"
        details="Success but output unexpected"
      fi
    else
      status="FAIL"
      details="Expected success, got error"
    fi
  fi

  # Update counters
  case "$status" in
    PASS)
      PASSED=$((PASSED + 1))
      echo -e "  ${GREEN}PASS${NC}: $details"
      ;;
    WARN)
      WARNED=$((WARNED + 1))
      echo -e "  ${YELLOW}WARN${NC}: $details"
      ;;
    FAIL)
      FAILED=$((FAILED + 1))
      echo -e "  ${RED}FAIL${NC}: $details"
      ;;
  esac

  # Write to markdown report
  echo "| $num | $name | $status | $details |" >> "$RESULTS_FILE"
}

# ============================================================================
# Test Categories
# ============================================================================

run_edge_cases() {
  setup_nav_category "edge-cases"
  print_info "Running edge-cases tests..."

  # Navigate to test page first
  nav open "$TEST_URL" >/dev/null 2>&1

  # Test 1: Empty element ref
  run_nav_test 1 "Empty element ref" "click @" "invalid" "true"

  # Test 2: Malformed element ref
  run_nav_test 2 "Malformed element ref" "click @abc" "invalid" "true"

  # Test 3: Negative element index
  run_nav_test 3 "Negative element index" "click @e-1" "invalid" "true"

  # Test 4: Very large element index
  run_nav_test 4 "Very large element index" "click @e99999999" "ELEMENT_NOT_FOUND" "true"

  # Test 5: Click without target
  run_nav_test 5 "Click without target" "click 2>&1 || true" "missing|required|argument" "true"

  # Test 6: Type without text
  run_nav_test 6 "Type without text" "type @e1 2>&1 || true" "missing|required|argument" "true"

  # Test 7: Navigate without URL
  run_nav_test 7 "Navigate without URL" "open 2>&1 || true" "missing|required|argument" "true"

  # Test 8: Success returns exit code 0
  run_nav_test 8 "Snap succeeds" "snap" "success.*true" "false"

  # Test 9: JSON output is valid (custom test)
  local json_first_line
  json_first_line=$(nav snap 2>&1 | grep -v '^\[' | head -1)
  if [[ "$json_first_line" == "{"* ]]; then
    record_custom_result 9 "Snap JSON valid" "PASS" "First line is JSON"
  else
    record_custom_result 9 "Snap JSON valid" "FAIL" "First line: $json_first_line"
  fi

  # Test 10: Rapid sequential commands (custom test)
  if nav snap >/dev/null 2>&1 && nav snap >/dev/null 2>&1 && nav snap >/dev/null 2>&1; then
    record_custom_result 10 "Rapid sequential snaps" "PASS" "All 3 snaps succeeded"
  else
    record_custom_result 10 "Rapid sequential snaps" "FAIL" "Sequential snaps failed"
  fi

  finalize_category
}

run_error_taxonomy() {
  setup_nav_category "error-taxonomy"
  print_info "Running error-taxonomy tests..."

  nav open "$TEST_URL" >/dev/null 2>&1

  # Test 1: ELEMENT_NOT_FOUND for invalid ref
  run_nav_test 1 "ELEMENT_NOT_FOUND" "click @e99999" "ELEMENT_NOT_FOUND" "true"

  # Test 2: TAB_NOT_FOUND for invalid tab
  run_nav_test 2 "TAB_NOT_FOUND" "tab b99" "TAB_NOT_FOUND|not found" "true"

  # Test 3: SELECTOR_INVALID for bad selector
  run_nav_test 3 "SELECTOR_INVALID" 'click "::invalid[["' "SELECTOR_INVALID|invalid" "true"

  # Test 4: Error response has errorCode field
  run_nav_test 4 "Error has errorCode" "click @e99999 2>&1" "errorCode" "true"

  # Test 5: Error response has retryable field
  run_nav_test 5 "Error has retryable" "click @e99999 2>&1" "retryable" "true"

  finalize_category
}

# ============================================================================
# Main
# ============================================================================

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

  # Initialize test runner
  init_test_runner "$OUTPUT_DIR" "Navigator CLI"

  check_server

  print_header "Navigator CLI Test Runner"
  echo "Server:   $SERVER_URL"
  echo "Test URL: $TEST_URL"
  echo "Output:   $OUTPUT_DIR"
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
    print_pass "All tests passed"
  else
    print_fail "Some tests failed"
  fi

  exit $exit_code
}

main "$@"
