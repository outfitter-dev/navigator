#!/usr/bin/env bash
set -euo pipefail

# Navigator Installation Script
# Browser automation for AI agents

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors (disable when not a TTY)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

info() { echo -e "${BLUE}==>${NC} $1"; }
success() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1"; }

# Check prerequisites
check_prerequisites() {
  info "Checking prerequisites..."

  if ! command -v bun &> /dev/null; then
    error "bun is required but not installed."
    echo "  Install: curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi

  if ! command -v git &> /dev/null; then
    error "git is required but not installed."
    exit 1
  fi

  success "Prerequisites satisfied"
}

# Install dependencies
install_deps() {
  info "Installing dependencies..."
  bun install
  success "Dependencies installed"
}

# Build all packages
build_packages() {
  info "Building packages..."
  bun run build
  success "Packages built"
}

# Link CLI globally
link_cli() {
  info "Linking CLI globally..."
  cd "$SCRIPT_DIR/packages/cli"
  bun link
  cd "$SCRIPT_DIR"

  if command -v nav &> /dev/null; then
    success "CLI linked: nav and nav-dev available"
    # Safely get version without aborting on error
    local version
    version=$(nav --version 2>/dev/null || echo "unknown")
    echo "  nav --version: $version"
  else
    warn "CLI linked but not in PATH. Add ~/.bun/bin to your PATH:"
    echo "  export PATH=\"\$HOME/.bun/bin:\$PATH\""
  fi
}

# Print next steps
print_next_steps() {
  echo ""
  success "Installation complete!"
  echo ""
  echo "Next steps:"
  echo ""
  echo "  1. Start the server:"
  echo "     ${BLUE}nav server start${NC}"
  echo ""
  echo "  2. Install Claude Code plugin (in your project):"
  echo "     ${BLUE}nav install --plugin claude${NC}"
  echo ""
  echo "  3. For paired browsing, build and load the Chrome extension:"
  echo "     ${BLUE}bun run --filter @outfitter/navigator-extension build${NC}"
  echo "     Then load ${YELLOW}packages/extension/dist${NC} in Chrome (chrome://extensions)"
  echo ""
  echo "Documentation: https://github.com/outfitter-dev/navigator"
}

# Main
main() {
  echo ""
  echo "  Navigator - Browser automation for AI agents"
  echo ""

  check_prerequisites
  install_deps
  build_packages
  link_cli
  print_next_steps
}

main "$@"
