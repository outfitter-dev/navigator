/**
 * Watch Command
 *
 * Stream live session activity via WebSocket.
 *
 * @module commands/watch
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

// ============================================================================
// Types
// ============================================================================

interface WatchEvent {
	ts: string
	type: 'action' | 'tab' | 'mode' | 'extension' | 'error' | 'connected'
	source?: 'agent' | 'user'
	action?: string
	target?: string
	status?: 'start' | 'success' | 'error'
	duration?: number
	error?: string
	tabId?: string
	tabEvent?: 'open' | 'close' | 'switch'
	meta?: Record<string, unknown>
}

interface WatchOptions {
	json?: boolean
	quiet?: boolean
	source?: 'agent' | 'user'
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format a timestamp for display.
 */
function formatTime(isoTimestamp: string): string {
	const date = new Date(isoTimestamp)
	return date.toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

/**
 * Format source indicator.
 */
function formatSource(source?: 'agent' | 'user'): string {
	if (source === 'agent') return '[A]'
	if (source === 'user') return '[U]'
	return '[-]'
}

/**
 * Format status indicator.
 */
function formatStatus(status?: 'start' | 'success' | 'error'): string {
	if (status === 'start') return '...'
	if (status === 'success') return '\u2713' // checkmark
	if (status === 'error') return '\u2717' // X mark
	return ''
}

/**
 * Format duration for display.
 */
function formatDuration(duration?: number): string {
	if (duration === undefined) return ''
	if (duration < 1000) return `${duration}ms`
	return `${(duration / 1000).toFixed(1)}s`
}

/**
 * Format an event for human-readable output.
 */
function formatEvent(event: WatchEvent, quiet: boolean): string | null {
	const time = formatTime(event.ts)

	switch (event.type) {
		case 'connected':
			if (quiet) return null
			return `[${time}] Connected to Navigator`

		case 'action': {
			const source = formatSource(event.source)
			const status = formatStatus(event.status)
			const duration =
				event.status !== 'start' ? formatDuration(event.duration) : ''
			const target = event.target ? ` -> ${truncate(event.target, 50)}` : ''
			const error = event.error ? ` (${event.error})` : ''
			const meta = formatMeta(event.meta)

			if (quiet && event.status === 'start') return null

			return `[${time}] ${source} ${event.action}${target} ${status}${duration ? ` ${duration}` : ''}${meta}${error}`
		}

		case 'tab': {
			if (quiet) return null
			const tabAction = event.tabEvent ?? 'update'
			return `[${time}] tab ${tabAction}${event.tabId ? ` ${event.tabId}` : ''}`
		}

		case 'mode':
			if (quiet) return null
			return `[${time}] mode changed${event.target ? ` -> ${event.target}` : ''}`

		case 'extension':
			if (quiet) return null
			return `[${time}] extension ${event.status ?? 'event'}`

		case 'error':
			return `[${time}] ERROR: ${event.error ?? 'Unknown error'}`

		default:
			if (quiet) return null
			return `[${time}] ${event.type}`
	}
}

/**
 * Format metadata for display.
 */
function formatMeta(meta?: Record<string, unknown>): string {
	if (!meta) return ''

	const parts: string[] = []
	if (typeof meta.elementCount === 'number') {
		parts.push(`${meta.elementCount} elements`)
	}
	if (typeof meta.tabCount === 'number') {
		parts.push(`${meta.tabCount} tabs`)
	}
	if (typeof meta.markerCount === 'number') {
		parts.push(`${meta.markerCount} markers`)
	}

	return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str
	return `${str.slice(0, maxLen - 3)}...`
}

// ============================================================================
// WebSocket Client
// ============================================================================

/**
 * Create WebSocket URL from server URL.
 */
function getWebSocketUrl(serverUrl: string): string {
	const url = new URL(serverUrl)
	const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
	return `${protocol}//${url.host}/ws/watch`
}

/**
 * Connect to the watch WebSocket and stream events.
 */
async function watchSession(
	serverUrl: string,
	options: WatchOptions,
): Promise<void> {
	const wsUrl = getWebSocketUrl(serverUrl)

	let reconnectAttempts = 0
	const maxReconnectAttempts = 5
	const reconnectDelay = 1000
	let currentWs: WebSocket | null = null
	let resolveMain: (() => void) | null = null

	// Register signal handlers once, outside connect()
	const cleanup = () => {
		if (currentWs) {
			currentWs.close()
		}
		if (resolveMain) {
			resolveMain()
		}
		process.off('SIGINT', cleanup)
		process.off('SIGTERM', cleanup)
	}

	process.on('SIGINT', cleanup)
	process.on('SIGTERM', cleanup)

	function connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			resolveMain = resolve
			const ws = new WebSocket(wsUrl)
			currentWs = ws

			ws.onopen = () => {
				reconnectAttempts = 0
				if (!options.quiet && !options.json) {
					console.log(`Watching session at ${serverUrl}`)
					console.log('Press Ctrl+C to stop\n')
				}
			}

			ws.onmessage = (messageEvent) => {
				try {
					const event = JSON.parse(String(messageEvent.data)) as WatchEvent

					// Filter by source if specified
					if (
						options.source &&
						event.source &&
						event.source !== options.source
					) {
						return
					}

					if (options.json) {
						// JSONL output
						console.log(JSON.stringify(event))
					} else {
						// Human-readable output
						const formatted = formatEvent(event, options.quiet ?? false)
						if (formatted) {
							console.log(formatted)
						}
					}
				} catch {
					// Ignore parse errors
				}
			}

			ws.onerror = (error) => {
				if (!options.quiet && !options.json) {
					console.error('WebSocket error:', error)
				}
			}

			ws.onclose = () => {
				currentWs = null
				if (reconnectAttempts < maxReconnectAttempts) {
					reconnectAttempts++
					if (!options.quiet && !options.json) {
						console.log(
							`Connection lost. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`,
						)
					}
					setTimeout(() => {
						connect().catch(reject)
					}, reconnectDelay)
				} else {
					reject(new Error('Max reconnection attempts reached'))
				}
			}
		})
	}

	await connect()
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register the watch command.
 */
export function registerWatchCommand(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	program
		.command('watch')
		.description('Stream live session activity')
		.option('--json', 'Output events as JSONL')
		.option(
			'-q, --quiet',
			'Minimal output (hide start events, connection messages)',
		)
		.option(
			'--source <source>',
			'Filter events by source (agent or user)',
			(value) => {
				if (value !== 'agent' && value !== 'user') {
					throw new Error('Source must be "agent" or "user"')
				}
				return value as 'agent' | 'user'
			},
		)
		.action(async (options: WatchOptions) => {
			const client = getClient()

			// First check if server is running
			try {
				const healthResponse = await fetch(`${client.serverUrl}/health`)
				if (!healthResponse.ok) {
					console.error(`Server error: HTTP ${healthResponse.status}`)
					process.exitCode = 1
					return
				}
			} catch (err) {
				if (
					err instanceof Error &&
					(err.message.includes('ECONNREFUSED') ||
						err.message.includes('fetch failed'))
				) {
					console.error('Navigator server is not running.')
					console.error('Start it with: nav serve')
					process.exitCode = 1
					return
				}
				console.error(
					'Error connecting to server:',
					err instanceof Error ? err.message : String(err),
				)
				process.exitCode = 1
				return
			}

			// Start watching
			try {
				await watchSession(client.serverUrl, options)
			} catch (err) {
				if (!options.quiet && !options.json) {
					console.error(
						'Watch stopped:',
						err instanceof Error ? err.message : String(err),
					)
				}
				process.exitCode = 1
			}
		})
}
