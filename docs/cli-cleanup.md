# CLI Cleanup

Consolidate and improve CLI command structure for consistency and discoverability.

## Command Renames ✅

| Old | New | Status |
|-----|-----|--------|
| `init` | `install --plugin claude` | ✅ Implemented |
| `tidy` | `clean` | ✅ Implemented |

## Command Groupings ✅

### `server` subcommands ✅

| Old | New | Status |
|-----|-----|--------|
| `serve` | `server start` | ✅ Implemented |
| `status` | `server status` | ✅ Implemented |
| (new) | `server stop` | ✅ Implemented |

### `tab` subcommands ✅

| Old | New | Status |
|-----|-----|--------|
| `tabs` | `tab list` | ✅ Implemented |
| `tab <id>` | `tab <id>` or `tab switch <id>` | ✅ Implemented |
| `new-tab [url]` | `tab new [url]` | ✅ Implemented |
| `close-tab <id>` | `tab close <id>` | ✅ Implemented |

Note: `nav tab <id>` works as shorthand for `nav tab switch <id>` since switching is the most common action.

### `mark` subcommands ✅

| Old | New | Status |
|-----|-----|--------|
| `mark` | `mark save` | ✅ Implemented |
| `markers` | `mark list` | ✅ Implemented |
| `marker <id>` | `mark get <id>` | ✅ Implemented |
| `marker-compare <id1> <id2>` | `mark diff <id1> <id2>` | ✅ Implemented |
| `marker-delete <id>` | `mark remove <id>` | ✅ Implemented |

## Summary

### Current Structure

```
nav install --plugin claude
nav server start|stop|status
nav tab list|switch|new|close
nav mark save|list|get|diff|remove
nav clean
nav doctor
nav update
nav uninstall
nav watch
nav session
nav steps
nav mcp
nav action
```

## Ergonomic Improvements

### `color-scheme` alias

Add `system` as an alias for `no-preference` (clearer intent):

```bash
nav color-scheme system   # → sends 'no-preference' to agent-browser
nav color-scheme light
nav color-scheme dark
```

### `scroll` direction syntax

The schema uses `x`/`y` but CLI already converts direction. Expose direction in schema:

```bash
nav scroll down 200      # Current (works)
nav scroll down          # Default amount
```

Schema should accept both:
- `{ action: 'scroll', direction: 'down', amount: 200 }` (ergonomic)
- `{ action: 'scroll', x: 0, y: 200 }` (raw)

## New Commands

### `press` - Keyboard input

Support single keys and key combinations (safely):

```bash
nav press Enter
nav press Escape
nav press Tab
nav press cmd-k          # Command palette (Linear, VS Code, etc.)
nav press ctrl-shift-p   # Another common binding
nav press ArrowDown
```

**Modifier format**: `ctrl-`, `cmd-`, `shift-`, `alt-` (combinable)

**Key normalization** (aliases accepted, canonical sent to Playwright):
- `cmd`, `meta`, `win` → `Meta`
- `ctrl`, `control` → `Control`
- `esc` → `Escape`

**Separator support**: Both `-` and `+` work:
- `ctrl-shift-p` and `ctrl+shift+p` are equivalent

**Edge cases**: Use `--` for punctuation keys:
```bash
nav press -- "-"         # Minus key
nav press -- "+"         # Plus key
```

### `fill` - Instant form fill

Alternative to `type` - sets value directly without simulating keystrokes:

```bash
nav fill @e1 "hello@example.com"    # Instant
nav type @e1 "hello@example.com"    # Keystroke simulation (existing)
```

Use `fill` for speed, `type` when keystroke events matter (autocomplete, validation triggers).

### `click` enhancements

```bash
nav click @e1                    # Left click (existing)
nav click @e1 --double           # Double click
nav click @e1 --right            # Right click (existing via --button)
nav click @e1 --mod ctrl         # Ctrl+click (open in new tab, etc.)
nav click @e1 --mod cmd          # Cmd+click
nav click @e1 --mod shift        # Shift+click (extend selection)
```

### `interact` subcommands

Group less common interaction actions:

```bash
nav interact check @e1           # Check checkbox
nav interact uncheck @e1         # Uncheck checkbox
nav interact upload @e1 ./file.png   # File upload
nav interact dialog accept       # Accept next alert/confirm
nav interact dialog dismiss      # Dismiss next alert/confirm
nav interact dialog prompt "text"    # Answer next prompt with text
nav interact dialog clear        # Clear handler (back to auto-dismiss)
```

**Idempotency**: `check` and `uncheck` are idempotent - they no-op if the checkbox is already in the desired state.

**Dialog lifecycle**:
- Handlers are **one-shot** by default (auto-cleared after handling one dialog)
- Multiple queued dialogs require re-registering the handler
- `dialog clear` removes any pending handler (returns to auto-dismiss)

**Important**: Dialog handlers use a pre-registration pattern. Set the handler *before* the action that triggers the dialog:

```bash
nav interact dialog accept       # 1. Register handler (one-shot)
nav click @submit-button         # 2. This triggers confirm() → auto-accepted
# Handler now cleared - next dialog would auto-dismiss
```

### `find` - Element discovery

Fast element lookup without full snap. Returns list if multiple matches.

```bash
nav find "Submit"                  # Find by visible text (partial match)
nav find --exact "Submit"          # Exact text match
nav find --role button             # Find by ARIA role
nav find --role button "Submit"    # Role + text combo
nav find --label "Email"           # Find by associated label
nav find --placeholder "Search"    # Find by placeholder
nav find --testid "submit-btn"     # Find by data-testid
nav find @e42                      # Get details about existing ref
```

**Scoped search** - narrow down within a container:

```bash
nav find "Submit" --in-ref @e42           # Search within element ref
nav find "Submit" --in-tag form           # Search within tag type
nav find "Submit" --in-css ".modal"       # Search within CSS selector
nav find "Submit" --in-css "#sidebar > nav"
nav find "Delete" --in-tag form --role button  # Chained filters
```

**Scope flags**:
- `--in-ref @e42` - Search within an element reference
- `--in-tag form` - Search within all elements of a tag type
- `--in-css ".modal"` - Search within elements matching CSS selector

**Tag filtering** (filter results by tag, not scope):

```bash
nav find "Settings" --tag a               # Only links
nav find "Submit" --tag button            # Only buttons
nav find --tag input --in-tag form        # All inputs in forms
```

**State filtering**:

```bash
nav find "Submit" --visible               # Only visible elements
nav find --tag input --enabled            # Only enabled inputs
nav find --role checkbox --checked        # Only checked checkboxes
nav find "Submit" --in-css ".modal" --visible  # Combined
```

Returns rich element info (array if multiple):

```json
[
  {
    "ref": "e42",
    "text": "Submit",
    "role": "button",
    "tag": "button",
    "box": { "x": 100, "y": 200, "width": 80, "height": 32 },
    "visible": true,
    "enabled": true,
    "attributes": { "class": "btn-primary", "type": "submit" }
  }
]
```

**Scriptable workflows** - faster than screenshot analysis:

```bash
# Find and click without snap/screenshot
nav find "Log in" | nav click      # Pipe first match to click

# Conditional logic
nav find --role alert              # Check for error messages
nav find --label "Email" | nav fill "user@example.com"

# Verify state
nav find "Submit" --json | jq '.enabled'  # Is button enabled?

# Count matches
nav find --role listitem | wc -l   # How many items?
```

**Comparison:**

| Approach | Steps | Latency |
|----------|-------|---------|
| Screenshot → Vision → Click | 3 | ~2-5s |
| Snap → Parse → Click | 3 | ~500ms |
| Find → Click | 2 | ~100ms |

## Deferred

### Auth persistence (`auth save`/`auth load`)

Save and restore browser state (cookies, localStorage) for maintaining login across sessions. Deferred for later implementation.

## Implementation Notes

- Keep backward compatibility aliases for deprecated commands (warn on use)
- Update CLAUDE.md and plugin docs
- Update MCP action mappings if affected
