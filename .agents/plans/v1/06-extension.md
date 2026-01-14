# 06 - Chrome Extension

Implement the Chrome extension for Paired mode and marker creation.

## Overview

The extension enables two key features:

1. **Paired Mode**: Agent operates in user's browser via WebSocket
2. **Markers**: User clicks/drags to annotate, copies context to agent

## Extension Structure

```
packages/extension/
├── manifest.json
├── vite.config.ts
├── src/
│   ├── background/
│   │   └── index.ts        # Service worker
│   ├── content/
│   │   └── index.ts        # Content script
│   ├── popup/
│   │   ├── App.tsx         # Popup UI
│   │   └── main.tsx        # Popup entry
│   ├── components/
│   │   ├── MarkerOverlay.tsx
│   │   ├── ConnectionStatus.tsx
│   │   └── MarkerList.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   └── useMarkers.ts
│   └── lib/
│       ├── websocket.ts
│       └── clipboard.ts
├── public/
│   └── icons/
└── package.json
```

## Manifest

```json
// manifest.json
{
  "manifest_version": 3,
  "name": "Navigator",
  "version": "0.1.0",
  "description": "Browser automation for AI agents",
  "permissions": [
    "activeTab",
    "storage",
    "clipboardWrite"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.ts"],
    "css": ["src/content/styles.css"]
  }],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

## Background Script

```typescript
// src/background/index.ts
let ws: WebSocket | null = null
let connected = false

// Connect to navigator-server
function connect(port: number = 9334) {
  ws = new WebSocket(`ws://localhost:${port}/ws`)

  ws.onopen = () => {
    connected = true
    broadcast({ type: 'connected' })
  }

  ws.onclose = () => {
    connected = false
    broadcast({ type: 'disconnected' })
    // Reconnect after delay
    setTimeout(() => connect(port), 3000)
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    handleServerMessage(message)
  }
}

// Handle messages from server
function handleServerMessage(message: unknown) {
  switch (message.type) {
    case 'execute':
      // Forward action to content script
      sendToActiveTab(message.payload)
      break
    case 'markerCreated':
      broadcast({ type: 'markerCreated', payload: message.payload })
      break
  }
}

// Send to all extension contexts
function broadcast(message: unknown) {
  chrome.runtime.sendMessage(message).catch(() => {})
}

// Send to active tab's content script
async function sendToActiveTab(message: unknown) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, message)
  }
}

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'connect':
      connect(message.port)
      sendResponse({ success: true })
      break
    case 'getStatus':
      sendResponse({ connected })
      break
    case 'createMarker':
      ws?.send(JSON.stringify({
        type: 'createMarker',
        payload: message.payload,
      }))
      sendResponse({ success: true })
      break
    case 'sendAction':
      ws?.send(JSON.stringify(message.payload))
      sendResponse({ success: true })
      break
  }
  return true
})

// Auto-connect on install
chrome.runtime.onInstalled.addListener(() => {
  connect()
})
```

## Content Script

```typescript
// src/content/index.ts
let markerMode = false
let startPoint: { x: number; y: number } | null = null
let overlay: HTMLDivElement | null = null

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'enableMarkerMode':
      enableMarkerMode()
      sendResponse({ success: true })
      break
    case 'disableMarkerMode':
      disableMarkerMode()
      sendResponse({ success: true })
      break
    case 'execute':
      // Handle agent actions in user's browser
      handleAction(message.payload)
      sendResponse({ success: true })
      break
  }
  return true
})

function enableMarkerMode() {
  markerMode = true
  document.body.style.cursor = 'crosshair'
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  showModeIndicator()
}

function disableMarkerMode() {
  markerMode = false
  document.body.style.cursor = ''
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  hideModeIndicator()
}

function handleMouseDown(e: MouseEvent) {
  if (!markerMode) return
  e.preventDefault()
  startPoint = { x: e.clientX, y: e.clientY }
  createOverlay()
}

function handleMouseMove(e: MouseEvent) {
  if (!markerMode || !startPoint || !overlay) return
  const width = e.clientX - startPoint.x
  const height = e.clientY - startPoint.y

  overlay.style.left = `${Math.min(startPoint.x, e.clientX)}px`
  overlay.style.top = `${Math.min(startPoint.y, e.clientY)}px`
  overlay.style.width = `${Math.abs(width)}px`
  overlay.style.height = `${Math.abs(height)}px`
}

function handleMouseUp(e: MouseEvent) {
  if (!markerMode || !startPoint) return

  const endPoint = { x: e.clientX, y: e.clientY }
  const isClick = Math.abs(endPoint.x - startPoint.x) < 5 &&
                  Math.abs(endPoint.y - startPoint.y) < 5

  const geometry = isClick
    ? { type: 'point' as const, x: startPoint.x, y: startPoint.y }
    : {
        type: 'region' as const,
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - startPoint.x),
        height: Math.abs(endPoint.y - startPoint.y),
      }

  // Prompt for note
  const note = prompt('Add a note (optional):')

  // Send marker to server
  chrome.runtime.sendMessage({
    type: 'createMarker',
    payload: {
      geometry,
      note: note || undefined,
      url: window.location.href,
      title: document.title,
    },
  })

  // Cleanup
  removeOverlay()
  startPoint = null
}

function createOverlay() {
  overlay = document.createElement('div')
  overlay.className = 'navigator-marker-overlay'
  overlay.style.cssText = `
    position: fixed;
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    z-index: 999999;
  `
  document.body.appendChild(overlay)
}

function removeOverlay() {
  overlay?.remove()
  overlay = null
}

function showModeIndicator() {
  const indicator = document.createElement('div')
  indicator.id = 'navigator-mode-indicator'
  indicator.textContent = '🎯 Marker Mode'
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border-radius: 4px;
    font-family: system-ui;
    font-size: 14px;
    z-index: 999999;
  `
  document.body.appendChild(indicator)
}

function hideModeIndicator() {
  document.getElementById('navigator-mode-indicator')?.remove()
}

// Handle agent actions in Paired mode
async function handleAction(action: unknown) {
  // Execute action in user's browser context
  switch (action.action) {
    case 'click':
      // Find element by ref and click
      break
    case 'type':
      // Find element and type
      break
    case 'scroll':
      window.scrollBy(action.x || 0, action.y || 0)
      break
    // ... more actions
  }
}
```

## Popup UI

```typescript
// src/popup/App.tsx
import { useState, useEffect } from 'react'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { MarkerList } from '../components/MarkerList'

export function App() {
  const [connected, setConnected] = useState(false)
  const [markerMode, setMarkerMode] = useState(false)
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    // Get connection status
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      setConnected(response?.connected || false)
    })

    // Listen for updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'connected') setConnected(true)
      if (message.type === 'disconnected') setConnected(false)
      if (message.type === 'markerCreated') {
        setMarkers(prev => [...prev, message.payload])
      }
    })
  }, [])

  const toggleMarkerMode = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: markerMode ? 'disableMarkerMode' : 'enableMarkerMode',
      })
      setMarkerMode(!markerMode)
    }
  }

  const copyToAgent = async () => {
    // Get markdown from server
    const response = await fetch('http://localhost:9334/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markerRead' }),
    })
    const result = await response.json()

    // Copy to clipboard
    await navigator.clipboard.writeText(result.markdown)
    alert('Copied to clipboard!')
  }

  return (
    <div className="w-80 p-4">
      <h1 className="text-lg font-bold mb-4">Navigator</h1>

      <ConnectionStatus connected={connected} />

      <div className="space-y-2 mt-4">
        <button
          onClick={toggleMarkerMode}
          className={`w-full py-2 px-4 rounded ${
            markerMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {markerMode ? '🎯 Marker Mode Active' : 'Enable Marker Mode'}
        </button>

        <button
          onClick={copyToAgent}
          disabled={markers.length === 0}
          className="w-full py-2 px-4 rounded bg-green-600 text-white disabled:opacity-50"
        >
          Copy to Agent ({markers.length})
        </button>
      </div>

      <MarkerList markers={markers} />
    </div>
  )
}
```

## WebSocket Protocol

### Client → Server

```typescript
// Enable Paired mode
{ type: 'enablePaired' }

// Create marker
{
  type: 'createMarker',
  payload: {
    geometry: { type: 'point', x: 100, y: 200 },
    note: 'Login button',
    url: 'https://example.com',
    title: 'Example'
  }
}

// Action result (for Paired mode)
{
  type: 'actionResult',
  id: 'action-123',
  success: true,
  data: { ... }
}
```

### Server → Client

```typescript
// Execute action (Paired mode)
{
  type: 'execute',
  id: 'action-123',
  payload: { action: 'click', ref: '@e42' }
}

// Marker created confirmation
{
  type: 'markerCreated',
  payload: { id: 'marker-456', ... }
}

// Status update
{ type: 'status', paired: true }
```

## Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        background: 'src/background/index.ts',
        content: 'src/content/index.ts',
      },
    },
  },
})
```

## Verification

- [ ] Extension installs in Chrome
- [ ] WebSocket connects to navigator-server
- [ ] Marker mode creates point markers (click)
- [ ] Marker mode creates region markers (drag)
- [ ] Notes can be added to markers
- [ ] "Copy to Agent" produces clean markdown
- [ ] Paired mode receives and executes actions

## Dependencies

- Phase 2 complete (core types)
- Phase 3 complete (sessions)
- Phase 4 complete (markers)
- Server running with WebSocket support

## Reference

See trails codebase patterns:
- `packages/extension/` for extension structure
- `packages/ui/` for shared components
