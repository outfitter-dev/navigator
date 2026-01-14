/**
 * Status Command
 *
 * Shows runtime status of the Navigator system.
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

// ============================================================================
// Types
// ============================================================================

interface HealthResponse {
	status: 'ok' | 'error'
	mode?: 'headless' | 'windowed' | 'paired'
	uptime?: number
	version?: string
}

interface SessionResponse {
	session?: {
		id: string
		stepCount?: number
	}
	tabs?: Array<{
		id: string
		active?: boolean
	}>
	extension?: {
		connected: boolean
	}
}

// ============================================================================
// Status Command
// ============================================================================

export function registerStatusCommand(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	program
		.command('status')
		.description('Show Navigator runtime status')
		.action(async () => {
			const client = getClient()

			console.log('Navigator Status')

			// Check server health
			try {
				const healthResponse = await fetch(`${client.serverUrl}/health`)
				if (!healthResponse.ok) {
					console.log(`  Server: error (HTTP ${healthResponse.status})`)
					return
				}

				const health = (await healthResponse.json()) as HealthResponse
				const port = new URL(client.serverUrl).port
				console.log(`  Server: running on :${port}`)

				if (health.mode) {
					console.log(`  Mode: ${health.mode}`)
				}
			} catch (err) {
				if (
					err instanceof Error &&
					(err.message.includes('ECONNREFUSED') ||
						err.message.includes('fetch failed'))
				) {
					console.log('  Server: not running')
					return
				}
				console.log(
					`  Server: error (${err instanceof Error ? err.message : String(err)})`,
				)
				return
			}

			// Get session info
			try {
				const sessionResponse = await fetch(`${client.serverUrl}/session`, {
					headers: {
						'X-Project-Path': client.projectPath,
					},
				})

				if (sessionResponse.ok) {
					const data = (await sessionResponse.json()) as SessionResponse

					if (data.session) {
						const stepInfo =
							data.session.stepCount !== undefined
								? ` (${data.session.stepCount} steps)`
								: ''
						console.log(`  Session: ${data.session.id.slice(0, 8)}${stepInfo}`)
					} else {
						console.log('  Session: none')
					}

					if (data.tabs && data.tabs.length > 0) {
						const activeTab = data.tabs.find((t) => t.active)
						const activeInfo = activeTab ? ` (${activeTab.id} active)` : ''
						console.log(`  Tabs: ${data.tabs.length} open${activeInfo}`)
					}

					if (data.extension) {
						console.log(
							`  Extension: ${data.extension.connected ? 'connected' : 'disconnected'}`,
						)
					}
				}
			} catch {
				// Session endpoint may not exist or may error - that's ok
			}
		})
}
