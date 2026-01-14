# 02 - Core Types

Define TypeScript types, Zod schemas, and storage utilities for Navigator.

## Overview

The `packages/core` package provides:
- Type definitions and Zod schemas
- Storage path utilities (XDG-compliant)
- Project root detection
- Configuration loading

## Package Structure

```
packages/core/
├── src/
│   ├── index.ts           # Public exports
│   ├── schema/
│   │   ├── index.ts       # Schema barrel
│   │   ├── action.ts      # Action schemas (discriminated union)
│   │   ├── step.ts        # Step schema
│   │   ├── session.ts     # Session schema
│   │   └── marker.ts      # Marker schema
│   ├── storage/
│   │   ├── index.ts       # Storage barrel
│   │   └── paths.ts       # XDG path utilities
│   ├── project/
│   │   ├── index.ts       # Project barrel
│   │   └── detect.ts      # Project root detection
│   └── config/
│       ├── index.ts       # Config barrel
│       └── loader.ts      # YAML config loader
├── package.json
└── tsconfig.json
```

## Schemas

### Action Schema (Discriminated Union)

```typescript
// src/schema/action.ts
import { z } from 'zod'

// Navigation actions
const navigateAction = z.object({
  action: z.literal('navigate'),
  url: z.string().url(),
})

const backAction = z.object({
  action: z.literal('back'),
})

const forwardAction = z.object({
  action: z.literal('forward'),
})

const reloadAction = z.object({
  action: z.literal('reload'),
})

// Interaction actions
const clickAction = z.object({
  action: z.literal('click'),
  ref: z.string().regex(/^@?e\d+(_\d+)?$/), // e42 or @e42 or e42_1
})

const typeAction = z.object({
  action: z.literal('type'),
  ref: z.string(),
  text: z.string(),
  clear: z.boolean().optional(),
})

// Capture actions
const snapAction = z.object({
  action: z.literal('snap'),
  fullPage: z.boolean().optional(),
  selector: z.string().optional(),
})

const screenshotAction = z.object({
  action: z.literal('screenshot'),
  fullPage: z.boolean().optional(),
  path: z.string().optional(),
})

// Discriminated union
export const ActionSchema = z.discriminatedUnion('action', [
  navigateAction,
  backAction,
  forwardAction,
  reloadAction,
  clickAction,
  typeAction,
  snapAction,
  screenshotAction,
  // ... more actions
])

export type Action = z.infer<typeof ActionSchema>
```

### Step Schema

```typescript
// src/schema/step.ts
import { z } from 'zod'
import { ActionSchema } from './action'

export const StepSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  action: ActionSchema,
  result: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    data: z.unknown().optional(),
  }),
  duration: z.number(), // ms
})

export type Step = z.infer<typeof StepSchema>
```

### Session Schema

```typescript
// src/schema/session.ts
import { z } from 'zod'

export const SessionMetaSchema = z.object({
  id: z.string().uuid(),
  projectHash: z.string(),
  projectPath: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  gitRef: z.string().optional(),
  gitBranch: z.string().optional(),
})

export type SessionMeta = z.infer<typeof SessionMetaSchema>
```

### Marker Schema

```typescript
// src/schema/marker.ts
import { z } from 'zod'

const PointMarkerSchema = z.object({
  type: z.literal('point'),
  x: z.number(),
  y: z.number(),
})

const RegionMarkerSchema = z.object({
  type: z.literal('region'),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const MarkerSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  url: z.string().url(),
  title: z.string(),
  geometry: z.discriminatedUnion('type', [PointMarkerSchema, RegionMarkerSchema]),
  note: z.string().optional(),
  screenshot: z.string().optional(), // base64 or path
})

export type Marker = z.infer<typeof MarkerSchema>
```

## Storage Paths

```typescript
// src/storage/paths.ts
import { homedir } from 'os'
import { join } from 'path'
import { createHash } from 'crypto'

// XDG Base Directory compliance
function getDataHome(): string {
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
}

function getCacheHome(): string {
  return process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
}

function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

// Navigator-specific paths
export function getNavigatorDataDir(): string {
  return join(getDataHome(), 'navigator')
}

export function getNavigatorCacheDir(): string {
  return join(getCacheHome(), 'navigator')
}

export function getNavigatorConfigDir(): string {
  return join(getConfigHome(), 'navigator')
}

// Project-scoped paths
export function hashProjectPath(projectPath: string): string {
  return createHash('sha256').update(projectPath).digest('hex').slice(0, 12)
}

export function getProjectDir(projectPath: string): string {
  const hash = hashProjectPath(projectPath)
  return join(getNavigatorDataDir(), hash)
}

export function getSessionsDir(projectPath: string): string {
  return join(getProjectDir(projectPath), 'sessions')
}

export function getSessionDir(projectPath: string, sessionId: string): string {
  return join(getSessionsDir(projectPath), sessionId)
}

export function getMarkersDir(projectPath: string, sessionId: string): string {
  return join(getSessionDir(projectPath, sessionId), 'markers')
}

// File paths within session
export function getSessionMetaPath(projectPath: string, sessionId: string): string {
  return join(getSessionDir(projectPath, sessionId), 'meta.json')
}

export function getStepsPath(projectPath: string, sessionId: string): string {
  return join(getSessionDir(projectPath, sessionId), 'steps.jsonl')
}
```

## Project Detection

```typescript
// src/project/detect.ts
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
]

export function detectProjectRoot(startPath: string = process.cwd()): string | null {
  let current = resolve(startPath)
  const root = dirname(current)

  while (current !== root) {
    for (const marker of PROJECT_MARKERS) {
      if (existsSync(join(current, marker))) {
        return current
      }
    }
    current = dirname(current)
  }

  return null
}

export function requireProjectRoot(startPath?: string): string {
  const root = detectProjectRoot(startPath)
  if (!root) {
    throw new Error('Not in a project directory (no .git, package.json, etc.)')
  }
  return root
}
```

## Configuration

```typescript
// src/config/loader.ts
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'
import { z } from 'zod'
import { getNavigatorConfigDir } from '../storage/paths'

const ConfigSchema = z.object({
  server: z.object({
    port: z.number().default(9334),
    host: z.string().default('localhost'),
  }).default({}),
  browser: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }).default({}),
  }).default({}),
  session: z.object({
    continuationWindow: z.number().default(30), // minutes
  }).default({}),
})

export type Config = z.infer<typeof ConfigSchema>

export function loadConfig(): Config {
  const configPath = join(getNavigatorConfigDir(), 'config.yaml')

  if (!existsSync(configPath)) {
    return ConfigSchema.parse({})
  }

  const raw = readFileSync(configPath, 'utf-8')
  const parsed = parse(raw)
  return ConfigSchema.parse(parsed)
}
```

## Package Configuration

```json
// packages/core/package.json
{
  "name": "@outfitter/navigator-core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./storage": "./src/storage/index.ts",
    "./project": "./src/project/index.ts",
    "./config": "./src/config/index.ts"
  },
  "dependencies": {
    "yaml": "^2.4.0",
    "zod": "^3.23.0"
  }
}
```

## Verification

- [ ] All schemas validate correctly with Zod
- [ ] Storage paths follow XDG specification
- [ ] Project detection finds roots correctly
- [ ] Config loader handles missing/partial files

## Dependencies

- Phase 1 complete (fork setup)

## Reference

See trails codebase patterns:
- `packages/core/src/schema/` for schema organization
- `packages/server/src/storage/` for path utilities
