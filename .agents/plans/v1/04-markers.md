# 04 - Markers

> **Historical Document**: This plan was written during initial development. The actual implementation may differ. See `CLAUDE.md` for current command reference.

Implement the marker system for annotating browser views.

## Overview

Markers are user-created annotations on browser pages. Two types:

- **Point**: Single click location
- **Region**: Dragged rectangle area

Each marker includes:
- Geometric data (coordinates)
- Optional note/description
- Screenshot of the marked area
- Page metadata (URL, title)

Key feature: **"Copy to Agent"** generates markdown for sharing context with AI agents.

## Marker Model

### Schema

```typescript
// Already defined in 02-core-types.md
interface Marker {
  id: string           // UUID
  sessionId: string    // Parent session
  timestamp: string    // ISO 8601
  url: string          // Page URL when marked
  title: string        // Page title
  geometry: PointGeometry | RegionGeometry
  note?: string        // User annotation
  screenshot?: string  // Base64 or file path
}

interface PointGeometry {
  type: 'point'
  x: number
  y: number
}

interface RegionGeometry {
  type: 'region'
  x: number
  y: number
  width: number
  height: number
}
```

### Storage

```
~/.local/share/navigator/{project-hash}/sessions/{session-id}/markers/
└── {marker-id}.json
```

Each marker is a separate JSON file for easy management and conflict-free writes.

## Implementation

### Marker Store

```typescript
// packages/server/src/markers/store.ts
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getMarkersDir } from '@outfitter/navigator-core/storage'
import { MarkerSchema } from '@outfitter/navigator-core/schema'
import type { Marker } from '@outfitter/navigator-core/schema'

export class MarkerStore {
  private projectPath: string
  private sessionId: string

  constructor(projectPath: string, sessionId: string) {
    this.projectPath = projectPath
    this.sessionId = sessionId
  }

  private getDir(): string {
    return getMarkersDir(this.projectPath, this.sessionId)
  }

  private getPath(markerId: string): string {
    return join(this.getDir(), `${markerId}.json`)
  }

  async create(data: Omit<Marker, 'id' | 'timestamp' | 'sessionId'>): Promise<Marker> {
    const marker: Marker = {
      id: randomUUID(),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      ...data,
    }

    // Validate
    MarkerSchema.parse(marker)

    // Ensure directory exists
    const dir = this.getDir()
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Write marker file
    writeFileSync(this.getPath(marker.id), JSON.stringify(marker, null, 2))

    return marker
  }

  async get(markerId: string): Promise<Marker> {
    const path = this.getPath(markerId)
    if (!existsSync(path)) {
      throw new Error(`Marker not found: ${markerId}`)
    }
    const raw = readFileSync(path, 'utf-8')
    return MarkerSchema.parse(JSON.parse(raw))
  }

  async list(): Promise<Marker[]> {
    const dir = this.getDir()
    if (!existsSync(dir)) return []

    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const raw = readFileSync(join(dir, f), 'utf-8')
        return MarkerSchema.parse(JSON.parse(raw))
      })
      .sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
  }

  async update(markerId: string, updates: Partial<Pick<Marker, 'note'>>): Promise<Marker> {
    const marker = await this.get(markerId)
    const updated = { ...marker, ...updates }
    MarkerSchema.parse(updated)
    writeFileSync(this.getPath(markerId), JSON.stringify(updated, null, 2))
    return updated
  }

  async delete(markerId: string): Promise<void> {
    const path = this.getPath(markerId)
    if (existsSync(path)) {
      unlinkSync(path)
    }
  }
}
```

### Copy to Agent

```typescript
// packages/server/src/markers/export.ts
import type { Marker } from '@outfitter/navigator-core/schema'

export function markersToMarkdown(markers: Marker[]): string {
  if (markers.length === 0) {
    return '_No markers_'
  }

  const lines: string[] = ['## Browser Markers', '']

  for (const marker of markers) {
    lines.push(`### ${marker.title}`)
    lines.push('')
    lines.push(`**URL**: ${marker.url}`)
    lines.push(`**Type**: ${marker.geometry.type}`)

    if (marker.geometry.type === 'point') {
      lines.push(`**Position**: (${marker.geometry.x}, ${marker.geometry.y})`)
    } else {
      const { x, y, width, height } = marker.geometry
      lines.push(`**Region**: (${x}, ${y}) → ${width}×${height}`)
    }

    if (marker.note) {
      lines.push('')
      lines.push(`> ${marker.note}`)
    }

    if (marker.screenshot) {
      lines.push('')
      if (marker.screenshot.startsWith('data:')) {
        lines.push(`![Marker screenshot](${marker.screenshot})`)
      } else {
        lines.push(`_Screenshot saved: ${marker.screenshot}_`)
      }
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

// Single marker export
export function markerToMarkdown(marker: Marker): string {
  return markersToMarkdown([marker])
}
```

### Screenshot Capture

```typescript
// packages/server/src/markers/screenshot.ts
import type { Page } from 'playwright'
import type { Marker } from '@outfitter/navigator-core/schema'

export async function captureMarkerScreenshot(
  page: Page,
  geometry: Marker['geometry']
): Promise<string> {
  if (geometry.type === 'point') {
    // Capture small area around point
    const size = 100
    const clip = {
      x: Math.max(0, geometry.x - size / 2),
      y: Math.max(0, geometry.y - size / 2),
      width: size,
      height: size,
    }
    const buffer = await page.screenshot({ clip })
    return `data:image/png;base64,${buffer.toString('base64')}`
  }

  // Capture region
  const clip = {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
  }
  const buffer = await page.screenshot({ clip })
  return `data:image/png;base64,${buffer.toString('base64')}`
}
```

## MCP/CLI Actions

### Create Marker

```typescript
// Action schema addition
const markerAction = z.object({
  action: z.literal('marker'),
  geometry: z.discriminatedUnion('type', [
    z.object({ type: z.literal('point'), x: z.number(), y: z.number() }),
    z.object({ type: z.literal('region'), x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  ]),
  note: z.string().optional(),
})
```

### List Markers

```typescript
const markersAction = z.object({
  action: z.literal('markers'),
  format: z.enum(['json', 'markdown']).optional().default('json'),
})
```

### Get Marker

```typescript
const markerGetAction = z.object({
  action: z.literal('markerGet'),
  id: z.string().uuid(),
})
```

### Read Markers (Copy to Agent)

```typescript
const markerReadAction = z.object({
  action: z.literal('markerRead'),
  ids: z.array(z.string().uuid()).optional(), // All if not specified
})
```

### Compare Markers

```typescript
const markerCompareAction = z.object({
  action: z.literal('markerCompare'),
  id1: z.string().uuid(),
  id2: z.string().uuid(),
})
```

## Extension Integration

The Chrome extension creates markers via:

1. **Click**: User clicks with marker tool active → creates point marker
2. **Drag**: User drags rectangle → creates region marker
3. **Add Note**: Modal for adding description
4. **Copy to Agent**: Button that calls `markerRead` and copies markdown to clipboard

Extension sends marker creation via WebSocket:

```typescript
// From extension to server
{
  type: 'createMarker',
  payload: {
    geometry: { type: 'point', x: 450, y: 300 },
    note: 'Login button location',
    url: 'https://example.com/login',
    title: 'Login Page'
  }
}

// Server responds
{
  type: 'markerCreated',
  payload: { id: 'abc-123', ... }
}
```

## Verification

- [ ] Point markers created via click coordinates
- [ ] Region markers created via drag bounds
- [ ] Notes attach to markers correctly
- [ ] Screenshots capture marked areas
- [ ] `markerRead` produces clean markdown
- [ ] Extension can create markers via WebSocket

## Dependencies

- Phase 2 complete (core types)
- Phase 3 complete (sessions) for session ID

## Reference

See trails codebase patterns:
- `packages/server/src/markers/` for marker store
- `packages/extension/` for marker UI
