/**
 * Watch Broadcaster
 *
 * Manages WebSocket connections for watch clients and broadcasts events.
 * Enables live streaming of session activity to the terminal via `nav watch`.
 *
 * @module watch/broadcaster
 */

import type { ServerWebSocket } from 'bun'

// ============================================================================
// Types
// ============================================================================

/**
 * Event types that can be broadcast to watch clients.
 */
export type WatchEventType =
	| 'action'
	| 'tab'
	| 'mode'
	| 'extension'
	| 'error'
	| 'connected'

/**
 * Event source indicator.
 */
export type WatchEventSource = 'agent' | 'user'

/**
 * Action status phases.
 */
export type WatchActionStatus = 'start' | 'success' | 'error'

/**
 * Tab event types.
 */
export type WatchTabEvent = 'open' | 'close' | 'switch'

/**
 * Watch event payload broadcast to connected clients.
 */
export interface WatchEvent {
	/** ISO timestamp */
	ts: string
	/** Event type */
	type: WatchEventType
	/** Event source (for action events) */
	source?: WatchEventSource | undefined
	/** Action name */
	action?: string | undefined
	/** Action target (URL, selector, etc.) */
	target?: string | undefined
	/** Action status */
	status?: WatchActionStatus | undefined
	/** Duration in milliseconds */
	duration?: number | undefined
	/** Error message */
	error?: string | undefined
	/** Tab reference */
	tabId?: string | undefined
	/** Tab event type */
	tabEvent?: WatchTabEvent | undefined
	/** Additional metadata */
	meta?: Record<string, unknown> | undefined
}

type WatchSocket = ServerWebSocket<unknown>

// ============================================================================
// Watch Broadcaster
// ============================================================================

/**
 * Broadcasts session events to connected watch clients.
 */
export class WatchBroadcaster {
	private readonly clients = new Set<WatchSocket>()

	/**
	 * Add a new watch client.
	 */
	addClient(ws: WatchSocket): void {
		this.clients.add(ws)

		// Send welcome event
		this.sendTo(ws, {
			ts: new Date().toISOString(),
			type: 'connected',
			meta: {
				clientCount: this.clients.size,
			},
		})
	}

	/**
	 * Remove a watch client.
	 */
	removeClient(ws: WatchSocket): void {
		this.clients.delete(ws)
	}

	/**
	 * Broadcast an event to all connected watch clients.
	 */
	broadcast(event: WatchEvent): void {
		if (this.clients.size === 0) return

		const message = JSON.stringify(event)
		for (const client of this.clients) {
			try {
				client.send(message)
			} catch {
				// Client may have disconnected, remove it
				this.clients.delete(client)
			}
		}
	}

	/**
	 * Get the number of connected watch clients.
	 */
	getClientCount(): number {
		return this.clients.size
	}

	/**
	 * Send an event to a specific client.
	 */
	private sendTo(ws: WatchSocket, event: WatchEvent): void {
		try {
			ws.send(JSON.stringify(event))
		} catch {
			// Ignore send errors
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global watch broadcaster instance.
 */
export const watchBroadcaster = new WatchBroadcaster()
