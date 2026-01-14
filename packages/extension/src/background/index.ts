/**
 * Background Script (Service Worker)
 *
 * Bridges the extension to navigator-server over WebSocket.
 * Handles Paired mode communication and marker creation requests.
 */

const DEFAULT_SERVER_URL = 'http://localhost:9334'

let ws: WebSocket | null = null
let connected = false
let pairedMode = false

// Store viewport per tab
const tabViewports = new Map<number, { width: number; height: number }>()

interface Viewport {
	width: number
	height: number
}

interface ServerMessage {
	type: string
	id?: string
	payload?: Record<string, unknown>
	paired?: boolean
}

interface ActionResult {
	success: boolean
	data?: unknown
	error?: string
}

/**
 * Get stored configuration from chrome.storage.local
 */
function getConfig(): Promise<{ serverUrl?: string }> {
	return new Promise((resolve) => {
		chrome.storage.local.get(['serverUrl'], resolve)
	})
}

/**
 * Send an action to the navigator-server via HTTP
 */
async function sendAction(
	action: Record<string, unknown>,
): Promise<ActionResult> {
	const { serverUrl } = await getConfig()
	const url = serverUrl || DEFAULT_SERVER_URL

	const response = await fetch(`${url}/action`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-navigator-source': 'extension',
		},
		body: JSON.stringify(action),
	})

	return response.json() as Promise<ActionResult>
}

/**
 * Connect to navigator-server WebSocket
 */
async function connectWebSocket(): Promise<void> {
	const { serverUrl } = await getConfig()
	const baseUrl = serverUrl || DEFAULT_SERVER_URL
	const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`

	if (ws?.readyState === WebSocket.OPEN) {
		return
	}
	if (ws?.readyState === WebSocket.CONNECTING) {
		return
	}

	ws = new WebSocket(wsUrl)

	ws.addEventListener('open', () => {
		connected = true
		broadcast({ type: 'connected' })

		// Send hello message to identify as extension
		ws?.send(
			JSON.stringify({
				type: 'hello',
				client: 'extension',
				version: '0.1.0',
			}),
		)

		// Send current tabs
		sendTabs()
	})

	ws.addEventListener('close', () => {
		connected = false
		pairedMode = false
		broadcast({ type: 'disconnected' })

		// Reconnect after delay
		setTimeout(() => connectWebSocket(), 3000)
	})

	ws.addEventListener('error', () => {
		// Error handling - close will fire after this
	})

	ws.addEventListener('message', (event) => {
		let message: ServerMessage
		try {
			message = JSON.parse(event.data as string) as ServerMessage
		} catch {
			return
		}

		handleServerMessage(message)
	})
}

/**
 * Handle messages from the server
 */
function handleServerMessage(message: ServerMessage): void {
	switch (message.type) {
		case 'execute':
			// Forward action to content script for execution in Paired mode
			if (message.id && message.payload) {
				executeInActiveTab(message.id, message.payload)
			}
			break

		case 'markerCreated':
			// Broadcast marker creation confirmation
			broadcast({
				type: 'markerCreated',
				payload: message.payload,
			})
			break

		case 'status': {
			// Server status update
			const wasPaired = pairedMode
			pairedMode = message.paired ?? false
			broadcast({ type: 'pairedModeChanged', paired: pairedMode })

			// Notify content scripts of paired mode change
			if (pairedMode !== wasPaired) {
				notifyContentScripts({
					type: 'navigator:pairedModeStatus',
					pairedMode,
				})
			}
			break
		}
	}
}

/**
 * Execute an action in the active tab's content script
 */
async function executeInActiveTab(
	id: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
	if (!tab?.id) {
		sendActionResult(id, { success: false, error: 'No active tab' })
		return
	}

	chrome.tabs.sendMessage(
		tab.id,
		{ type: 'navigator:execute', action: payload },
		(response: ActionResult | undefined) => {
			if (chrome.runtime.lastError) {
				sendActionResult(id, {
					success: false,
					error: chrome.runtime.lastError.message ?? 'Unknown error',
				})
				return
			}
			sendActionResult(id, response ?? { success: false, error: 'No response' })
		},
	)
}

/**
 * Send action result back to server
 */
function sendActionResult(id: string, result: ActionResult): void {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: 'actionResult',
				id,
				...result,
			}),
		)
	}
}

/**
 * Send current tabs to the server
 */
async function sendTabs(): Promise<void> {
	if (ws?.readyState !== WebSocket.OPEN) {
		return
	}

	const tabs = await chrome.tabs.query({ currentWindow: true })
	ws.send(
		JSON.stringify({
			type: 'tabs',
			tabs: tabs.map((tab) => ({
				id: tab.id,
				url: tab.url || '',
				title: tab.title || '',
				active: tab.active,
				viewport: tab.id ? tabViewports.get(tab.id) : undefined,
			})),
		}),
	)
}

/**
 * Send viewport update to the server
 */
function sendViewportUpdate(
	tabId: number,
	viewport: Viewport,
	url: string,
	title: string,
): void {
	if (ws?.readyState !== WebSocket.OPEN) {
		return
	}

	// Store viewport for this tab
	tabViewports.set(tabId, viewport)

	// Send viewport update message
	ws.send(
		JSON.stringify({
			type: 'viewportUpdate',
			tabId,
			viewport,
			url,
			title,
		}),
	)
}

/**
 * Send user action event to the server
 */
function sendUserAction(
	tabId: number,
	action: string,
	target?: string,
	url?: string,
): void {
	if (ws?.readyState !== WebSocket.OPEN) {
		return
	}

	ws.send(
		JSON.stringify({
			type: 'userAction',
			tabId,
			action,
			target,
			url,
			timestamp: new Date().toISOString(),
		}),
	)
}

/**
 * Broadcast message to all extension contexts (popup, content scripts)
 */
function broadcast(message: Record<string, unknown>): void {
	chrome.runtime.sendMessage(message).catch(() => {
		// Ignore errors when no listeners
	})
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener(
	(
		message: {
			type: string
			port?: number
			payload?: Record<string, unknown>
			viewport?: Viewport
			url?: string
			title?: string
			action?: string
			target?: string
			timestamp?: string
		},
		sender,
		sendResponse,
	) => {
		switch (message.type) {
			case 'connect':
				connectWebSocket()
				sendResponse({ success: true })
				break

			case 'getStatus':
				sendResponse({ connected, pairedMode })
				break

			case 'enablePaired':
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'enablePaired' }))
					// Notify content scripts to start tracking user actions
					notifyContentScripts({ type: 'navigator:enablePairedMode' })
					sendResponse({ success: true })
				} else {
					sendResponse({ success: false, error: 'Not connected' })
				}
				break

			case 'disablePaired':
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'disablePaired' }))
					// Notify content scripts to stop tracking user actions
					notifyContentScripts({ type: 'navigator:disablePairedMode' })
					sendResponse({ success: true })
				} else {
					sendResponse({ success: false, error: 'Not connected' })
				}
				break

			case 'createMarker':
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({
							type: 'createMarker',
							payload: message.payload,
						}),
					)
					sendResponse({ success: true })
				} else {
					// Fallback to HTTP if WebSocket not connected
					sendAction({
						action: 'marker',
						...message.payload,
					})
						.then((result) => sendResponse(result))
						.catch((error) =>
							sendResponse({
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							}),
						)
					return true // Keep channel open for async response
				}
				break

			case 'sendAction':
				if (message.payload) {
					sendAction(message.payload)
						.then((result) => sendResponse(result))
						.catch((error) =>
							sendResponse({
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							}),
						)
					return true // Keep channel open for async response
				}
				break

			case 'viewportUpdate':
				// Forward viewport update from content script to server
				if (sender.tab?.id && message.viewport) {
					sendViewportUpdate(
						sender.tab.id,
						message.viewport,
						message.url ?? '',
						message.title ?? '',
					)
				}
				sendResponse({ success: true })
				break

			case 'userAction':
				// Forward user action from content script to server
				if (sender.tab?.id && message.action && pairedMode) {
					sendUserAction(
						sender.tab.id,
						message.action,
						message.target,
						message.url,
					)
				}
				sendResponse({ success: true })
				break
		}

		return true // Keep channel open
	},
)

/**
 * Notify all content scripts of paired mode status changes
 */
async function notifyContentScripts(
	message: Record<string, unknown>,
): Promise<void> {
	const tabs = await chrome.tabs.query({ currentWindow: true })
	for (const tab of tabs) {
		if (tab.id) {
			chrome.tabs.sendMessage(tab.id, message).catch(() => {
				// Ignore errors for tabs without content scripts
			})
		}
	}
}

// Tab change listeners - keep server informed
chrome.tabs.onActivated.addListener(() => sendTabs())
chrome.tabs.onCreated.addListener(() => sendTabs())
chrome.tabs.onRemoved.addListener(() => sendTabs())
chrome.tabs.onUpdated.addListener(() => sendTabs())

// Reconnect when storage changes (server URL updated)
chrome.storage.onChanged.addListener(() => {
	if (ws) {
		ws.close()
	}
	connectWebSocket()
})

// Connect on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
	connectWebSocket()
})

// Connect on service worker startup
connectWebSocket()
