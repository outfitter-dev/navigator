/**
 * Paired Manager
 *
 * Bridges Navigator actions to a browser extension over WebSocket.
 * Responsible for:
 * - tracking connected extension clients
 * - tracking live tab metadata
 * - forwarding actions and resolving responses
 *
 * @module paired/manager
 */

import {
	type Action,
	type ActionResult,
	type ColorScheme,
	type TabInfo,
	type TabRef,
	type Viewport,
	hashUrl,
} from '@outfitter/navigator-core'
import type { ServerWebSocket } from 'bun'

// ============================================================================
// Types
// ============================================================================

type PairedMessage =
	| { type: 'hello'; client: 'extension'; version?: string }
	| {
			type: 'tabs'
			tabs: Array<{ id: number; url: string; title: string; active: boolean }>
	  }
	| { type: 'actionResult'; id: string; result: ActionResult }
	| { type: 'captureResult'; id: string; result: PairedCaptureResult }
	| { type: 'pong' }

interface PairedCaptureResult {
	success: boolean
	error?: string
	url?: string
	title?: string
	viewport?: Viewport
	colorScheme?: ColorScheme
	html?: string
	css?: string
	screenshot?: string
}

interface PendingRequest<T> {
	resolve: (value: T) => void
	reject: (error: Error) => void
	timeout: ReturnType<typeof setTimeout>
}

export interface PairedSessionState {
	connected: boolean
	tabCount: number
	activeTab: number | null
}

type PairedSocket = ServerWebSocket<unknown>

// ============================================================================
// Paired Manager
// ============================================================================

/**
 * Manages the connection to browser extensions in paired mode.
 */
export class PairedManager {
	private readonly sockets = new Set<PairedSocket>()
	private readonly pendingActions = new Map<
		string,
		PendingRequest<ActionResult>
	>()
	private readonly pendingCaptures = new Map<
		string,
		PendingRequest<PairedCaptureResult>
	>()
	private readonly tabsByRef = new Map<
		number,
		TabInfo & { tabId: number; active: boolean }
	>()
	private readonly tabIdByRef = new Map<number, number>()
	private activeRef: number | null = null
	private readonly requestTimeoutMs = 15_000

	/**
	 * Register a new websocket connection from the extension.
	 */
	handleOpen(socket: PairedSocket): void {
		this.sockets.add(socket)
	}

	/**
	 * Handle incoming websocket messages from the extension.
	 */
	handleMessage(_socket: PairedSocket, message: string | Uint8Array): void {
		const text =
			typeof message === 'string' ? message : new TextDecoder().decode(message)
		let payload: PairedMessage

		try {
			payload = JSON.parse(text) as PairedMessage
		} catch {
			return
		}

		switch (payload.type) {
			case 'hello':
				return
			case 'tabs':
				this.updateTabs(payload.tabs)
				return
			case 'actionResult': {
				const pending = this.pendingActions.get(payload.id)
				if (pending) {
					clearTimeout(pending.timeout)
					pending.resolve(payload.result)
					this.pendingActions.delete(payload.id)
				}
				return
			}
			case 'captureResult': {
				const pending = this.pendingCaptures.get(payload.id)
				if (pending) {
					clearTimeout(pending.timeout)
					pending.resolve(payload.result)
					this.pendingCaptures.delete(payload.id)
				}
				return
			}
			case 'pong':
				return
			default:
				return
		}
	}

	/**
	 * Handle websocket close and clear state if needed.
	 */
	handleClose(socket: PairedSocket): void {
		this.sockets.delete(socket)
		if (this.sockets.size === 0) {
			this.tabsByRef.clear()
			this.tabIdByRef.clear()
			this.activeRef = null
		}
	}

	/**
	 * Whether any extension client is connected.
	 */
	isConnected(): boolean {
		return this.sockets.size > 0
	}

	/**
	 * Return paired session state for /session reporting.
	 */
	getSessionState(): PairedSessionState {
		return {
			connected: this.isConnected(),
			tabCount: this.tabsByRef.size,
			activeTab: this.activeRef,
		}
	}

	/**
	 * List known paired tabs.
	 */
	getTabs(): TabInfo[] {
		const defaultViewport: Viewport = { width: 1280, height: 720 }
		return Array.from(this.tabsByRef.values()).map((tab) => ({
			ref: tab.ref,
			url: tab.url,
			urlHash: tab.urlHash,
			title: tab.title,
			viewport: tab.viewport ?? defaultViewport,
			colorScheme: tab.colorScheme ?? 'no-preference',
		}))
	}

	/**
	 * Forward an Action to the extension and wait for a response.
	 */
	async execute(action: Action): Promise<ActionResult> {
		if (!this.isConnected()) {
			return { success: false, error: 'No extension connected' }
		}

		const tabId = this.resolveTabIdFromAction(action)
		const requestId = this.createRequestId()

		const payload = {
			type: 'action',
			id: requestId,
			action: {
				...action,
				tabId,
			},
		}

		const socket = this.getPrimarySocket()
		if (!socket) {
			return { success: false, error: 'No extension connected' }
		}

		const result = await new Promise<ActionResult>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingActions.delete(requestId)
				reject(new Error('Extension action timed out'))
			}, this.requestTimeoutMs)

			this.pendingActions.set(requestId, { resolve, reject, timeout })
			socket.send(JSON.stringify(payload))
		})

		return result
	}

	/**
	 * Request a marker capture from the extension.
	 */
	async captureElement(
		selector: string,
		tab?: TabRef,
	): Promise<PairedCaptureResult> {
		if (!this.isConnected()) {
			return { success: false, error: 'No extension connected' }
		}

		const tabId = this.resolveTabId(tab)
		const requestId = this.createRequestId()

		const payload = {
			type: 'capture',
			id: requestId,
			selector,
			tabId,
			includeScreenshot: true,
			includeStyles: true,
		}

		const socket = this.getPrimarySocket()
		if (!socket) {
			return { success: false, error: 'No extension connected' }
		}

		const result = await new Promise<PairedCaptureResult>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingCaptures.delete(requestId)
				reject(new Error('Extension capture timed out'))
			}, this.requestTimeoutMs)

			this.pendingCaptures.set(requestId, { resolve, reject, timeout })
			socket.send(JSON.stringify(payload))
		})

		return result
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private getPrimarySocket(): PairedSocket | null {
		for (const socket of this.sockets) {
			return socket
		}
		return null
	}

	private updateTabs(
		tabs: Array<{ id: number; url: string; title: string; active: boolean }>,
	): void {
		const defaultViewport: Viewport = { width: 1280, height: 720 }
		const previousByTabId = new Map<
			number,
			TabInfo & { tabId: number; active: boolean }
		>()
		for (const info of this.tabsByRef.values()) {
			previousByTabId.set(info.tabId, info)
		}

		this.tabsByRef.clear()
		this.tabIdByRef.clear()
		this.activeRef = null

		tabs.forEach((tab, index) => {
			const ref = index
			const previous = previousByTabId.get(tab.id)
			const info: TabInfo & { tabId: number; active: boolean } = {
				ref,
				url: tab.url,
				urlHash: hashUrl(tab.url),
				title: tab.title,
				viewport: previous?.viewport ?? defaultViewport,
				colorScheme: previous?.colorScheme ?? 'no-preference',
				tabId: tab.id,
				active: tab.active,
			}

			this.tabsByRef.set(ref, info)
			this.tabIdByRef.set(ref, tab.id)
			if (tab.active) {
				this.activeRef = ref
			}
		})
	}

	/**
	 * Update viewport state for a paired tab.
	 */
	setTabViewport(ref: TabRef | undefined, viewport: Viewport): void {
		const resolved = this.resolveTabRef(ref)
		if (resolved === undefined) return
		const info = this.tabsByRef.get(resolved)
		if (!info) return
		this.tabsByRef.set(resolved, { ...info, viewport })
	}

	/**
	 * Update color scheme state for a paired tab.
	 */
	setTabColorScheme(ref: TabRef | undefined, scheme: ColorScheme): void {
		const resolved = this.resolveTabRef(ref)
		if (resolved === undefined) return
		const info = this.tabsByRef.get(resolved)
		if (!info) return
		this.tabsByRef.set(resolved, { ...info, colorScheme: scheme })
	}

	private resolveTabIdFromAction(action: Action): number | undefined {
		// Tab-specific actions
		if (action.action === 'tab') {
			return this.resolveTabId(action.ref)
		}
		if (action.action === 'closeTab') {
			return this.resolveTabId(action.ref)
		}
		// Actions with optional tab parameter
		if ('tab' in action) {
			return this.resolveTabId(action.tab as TabRef | undefined)
		}
		return this.resolveTabId(undefined)
	}

	private resolveTabId(ref?: TabRef): number | undefined {
		if (typeof ref === 'number') {
			return this.tabIdByRef.get(ref)
		}

		if (typeof ref === 'string' && ref.length === 4) {
			for (const [tabRef, info] of this.tabsByRef) {
				if (info.urlHash === ref) {
					return this.tabIdByRef.get(tabRef)
				}
			}
		}

		if (ref === undefined && this.activeRef !== null) {
			return this.tabIdByRef.get(this.activeRef)
		}

		return undefined
	}

	private resolveTabRef(ref?: TabRef): number | undefined {
		if (typeof ref === 'number') {
			return this.tabsByRef.has(ref) ? ref : undefined
		}

		if (typeof ref === 'string' && ref.length === 4) {
			for (const [tabRef, info] of this.tabsByRef) {
				if (info.urlHash === ref) {
					return tabRef
				}
			}
		}

		if (ref === undefined && this.activeRef !== null) {
			return this.activeRef
		}

		return undefined
	}

	private createRequestId(): string {
		return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
	}
}
