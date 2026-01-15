/**
 * Mock implementations of BrowserManager, PairedManager, and SessionManager
 * for testing ActionExecutor without real browser dependencies.
 */

import type {
	Action,
	ActionResult,
	BrowserMode,
	ColorScheme,
	NavigatorConfig,
	SessionMeta,
	TabInfo,
	Viewport,
} from '@outfitter/navigator-core'

// ============================================================================
// Types
// ============================================================================

interface AgentBrowserResponse<T = unknown> {
	success: boolean
	data?: T
	error?: string
}

interface RecordedCommand {
	command: Record<string, unknown>
	timestamp: number
}

type SendHandler<T = unknown> = (
	command: Record<string, unknown>,
) => AgentBrowserResponse<T> | Promise<AgentBrowserResponse<T>>

// ============================================================================
// Mock Browser Manager
// ============================================================================

export class MockBrowserManager {
	private mode: BrowserMode = 'headless'
	private snapshotVersion = 0
	private readonly recordedCommands: RecordedCommand[] = []
	private sendHandler: SendHandler = () => ({ success: true })
	private tabs: TabInfo[] = []

	/**
	 * Set the mock response handler for send() calls.
	 */
	onSend(handler: SendHandler): void {
		this.sendHandler = handler
	}

	/**
	 * Get all recorded commands sent to the browser.
	 */
	getRecordedCommands(): RecordedCommand[] {
		return [...this.recordedCommands]
	}

	/**
	 * Clear recorded commands.
	 */
	clearRecordedCommands(): void {
		this.recordedCommands.length = 0
	}

	/**
	 * Get the last command sent.
	 */
	getLastCommand(): Record<string, unknown> | undefined {
		return this.recordedCommands.at(-1)?.command
	}

	/**
	 * Set mock tabs for getTabs().
	 */
	setTabs(tabs: TabInfo[]): void {
		this.tabs = tabs
	}

	// BrowserManager interface implementation

	getMode(): BrowserMode {
		return this.mode
	}

	async setMode(target: BrowserMode): Promise<void> {
		this.mode = target
	}

	getSnapshotVersion(): number {
		return this.snapshotVersion
	}

	incrementSnapshotVersion(): number {
		return ++this.snapshotVersion
	}

	async send<T = unknown>(
		command: Record<string, unknown>,
	): Promise<AgentBrowserResponse<T>> {
		this.recordedCommands.push({
			command: { ...command },
			timestamp: Date.now(),
		})
		const result = await this.sendHandler(command)
		return result as AgentBrowserResponse<T>
	}

	async getTabs(): Promise<TabInfo[]> {
		return this.tabs
	}

	async getSessionState(): Promise<{
		mode: BrowserMode
		tabCount: number
		activeTab: number | null
		snapshotVersion: number
	}> {
		return {
			mode: this.mode,
			tabCount: this.tabs.length,
			activeTab: this.tabs.findIndex((t) => t.ref === 0) >= 0 ? 0 : null,
			snapshotVersion: this.snapshotVersion,
		}
	}

	async close(): Promise<void> {
		// No-op for mock
	}

	updateTabViewport(_index: number, _viewport: Viewport): void {
		// No-op for mock
	}

	updateTabColorScheme(_index: number, _scheme: ColorScheme): void {
		// No-op for mock
	}
}

// ============================================================================
// Mock Paired Manager
// ============================================================================

export class MockPairedManager {
	private connected = false
	private tabs: TabInfo[] = []
	private executeHandler: (action: Action) => ActionResult = () => ({
		success: true,
	})

	/**
	 * Set connected state.
	 */
	setConnected(connected: boolean): void {
		this.connected = connected
	}

	/**
	 * Set mock execute handler.
	 */
	onExecute(handler: (action: Action) => ActionResult): void {
		this.executeHandler = handler
	}

	// PairedManager interface implementation

	isConnected(): boolean {
		return this.connected
	}

	getTabs(): TabInfo[] {
		return this.tabs
	}

	getSessionState(): {
		connected: boolean
		tabCount: number
		activeTab: number | null
		viewport: Viewport | null
	} {
		return {
			connected: this.connected,
			tabCount: this.tabs.length,
			activeTab: null,
			viewport: null,
		}
	}

	async execute(action: Action): Promise<ActionResult> {
		return this.executeHandler(action)
	}

	handleOpen(): void {
		// No-op for mock
	}

	handleMessage(): void {
		// No-op for mock
	}

	handleClose(): void {
		// No-op for mock
	}
}

// ============================================================================
// Mock Session Manager
// ============================================================================

export class MockSessionManager {
	private currentSession: SessionMeta | null = null
	private readonly projectRoot: string

	constructor(projectRoot = '/tmp/navigator-test') {
		this.projectRoot = projectRoot
	}

	/**
	 * Set the current session.
	 */
	setCurrentSession(session: SessionMeta | null): void {
		this.currentSession = session
	}

	// SessionManager interface implementation

	getProjectRoot(): string {
		return this.projectRoot
	}

	getProjectHash(): string {
		return 'test-hash'
	}

	getCurrentSession(): SessionMeta | null {
		return this.currentSession
	}

	async getOrCreateSession(_sessionId?: string): Promise<SessionMeta> {
		if (!this.currentSession) {
			this.currentSession = {
				id: 'test-session-id',
				projectHash: 'test-hash',
				projectPath: this.projectRoot,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}
		}
		return this.currentSession
	}

	async touchSession(): Promise<void> {
		if (this.currentSession) {
			this.currentSession.updatedAt = new Date().toISOString()
		}
	}

	async loadSession(sessionId: string): Promise<SessionMeta> {
		if (this.currentSession?.id === sessionId) {
			return this.currentSession
		}
		throw new Error(`Session not found: ${sessionId}`)
	}

	async listSessions(): Promise<unknown[]> {
		return this.currentSession ? [this.currentSession] : []
	}

	getSessionPaths(): null {
		return null
	}
}

// ============================================================================
// Test Config
// ============================================================================

export function createTestConfig(): NavigatorConfig {
	return {
		browser: {
			headless: true,
			width: 1280,
			height: 720,
			userAgent: 'test-agent',
			timeout: 5000,
		},
		server: {
			host: '127.0.0.1',
			port: 9334,
		},
		extensions: {
			allowedExtensions: [],
			blockedExtensions: [],
		},
	}
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock send handler that responds based on action type.
 */
export function createActionHandler(
	handlers: Record<string, SendHandler>,
): SendHandler {
	return (command) => {
		const action = command.action as string
		const handler = handlers[action]
		if (handler) {
			return handler(command)
		}
		return { success: true }
	}
}

/**
 * Create a default handler that succeeds for common actions.
 */
export function createDefaultHandler(): SendHandler {
	return (command) => {
		const action = command.action as string

		switch (action) {
			case 'press':
			case 'fill':
			case 'check':
			case 'uncheck':
			case 'upload':
			case 'dialog':
			case 'click':
			case 'type':
			case 'navigate':
				return { success: true }

			case 'url':
				return { success: true, data: { url: 'https://example.com' } }

			case 'title':
				return { success: true, data: { title: 'Test Page' } }

			case 'tab_list':
				return {
					success: true,
					data: {
						tabs: [
							{
								index: 0,
								url: 'https://example.com',
								title: 'Test',
								active: true,
							},
						],
						active: 0,
					},
				}

			case 'tab_switch':
				return { success: true }

			case 'evaluate':
				return { success: true, data: { result: [] } }

			default:
				return { success: true }
		}
	}
}
