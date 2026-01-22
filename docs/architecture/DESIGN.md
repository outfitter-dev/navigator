# Navigator Design Architecture

This document captures Navigator's design philosophy, conventions, and decision frameworks. It serves as the authoritative reference for:

- Future upstream agent-browser sync decisions
- New contributors understanding the mental model
- Consistent decision-making when adding features
- When to realign with upstream vs. maintain divergence

---

## Philosophy

Navigator is an **agent-first browser automation system**. Every design decision optimizes for AI agents as the primary user, with human developers as secondary users who benefit from the same affordances.

### Optimization Targets

| Target | Why It Matters |
|--------|----------------|
| **Token efficiency** | Agents pay per token. Shorter refs (`e42`), consolidated actions, and minimal output maximize value per API call. |
| **Cognitive load** | Agents shouldn't need locator expertise. One way to do things beats ten equivalent options. |
| **Workflow continuity** | Sessions persist. Element refs survive page loads when possible. Markers enable resumable workflows. |
| **Error clarity** | When things fail, agents need actionable guidance, not stack traces. |

### Core Principle

> **Opinionated user surface, aligned internals.**

Navigator's user-facing APIs (CLI commands, MCP actions, documentation terminology) are intentionally opinionated—designed for agent workflows even when upstream uses different conventions.

Navigator's internal implementation (executor, browser control, type definitions) should generally align with upstream agent-browser to minimize maintenance burden and enable easier syncs.

```
                    ┌─────────────────────────────────────────┐
  OPINIONATED ──────│ CLI, MCP Schema, Docs, Element Refs    │
                    │ "Navigator says snap, not snapshot"     │
                    └─────────────────────────────────────────┘
                                       │
                    ┌─────────────────────────────────────────┐
  TRANSLATION ──────│ packages/core/src/schema/               │
                    │ Maps Navigator terms → upstream terms   │
                    └─────────────────────────────────────────┘
                                       │
                    ┌─────────────────────────────────────────┐
  ALIGNED ──────────│ action-executor, browser control        │
                    │ Uses upstream API directly when possible│
                    └─────────────────────────────────────────┘
                                       │
                    ┌─────────────────────────────────────────┐
  DOWNSTREAM ───────│ @outfitter/agent-browser (fork)         │
                    │ Playwright, CDP, browser internals      │
                    └─────────────────────────────────────────┘
```

---

## Layer Model

### Layer 1: User Surface (Opinionated)

**Components:** CLI commands, MCP action names, documentation, element refs

**Characteristics:**
- Stability matters most—changes here affect agent prompts and workflows
- Naming optimizes for agent comprehension and token efficiency
- Navigator-specific terms are intentional divergences, not accidents
- Breaking changes require deprecation periods

**Examples:**
- `snap` (not `snapshot`)—shorter, memorable
- `e42` refs (not CSS selectors)—stable across page changes
- `paired` mode (not `guided`)—describes the relationship accurately

### Layer 2: Core Schema (Translation)

**Location:** `packages/core/src/schema/index.ts`

**Characteristics:**
- Zod schemas define the contract between user surface and executor
- Maps Navigator terminology to upstream terminology
- Validates input before reaching execution layer
- Can contain Navigator-specific fields that don't exist upstream

**Example:**
```typescript
// Navigator's action name
action: z.literal('newTab')  // ← User-facing

// Executor translates to upstream
// upstream uses: 'tab_new'
```

### Layer 3: Executor (Can Align)

**Location:** `packages/server/src/actions/executor.ts`

**Characteristics:**
- Implements actions by calling agent-browser APIs
- Should align with upstream patterns when practical
- Translation between Navigator and upstream terms happens here
- Adding new upstream features is usually straightforward

### Layer 4: Downstream (Inherited)

**Component:** `@outfitter/agent-browser` (fork of vercel-labs/agent-browser)

**Characteristics:**
- Browser automation primitives (Playwright, CDP)
- Navigator inherits behavior, doesn't modify internals
- Changes flow upstream when generally useful
- Fork exists for dependency control, not feature divergence

---

## Decision Frameworks

These frameworks guide decisions when integrating upstream changes or adding Navigator features.

### Framework A: New Upstream Feature

Use when upstream adds a new capability.

```
Does it benefit agents?
│
├─ NO → Skip or defer
│       (Example: Developer-focused debugging features)
│
└─ YES
    │
    └─ Does Navigator have an existing concept that covers this?
        │
        ├─ YES → Extend existing action or keep if sufficient
        │        (Example: upstream adds url param to tab_new,
        │         Navigator's newTab already exists → just add param)
        │
        └─ NO → Add new action
                │
                └─ Is upstream naming agent-friendly?
                    │
                    ├─ YES → Adopt with camelCase conversion
                    │        (Example: recording_start → recordingStart)
                    │
                    └─ NO → Create Navigator name
                            (Example: if upstream called it
                             "capture_element_visual" → Navigator uses "snap")
```

### Framework B: Upstream Renames Something We Diverged From

Use when upstream changes naming we intentionally diverged from.

```
Which layer is affected?
│
├─ INTERNAL (executor, types, implementation)
│   └─ Align with upstream
│      No user impact, reduces maintenance burden
│
└─ USER SURFACE (CLI, MCP, docs)
    │
    └─ Is the new upstream name objectively better for agents?
        │
        ├─ NO → Keep Navigator name
        │       Stability wins. Document the mapping.
        │       (Example: upstream renames to longer/less clear name)
        │
        └─ YES → Consider migration with deprecation period
                 1. Add new name alongside old
                 2. Deprecation notice in docs
                 3. Remove old name in next major version
```

### Framework C: Upstream "Catches Up"

Use when upstream adopts a concept Navigator pioneered.

```
Upstream adopts Navigator's concept
│
└─ Is naming identical?
    │
    ├─ YES → Simplify executor
    │        Remove Navigator-specific translation layer
    │        Internal alignment achieved
    │
    └─ NO → Keep Navigator name, simplify mapping
            Navigator name is established—changing it
            would break existing agent workflows
```

### Framework D: Consolidate vs. Mirror

Use when upstream has multiple related actions.

```
Multiple upstream actions with related purpose
│
└─ Are they cognitively distinct for agents?
    │
    ├─ YES → Mirror as separate actions
    │        (Example: screenshot vs. snap have different purposes)
    │
    └─ NO → Consolidate with parameters
            (Example: upstream has getByText, getByRole, getByTestId...
             → Navigator has single "find" with strategy parameter)
```

### Framework E: Skip vs. Adopt

Use when evaluating any upstream change.

```
┌─────────────────────────────────────────────────────────────┐
│ ALWAYS SKIP                                                  │
├─────────────────────────────────────────────────────────────┤
│ • Branding-specific (Vercel plugins, marketplace entries)   │
│ • Developer debugging tools with no agent benefit           │
│ • Duplicate functionality Navigator already handles better   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ALWAYS ADOPT                                                 │
├─────────────────────────────────────────────────────────────┤
│ • Bug fixes                                                  │
│ • Performance improvements                                   │
│ • Security patches                                           │
│ • Type definition improvements                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ EVALUATE CASE-BY-CASE                                        │
├─────────────────────────────────────────────────────────────┤
│ • New commands/actions (apply Framework A)                   │
│ • API changes (apply Framework B)                            │
│ • New CLI flags (does Navigator need them?)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Naming Conventions

### Layer-Specific Conventions

| Layer | Convention | Rationale | Examples |
|-------|------------|-----------|----------|
| User Surface (MCP) | camelCase | Consistent, agent-parseable | `newTab`, `recordingStart` |
| User Surface (CLI) | verb-noun subcommands | Human-friendly | `nav tab new`, `nav mark save` |
| Element Refs | short tokens | Token efficiency | `e42` not `element42` |
| Internal Code | Match upstream | Easier maintenance | Use upstream types directly |

### Navigator-Specific Terms

These terms are intentional Navigator choices, with rationale:

| Navigator | Upstream/Alternative | Rationale |
|-----------|---------------------|-----------|
| `snap` | `snapshot` | 4 chars vs 8 chars. Memorable. Distinct action name. |
| `paired` | `guided` | Describes the human-agent relationship, not direction. |
| `find` | `getByText`, `getByRole`, etc. | Agents shouldn't need locator strategy expertise. |
| `marker` | N/A (Navigator-specific) | Persistent references that survive sessions. |
| `e42` refs | CSS selectors | Stable, short, version-trackable. |

### When to Break Conventions

Break Navigator naming conventions when:

1. **Upstream term is unambiguous**: `evaluate` for JS execution is clear
2. **Industry standard is well-known**: `viewport`, `screenshot`
3. **Playwright parity matters**: Actions that map 1:1 to Playwright APIs

### camelCase Conversion Rule

When adopting upstream actions that use snake_case:

```
recording_start  →  recordingStart
tab_new          →  newTab (reordered for verb-noun pattern)
color_scheme     →  colorScheme
```

---

## Consolidation Patterns

Navigator consolidates upstream complexity to reduce cognitive load for agents.

### Pattern: Unified Query (`find`)

**Problem:** Playwright has multiple locator strategies: `getByText`, `getByRole`, `getByTestId`, `getByLabel`, etc. Agents must know which to use.

**Solution:** Single `find` action with strategy as parameter.

```typescript
// Navigator's unified approach
{ action: 'find', text: 'Submit' }          // finds by text
{ action: 'find', role: 'button' }          // finds by role
{ action: 'find', testId: 'submit-btn' }    // finds by test ID

// Agent doesn't need to know strategy names
```

### Pattern: Universal Tab Parameter

**Problem:** Most actions need a tab context. Switching tabs constantly is verbose.

**Solution:** Most actions accept optional `tab` parameter.

```typescript
// Without universal parameter (verbose)
{ action: 'tab', ref: 'b1' }
{ action: 'click', ref: 'e42' }

// With universal parameter (concise)
{ action: 'click', ref: 'e42', tab: 'b1' }
```

### Pattern: Presets with Escape Hatch (`viewport`)

**Problem:** Common cases (mobile, tablet) have well-known sizes. Custom sizes also needed.

**Solution:** Named presets with custom override.

```typescript
// Preset (common case)
{ action: 'viewport', preset: 'mobile' }

// Custom (escape hatch)
{ action: 'viewport', width: 1440, height: 900 }
```

### Pattern: Action + Subaction

**Problem:** Related operations bloat the action namespace.

**Solution:** Single action with operation parameter.

```typescript
// Single entry point
{ action: 'marker', operation: 'save', name: 'checkout-state' }
{ action: 'marker', operation: 'compare', name: 'checkout-state' }
{ action: 'marker', operation: 'list' }

// Not multiple actions: markerSave, markerCompare, markerList...
```

---

## Element Reference Philosophy

Element refs are Navigator's primary interface for element interaction.

### Why Refs Over Selectors

| Factor | Element Refs | CSS Selectors |
|--------|-------------|---------------|
| Token count | `e42` = 3 chars | `button.primary[data-testid="submit"]` = 40+ chars |
| Stability | Survives minor DOM changes | Breaks on class/structure changes |
| Agent expertise | None required | CSS knowledge required |
| Versioning | Built-in (`e42_1`, `e42_2`) | No concept of versions |

### Ref Format

```
e{index}_{version}

e42      → Element 42, current snap version (shorthand)
e42_1    → Element 42, explicitly version 1
e42_2    → Element 42, version 2 (after page change)
```

### Ref Lifecycle

```
snap       →  generates refs (e1, e2, e3...)
   │
interact   →  use refs to click, type, etc.
   │
page change →  DOM may change, refs may be stale
   │
snap       →  new refs with incremented version
```

### When Selectors Are OK

Selectors are acceptable when:

1. **Element is static**: Header logo, nav items that never change
2. **Test IDs exist**: `data-testid="submit"` is stable by design
3. **Advanced patterns**: Complex queries that refs can't express
4. **Agent explicitly chooses**: Agent can always fall back to selectors

---

## Upstream Sync Protocol

Navigator maintains a fork of agent-browser to control dependency versions and enable Navigator-specific patches when necessary.

### Sync Workflow

See `/flow:agent-browser` for the interactive workflow. Key phases:

1. **Check** — Detect upstream changes
2. **Analyze** — Categorize commits (breaking, additive, fix)
3. **Investigate** — Analyst subagent evaluates each change
4. **Document** — Write integration plan before merging
5. **Confirm** — User approves the plan
6. **Execute** — Merge upstream, update lockfile, test

### Evaluation Checklist

For each upstream change, determine:

- [ ] Does Navigator benefit from this? (Framework A)
- [ ] Does this conflict with Navigator conventions? (Framework B)
- [ ] Is this a bug fix or improvement to adopt immediately?
- [ ] Is documentation needed before implementation?

### Documentation Requirement

**No merge without documentation.** Every upstream sync must:

1. Create/update `docs/_upstream/{version}/integration.md`
2. Document any Navigator schema changes needed
3. Track implementation checklist items

---

## Historical Decisions

This section documents past decisions and their rationale. Reference when similar decisions arise.

### `snap` vs. `snapshot` (v0.1.0)

**Decision:** Use `snap` for DOM capture action.

**Rationale:**
- Token efficiency: 4 chars vs. 8 chars
- Memorable, distinct from `screenshot`
- Verb-like, implies quick action
- Aligns with Navigator's philosophy of brevity

**When to reconsider:** If `snapshot` becomes industry standard for this operation.

### `paired` vs. `guided` Mode (v0.2.0)

**Decision:** Call the extension-connected mode `paired`, not `guided`.

**Rationale:**
- `guided` implies one direction (agent guides human)
- `paired` describes the relationship accurately—human and agent work together
- Neither is strictly in control

**When to reconsider:** Never. This is a core Navigator concept.

### `find` Consolidation (v0.3.0)

**Decision:** Single `find` action instead of mirroring Playwright's `getBy*` methods.

**Rationale:**
- Agents don't need locator strategy expertise
- Reduces action namespace from 6+ methods to 1
- Parameters express intent; Navigator chooses strategy

**When to reconsider:** If agents demonstrate need for explicit locator control.

### Marketplace Plugin Skip (v0.6.0)

**Decision:** Exclude upstream's `.claude-plugin/marketplace.json` from fork.

**Rationale:**
- Vercel-branded, not Navigator-appropriate
- Navigator has its own plugin at `packages/agents/`
- Branding-specific content is always excluded (Framework E)

**When to reconsider:** Never. Navigator maintains its own plugin.

### `recording*` Actions Adoption (v0.6.0)

**Decision:** Adopt as `recordingStart`, `recordingStop`, `recordingRestart`.

**Rationale:**
- Native video recording benefits agents (demos, debugging)
- camelCase conversion per naming conventions
- No existing Navigator concept covers this

---

## Forward Guidance

### Adding New Navigator Features

When adding features unique to Navigator:

1. **Design for agents first** — Would an LLM understand this? Is it token-efficient?
2. **Consider upstream contribution** — If generally useful, contribute back
3. **Document the decision** — Add to Historical Decisions section
4. **Follow layer model** — User surface can diverge; internals should align when possible

### Deprecation Process

When changing user-facing APIs:

1. **Notice** — Document deprecation in changelog and docs
2. **Alias period** — Support both old and new for at least one minor version
3. **Removal** — Remove old API in next major version

### Testing Requirements by Layer

| Layer | Testing Requirement |
|-------|---------------------|
| User Surface | Integration tests via CLI/MCP |
| Core Schema | Unit tests for Zod schemas |
| Executor | Unit tests mocking agent-browser |
| End-to-end | Full stack tests with real browser |

### Contribution Checklist

For any change affecting Navigator conventions:

- [ ] Which layer does this affect?
- [ ] Does a decision framework apply?
- [ ] Is this documented in the right place?
- [ ] Does this need deprecation handling?
- [ ] Are tests updated?

---

## Appendix: Quick Reference

### Decision Framework Summary

| Situation | Framework | Quick Answer |
|-----------|-----------|--------------|
| New upstream feature | A | Benefit agents? → Adopt with Navigator naming |
| Upstream renamed something | B | User surface? → Keep Navigator name |
| Upstream caught up to us | C | Simplify executor, keep our name |
| Multiple related upstream actions | D | Cognitively distinct? → Mirror. Otherwise consolidate. |
| Any upstream change | E | Bug fix → adopt. Branding → skip. Features → evaluate. |

### Naming Quick Reference

```
MCP Actions:     camelCase              newTab, recordingStart
CLI Commands:    verb-noun              nav tab new, nav mark save
Element Refs:    e{index}[_{version}]   e42, e42_1
Internal Code:   Match upstream         Use their types directly
```

### Key Principle

> **When in doubt:** Keep user surface stable, let internals flex.

User-facing changes break agent workflows. Internal changes are invisible to agents. Optimize for the agents.
