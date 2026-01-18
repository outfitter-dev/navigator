#!/bin/bash
# run-mcp-tests.sh - Navigator MCP Server test runner
# Usage: ./run-mcp-tests.sh [category|--all]
#
# Runs automated MCP server tests via JSON-RPC stdio protocol.
# No agent interpretation required - fully automated.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR=".scratch/testing"
SERVER_URL="${NAVIGATOR_SERVER_URL:-http://localhost:9334}"
MCP_ENTRY="$PROJECT_DIR/packages/mcp/src/index.ts"
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

Run Navigator MCP server tests via JSON-RPC protocol.

Categories:
  schema-validation    Input schema validation
  action-routing       Action dispatch and routing
  error-responses      Error codes and formatting
  response-formatting  Response structure validation

Options:
  --all              Run all test categories
  --help             Show this help

Examples:
  $(basename "$0") schema-validation
  $(basename "$0") --all
EOF
}

log() { echo -e "${BLUE}[mcp-test]${NC} $*"; }
pass() { echo -e "${GREEN}PASS${NC} $*"; }
fail() { echo -e "${RED}FAIL${NC} $*"; }
warn() { echo -e "${YELLOW}WARN${NC} $*"; }

# ============================================================================
# Dependency Checks
# ============================================================================

# Check navigator-server health (MCP proxies to server)
check_server() {
  if ! curl -fsSL "$SERVER_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}ERROR${NC}: Navigator server not running at $SERVER_URL"
    echo "Start with: bun run dev"
    exit 2
  fi
}

# Verify jq is available for JSON parsing
check_jq() {
  if ! command -v jq &>/dev/null; then
    echo -e "${RED}ERROR${NC}: jq is required for JSON parsing"
    echo "Install with: brew install jq"
    exit 2
  fi
}

# ============================================================================
# Output Setup
# ============================================================================

# Setup output directory and files
setup_output() {
  local category="$1"
  mkdir -p "$OUTPUT_DIR"

  RESULTS_FILE="$OUTPUT_DIR/${DATE}-${RUN_ID}-mcp-${category}.md"
  DEBUG_FILE="$OUTPUT_DIR/${DATE}-${RUN_ID}-mcp-${category}-debug.log"

  cat > "$RESULTS_FILE" <<EOF
# Navigator MCP Test Report

**Category**: ${category}
**Run ID**: ${RUN_ID}
**Date**: $(date -Iseconds)
**Server**: ${SERVER_URL}
**Debug Log**: ${DEBUG_FILE}

---

## Results

| # | Test | Status | Details |
|---|------|--------|---------|
EOF

  cat > "$DEBUG_FILE" <<EOF
# Navigator MCP Debug Log
# Category: ${category}
# Run ID: ${RUN_ID}
# Started: $(date -Iseconds)
# Server: ${SERVER_URL}
# ============================================================

EOF
}

# ============================================================================
# Counters
# ============================================================================

PASSED=0
WARNED=0
FAILED=0
TOTAL=0

reset_counters() {
  PASSED=0
  WARNED=0
  FAILED=0
  TOTAL=0
}

# ============================================================================
# MCP Communication
# ============================================================================

# Send JSON-RPC request to MCP server via stdio
# Args: action_json - JSON object with action parameters
# Returns: JSON-RPC response
mcp_call() {
  local action_json="$1"
  echo "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"navigator\",\"arguments\":$action_json},\"id\":1}" \
    | bun "$MCP_ENTRY" 2>/dev/null
}

# ============================================================================
# Test Runner
# ============================================================================

# Run a single MCP test case
# Args: test_num, test_name, action_json, expected_pattern, [expect_error]
run_mcp_test() {
  local num="$1"
  local name="$2"
  local action_json="$3"
  local expected="$4"
  local expect_error="${5:-false}"

  ((TOTAL++))

  echo -e "\n# Test $num: $name" >> "$DEBUG_FILE"
  echo "# Action: $action_json" >> "$DEBUG_FILE"
  echo "# Expected: $expected" >> "$DEBUG_FILE"
  echo "# Expect error: $expect_error" >> "$DEBUG_FILE"
  echo "---" >> "$DEBUG_FILE"

  # Send MCP request and capture response
  local response
  response=$(mcp_call "$action_json" 2>&1) || true

  echo "Response: $response" >> "$DEBUG_FILE"

  # Parse response
  local is_error content_text
  is_error=$(echo "$response" | jq -r '.result.isError // false' 2>/dev/null || echo "parse_error")
  content_text=$(echo "$response" | jq -r '.result.content[0].text // ""' 2>/dev/null || echo "")

  echo "isError: $is_error" >> "$DEBUG_FILE"
  echo "content: $content_text" >> "$DEBUG_FILE"

  # Determine pass/fail
  local status details
  if [[ "$expect_error" == "true" ]]; then
    if [[ "$is_error" == "true" ]]; then
      if [[ -z "$expected" ]] || echo "$content_text" | grep -qE "$expected"; then
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
    if [[ "$is_error" == "false" ]]; then
      if [[ -z "$expected" ]] || echo "$content_text" | grep -qE "$expected"; then
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

# ============================================================================
# Finalize Results
# ============================================================================

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

# ============================================================================
# Test Categories (stubs for now)
# ============================================================================

# Test input schema validation
test_schema_validation() {
  reset_counters
  setup_output "schema-validation"
  log "Running schema-validation tests..."

  # Test 1: Missing action field
  run_mcp_test 1 "Missing action field" \
    '{}' \
    "" \
    true

  # Test 2: Unknown action type
  run_mcp_test 2 "Unknown action type" \
    '{"action":"invalid"}' \
    "" \
    true

  # Test 3: Missing required param (navigate needs url)
  run_mcp_test 3 "Missing required param (navigate needs url)" \
    '{"action":"navigate"}' \
    "" \
    true

  # Test 4: Missing required param (tab needs ref)
  run_mcp_test 4 "Missing required param (tab needs ref)" \
    '{"action":"tab"}' \
    "" \
    true

  # Test 5: Type mismatch (wait ms should be number)
  run_mcp_test 5 "Type mismatch (wait ms should be number)" \
    '{"action":"wait","ms":"string"}' \
    "" \
    true

  # Test 6: Valid minimal action
  run_mcp_test 6 "Valid minimal action" \
    '{"action":"snap"}' \
    "" \
    false

  # Test 7: Valid action with params
  run_mcp_test 7 "Valid action with params" \
    '{"action":"wait","ms":100}' \
    "" \
    false

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# Test action routing and dispatch
test_action_routing() {
  reset_counters
  setup_output "action-routing"
  log "Running action-routing tests..."

  # Test 1: Navigation - navigate to example.com
  run_mcp_test 1 "Navigate to example.com" \
    '{"action":"navigate","url":"https://example.com"}' \
    "" \
    false

  # Test 2: Capture - snap (after navigate)
  run_mcp_test 2 "Snap page state" \
    '{"action":"snap"}' \
    "" \
    false

  # Test 3: Capture - screenshot
  run_mcp_test 3 "Take screenshot" \
    '{"action":"screenshot"}' \
    "" \
    false

  # Test 4: Tabs - list tabs
  run_mcp_test 4 "List open tabs" \
    '{"action":"tabs"}' \
    "" \
    false

  # Test 5: Wait - wait 100ms
  run_mcp_test 5 "Wait 100ms" \
    '{"action":"wait","ms":100}' \
    "" \
    false

  # Test 6: Interaction - scroll down (y=100)
  run_mcp_test 6 "Scroll down" \
    '{"action":"scroll","y":100}' \
    "" \
    false

  # Test 7: Display - set viewport
  run_mcp_test 7 "Set viewport 1280x720" \
    '{"action":"viewport","width":1280,"height":720}' \
    "" \
    false

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# Test error response codes and formatting
test_error_responses() {
  reset_counters
  setup_output "error-responses"
  log "Running error-responses tests..."

  # TODO: Add error response tests
  # - ELEMENT_NOT_FOUND error code
  # - TAB_NOT_FOUND error code
  # - SELECTOR_INVALID error code
  # - Error includes retryable field

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# Test response structure and formatting
test_response_formatting() {
  reset_counters
  setup_output "response-formatting"
  log "Running response-formatting tests..."

  # TODO: Add response formatting tests
  # - Success response has correct structure
  # - Snap response includes ARIA tree
  # - Screenshot response includes image content
  # - Error response has isError: true

  finalize_results $PASSED $WARNED $FAILED $TOTAL

  echo ""
  log "Results: $PASSED passed, $WARNED warnings, $FAILED failed (of $TOTAL)"
  log "Report: $RESULTS_FILE"
  log "Debug:  $DEBUG_FILE"

  [[ $FAILED -eq 0 ]] && return 0 || return 1
}

# ============================================================================
# Main
# ============================================================================

main() {
  local category="" run_all=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all) run_all=true; shift ;;
      --help|-h) usage; exit 0 ;;
      -*) echo "Unknown option: $1"; usage; exit 1 ;;
      *) category="$1"; shift ;;
    esac
  done

  if [[ -z "$category" ]] && [[ "$run_all" == "false" ]]; then
    usage
    exit 1
  fi

  check_jq
  check_server

  log "Navigator MCP Test Runner"
  log "Server: $SERVER_URL"
  log "Output: $OUTPUT_DIR"
  echo ""

  local exit_code=0

  if [[ "$run_all" == "true" ]]; then
    test_schema_validation || exit_code=1
    echo ""
    test_action_routing || exit_code=1
    echo ""
    test_error_responses || exit_code=1
    echo ""
    test_response_formatting || exit_code=1
  else
    case "$category" in
      schema-validation) test_schema_validation || exit_code=1 ;;
      action-routing) test_action_routing || exit_code=1 ;;
      error-responses) test_error_responses || exit_code=1 ;;
      response-formatting) test_response_formatting || exit_code=1 ;;
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
