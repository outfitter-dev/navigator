# Sequences

Sequences enable batch execution of multiple Navigator actions in a single call. This reduces round trips, minimizes context usage, and enables efficient multi-step workflows while maintaining full validation and logging for each step.

## Overview

A sequence is an array of typed actions executed in order. Each step is validated, logged, and can be parameterized with variables.

```json
{
  "action": "sequence",
  "steps": [
    { "action": "navigate", "url": "https://example.com" },
    { "action": "click", "selector": "button" },
    { "action": "snap" }
  ]
}
```

## When to Use Sequences

| Scenario | Without Sequences | With Sequences |
|----------|-------------------|----------------|
| Login flow (5 steps) | 5 MCP calls | 1 MCP call |
| Form fill + submit | 4+ MCP calls | 1 MCP call |
| Multi-page navigation | N calls | 1 call |

Use sequences when:
- You have a known series of actions to execute
- Reducing round trips improves efficiency
- Actions don't depend on inspecting intermediate results

Don't use sequences when:
- You need to inspect results between steps
- Actions depend on dynamic element refs from previous snaps
- You need conditional branching based on page state

## Variable Interpolation

Use `{{varName}}` syntax to parameterize action values:

```json
{
  "action": "sequence",
  "steps": [
    { "action": "navigate", "url": "{{baseUrl}}/login" },
    { "action": "fill", "selector": "#email", "value": "{{email}}" },
    { "action": "fill", "selector": "#password", "value": "{{password}}" },
    { "action": "click", "selector": "button[type='submit']" }
  ],
  "params": {
    "baseUrl": "https://example.com",
    "email": "user@example.com",
    "password": "secret123"
  }
}
```

### Variable Rules

- Variables use the pattern `{{varName}}`
- Variable names must start with a letter or underscore
- Missing variables are left as-is (not errors)
- Non-string values are converted via `String()`
- Variables can appear anywhere in string values

## Error Handling

### Stop on Error (Default)

By default, sequences stop on the first error:

```json
{
  "action": "sequence",
  "steps": [
    { "action": "navigate", "url": "https://example.com" },
    { "action": "click", "selector": "#nonexistent" },
    { "action": "snap" }
  ]
}
```

Result when step 2 fails:
```json
{
  "success": false,
  "completed": 2,
  "total": 3,
  "stoppedAt": 1,
  "error": "Element not found: #nonexistent",
  "steps": [
    { "index": 0, "action": "navigate", "success": true, "duration": 1200 },
    { "index": 1, "action": "click", "success": false, "error": "Element not found", "duration": 50 }
  ]
}
```

### Continue on Error

Set `stopOnError: false` to continue executing remaining steps:

```json
{
  "action": "sequence",
  "steps": [
    { "action": "click", "selector": "#optional-button" },
    { "action": "snap" }
  ],
  "stopOnError": false
}
```

The sequence completes all steps; `success` is `false` if any step failed.

## Nested Sequences

Sequences can contain other sequences (max depth: 3):

```json
{
  "action": "sequence",
  "name": "full-checkout",
  "steps": [
    {
      "action": "sequence",
      "name": "login",
      "steps": [
        { "action": "navigate", "url": "{{baseUrl}}/login" },
        { "action": "fill", "selector": "#email", "value": "{{email}}" },
        { "action": "click", "selector": "button[type='submit']" }
      ]
    },
    {
      "action": "sequence",
      "name": "add-to-cart",
      "steps": [
        { "action": "navigate", "url": "{{baseUrl}}/products/{{productId}}" },
        { "action": "click", "selector": ".add-to-cart" }
      ],
      "params": { "productId": "12345" }
    }
  ],
  "params": {
    "baseUrl": "https://shop.example.com",
    "email": "user@example.com"
  }
}
```

Nested sequences:
- Inherit parent params (inner params override outer)
- Have their own `stopOnError` setting
- Are logged as single steps in the parent result

## Sequence Result

Every sequence returns a structured result:

```typescript
interface SequenceResult {
  success: boolean          // true if all steps succeeded
  completed: number         // number of steps that ran
  total: number             // total steps in sequence
  steps: SequenceStepResult[]
  stoppedAt?: number        // index where execution stopped (if stopOnError)
  error?: string            // first error message
}

interface SequenceStepResult {
  index: number             // 0-based step index
  action: string            // action type (e.g., "click", "navigate")
  success: boolean
  error?: string
  duration: number          // milliseconds
}
```

## Logging

Each step is logged to the session's step log (`step-log.jsonl`) with:
- Timestamp
- Action type
- Success/failure status
- Duration
- Any error details

This enables debugging and replay of sequence execution.

## Examples

### Login Flow

```json
{
  "action": "sequence",
  "name": "login",
  "steps": [
    { "action": "navigate", "url": "https://app.example.com/login" },
    { "action": "fill", "selector": "#email", "value": "{{email}}" },
    { "action": "fill", "selector": "#password", "value": "{{password}}" },
    { "action": "click", "selector": "button[type='submit']" },
    { "action": "waitFor", "selector": ".dashboard", "state": "visible" }
  ],
  "params": {
    "email": "user@example.com",
    "password": "secret"
  }
}
```

### Form Fill with Snap

```json
{
  "action": "sequence",
  "steps": [
    { "action": "navigate", "url": "https://example.com/contact" },
    { "action": "fill", "selector": "#name", "value": "{{name}}" },
    { "action": "fill", "selector": "#email", "value": "{{email}}" },
    { "action": "fill", "selector": "#message", "value": "{{message}}" },
    { "action": "snap" }
  ],
  "params": {
    "name": "Test User",
    "email": "test@example.com",
    "message": "Hello from Navigator!"
  }
}
```

### Multi-Tab Workflow

```json
{
  "action": "sequence",
  "steps": [
    { "action": "navigate", "url": "https://docs.example.com", "tab": "b0" },
    { "action": "newTab", "url": "https://app.example.com" },
    { "action": "snap", "tab": "b0" },
    { "action": "snap", "tab": "b1" }
  ]
}
```

### Resilient Scraping

```json
{
  "action": "sequence",
  "stopOnError": false,
  "steps": [
    { "action": "navigate", "url": "{{url}}" },
    { "action": "click", "selector": ".cookie-dismiss" },
    { "action": "click", "selector": ".popup-close" },
    { "action": "snap" }
  ],
  "params": { "url": "https://example.com" }
}
```

Optional clicks (cookie banner, popups) may fail but the snap still executes.

## Limitations

- **Max nesting depth**: 3 levels
- **No conditionals**: Sequences execute linearly (use separate calls for branching)
- **No loops**: Each step executes once
- **Element refs**: Refs from snap are scoped to that step; subsequent steps can't use them directly

## Surface Availability

| Surface | Support |
|---------|---------|
| MCP | Yes |
| CLI | Yes |
| Server API | Yes |

## Related

- **Element References** - `e42` refs are documented in `CLAUDE.md` under "Element Reference System"
- **Action Categories** - Full action list in `CLAUDE.md` under "Action Categories (MCP)"
- **Architecture** - See `docs/architecture/DESIGN.md` for design philosophy
