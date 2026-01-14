/**
 * WebSocket client utilities for Navigator extension
 */

export interface WebSocketMessage {
	type: string
	id?: string
	payload?: Record<string, unknown>
	[key: string]: unknown
}

export interface WebSocketConfig {
	url: string
	onOpen?: () => void
	onClose?: () => void
	onMessage?: (message: WebSocketMessage) => void
	onError?: (error: Event) => void
	reconnectDelay?: number
	maxReconnectAttempts?: number
}

/**
 * Create a reconnecting WebSocket connection
 */
export function createWebSocket(config: WebSocketConfig): {
	send: (message: WebSocketMessage) => void
	close: () => void
	isConnected: () => boolean
} {
	const {
		url,
		onOpen,
		onClose,
		onMessage,
		onError,
		reconnectDelay = 3000,
		maxReconnectAttempts = 10,
	} = config

	let ws: WebSocket | null = null
	let reconnectAttempts = 0
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
	let closed = false

	function connect() {
		if (closed) return

		ws = new WebSocket(url)

		ws.addEventListener('open', () => {
			reconnectAttempts = 0
			onOpen?.()
		})

		ws.addEventListener('close', () => {
			onClose?.()

			if (!closed && reconnectAttempts < maxReconnectAttempts) {
				reconnectAttempts++
				reconnectTimeout = setTimeout(connect, reconnectDelay)
			}
		})

		ws.addEventListener('error', (event) => {
			onError?.(event)
		})

		ws.addEventListener('message', (event) => {
			try {
				const message = JSON.parse(event.data as string) as WebSocketMessage
				onMessage?.(message)
			} catch {
				// Ignore invalid JSON
			}
		})
	}

	function send(message: WebSocketMessage) {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message))
		}
	}

	function close() {
		closed = true
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout)
		}
		ws?.close()
	}

	function isConnected() {
		return ws?.readyState === WebSocket.OPEN
	}

	// Start connection
	connect()

	return { send, close, isConnected }
}

/**
 * Convert HTTP URL to WebSocket URL
 */
export function httpToWsUrl(httpUrl: string): string {
	return `${httpUrl.replace(/^http/, 'ws')}/ws`
}
