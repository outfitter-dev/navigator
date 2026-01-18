# agent-browser Upstream Sync

This document outlines features, fixes, and protocol changes from [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) that Navigator can integrate via our [@outfitter/agent-browser](https://github.com/outfitter-dev/agent-browser) fork.

## New Features

### Video Recording

```markdown
Title: Add video recording support (record start/stop/restart)

## Summary

Upstream agent-browser now supports video recording with `record start`, `record stop`, and `record restart` commands. This enables capturing browser sessions for debugging, demos, and test evidence.

## Proposed Changes

- [ ] Add `record` action to core schema (`packages/core/src/schema/index.ts`)
  - Operations: `start`, `stop`, `restart`
  - Options: output path, format, quality
- [ ] Implement recording handler in server (`packages/server/`)
- [ ] Expose via CLI: `nav record start`, `nav record stop`
- [ ] Store recordings in `~/.local/share/navigator/{project}/recordings/`
- [ ] Add `--record` flag to `nav run` for auto-recording route replays

## Use Cases

- Debugging failed automation runs
- Creating demo videos of workflows
- Test evidence for CI/CD pipelines
- Reproducing user-reported issues

## Labels

enhancement, upstream
```

### Persistent CDP Sessions

```markdown
Title: Add persistent CDP session support (connect command)

## Summary

Upstream now supports connecting to existing browser instances via Chrome DevTools Protocol. This enables attaching to running browsers instead of launching new ones.

## Proposed Changes

- [ ] Add `connect` action to core schema
  - Parameters: `cdpUrl` (WebSocket endpoint), `timeout`
- [ ] Implement CDP connection handler in server
- [ ] Expose via CLI: `nav connect ws://localhost:9222`
- [ ] Consider as alternative to extension for paired mode

## Use Cases

- Connect to user's existing browser session
- Debug production browsers during development
- Attach to browsers launched by other tools
- Simplified paired mode without extension

## Technical Notes

Chrome must be launched with `--remote-debugging-port=9222` flag.

## Labels

enhancement, upstream
```

### Proxy Support

```markdown
Title: Add proxy support with authentication

## Summary

Upstream added `--proxy` flag with authentication support. This enables testing behind corporate proxies, geo-testing, and web scraping scenarios.

## Proposed Changes

- [ ] Add proxy configuration to browser launch options
  - Server: `proxy` field in mode configuration
  - CLI: `--proxy` flag with format `http://user:pass@host:port`
- [ ] Support in config file (`navigator.config.ts`):
  ```ts
  export default {
    proxy: {
      server: 'http://proxy.example.com:8080',
      username: 'user',
      password: 'pass',
      bypass: ['localhost', '*.internal.com']
    }
  }
  ```
- [ ] Pass through to headless/windowed modes via Playwright

## Use Cases

- Corporate environments with mandatory proxies
- Geo-location testing (test from different regions)
- Web scraping with rotating proxies
- Testing proxy-aware applications

## Labels

enhancement, upstream
```

### Computed Styles Extraction

```markdown
Title: Add computed styles extraction (styles action)

## Summary

Upstream added `get styles` command to extract computed CSS styles from elements. This enables visual testing, accessibility checks, and style verification.

## Proposed Changes

- [ ] Add `styles` action to core schema
  - Parameters: `ref` (element reference), `properties` (optional filter)
  - Returns: computed style key-value pairs
- [ ] Implement in server using Playwright's `evaluate`
- [ ] Expose via CLI: `nav styles @e1` or `nav styles @e1 --props color,font-size`
- [ ] Integrate with markers for visual regression tracking:
  ```bash
  nav marker save button-styles --action styles --ref @e1
  nav marker compare button-styles
  ```

## Use Cases

- Visual regression testing (detect unintended style changes)
- Accessibility audits (color contrast, font sizes)
- Design system compliance verification
- Debugging CSS issues

## Labels

enhancement, upstream
```

### Network Request Details

```markdown
Title: Enhance network request visibility (method/URL/type)

## Summary

Upstream now shows method, URL, and type for network requests. This provides better debugging and enables request tracking/verification.

## Proposed Changes

- [ ] Add `network` action to core schema
  - Operations: `list`, `clear`, `wait`
  - Filters: method, URL pattern, resource type
- [ ] Optionally include recent network activity in snap output
  - New flag: `nav snap --network`
- [ ] Integrate with markers for API response tracking:
  ```bash
  nav marker save api-response --action network --filter "POST /api/users"
  ```

## Example Output

```json
{
  "requests": [
    { "method": "GET", "url": "https://api.example.com/users", "type": "fetch", "status": 200 },
    { "method": "POST", "url": "https://api.example.com/login", "type": "xhr", "status": 201 }
  ]
}
```

## Use Cases

- Verify API calls are made correctly
- Debug failed requests
- Monitor network activity during automation
- Test request/response payloads

## Labels

enhancement, upstream
```

### Multi-value Select Support

```markdown
Title: Support multi-value select elements

## Summary

Upstream now supports selecting multiple values in `<select multiple>` elements. Navigator's `select` action needs to support this.

## Proposed Changes

- [ ] Update `select` action schema to accept array of values:
  ```ts
  // Current
  { action: 'select', ref: 'e1', value: 'option1' }

  // New (backwards compatible)
  { action: 'select', ref: 'e1', value: 'option1' }           // single
  { action: 'select', ref: 'e1', values: ['opt1', 'opt2'] }   // multiple
  ```
- [ ] Update CLI to support multiple values:
  ```bash
  nav select @e1 --value opt1 --value opt2
  # or
  nav select @e1 opt1,opt2
  ```
- [ ] Maintain backwards compatibility with single `value` field

## Labels

enhancement, upstream
```

## CLI Enhancements

### Version Flag

```markdown
Title: Add --version flag to CLI

## Summary

Add standard `--version` flag to display Navigator version information.

## Proposed Changes

- [ ] Add `--version` / `-v` flag to CLI
- [ ] Display version from package.json
- [ ] Include agent-browser version if available

## Example Output

```
navigator v0.1.0
agent-browser v1.2.3
```

## Labels

enhancement, cli
```

### NO_COLOR Support

```markdown
Title: Support NO_COLOR environment variable

## Summary

Respect the `NO_COLOR` environment variable to disable colored output, per https://no-color.org/ standard.

## Proposed Changes

- [ ] Check for `NO_COLOR` env var in CLI output
- [ ] Disable ANSI colors when `NO_COLOR` is set (any value)
- [ ] Useful for CI/CD pipelines and accessibility

## Labels

enhancement, cli, accessibility
```

## Protocol Alignment

### Select Values Field

```markdown
Title: Align select action with upstream values field

## Summary

Upstream changed `select` to use `values` field instead of `value`. Update schema for compatibility.

## Proposed Changes

- [ ] Update schema to use `values` field (array)
- [ ] Support `value` as alias for backwards compatibility
- [ ] Update CLI and MCP to use new field

## Migration

```ts
// Old
{ action: 'select', ref: 'e1', value: 'option1' }

// New
{ action: 'select', ref: 'e1', values: ['option1'] }
```

## Labels

breaking-change, upstream
```

### Mainframe Action

```markdown
Title: Add mainframe action for frame handling

## Summary

Upstream renamed `frame main` to `mainframe` action. Add support for protocol alignment.

## Proposed Changes

- [ ] Add `mainframe` action to schema
- [ ] Implement in server to switch to main frame
- [ ] Keep `frame` action with `main` parameter as alias

## Labels

breaking-change, upstream
```

### Wheel Action

```markdown
Title: Add wheel action for mouse scrolling

## Summary

Upstream added explicit `wheel` action for mouse wheel events. Consider as alias or replacement for scroll.

## Proposed Changes

- [ ] Add `wheel` action to schema
  - Parameters: `deltaX`, `deltaY`, `ref` (optional target)
- [ ] Evaluate relationship with existing `scroll` action
- [ ] May provide more precise control than scroll

## Labels

enhancement, upstream
```

### Emulate Media Action

```markdown
Title: Add emulatemedia action for media emulation

## Summary

Upstream renamed media emulation to `emulatemedia` action. Align for protocol compatibility.

## Proposed Changes

- [ ] Add `emulatemedia` action to schema
  - Parameters: `media` (screen/print), `colorScheme`, `reducedMotion`
- [ ] Evaluate overlap with existing `colorScheme` action
- [ ] Consider consolidating media-related actions

## Labels

breaking-change, upstream
```

### Console Messages Field

```markdown
Title: Update console response to use messages field

## Summary

Upstream changed console output to use `messages` field. Update response schema.

## Proposed Changes

- [ ] Update console-related response types to use `messages` array
- [ ] Ensure backwards compatibility in response handling

## Labels

breaking-change, upstream
```

## Stability Fixes

### Windows Daemon Startup

```markdown
Title: Fix Windows daemon startup issues

## Summary

Upstream fixed Windows daemon startup. Sync fix for cross-platform reliability.

## Proposed Changes

- [ ] Sync daemon startup fixes from upstream
- [ ] Test on Windows environments
- [ ] Document any Windows-specific setup requirements

## Labels

bug, windows, upstream
```

### Ubuntu 24.04 Compatibility

```markdown
Title: Fix Ubuntu 24.04 compatibility (libasound2t64)

## Summary

Upstream fixed compatibility with Ubuntu 24.04 which renamed libasound2 to libasound2t64.

## Proposed Changes

- [ ] Sync dependency fixes from upstream
- [ ] Update documentation for Ubuntu 24.04
- [ ] Test on Ubuntu 24.04 LTS

## Labels

bug, linux, upstream
```

### CDP Timeout on Empty Tabs

```markdown
Title: Fix CDP timeout on empty tabs

## Summary

Upstream fixed CDP timeout issues when connecting to empty/blank tabs.

## Proposed Changes

- [ ] Sync timeout handling fix from upstream
- [ ] Add tests for empty tab scenarios

## Labels

bug, upstream
```

### Screenshot Base64 Output

```markdown
Title: Fix screenshot base64 output consistency

## Summary

Upstream fixed screenshot base64 encoding output. Sync for consistent behavior.

## Proposed Changes

- [ ] Sync screenshot encoding fix from upstream
- [ ] Verify base64 output is valid and consistent
- [ ] Update tests if needed

## Labels

bug, upstream
```

### Ref Resolution in Get Value

```markdown
Title: Fix ref resolution in get value action

## Summary

Upstream fixed element reference resolution when getting values.

## Proposed Changes

- [ ] Sync ref resolution fix from upstream
- [ ] Add test cases for ref resolution edge cases

## Labels

bug, upstream
```

### Tab New URL Parameter

```markdown
Title: Fix tab new URL parameter handling

## Summary

Upstream fixed URL parameter handling in `tab new` command.

## Proposed Changes

- [ ] Sync URL parameter fix from upstream
- [ ] Test `newTab` action with various URL formats

## Labels

bug, upstream
```

### Special URL Schemes

```markdown
Title: Fix handling of about:/data:/file: URLs

## Summary

Upstream fixed handling of special URL schemes (about:, data:, file:).

## Proposed Changes

- [ ] Sync URL scheme handling from upstream
- [ ] Test navigation to special URLs
- [ ] Document supported URL schemes

## Labels

bug, upstream
```

### Stale Unix Socket Detection

```markdown
Title: Fix stale unix socket detection

## Summary

Upstream improved detection of stale unix sockets for daemon communication.

## Proposed Changes

- [ ] Sync socket detection improvements from upstream
- [ ] Improves daemon reliability on crashes/restarts

## Labels

bug, upstream
```

### SIGPIPE Panic

```markdown
Title: Fix SIGPIPE panic when piping output

## Summary

Upstream fixed panic when piping CLI output to other commands.

## Proposed Changes

- [ ] Sync SIGPIPE handling fix from upstream
- [ ] Test piping scenarios: `nav snap | jq .`

## Labels

bug, cli, upstream
```

### AGENT_BROWSER_HEADED Environment Variable

```markdown
Title: Fix AGENT_BROWSER_HEADED environment variable

## Summary

Upstream fixed the `AGENT_BROWSER_HEADED` environment variable for controlling headed mode.

## Proposed Changes

- [ ] Sync env var handling fix from upstream
- [ ] Document environment variable in README
- [ ] Test headed mode via env var

## Labels

bug, upstream
```

---

## Implementation Priority

| Priority | Category | Issues |
|----------|----------|--------|
| P0 | Protocol alignment | select values, mainframe, wheel, emulatemedia, console messages |
| P1 | Stability | All bug fixes |
| P2 | Features | Video recording, styles extraction, multi-select |
| P3 | Features | CDP connect, proxy support, network details |
| P4 | CLI | --version, NO_COLOR |
