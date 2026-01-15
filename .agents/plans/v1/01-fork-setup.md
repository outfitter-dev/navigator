# 01 - Fork Setup

Set up `@outfitter/agent-browser` as Navigator's browser automation dependency.

## Overview

Navigator depends on `@outfitter/agent-browser` (a fork of [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)) for Playwright-based browser control. This document covers the fork setup, build process, and publish workflow.

## Fork Strategy

**Relationship**: Navigator consumes `@outfitter/agent-browser` as a dependency. We extend agent-browser with Navigator-specific enhancements (paired mode, markers, sessions).

```
vercel-labs/agent-browser (upstream)
        ↓ fork
@outfitter/agent-browser (our fork)
        ↓ npm dependency
@outfitter/navigator (this project)
```

**Rationale**:
- Clean separation of concerns
- Can contribute upstream if we add features
- Navigator owns everything above the browser automation layer

## Contributing Back

When we develop enhancements that would benefit the broader community:

1. **Implement in our fork** — Make changes in `@outfitter/agent-browser`
2. **Test thoroughly** — Ensure the changes work in Navigator and don't break existing functionality
3. **File upstream PR** — Submit a PR against [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)

## Tasks

### 1. Fork Repository

```bash
# Fork via GitHub UI: vercel-labs/agent-browser → outfitter-dev/agent-browser
gh repo fork vercel-labs/agent-browser --org outfitter-dev --clone
cd agent-browser
```

### 2. Update Package Identity

```json
// package.json
{
  "name": "@outfitter/agent-browser",
  "version": "0.5.0",
  "description": "Browser automation for AI agents (Outfitter fork)",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/outfitter-dev/agent-browser.git"
  }
}
```

### 3. Set Up Build

```json
// package.json scripts
{
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "prepublishOnly": "bun run build"
  }
}
```

### 4. Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 5. Configure CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run build
```

### 6. Configure Publish Workflow

```yaml
# .github/workflows/publish.yml
name: Publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 7. Initial Publish

```bash
# Tag initial release matching upstream version
git tag v0.5.0
git push origin v0.5.0

# Create GitHub release (triggers publish workflow)
gh release create v0.5.0 --title "v0.5.0" --notes "Initial fork release"
```

## Verification

- [ ] Fork exists at `github.com/outfitter-dev/agent-browser`
- [ ] Package published to npm as `@outfitter/agent-browser`
- [ ] CI passes on main branch
- [ ] Can install in Navigator: `bun add @outfitter/agent-browser`

## Dependencies

None (first step in build sequence).

## Notes

- Keep the fork minimal—only changes that Navigator specifically needs
- Contribute general-purpose enhancements back to vercel-labs/agent-browser
- Version sync: track upstream releases from Vercel, merge as needed
