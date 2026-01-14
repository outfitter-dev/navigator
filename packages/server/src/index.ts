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
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ActionExecutor } from './actions/executor'
import { BrowserManager } from './browser/manager'
import { PairedManager } from './paired/manager'
import { SessionManager } from './session/manager'

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
}

let state: AppState | null = null
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
		const result = await appState.actionExecutor.execute(action)
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
		if (url.pathname === '/ws') {
			const appState = initializeState()
			if (serverInstance.upgrade(request, { data: { state: appState } })) {
				return
			}
			return new Response('Upgrade failed', { status: 400 })
		}
		return app.fetch(request)
	},
	websocket: {
		open: (ws) => {
			ws.data.state.pairedManager.handleOpen(ws)
		},
		message: (ws, message) => {
			ws.data.state.pairedManager.handleMessage(ws, message)
		},
		close: (ws) => {
			ws.data.state.pairedManager.handleClose(ws)
		},
	},
})

console.log(`Navigator server starting on http://${host}:${port}`)

export default server

// Cleanup on shutdown
process.on('SIGINT', async () => {
	console.log('\nShutting down Navigator server...')
	if (state) {
		await state.browserManager.close()
	}
	process.exit(0)
})

process.on('SIGTERM', async () => {
	console.log('\nShutting down Navigator server...')
	if (state) {
		await state.browserManager.close()
	}
	process.exit(0)
})
