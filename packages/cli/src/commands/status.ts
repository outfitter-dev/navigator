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
	}
	browser?: {
		mode: 'headless' | 'windowed' | 'paired'
		tabCount: number
		activeTab: number | null
		snapshotVersion: number
	}
	paired?: {
		connected: boolean
		tabCount: number
		activeTab: number | null
		viewport: {
			width: number
			height: number
		} | null
	}
}

// ============================================================================
// Status Command
// ============================================================================

function isConnectionError(err: unknown): boolean {
	return (
		err instanceof Error &&
		(err.message.includes('ECONNREFUSED') ||
			err.message.includes('fetch failed'))
	)
}

async function logServerStatus(
	client: NavigatorClient,
): Promise<{ ok: boolean; mode?: HealthResponse['mode'] }> {
	try {
		const healthResponse = await fetch(`${client.serverUrl}/health`)
		if (!healthResponse.ok) {
			console.log(`  Server: error (HTTP ${healthResponse.status})`)
			return { ok: false }
		}

		const health = (await healthResponse.json()) as HealthResponse
		const port = new URL(client.serverUrl).port
		console.log(`  Server: running on :${port}`)

		if (health.mode) {
			console.log(`  Mode: ${health.mode}`)
		}

		return { ok: true, mode: health.mode }
	} catch (err) {
		if (isConnectionError(err)) {
			console.log('  Server: not running')
			return { ok: false }
		}
		console.log(
			`  Server: error (${err instanceof Error ? err.message : String(err)})`,
		)
		return { ok: false }
	}
}

function logSessionSummary(session?: SessionResponse['session']): void {
	if (session) {
		console.log(`  Session: ${session.id.slice(0, 8)}`)
		return
	}
	console.log('  Session: none')
}

function formatActiveTab(activeTab: number | null | undefined): string {
	if (activeTab === null || activeTab === undefined) return ''
	return ` (active ${activeTab})`
}

function logTabSummary(
	data: SessionResponse,
	serverMode?: HealthResponse['mode'],
): void {
	const mode = data.browser?.mode ?? serverMode
	const tabCount =
		mode === 'paired' ? data.paired?.tabCount : data.browser?.tabCount
	const activeTab =
		mode === 'paired' ? data.paired?.activeTab : data.browser?.activeTab

	if (tabCount === undefined) {
		return
	}

	console.log(`  Tabs: ${tabCount} open${formatActiveTab(activeTab)}`)
}

function logExtensionStatus(paired?: SessionResponse['paired']): void {
	if (!paired) return
	console.log(`  Extension: ${paired.connected ? 'connected' : 'disconnected'}`)
}

async function logSessionStatus(
	client: NavigatorClient,
	serverMode?: HealthResponse['mode'],
): Promise<void> {
	try {
		const sessionResponse = await fetch(`${client.serverUrl}/session`, {
			headers: {
				'X-Project-Path': client.projectPath,
			},
		})

		if (!sessionResponse.ok) return

		const data = (await sessionResponse.json()) as SessionResponse
		logSessionSummary(data.session)
		logTabSummary(data, serverMode)
		logExtensionStatus(data.paired)
	} catch {
		// Session endpoint may not exist or may error - that's ok
	}
}

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

			const serverStatus = await logServerStatus(client)
			if (!serverStatus.ok) {
				return
			}

			await logSessionStatus(client, serverStatus.mode)
		})
}
