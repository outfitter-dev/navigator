/**
 * Navigator Server Client
 *
 * HTTP client for communicating with navigator-server.
 * Handles action execution and server health checks.
 */

import type { ActionResult, NavigatorAction } from './schema'

// Default server configuration
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 9334

// Server connection state
let serverUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
let serverUrlInitialized = false

/**
 * Configure the server URL
 */
export function setServerUrl(url: string): void {
	serverUrl = url
	serverUrlInitialized = true
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string {
	return serverUrl
}

/**
 * Initialize server URL from environment or config
 */
async function ensureServerUrl(): Promise<void> {
	if (serverUrlInitialized) {
		return
	}
	serverUrlInitialized = true

	// Check environment variables
	const host = process.env.NAVIGATOR_HOST ?? DEFAULT_HOST
	const port = process.env.NAVIGATOR_PORT ?? String(DEFAULT_PORT)
	serverUrl = `http://${host}:${port}`
}

/**
 * Execute a navigator action via HTTP
 */
export async function executeAction(
	action: NavigatorAction,
): Promise<ActionResult> {
	await ensureServerUrl()

	try {
		const response = await fetch(`${serverUrl}/action`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(action),
		})

		if (!response.ok) {
			const error = await response.text()
			return {
				success: false,
				error: `Server error (${response.status}): ${error}`,
			}
		}

		return (await response.json()) as ActionResult
	} catch (error) {
		// Handle connection errors
		if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
			return {
				success: false,
				error: 'navigator-server not running. Start with: bun run dev',
			}
		}

		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Check if navigator-server is available
 */
export async function checkServer(): Promise<{
	available: boolean
	version?: string
}> {
	await ensureServerUrl()

	try {
		const response = await fetch(`${serverUrl}/health`)
		if (response.ok) {
			const data = (await response.json()) as { version: string }
			return { available: true, version: data.version }
		}
		return { available: false }
	} catch {
		return { available: false }
	}
}
