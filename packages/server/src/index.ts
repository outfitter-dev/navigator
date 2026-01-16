/**
 * Navigator Server
 *
 * Core orchestrator for browser control.
 * Provides HTTP/WebSocket API consumed by @outfitter/navigator-mcp.
 *
 * @module navigator-server
 */

import {
	type Action,
	type ActionResult,
	ActionSchema,
	loadConfig,
} from '@outfitter/navigator-core'
import {
	CATEGORIES,
	configureLogging,
	getLogger,
} from '@outfitter/navigator-core/logging'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ActionExecutor } from './actions/executor'
import { BrowserManager } from './browser/manager'
import { PairedManager } from './paired/manager'
import { SessionManager } from './session/manager'
import { watchBroadcaster } from './watch'

// ============================================================================
// Application State
// ============================================================================

interface AppState {
	browserManager: BrowserManager
	pairedManager: PairedManager
	sessionManager: SessionManager
	actionExecutor: ActionExecutor
}

interface WebSocketData {
	state: AppState
	type: 'paired' | 'watch'
}

let state: AppState | null = null

// Initialize logging before other configuration
await configureLogging({
	environment:
		process.env.NODE_ENV === 'production' ? 'production' : 'development',
})
const log = getLogger(CATEGORIES.SERVER)

const config = await loadConfig()

function initializeState(): AppState {
	if (state) {
		return state
	}

	const sessionManager = new SessionManager()
	const projectHash = sessionManager.getProjectHash()
	const session =
		process.env.NAVIGATOR_AGENT_BROWSER_SESSION ?? `navigator-${projectHash}`

	const browserManager = new BrowserManager(config, session)
	const pairedManager = new PairedManager()
	const actionExecutor = new ActionExecutor(
		browserManager,
		pairedManager,
		sessionManager,
		config,
	)

	state = { browserManager, pairedManager, sessionManager, actionExecutor }
	return state
}

// ============================================================================
// HTTP Server
// ============================================================================

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Health check
app.get('/health', (c) => {
	return c.json({
		status: 'ok',
		version: '0.1.0',
		mode: state?.browserManager.getMode() ?? 'not_initialized',
	})
})

// Execute action
app.post('/action', async (c) => {
	const appState = initializeState()

	try {
		const body = await c.req.json()
		const action = ActionSchema.parse(body) as Action

		// Read project path from header (sent by CLI)
		const projectPath = c.req.header('X-Project-Path')

		const result = await appState.actionExecutor.execute(action, projectPath)
		return c.json(result)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const result: ActionResult = { success: false, error: message }
		return c.json(result, 400)
	}
})

// Get current session state
app.get('/session', async (c) => {
	const appState = initializeState()
	const session = appState.sessionManager.getCurrentSession()
	const browserState = await appState.browserManager.getSessionState()
	const pairedState = appState.pairedManager.getSessionState()

	return c.json({
		session,
		browser: browserState,
		paired: pairedState,
	})
})

// List tabs
app.get('/tabs', async (c) => {
	const appState = initializeState()
	const tabs =
		appState.browserManager.getMode() === 'paired'
			? appState.pairedManager.getTabs()
			: await appState.browserManager.getTabs()
	return c.json(tabs)
})

// ============================================================================
// Server Startup
// ============================================================================

const port = config.server.port
const host = config.server.host

// Start HTTP + WebSocket server (WS used for paired extension mode).
const server = Bun.serve<WebSocketData>({
	port,
	hostname: host,
	fetch: (request, serverInstance) => {
		const url = new URL(request.url)

		// WebSocket upgrade for paired extension
		if (url.pathname === '/ws') {
			const appState = initializeState()
			if (
				serverInstance.upgrade(request, {
					data: { state: appState, type: 'paired' as const },
				})
			) {
				return
			}
			return new Response('Upgrade failed', { status: 400 })
		}

		// WebSocket upgrade for watch clients
		if (url.pathname === '/ws/watch') {
			const appState = initializeState()
			if (
				serverInstance.upgrade(request, {
					data: { state: appState, type: 'watch' as const },
				})
			) {
				return
			}
			return new Response('Upgrade failed', { status: 400 })
		}

		return app.fetch(request)
	},
	websocket: {
		open: (ws) => {
			if (ws.data.type === 'watch') {
				watchBroadcaster.addClient(ws)
			} else {
				ws.data.state.pairedManager.handleOpen(ws)
			}
		},
		message: (ws, message) => {
			if (ws.data.type === 'paired') {
				ws.data.state.pairedManager.handleMessage(ws, message)
			}
			// Watch clients don't send messages, they only receive
		},
		close: (ws) => {
			if (ws.data.type === 'watch') {
				watchBroadcaster.removeClient(ws)
			} else {
				ws.data.state.pairedManager.handleClose(ws)
			}
		},
	},
})

log.info`Server starting on ${{ host, port }}`

export default server

// Cleanup on shutdown
process.on('SIGINT', async () => {
	log.info`Server shutting down ${{ signal: 'SIGINT' }}`
	if (state) {
		await state.browserManager.close()
	}
	process.exit(0)
})

process.on('SIGTERM', async () => {
	log.info`Server shutting down ${{ signal: 'SIGTERM' }}`
	if (state) {
		await state.browserManager.close()
	}
	process.exit(0)
})
