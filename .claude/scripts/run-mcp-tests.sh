#!/bin/bash
# run-mcp-tests.sh - Navigator MCP Server test runner
# Usage: ./run-mcp-tests.sh [category|--all]
#
# Runs automated MCP server tests via JSON-RPC stdio protocol.
# Uses shared test-runner-lib.sh for common patterns.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared library
source "$SCRIPT_DIR/lib/test-runner-lib.sh"

# ============================================================================
# Navigator MCP-specific configuration
# ============================================================================

SERVER_URL="${NAVIGATOR_SERVER_URL:-http://localhost:9334}"
MCP_ENTRY="$PROJECT_DIR/packages/mcp/src/index.ts"
OUTPUT_DIR=".scratch/testing"

# ============================================================================
# CLI Usage
# ============================================================================

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

check_jq() {
  if ! command -v jq &>/dev/null; then
    echo -e "${RED}ERROR${NC}: jq is required for JSON parsing"
    echo "Install with: brew install jq"
    exit 2
  fi
}

# ============================================================================
# MCP Communication
# ============================================================================

# Send JSON-RPC request to MCP server via stdio
# Note: NAVIGATOR_SERVER_URL is passed to the MCP client via environment variable
mcp_call() {
  local action_json="$1"
  echo "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"navigator\",\"arguments\":$action_json},\"id\":1}" \
    | NAVIGATOR_SERVER_URL="$SERVER_URL" bun "$MCP_ENTRY" 2>/dev/null
}

# ============================================================================
# MCP-specific setup and test functions
# ============================================================================

# Override setup_category for MCP-specific naming
setup_mcp_category() {
  local category="$1"

  # Use base setup but prepend "mcp-" to category name
  setup_category "mcp-$category"

  # Patch the results file to include Server info
  local temp_file="${RESULTS_FILE}.tmp"
  sed "s|^\*\*Debug Log\*\*: .*$|**Debug Log**: ${DEBUG_FILE##*/}\n**Server**: ${SERVER_URL}|" "$RESULTS_FILE" > "$temp_file"
  mv "$temp_file" "$RESULTS_FILE"
}

# MCP-specific test runner using JSON-RPC
run_mcp_test() {
  local num="$1"
  local name="$2"
  local action_json="$3"
  local expected="$4"
  local expect_error="${5:-false}"

  TOTAL=$((TOTAL + 1))

  # Console output (test start)
  echo -e "${BLUE}Test $num: $name${NC}"

  # Log to debug file
  cat >> "$DEBUG_FILE" << EOF

# Test $num: $name
# Action: $action_json
# Expected: $expected
# Expect error: $expect_error
---
EOF

  # Send MCP request and capture response
  local response
  set +e
  response=$(mcp_call "$action_json" 2>&1)
  set -e

  echo "Response: $response" >> "$DEBUG_FILE"

  # Parse response
  local is_error content_text
  is_error=$(echo "$response" | jq -r '.result.isError // false' 2>/dev/null || echo "parse_error")
  content_text=$(echo "$response" | jq -r '.result.content[0].text // ""' 2>/dev/null || echo "")

  echo "isError: $is_error" >> "$DEBUG_FILE"
  echo "content: $content_text" >> "$DEBUG_FILE"
  echo "---" >> "$DEBUG_FILE"

  # Determine pass/fail
  local status="FAIL"
  local details=""

  if [[ "$expect_error" == "true" ]]; then
    if [[ "$is_error" == "true" ]]; then
      if [[ -z "$expected" ]] || echo "$content_text" | grep -qE "$expected"; then
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
    if [[ "$is_error" == "false" ]]; then
      if [[ -z "$expected" ]] || echo "$content_text" | grep -qE "$expected"; then
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

# Structure test for validating response format
run_structure_test() {
  local num="$1"
  local name="$2"
  local action_json="$3"
  local check_type="$4"  # "contains", "is_array", "jq_check"
  local check_value="$5"

  TOTAL=$((TOTAL + 1))

  # Console output (test start)
  echo -e "${BLUE}Test $num: $name${NC}"

  # Log to debug file
  cat >> "$DEBUG_FILE" << EOF

# Test $num: $name
# Action: $action_json
# Check: $check_type = $check_value
---
EOF

  local response
  set +e
  response=$(mcp_call "$action_json" 2>&1)
  set -e

  echo "Response: $response" >> "$DEBUG_FILE"

  local status="FAIL"
  local details=""

  case "$check_type" in
    contains)
      if echo "$response" | grep -qE "$check_value"; then
        status="PASS"
        details="Found expected pattern"
      else
        status="FAIL"
        details="Pattern not found: $check_value"
      fi
      ;;
    is_array)
      if echo "$response" | jq -e "$check_value | type == \"array\"" >/dev/null 2>&1; then
        status="PASS"
        details="Content is array"
      else
        status="FAIL"
        details="Content is not array"
      fi
      ;;
    jq_check)
      if echo "$response" | jq -e "$check_value" >/dev/null 2>&1; then
        status="PASS"
        details="JQ check passed"
      else
        status="FAIL"
        details="JQ check failed"
      fi
      ;;
  esac

  echo "Status: $status - $details" >> "$DEBUG_FILE"
  echo "---" >> "$DEBUG_FILE"

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

test_schema_validation() {
  setup_mcp_category "schema-validation"
  print_info "Running schema-validation tests..."

  # Test 1: Missing action field
  run_mcp_test 1 "Missing action field" \
    '{}' \
    "" \
    "true"

  # Test 2: Unknown action type
  run_mcp_test 2 "Unknown action type" \
    '{"action":"invalid"}' \
    "" \
    "true"

  # Test 3: Missing required param (navigate needs url)
  run_mcp_test 3 "Missing required param (navigate needs url)" \
    '{"action":"navigate"}' \
    "" \
    "true"

  # Test 4: Missing required param (tab needs ref)
  run_mcp_test 4 "Missing required param (tab needs ref)" \
    '{"action":"tab"}' \
    "" \
    "true"

  # Test 5: Type mismatch (wait ms should be number)
  run_mcp_test 5 "Type mismatch (wait ms should be number)" \
    '{"action":"wait","ms":"string"}' \
    "" \
    "true"

  # Test 6: Valid minimal action (tabs works in all modes including paired)
  run_mcp_test 6 "Valid minimal action" \
    '{"action":"tabs"}' \
    "" \
    "false"

  # Test 7: Valid action with params
  run_mcp_test 7 "Valid action with params" \
    '{"action":"wait","ms":100}' \
    "" \
    "false"

  finalize_category
}

test_action_routing() {
  setup_mcp_category "action-routing"
  print_info "Running action-routing tests..."

  # Test 1: Navigation - navigate to about:blank (local, works offline)
  run_mcp_test 1 "Navigate to about:blank" \
    '{"action":"navigate","url":"about:blank"}' \
    "" \
    "false"

  # Test 2: Capture - snap (after navigate)
  run_mcp_test 2 "Snap page state" \
    '{"action":"snap"}' \
    "" \
    "false"

  # Test 3: Capture - screenshot
  run_mcp_test 3 "Take screenshot" \
    '{"action":"screenshot"}' \
    "" \
    "false"

  # Test 4: Tabs - list tabs
  run_mcp_test 4 "List open tabs" \
    '{"action":"tabs"}' \
    "" \
    "false"

  # Test 5: Wait - wait 100ms
  run_mcp_test 5 "Wait 100ms" \
    '{"action":"wait","ms":100}' \
    "" \
    "false"

  # Test 6: Interaction - scroll down (y=100)
  run_mcp_test 6 "Scroll down" \
    '{"action":"scroll","y":100}' \
    "" \
    "false"

  # Test 7: Display - set viewport
  run_mcp_test 7 "Set viewport 1280x720" \
    '{"action":"viewport","width":1280,"height":720}' \
    "" \
    "false"

  finalize_category
}

test_error_responses() {
  setup_mcp_category "error-responses"
  print_info "Running error-responses tests..."

  # Setup: Navigate to a page first (use data URL for offline compatibility)
  print_info "Setup: Navigating to test page..."
  mcp_call '{"action":"navigate","url":"data:text/html,<html><body><h1>Test</h1></body></html>"}' >/dev/null 2>&1 || true

  # Test 1: Element not found
  run_mcp_test 1 "Element not found (click e99999)" \
    '{"action":"click","ref":"e99999"}' \
    "not found|Element.*not found" \
    "true"

  # Test 2: Tab not found
  run_mcp_test 2 "Tab not found (tab b99)" \
    '{"action":"tab","ref":"b99"}' \
    "Invalid tab|tab.*not found" \
    "true"

  # Test 3: Invalid selector
  run_mcp_test 3 "Invalid selector (waitFor)" \
    '{"action":"waitFor","selector":"[invalid[["}' \
    "SELECTOR_INVALID|error|invalid" \
    "true"

  # Test 4: Timeout
  run_mcp_test 4 "Timeout (waitFor non-existent element)" \
    '{"action":"waitFor","selector":"#does-not-exist-xyz123","timeout":100}' \
    "timeout|Timeout|exceeded" \
    "true"

  finalize_category
}

test_response_formatting() {
  setup_mcp_category "response-formatting"
  print_info "Running response-formatting tests..."

  # Setup: Navigate to a page first (use data URL for offline compatibility)
  print_info "Setup: Navigating to test page..."
  mcp_call '{"action":"navigate","url":"data:text/html,<html><body><h1>Test</h1></body></html>"}' >/dev/null 2>&1 || true

  # Test 1: Snap returns text content (check for isError:false to exclude error responses)
  run_structure_test 1 "Snap returns text content" \
    '{"action":"snap"}' \
    "jq_check" \
    '.result.isError == false and .result.content[0].type == "text"'

  # Test 2: Screenshot returns image content
  run_structure_test 2 "Screenshot returns image content" \
    '{"action":"screenshot"}' \
    "contains" \
    '"type"[[:space:]]*:[[:space:]]*"image"'

  # Test 3: Success message format
  run_mcp_test 3 "Success message format" \
    '{"action":"wait","ms":50}' \
    "Success" \
    "false"

  # Test 4: Content is array
  run_structure_test 4 "Content is array" \
    '{"action":"snap"}' \
    "is_array" \
    ".result.content"

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
  init_test_runner "$OUTPUT_DIR" "Navigator MCP"

  check_jq
  check_server

  print_header "Navigator MCP Test Runner"
  echo "Server: $SERVER_URL"
  echo "Output: $OUTPUT_DIR"
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
    print_pass "All tests passed"
  else
    print_fail "Some tests failed"
  fi

  exit $exit_code
}

main "$@"
