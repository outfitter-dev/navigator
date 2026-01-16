/**
 * Browser Manager
 *
 * Wraps agent-browser for browser control.
 *
 * @module browser/manager
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import {
	type BrowserMode,
	type ColorScheme,
	type NavigatorConfig,
	type TabInfo,
	type Viewport,
	hashUrl,
} from '@outfitter/navigator-core'
import { CATEGORIES, getLogger } from '@outfitter/navigator-core/logging'

// ============================================================================
// Types
// ============================================================================

interface AgentBrowserResponse<T = unknown> {
	success: boolean
	data?: T
	error?: string
}

interface TabListData {
	tabs: Array<{ index: number; url: string; title: string; active: boolean }>
	active: number
}

// ============================================================================
// Constants
// ============================================================================

const SOCKET_READY_RETRIES = 50
const SOCKET_READY_DELAY_MS = 100
const CONNECT_TIMEOUT_MS = 250
const COMMAND_TIMEOUT_MS = 15_000

// ============================================================================
// Utilities
// ============================================================================

function getPortForSession(session: string): number {
	let hash = 0
	for (let i = 0; i < session.length; i++) {
		hash = (hash << 5) - hash + session.charCodeAt(i)
		hash |= 0
	}
	return 49_152 + (Math.abs(hash) % 16_383)
}

function getSocketPath(session: string): string {
	return os.platform() === 'win32'
		? String(getPortForSession(session))
		: `${os.tmpdir()}/agent-browser-${session}.sock`
}

function resolveAgentBrowserBin(): string {
	const override = process.env.AGENT_BROWSER_BIN
	if (override) return override

	if (typeof Bun !== 'undefined' && typeof Bun.which === 'function') {
		const resolved = Bun.which('agent-browser')
		if (resolved) return resolved
	}

	return 'agent-browser'
}

async function runAgentBrowserCli(
	args: string[],
	env?: Record<string, string>,
): Promise<void> {
	const bin = resolveAgentBrowserBin()
	const subprocess = Bun.spawn({
		cmd: [bin, ...args],
		env: { ...process.env, ...env },
		stdout: 'ignore',
		stderr: 'pipe',
	})

	const stderr = await new Response(subprocess.stderr).text()
	const exitCode = await subprocess.exited
	if (exitCode !== 0) {
		throw new Error(
			stderr.trim() || `agent-browser exited with code ${exitCode}`,
		)
	}
}

// ============================================================================
// Browser Manager
// ============================================================================

const log = getLogger(CATEGORIES.BROWSER)

/**
 * Manages browser instances via agent-browser.
 */
export class BrowserManager {
	private mode: BrowserMode
	private snapshotVersion = 0
	private readonly tabState = new Map<
		number,
		{ viewport: Viewport; colorScheme: ColorScheme }
	>()
	private ready = false

	constructor(
		config: NavigatorConfig,
		private readonly session: string,
	) {
		this.mode = config.browser.headless ? 'headless' : 'windowed'
	}

	/**
	 * Get the current browser mode.
	 */
	getMode(): BrowserMode {
		return this.mode
	}

	/**
	 * Get the current snapshot version.
	 */
	getSnapshotVersion(): number {
		return this.snapshotVersion
	}

	/**
	 * Increment and return the snapshot version.
	 */
	incrementSnapshotVersion(): number {
		return ++this.snapshotVersion
	}

	/**
	 * Set the browser mode.
	 */
	async setMode(target: BrowserMode): Promise<void> {
		if (target === this.mode) return

		const previousMode = this.mode
		log.info`Mode changing ${{ from: previousMode, to: target }}`

		if (target === 'paired') {
			await this.close()
			this.mode = target
			this.ready = false
			return
		}

		this.mode = target
		this.ready = false
		await this.ensureReady()
	}

	/**
	 * Close the browser.
	 */
	async close(): Promise<void> {
		log.info`Browser closing`
		try {
			await this.sendRaw({ action: 'close' })
		} catch {
			// Ignore shutdown errors
		}
		this.ready = false
		log.debug`Browser closed`
	}

	/**
	 * Get the current browser session state.
	 */
	async getSessionState(): Promise<{
		mode: BrowserMode
		tabCount: number
		activeTab: number | null
		snapshotVersion: number
	}> {
		const tabs = await this.listTabs()
		const active = tabs.find((tab) => tab.active)?.index ?? null
		return {
			mode: this.mode,
			tabCount: tabs.length,
			activeTab: active,
			snapshotVersion: this.snapshotVersion,
		}
	}

	/**
	 * Get tab information.
	 */
	async getTabs(): Promise<TabInfo[]> {
		const tabs = await this.listTabs()
		const defaultViewport: Viewport = { width: 1280, height: 720 }

		return tabs.map((tab) => {
			const state = this.tabState.get(tab.index)
			return {
				ref: tab.index,
				url: tab.url,
				urlHash: hashUrl(tab.url),
				title: tab.title,
				viewport: state?.viewport ?? defaultViewport,
				colorScheme: state?.colorScheme ?? 'no-preference',
			}
		})
	}

	/**
	 * Update tab viewport state.
	 */
	updateTabViewport(index: number, viewport: Viewport): void {
		const state = this.tabState.get(index)
		this.tabState.set(index, {
			viewport: { ...viewport },
			colorScheme: state?.colorScheme ?? 'no-preference',
		})
	}

	/**
	 * Update tab color scheme state.
	 */
	updateTabColorScheme(index: number, scheme: ColorScheme): void {
		const state = this.tabState.get(index)
		const defaultViewport: Viewport = { width: 1280, height: 720 }
		this.tabState.set(index, {
			viewport: state?.viewport ?? defaultViewport,
			colorScheme: scheme,
		})
	}

	/**
	 * Send a command to agent-browser.
	 */
	async send<T = unknown>(
		command: Record<string, unknown>,
	): Promise<AgentBrowserResponse<T>> {
		if (this.mode === 'paired') {
			return {
				success: false,
				error: 'agent-browser is disabled in paired mode',
			}
		}
		await this.ensureReady()
		return this.sendRaw<T>(command)
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private async ensureReady(): Promise<void> {
		if (this.mode === 'paired') return

		await this.ensureDaemon()

		if (!this.ready) {
			log.debug`Launching browser ${{ mode: this.mode }}`
			await this.sendRaw({
				action: 'launch',
				headless: this.mode === 'headless',
				viewport: { width: 1280, height: 720 },
			})
			this.ready = true
			log.info`Browser launched ${{ mode: this.mode }}`
		}
	}

	private async ensureDaemon(): Promise<void> {
		if (await this.canConnect()) return

		log.debug`Starting agent-browser daemon ${{ session: this.session }}`

		const args = ['--json', '--session', this.session]
		if (this.mode === 'windowed') {
			args.push('--headed')
		}
		args.push('get', 'url')

		await runAgentBrowserCli(args, { AGENT_BROWSER_SESSION: this.session })

		for (let attempt = 0; attempt < SOCKET_READY_RETRIES; attempt++) {
			if (await this.canConnect()) {
				log.debug`Daemon connected ${{ session: this.session, attempt }}`
				return
			}
			await delay(SOCKET_READY_DELAY_MS)
		}

		log.error`Daemon failed to start ${{ session: this.session }}`
		throw new Error('agent-browser daemon failed to start')
	}

	private canConnect(): Promise<boolean> {
		const socketPath = getSocketPath(this.session)

		// On Unix, check if socket file exists before attempting connection
		// This avoids Bun throwing unhandled errors for non-existent sockets
		if (os.platform() !== 'win32' && !existsSync(socketPath)) {
			return Promise.resolve(false)
		}

		return new Promise((resolve) => {
			const socket = this.createSocket(socketPath)
			const timeout = setTimeout(() => {
				socket.destroy()
				resolve(false)
			}, CONNECT_TIMEOUT_MS)

			socket.once('connect', () => {
				clearTimeout(timeout)
				socket.end()
				resolve(true)
			})
			socket.once('error', () => {
				clearTimeout(timeout)
				resolve(false)
			})
		})
	}

	private sendRaw<T = unknown>(
		command: Record<string, unknown>,
	): Promise<AgentBrowserResponse<T>> {
		const socketPath = getSocketPath(this.session)
		const payload = `${JSON.stringify({ id: randomUUID(), ...command })}\n`

		return new Promise((resolve, reject) => {
			const socket = this.createSocket(socketPath)
			let buffer = ''

			const timeout = setTimeout(() => {
				socket.destroy()
				reject(new Error('agent-browser command timeout'))
			}, COMMAND_TIMEOUT_MS)

			socket.on('data', (data) => {
				buffer += data.toString()
				const newlineIndex = buffer.indexOf('\n')
				if (newlineIndex === -1) return

				const line = buffer.slice(0, newlineIndex)
				clearTimeout(timeout)
				socket.end()

				try {
					const parsed = JSON.parse(line) as AgentBrowserResponse<T>
					resolve(parsed)
				} catch (error) {
					reject(error)
				}
			})

			socket.on('error', (error) => {
				clearTimeout(timeout)
				reject(error)
			})

			socket.write(payload)
		})
	}

	private createSocket(socketPath: string): net.Socket {
		if (os.platform() === 'win32') {
			const port = getPortForSession(this.session)
			return net.createConnection({ host: '127.0.0.1', port })
		}
		return net.createConnection({ path: socketPath })
	}

	private async listTabs(): Promise<
		Array<{ index: number; url: string; title: string; active: boolean }>
	> {
		if (this.mode === 'paired') return []
		const response = await this.send<TabListData>({ action: 'tab_list' })
		if (!(response.success && response.data)) return []
		return response.data.tabs
	}
}
