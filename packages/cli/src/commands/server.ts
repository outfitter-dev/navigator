/**
 * Server Commands
 *
 * nav server start|status|stop
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
// Status Helpers
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

// ============================================================================
// Server Commands
// ============================================================================

export function registerServerCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	const server = program.command('server').description('Server management')

	// nav server start
	server
		.command('start')
		.description('Start Navigator browser server')
		.option('--port <number>', 'Server port (default: 9334)')
		.action(async (options) => {
			const port = options.port ?? process.env.NAVIGATOR_PORT ?? '9334'
			process.env.PORT = port

			// Import server package - auto-starts on import
			try {
				await import('@outfitter/navigator-server')
				// Server is now running, keep process alive
				await new Promise(() => {})
			} catch (err) {
				// Fallback: spawn server from relative path (dev mode)
				const serverPath = join(
					dirname(fileURLToPath(import.meta.url)),
					'..',
					'..',
					'..',
					'server',
					'src',
					'index.ts',
				)

				console.log(`Starting Navigator server on port ${port}...`)
				const child = spawn('bun', ['run', serverPath], {
					stdio: 'inherit',
					env: { ...process.env, PORT: port },
				})

				child.on('error', (spawnErr) => {
					console.error('Failed to start server:', spawnErr.message)
					process.exitCode = 1
				})

				child.on('exit', (code) => {
					process.exitCode = code ?? 0
				})

				// Forward signals to child
				for (const signal of ['SIGINT', 'SIGTERM'] as const) {
					process.on(signal, () => child.kill(signal))
				}
			}
		})

	// nav server status
	server
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

	// nav server stop
	server
		.command('stop')
		.description('Stop Navigator server')
		.action(async () => {
			const client = getClient()

			try {
				const response = await fetch(`${client.serverUrl}/shutdown`, {
					method: 'POST',
				})

				if (response.ok) {
					console.log('Server stopped')
				} else {
					console.log(`Failed to stop server (HTTP ${response.status})`)
					process.exitCode = 1
				}
			} catch (err) {
				if (isConnectionError(err)) {
					console.log('Server is not running')
				} else {
					console.error(
						'Error:',
						err instanceof Error ? err.message : String(err),
					)
					process.exitCode = 1
				}
			}
		})
}
