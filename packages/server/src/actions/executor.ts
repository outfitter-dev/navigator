/**
 * Action Executor
 *
 * Routes Navigator actions to agent-browser (headless/windowed)
 * or forwards to the extension in paired mode.
 *
 * @module actions/executor
 */

import type {
	Action,
	ActionResult,
	BoundingBox,
	ColorScheme,
	ElementIdentity,
	ElementMetadata,
	FindAction,
	Geometry,
	LocatorStrategy,
	MarkerViewport,
	NavigatorConfig,
	TabRef,
	Viewport,
} from '@outfitter/navigator-core'
import {
	ErrorCode,
	parseKeyCombo,
	resolveViewFlag,
} from '@outfitter/navigator-core'
import { CATEGORIES, getLogger } from '@outfitter/navigator-core/logging'
import type { BrowserManager } from '../browser/manager'
import { MarkerStore, markersToMarkdown } from '../markers'
import type { PairedManager } from '../paired/manager'
import { SequenceExecutor } from '../sequences'
import type { SessionManager } from '../session/manager'
import { StepLogger } from '../session/step-logger'
import { type WatchEvent, watchBroadcaster } from '../watch'

// ============================================================================
// Types
// ============================================================================

interface AgentBrowserResponse<T = unknown> {
	success: boolean
	data?: T
	error?: string
}

type WaitState = 'visible' | 'hidden' | 'attached' | 'detached'

// ============================================================================
// Constants
// ============================================================================

const NUMERIC_STRING_PATTERN = /^\d+$/

// ============================================================================
// Error Helper
// ============================================================================

/**
 * Create a structured error result with code, retryable flag, and suggested fix.
 */
function createError(
	message: string,
	code: ErrorCode,
	retryable: boolean,
	suggestedFix?: string,
): ActionResult {
	return {
		success: false,
		error: message,
		errorCode: code,
		retryable,
		suggestedFix,
	}
}

// ============================================================================
// Action Executor
// ============================================================================

const log = getLogger(CATEGORIES.ACTIONS)

/**
 * Executes Navigator actions.
 */
export class ActionExecutor {
	private markerStore: MarkerStore | null = null
	private stepLogger: StepLogger | null = null
	private currentProjectRoot: string | null = null
	private hasSnapshot = false
	private lastInteractiveCount = 0
	private sequenceExecutor: SequenceExecutor

	constructor(
		private readonly browserManager: BrowserManager,
		private readonly pairedManager: PairedManager,
		private readonly sessionManager: SessionManager,
		_config: NavigatorConfig,
	) {
		// Initialize sequence executor with bound execute method
		this.sequenceExecutor = new SequenceExecutor((action, projectRoot) =>
			this.execute(action, projectRoot),
		)
	}

	// ============================================================================
	// Locator Extraction
	// ============================================================================

	/**
	 * Extract a locator strategy from an element reference.
	 *
	 * Queries the element for stable identifiers in priority order:
	 * 1. data-testid (most stable)
	 * 2. ARIA role with accessible name
	 * 3. Associated label
	 * 4. CSS selector fallback
	 */
	private async extractLocator(
		ref: string | undefined,
		selector: string | undefined,
		tab?: TabRef,
	): Promise<LocatorStrategy | undefined> {
		// Don't extract in paired mode (no agent-browser)
		if (this.isPairedActive()) return undefined

		// Build target selector
		const target = this.resolveSelector(ref, selector)
		if (!target) return undefined

		const script = `
			(selector) => {
				// Find element - agent-browser uses @e{index} format for refs
				let el
				if (selector.startsWith('@e')) {
					const refIndex = selector.slice(2)
					el = document.querySelector('[data-ref="' + refIndex + '"]')
				} else {
					el = document.querySelector(selector)
				}
				if (!el) return null

				// Priority 1: data-testid
				const testid = el.getAttribute('data-testid')
				if (testid) {
					return { strategy: 'testid', testid }
				}

				// Priority 2: ARIA role with accessible name
				const role = el.getAttribute('role') || el.tagName.toLowerCase()
				const ariaLabel = el.getAttribute('aria-label')
				const ariaLabelledBy = el.getAttribute('aria-labelledby')
				let accessibleName = ariaLabel

				if (!accessibleName && ariaLabelledBy) {
					const labelEl = document.getElementById(ariaLabelledBy)
					if (labelEl) {
						accessibleName = labelEl.textContent?.trim()
					}
				}

				// For certain elements, use inner text as name
				if (!accessibleName) {
					const tagName = el.tagName.toLowerCase()
					if (['button', 'a', 'label'].includes(tagName)) {
						accessibleName = el.textContent?.trim().slice(0, 100)
					}
				}

				// If we have a meaningful role and name, use role strategy
				const meaningfulRoles = ['button', 'link', 'textbox', 'checkbox',
					'radio', 'combobox', 'listbox', 'menu', 'menuitem', 'tab',
					'tabpanel', 'dialog', 'alert', 'heading', 'img', 'navigation']
				const implicitRoles = {
					button: 'button',
					a: 'link',
					input: el.type === 'checkbox' ? 'checkbox' :
								 el.type === 'radio' ? 'radio' :
								 el.type === 'text' || el.type === 'email' ||
								 el.type === 'password' || el.type === 'search' ? 'textbox' : null,
					select: 'combobox',
					textarea: 'textbox',
					h1: 'heading', h2: 'heading', h3: 'heading',
					h4: 'heading', h5: 'heading', h6: 'heading',
					img: 'img',
					nav: 'navigation',
				}
				const effectiveRole = el.getAttribute('role') ||
					implicitRoles[el.tagName.toLowerCase()] || null

				if (effectiveRole && meaningfulRoles.includes(effectiveRole)) {
					if (accessibleName) {
						return { strategy: 'role', role: effectiveRole, name: accessibleName }
					}
				}

				// Priority 3: Associated label (for form elements)
				// Check this before falling back to role-only, as labels provide more specific targeting
				const id = el.id
				if (id) {
					const label = document.querySelector('label[for="' + id + '"]')
					if (label) {
						const labelText = label.textContent?.trim()
						if (labelText) {
							return { strategy: 'label', label: labelText }
						}
					}
				}

				// Priority 3b: Role without name (after checking for label)
				// Less specific than label but still useful for targeting
				if (effectiveRole && meaningfulRoles.includes(effectiveRole)) {
					return { strategy: 'role', role: effectiveRole }
				}

				// Priority 4: Selector fallback
				// Build a reasonably unique selector
				const tagName = el.tagName.toLowerCase()
				if (id) {
					return { strategy: 'selector', selector: '#' + id }
				}
				const className = el.className?.split(' ')
					.filter(c => c && !c.startsWith('_') && !c.match(/^[a-z]{6,}$/))
					.slice(0, 2).join('.')
				if (className) {
					return { strategy: 'selector', selector: tagName + '.' + className }
				}

				return { strategy: 'selector', selector: tagName }
			}
		`

		try {
			const response = await this.withTab(tab, async () =>
				this.browserManager.send<{ result: LocatorStrategy | null }>({
					action: 'evaluate',
					script,
					args: [target],
				}),
			)

			if (response.success && response.data?.result) {
				return response.data.result
			}
		} catch {
			// Ignore extraction errors - locator is optional
		}

		return undefined
	}

	/**
	 * Execute a Navigator action.
	 *
	 * @param action - The action to execute
	 * @param projectRoot - Optional project root override from request header
	 */
	async execute(action: Action, projectRoot?: string): Promise<ActionResult> {
		// Use provided project root or fall back to session manager's default
		const effectiveProjectRoot =
			projectRoot ?? this.sessionManager.getProjectRoot()

		// Ensure session exists
		const session = await this.sessionManager.getOrCreateSession()

		// Reinitialize stores if project root changed or not yet initialized
		if (
			!this.markerStore ||
			!this.stepLogger ||
			this.currentProjectRoot !== effectiveProjectRoot
		) {
			this.currentProjectRoot = effectiveProjectRoot
			this.markerStore = new MarkerStore(effectiveProjectRoot, session.id)
			this.stepLogger = new StepLogger(effectiveProjectRoot, session.id)
			// Reset snapshot state when project root changes
			this.hasSnapshot = false
			this.lastInteractiveCount = 0
		}

		const start = Date.now()
		const target = this.extractActionTarget(action)

		log.debug`Action received ${{ action: action.action, target }}`

		// Notify extension of agent action start (for visual indicator)
		if (this.isPairedActive()) {
			this.pairedManager.broadcastActionStart()
		}

		// Broadcast action start
		this.broadcastEvent({
			ts: new Date().toISOString(),
			type: 'action',
			source: 'agent',
			action: action.action,
			target,
			status: 'start',
		})

		// Extract locator BEFORE running action (element may be gone after click/navigate)
		let locator: LocatorStrategy | undefined
		const refInfo = this.extractRefFromAction(action)
		if (refInfo) {
			locator = await this.extractLocator(
				refInfo.ref,
				refInfo.selector,
				refInfo.tab,
			)
		}

		let result: ActionResult

		try {
			result = await this.run(action)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			log.error`Action failed ${{ action: action.action, error: errorMessage }}`
			result = {
				success: false,
				error: errorMessage,
			}
		}

		const duration = Date.now() - start

		// Notify extension of agent action end (to hide visual indicator)
		if (this.isPairedActive()) {
			this.pairedManager.broadcastActionEnd()
		}

		if (result.success) {
			log.debug`Action completed ${{ action: action.action, duration }}`
		}

		// Broadcast action result
		this.broadcastEvent({
			ts: new Date().toISOString(),
			type: 'action',
			source: 'agent',
			action: action.action,
			target,
			status: result.success ? 'success' : 'error',
			duration,
			error: result.error,
			meta: this.extractResultMeta(action, result),
		})

		// Log step with source='agent' for all API/MCP actions
		try {
			await this.stepLogger.logStep(
				action,
				{ success: result.success, error: result.error, data: result.data },
				duration,
				'agent',
				locator,
			)
			await this.sessionManager.touchSession()
		} catch {
			// Ignore logging errors
		}

		return result
	}

	/**
	 * Route and execute the action.
	 */
	private async run(action: Action): Promise<ActionResult> {
		// Forward to paired mode if active
		if (this.isPairedActive() && this.shouldForwardToPaired(action)) {
			log.debug`Routing to paired mode ${{ action: action.action }}`
			return this.pairedManager.execute(action)
		}
		log.debug`Routing to headless mode ${{ action: action.action }}`

		switch (action.action) {
			// Navigation
			case 'navigate':
				return this.navigate(action.url, action.tab, action.waitUntil)
			case 'back':
				return this.goBack(action.tab)
			case 'forward':
				return this.goForward(action.tab)
			case 'reload':
				return this.reload(action.tab)

			// Tabs
			case 'tab':
				return this.focusTab(action.ref)
			case 'tabs':
				return this.listTabs()
			case 'newTab':
				return this.newTab(action.url)
			case 'closeTab':
				return this.closeTab(action.ref)

			// Interaction
			case 'click':
				return this.click(
					action.ref,
					action.selector,
					action.tab,
					action.button,
					action.clickCount,
				)
			case 'type':
				return this.type(
					action.ref,
					action.selector,
					action.text,
					action.tab,
					action.clear,
					action.delay,
				)
			case 'select':
				return this.select(
					action.ref,
					action.selector,
					action.value,
					action.tab,
				)
			case 'hover':
				return this.hover(action.ref, action.selector, action.tab)
			case 'focus':
				return this.focus(action.ref, action.selector, action.tab)
			case 'scroll':
				return this.scroll(
					action.ref,
					action.selector,
					action.x,
					action.y,
					action.tab,
				)
			case 'press':
				return this.press(action.key, action.tab)
			case 'fill':
				return this.fill(action.ref, action.selector, action.value, action.tab)
			case 'find':
				return this.find(action)
			case 'check':
				return this.check(action.ref, action.selector, action.tab)
			case 'uncheck':
				return this.uncheck(action.ref, action.selector, action.tab)
			case 'upload':
				return this.upload(
					action.ref,
					action.selector,
					action.files,
					action.tab,
				)
			case 'download':
				return this.download(
					action.ref,
					action.selector,
					action.path,
					action.wait,
					action.timeout,
					action.tab,
				)
			case 'dialog':
				return this.dialog(action.handler, action.text, action.tab)

			// Wait
			case 'waitFor':
				return this.waitFor(
					action.ref,
					action.selector,
					action.state,
					action.timeout,
					action.tab,
				)
			case 'waitForNavigation':
				return this.waitForNavigation(action.tab, action.timeout)
			case 'wait':
				return this.wait(action.ms)

			// Capture
			case 'screenshot':
				if (action.view) {
					return this.screenshotMultiViewport(action)
				}
				return this.screenshot(
					action.tab,
					action.ref,
					action.selector,
					action.fullPage,
					action.quality,
				)
			case 'snap':
				if (action.view) {
					return this.snapMultiViewport(action)
				}
				return this.snap(action.tab, action.mode, action)
			case 'html':
				return this.getHtml(action.tab, action.ref, action.selector)
			case 'text':
				return this.getText(action.tab, action.ref, action.selector)

			// Markers
			case 'marker':
				return this.createMarker(
					action.geometry,
					action.ref,
					action.tab,
					action.note,
					action.tags,
				)
			case 'markers': {
				// Build filters only with defined properties
				const filters: { tags?: string[]; url?: string; role?: string } = {}
				if (action.tags) filters.tags = action.tags
				if (action.url) filters.url = action.url
				if (action.role) filters.role = action.role
				return this.listMarkers(
					action.format,
					Object.keys(filters).length > 0 ? filters : undefined,
				)
			}
			case 'markerGet':
				return this.getMarker(action.id, action.includeScreenshot)
			case 'markerRead':
				return this.readMarkers(action.ids, action.includeScreenshot)
			case 'markerDelete':
				return this.deleteMarker(action.id)
			case 'markerCompare':
				return this.compareMarkers(action.id1, action.id2)
			case 'markerResolve':
				return this.resolveMarker(action.id, action.tab)

			// Display
			case 'viewport':
				return this.setViewport(
					action.tab,
					action.preset,
					action.width,
					action.height,
				)
			case 'colorScheme':
				return this.setColorScheme(action.tab, action.scheme)
			case 'mode':
				return this.setMode(action.target)

			// Evaluate
			case 'evaluate':
				return this.evaluate(action.script, action.args, action.tab)

			// Session
			case 'session':
				return this.getSession()
			case 'sessions':
				return this.listSessions(action.limit)
			case 'steps':
				return this.getSteps(action.sessionId, action.limit)

			// Sequence
			case 'sequence':
				return this.executeSequence(action.steps, action.params, {
					stopOnError: action.stopOnError,
					name: action.name,
				})

			default:
				return {
					success: false,
					error: `Unknown action: ${(action as Action).action}`,
				}
		}
	}

	// ============================================================================
	// Mode Helpers
	// ============================================================================

	private isPairedActive(): boolean {
		return this.browserManager.getMode() === 'paired'
	}

	private shouldForwardToPaired(action: Action): boolean {
		const forwardActions = new Set([
			'navigate',
			'back',
			'forward',
			'reload',
			'tab',
			'newTab',
			'closeTab',
			'click',
			'type',
			'select',
			'hover',
			'focus',
			'scroll',
			'press',
			'fill',
			'find',
			'check',
			'uncheck',
			'upload',
			'download',
			'dialog',
			'waitFor',
			'waitForNavigation',
			'wait',
			'html',
			'text',
			'screenshot',
			'evaluate',
			'viewport',
			'colorScheme',
		])
		return forwardActions.has(action.action)
	}

	// ============================================================================
	// Navigation Actions
	// ============================================================================

	private async navigate(
		url: string,
		tab?: TabRef,
		waitUntil?: 'load' | 'domcontentloaded' | 'networkidle',
	): Promise<ActionResult> {
		const response = await this.sendCommand(
			{ action: 'navigate', url, waitUntil },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Navigation failed' }
		}
		return { success: true }
	}

	private async goBack(tab?: TabRef): Promise<ActionResult> {
		const response = await this.sendCommand({ action: 'back' }, tab)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Back failed' }
		}
		return { success: true }
	}

	private async goForward(tab?: TabRef): Promise<ActionResult> {
		const response = await this.sendCommand({ action: 'forward' }, tab)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Forward failed' }
		}
		return { success: true }
	}

	private async reload(tab?: TabRef): Promise<ActionResult> {
		const response = await this.sendCommand({ action: 'reload' }, tab)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Reload failed' }
		}
		return { success: true }
	}

	// ============================================================================
	// Tab Actions
	// ============================================================================

	private async focusTab(ref: TabRef): Promise<ActionResult> {
		const index = await this.resolveTabIndex(ref)
		if (index === null) {
			return createError(
				`Tab ${String(ref)} not found`,
				ErrorCode.TAB_NOT_FOUND,
				false,
				'List available tabs with { action: "tabs" }',
			)
		}
		const response = await this.browserManager.send({
			action: 'tab_switch',
			index,
		})
		if (!response.success) {
			return { success: false, error: response.error ?? 'Tab switch failed' }
		}
		return { success: true }
	}

	private async listTabs(): Promise<ActionResult> {
		const tabs = this.isPairedActive()
			? this.pairedManager.getTabs()
			: await this.browserManager.getTabs()
		return { success: true, extractedContent: JSON.stringify(tabs, null, 2) }
	}

	private async newTab(url?: string): Promise<ActionResult> {
		const response = await this.browserManager.send<{ index: number }>({
			action: 'tab_new',
		})
		if (!(response.success && response.data)) {
			return { success: false, error: response.error ?? 'Failed to create tab' }
		}

		if (url) {
			await this.browserManager.send({ action: 'navigate', url })
		}

		return {
			success: true,
			extractedContent: `Created tab ${response.data.index}${url ? ` at ${url}` : ''}`,
		}
	}

	private async closeTab(ref: TabRef): Promise<ActionResult> {
		const index = await this.resolveTabIndex(ref)
		if (index === null) {
			return createError(
				`Tab ${String(ref)} not found`,
				ErrorCode.TAB_NOT_FOUND,
				false,
				'List available tabs with { action: "tabs" }',
			)
		}
		const response = await this.browserManager.send({
			action: 'tab_close',
			index,
		})
		if (!response.success) {
			return { success: false, error: response.error ?? 'Tab close failed' }
		}
		return { success: true }
	}

	// ============================================================================
	// Interaction Actions
	// ============================================================================

	private async click(
		ref?: string,
		selector?: string,
		tab?: TabRef,
		button: 'left' | 'right' | 'middle' = 'left',
		clickCount = 1,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'click requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'click', selector: target, button, clickCount },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Click failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async type(
		ref: string | undefined,
		selector: string | undefined,
		text: string,
		tab?: TabRef,
		clear = false,
		delay = 0,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'type requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'type', selector: target, text, clear, delay },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Type failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async select(
		ref: string | undefined,
		selector: string | undefined,
		value: string,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'select requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'select', selector: target, values: value },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Select failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async hover(
		ref?: string,
		selector?: string,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'hover requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'hover', selector: target },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Hover failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async focus(
		ref?: string,
		selector?: string,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'focus requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'focus', selector: target },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Focus failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async scroll(
		_ref: string | undefined,
		selector: string | undefined,
		x = 0,
		y = 0,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = selector ?? undefined

		const response = await this.sendCommand(
			{ action: 'scroll', selector: target, x, y },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Scroll failed' }
		}
		return { success: true }
	}

	private async press(key: string, tab?: TabRef): Promise<ActionResult> {
		const { key: normalizedKey, modifiers } = parseKeyCombo(key)

		// Build Playwright key format: "Control+Shift+k"
		const playwrightKey =
			modifiers.length > 0
				? `${modifiers.join('+')}+${normalizedKey}`
				: normalizedKey

		const response = await this.sendCommand(
			{ action: 'press', key: playwrightKey },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Press failed' }
		}
		return { success: true }
	}

	private async fill(
		ref: string | undefined,
		selector: string | undefined,
		value: string,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'fill requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'fill', selector: target, value },
			tab,
		)
		if (!response.success) {
			const errorMsg = response.error ?? 'Fill failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async find(action: FindAction): Promise<ActionResult> {
		// Build script to find elements using Playwright locators
		// This runs in the browser context via evaluate
		const script = `
			async (args) => {
				const { text, exact, role, label, placeholder, testid, ref,
								inRef, inCss, inTag, tag, visible, enabled, checked } = args

				// Helper to get element info
				const getElementInfo = (el, index) => {
					const rect = el.getBoundingClientRect()
					const computedStyle = window.getComputedStyle(el)
					const isVisible = rect.width > 0 && rect.height > 0 &&
						computedStyle.visibility !== 'hidden' &&
						computedStyle.display !== 'none'

					const attrs = {}
					for (const attr of el.attributes) {
						attrs[attr.name] = attr.value
					}

					return {
						ref: 'e' + index,
						text: el.textContent?.trim().slice(0, 100) || '',
						role: el.getAttribute('role') || el.tagName.toLowerCase(),
						tag: el.tagName.toLowerCase(),
						box: {
							x: Math.round(rect.x),
							y: Math.round(rect.y),
							width: Math.round(rect.width),
							height: Math.round(rect.height)
						},
						visible: isVisible,
						enabled: !el.disabled,
						checked: el.checked ?? null,
						attributes: attrs
					}
				}

				// Determine search scope
				let scope = document.body
				if (inRef) {
					// Find element by ref - look for data-ref attribute
					const refNum = inRef.replace(/^@?e/, '')
					scope = document.querySelector('[data-ref="' + refNum + '"]') || scope
				} else if (inCss) {
					scope = document.querySelector(inCss) || scope
				} else if (inTag) {
					scope = document.querySelector(inTag) || scope
				}

				// Build selector/query
				let elements = []

				if (ref) {
					// Looking up a specific ref
					const refNum = ref.replace(/^@?e/, '')
					const el = document.querySelector('[data-ref="' + refNum + '"]')
					if (el) elements = [el]
				} else if (testid) {
					elements = Array.from(scope.querySelectorAll('[data-testid="' + testid + '"]'))
				} else if (role) {
					// Search by ARIA role
					elements = Array.from(scope.querySelectorAll('[role="' + role + '"]'))
					// Also include implicit roles
					const implicitRoles = {
						button: ['button', 'input[type="button"]', 'input[type="submit"]'],
						link: ['a[href]'],
						checkbox: ['input[type="checkbox"]'],
						textbox: ['input[type="text"]', 'input[type="email"]', 'input[type="password"]', 'textarea'],
						listitem: ['li'],
						list: ['ul', 'ol'],
						heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
					}
					if (implicitRoles[role]) {
						for (const selector of implicitRoles[role]) {
							elements = elements.concat(Array.from(scope.querySelectorAll(selector)))
						}
					}
				} else if (label) {
					// Find by label text
					const labels = Array.from(scope.querySelectorAll('label'))
					for (const lbl of labels) {
						if (lbl.textContent?.includes(label)) {
							if (lbl.htmlFor) {
								const el = document.getElementById(lbl.htmlFor)
								if (el) elements.push(el)
							}
							// Also check nested inputs
							const nested = lbl.querySelector('input, select, textarea')
							if (nested) elements.push(nested)
						}
					}
				} else if (placeholder) {
					elements = Array.from(scope.querySelectorAll('[placeholder*="' + placeholder + '"]'))
				} else if (text) {
					// Text search - walk the DOM
					const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT)
					while (walker.nextNode()) {
						const el = walker.currentNode
						const elText = el.textContent?.trim() || ''
						if (exact ? elText === text : elText.includes(text)) {
							elements.push(el)
						}
					}
				} else {
					// No specific criteria - return all interactive elements
					elements = Array.from(scope.querySelectorAll('a, button, input, select, textarea, [role]'))
				}

				// Apply filters
				if (tag) {
					elements = elements.filter(el => el.tagName.toLowerCase() === tag.toLowerCase())
				}
				if (visible !== undefined) {
					elements = elements.filter(el => {
						const rect = el.getBoundingClientRect()
						const style = window.getComputedStyle(el)
						const isVis = rect.width > 0 && rect.height > 0 &&
							style.visibility !== 'hidden' && style.display !== 'none'
						return visible ? isVis : !isVis
					})
				}
				if (enabled !== undefined) {
					elements = elements.filter(el => enabled ? !el.disabled : el.disabled)
				}
				if (checked !== undefined) {
					elements = elements.filter(el => el.checked === checked)
				}

				// Dedupe and map to info
				const seen = new Set()
				const results = []
				let index = 0
				for (const el of elements) {
					if (seen.has(el)) continue
					seen.add(el)
					results.push(getElementInfo(el, index++))
				}

				return results.slice(0, 50) // Limit results
			}
		`

		const response = await this.withTab(action.tab, async () =>
			this.browserManager.send<{ result: unknown }>({
				action: 'evaluate',
				script,
				args: [
					{
						text: action.text,
						exact: action.exact,
						role: action.role,
						label: action.label,
						placeholder: action.placeholder,
						testid: action.testid,
						ref: action.ref,
						inRef: action.inRef,
						inCss: action.inCss,
						inTag: action.inTag,
						tag: action.tag,
						visible: action.visible,
						enabled: action.enabled,
						checked: action.checked,
					},
				],
			}),
		)

		if (!response.success) {
			return { success: false, error: response.error ?? 'Find failed' }
		}

		const results = response.data?.result
		if (!Array.isArray(results)) {
			return { success: false, error: 'Find returned invalid results' }
		}

		if (results.length === 0) {
			return { success: true, data: [], extractedContent: 'No elements found' }
		}

		return {
			success: true,
			data: results,
			extractedContent: JSON.stringify(results, null, 2),
		}
	}

	private async check(
		ref: string | undefined,
		selector: string | undefined,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'check requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'check', selector: target },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Check failed' }
		}
		return { success: true }
	}

	private async uncheck(
		ref: string | undefined,
		selector: string | undefined,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'uncheck requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'uncheck', selector: target },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Uncheck failed' }
		}
		return { success: true }
	}

	private async upload(
		ref: string | undefined,
		selector: string | undefined,
		files: string[],
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'upload requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		const response = await this.sendCommand(
			{ action: 'upload', selector: target, files },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Upload failed' }
		}
		return { success: true }
	}

	private async download(
		ref: string | undefined,
		selector: string | undefined,
		path: string,
		_wait = true, // Kept for schema compatibility; agent-browser always waits
		_timeout?: number, // Kept for schema compatibility; handled by agent-browser
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'download requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		// Pre-validate element ref before sending to agent-browser
		if (ref) {
			const validation = this.validateElementRef(ref)
			if (!validation.valid) {
				return this.createElementRefError(ref)
			}
		}

		// Trigger the download by clicking the element
		const downloadResponse = await this.sendCommand(
			{ action: 'download', selector: target, path },
			tab,
		)
		if (!downloadResponse.success) {
			const errorMsg = downloadResponse.error ?? 'Download failed'
			const lowerError = errorMsg.toLowerCase()

			let errorCode: ErrorCode = ErrorCode.ELEMENT_NOT_FOUND
			let retryable = true
			let recovery = 'Take a fresh snap to get updated element references'

			if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
				errorCode = ErrorCode.ELEMENT_NOT_VISIBLE
				recovery =
					'Element exists but is hidden - wait for visibility or scroll into view'
			} else if (
				lowerError.includes('not interactable') ||
				lowerError.includes('pointer events')
			) {
				errorCode = ErrorCode.ELEMENT_NOT_INTERACTABLE
				recovery =
					'Element is covered or disabled - wait or click covering element first'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				recovery = 'Element was removed from DOM - take a new snap and retry'
			} else if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}

		// Note: agent-browser's handleDownload already waits for the download
		// event and saves the file before returning, so no additional wait needed.
		// The `wait` parameter is accepted for API compatibility but has no effect.

		return { success: true, extractedContent: `Downloaded to ${path}` }
	}

	private async dialog(
		handler: 'accept' | 'dismiss' | 'prompt' | 'clear',
		text?: string,
		tab?: TabRef,
	): Promise<ActionResult> {
		// Map handler to agent-browser dialog action format
		const response = await this.sendCommand(
			{ action: 'dialog', handler, text },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Dialog setup failed' }
		}
		return { success: true }
	}

	// ============================================================================
	// Wait Actions
	// ============================================================================

	private async waitFor(
		ref: string | undefined,
		selector: string | undefined,
		state: WaitState = 'visible',
		timeout = 5000,
		tab?: TabRef,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)
		if (!target) {
			return createError(
				'waitFor requires ref or selector',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide ref from snap (e.g., "e42") or CSS selector',
			)
		}

		const response = await this.sendCommand(
			{ action: 'wait', selector: target, state, timeout },
			tab,
		)
		if (!response.success) {
			const errorMsg =
				response.error ?? `Timeout waiting for element to be ${state}`
			const lowerError = errorMsg.toLowerCase()

			// Determine appropriate error code based on error message
			let errorCode: ErrorCode = ErrorCode.NAVIGATION_TIMEOUT
			let retryable = true
			let recovery = 'Increase timeout or verify element exists with snap'

			if (
				lowerError.includes('invalid selector') ||
				lowerError.includes('syntax error')
			) {
				errorCode = ErrorCode.SELECTOR_INVALID
				retryable = false
				recovery = 'Check selector syntax - use CSS or ref from snap'
			} else if (
				lowerError.includes('stale') ||
				lowerError.includes('detached')
			) {
				errorCode = ErrorCode.STALE_REF
				retryable = true
				recovery = 'Element was removed from DOM - take a new snap and retry'
			}

			return createError(errorMsg, errorCode, retryable, recovery)
		}
		return { success: true }
	}

	private async waitForNavigation(
		tab?: TabRef,
		timeout = 10_000,
	): Promise<ActionResult> {
		const response = await this.sendCommand(
			{ action: 'waitforloadstate', state: 'load', timeout },
			tab,
		)
		if (!response.success) {
			return createError(
				response.error ?? 'Timeout waiting for navigation',
				ErrorCode.NAVIGATION_TIMEOUT,
				true,
				'Increase timeout or verify page is loading',
			)
		}
		return { success: true }
	}

	private async wait(ms: number): Promise<ActionResult> {
		const response = await this.browserManager.send({
			action: 'wait',
			timeout: ms,
		})
		if (!response.success) {
			return { success: false, error: response.error ?? 'Wait failed' }
		}
		return { success: true }
	}

	// ============================================================================
	// Capture Actions
	// ============================================================================

	private async screenshot(
		tab?: TabRef,
		_ref?: string,
		selector?: string,
		fullPage = false,
		quality = 85,
	): Promise<ActionResult> {
		const target = selector ?? undefined

		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{ base64?: string }>({
				action: 'screenshot',
				selector: target,
				fullPage: target ? undefined : fullPage,
				format: 'png',
				quality,
			}),
		)

		if (!(response.success && response.data?.base64)) {
			return { success: false, error: response.error ?? 'Screenshot failed' }
		}

		return { success: true, screenshot: response.data.base64 }
	}

	private async snap(
		tab: TabRef | undefined,
		mode: 'full' | 'interactive' | 'input_fields' | 'text_only' | undefined,
		options: {
			interactive?: boolean | undefined
			compact?: boolean | undefined
			depth?: number | undefined
			selector?: string | undefined
			visibleOnly?: boolean | undefined
		},
	): Promise<ActionResult> {
		if (this.isPairedActive()) {
			return createError(
				'snap is not available in paired mode. Use marker/html/text instead.',
				ErrorCode.ACTION_NOT_SUPPORTED,
				false,
				'Use { action: "html" } or { action: "text" } in paired mode',
			)
		}

		return this.withTab(tab, async () => {
			const version = this.browserManager.getSnapshotVersion() + 1
			const { url, title } = await this.getPageInfo()

			if (mode === 'text_only') {
				return this.createTextSnapshot(version, url, title, mode ?? 'full')
			}

			return this.createDomSnapshot(version, url, title, mode, options)
		})
	}

	private async getPageInfo(): Promise<{ url: string; title: string }> {
		const urlResult = await this.browserManager.send<{ url: string }>({
			action: 'url',
		})
		const titleResult = await this.browserManager.send<{ title: string }>({
			action: 'title',
		})
		return {
			url: urlResult.success && urlResult.data?.url ? urlResult.data.url : '',
			title:
				titleResult.success && titleResult.data?.title
					? titleResult.data.title
					: '',
		}
	}

	private async createTextSnapshot(
		version: number,
		url: string,
		title: string,
		mode: 'full' | 'interactive' | 'input_fields' | 'text_only',
	): Promise<ActionResult> {
		const textResult = await this.browserManager.send<{ text?: string }>({
			action: 'gettext',
			selector: 'body',
		})
		const text = textResult.success ? (textResult.data?.text ?? '') : ''
		this.hasSnapshot = true
		this.browserManager.incrementSnapshotVersion()
		return {
			success: true,
			snapshot: {
				version,
				timestamp: Date.now(),
				url,
				title,
				tree: text,
				mode,
				interactiveCount: 0,
			},
		}
	}

	private async createDomSnapshot(
		version: number,
		url: string,
		title: string,
		mode: 'full' | 'interactive' | 'input_fields' | 'text_only' | undefined,
		options: {
			interactive?: boolean | undefined
			compact?: boolean | undefined
			depth?: number | undefined
			selector?: string | undefined
			visibleOnly?: boolean | undefined
		},
	): Promise<ActionResult> {
		const interactive = options.interactive ?? mode === 'input_fields'
		const response = await this.browserManager.send<{
			snapshot?: string
			refs?: Record<string, unknown>
		}>({
			action: 'snapshot',
			interactive,
			compact: options.compact,
			maxDepth: options.depth,
			selector: options.selector,
			visibleOnly: options.visibleOnly,
		})

		if (!(response.success && response.data?.snapshot)) {
			return { success: false, error: response.error ?? 'Snapshot failed' }
		}

		const snapshotText = this.rewriteSnapshotRefs(
			response.data.snapshot,
			version,
		)
		const refs = response.data.refs ?? {}
		const interactiveCount = Object.keys(refs).length

		// Store for element ref validation
		this.hasSnapshot = true
		this.lastInteractiveCount = interactiveCount

		this.browserManager.incrementSnapshotVersion()
		return {
			success: true,
			snapshot: {
				version,
				timestamp: Date.now(),
				url,
				title,
				tree: snapshotText,
				mode: mode ?? 'full',
				interactiveCount,
			},
		}
	}

	/**
	 * Get the current viewport dimensions.
	 */
	private async getCurrentViewport(
		tab?: TabRef,
	): Promise<{ width: number; height: number } | null> {
		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{ width: number; height: number }>({
				action: 'evaluate',
				script:
					'() => ({ width: window.innerWidth, height: window.innerHeight })',
			}),
		)

		if (response.success && response.data) {
			// Handle evaluate result which wraps in { result: ... }
			const data = response.data as unknown as {
				result?: { width: number; height: number }
			}
			if (data.result) {
				return data.result
			}
		}
		return null
	}

	/**
	 * Set viewport and return success status.
	 */
	private async setViewportDimensions(
		tab: TabRef | undefined,
		width: number,
		height: number,
	): Promise<boolean> {
		const response = await this.withTab(tab, async () =>
			this.browserManager.send({
				action: 'viewport',
				width,
				height,
			}),
		)
		return response.success
	}

	/**
	 * Screenshot at multiple viewports.
	 */
	private async screenshotMultiViewport(action: {
		tab?: TabRef | undefined
		ref?: string | undefined
		selector?: string | undefined
		fullPage?: boolean | undefined
		quality?: number | undefined
		view?: string | undefined
	}): Promise<ActionResult> {
		if (!action.view) {
			return { success: false, error: 'view parameter is required' }
		}
		const viewports = resolveViewFlag(action.view)
		const screenshots: Array<{ viewport: string; data: string }> = []

		// Save original viewport
		const originalViewport = await this.getCurrentViewport(action.tab)

		try {
			for (const vp of viewports) {
				// Set viewport
				const success = await this.setViewportDimensions(
					action.tab,
					vp.width,
					vp.height,
				)
				if (!success) {
					return {
						success: false,
						error: `Failed to set viewport to ${vp.width}x${vp.height}`,
					}
				}

				// Small delay to let layout settle
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Capture screenshot at this viewport
				const result = await this.screenshot(
					action.tab,
					action.ref,
					action.selector,
					action.fullPage,
					action.quality,
				)

				if (!result.success || !result.screenshot) {
					return {
						success: false,
						error:
							result.error ??
							`Screenshot failed at viewport ${vp.name ?? `${vp.width}x${vp.height}`}`,
					}
				}

				screenshots.push({
					viewport: vp.name ?? `${vp.width}x${vp.height}`,
					data: result.screenshot,
				})
			}

			return { success: true, data: { screenshots } }
		} finally {
			// Restore original viewport
			if (originalViewport) {
				await this.setViewportDimensions(
					action.tab,
					originalViewport.width,
					originalViewport.height,
				)
			}
		}
	}

	/**
	 * Snap at multiple viewports.
	 */
	private async snapMultiViewport(action: {
		tab?: TabRef | undefined
		mode?: 'full' | 'interactive' | 'input_fields' | 'text_only' | undefined
		interactive?: boolean | undefined
		compact?: boolean | undefined
		depth?: number | undefined
		selector?: string | undefined
		visibleOnly?: boolean | undefined
		view?: string | undefined
	}): Promise<ActionResult> {
		if (this.isPairedActive()) {
			return createError(
				'snap is not available in paired mode. Use marker/html/text instead.',
				ErrorCode.ACTION_NOT_SUPPORTED,
				false,
				'Use { action: "html" } or { action: "text" } in paired mode',
			)
		}

		if (!action.view) {
			return { success: false, error: 'view parameter is required' }
		}

		const viewports = resolveViewFlag(action.view)
		const snaps: Array<{
			viewport: string
			result: {
				tree?: string | undefined
				version?: number | undefined
				url?: string | undefined
				title?: string | undefined
				mode?: string | undefined
				interactiveCount?: number | undefined
			}
		}> = []

		// Save original viewport
		const originalViewport = await this.getCurrentViewport(action.tab)

		try {
			for (const vp of viewports) {
				// Set viewport
				const success = await this.setViewportDimensions(
					action.tab,
					vp.width,
					vp.height,
				)
				if (!success) {
					return {
						success: false,
						error: `Failed to set viewport to ${vp.width}x${vp.height}`,
					}
				}

				// Small delay to let layout settle
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Capture snap at this viewport
				const result = await this.snap(action.tab, action.mode, {
					interactive: action.interactive,
					compact: action.compact,
					depth: action.depth,
					selector: action.selector,
					visibleOnly: action.visibleOnly,
				})

				if (!result.success) {
					return {
						success: false,
						error:
							result.error ??
							`Snap failed at viewport ${vp.name ?? `${vp.width}x${vp.height}`}`,
					}
				}

				snaps.push({
					viewport: vp.name ?? `${vp.width}x${vp.height}`,
					result: {
						tree: result.snapshot?.tree,
						version: result.snapshot?.version,
						url: result.snapshot?.url,
						title: result.snapshot?.title,
						mode: result.snapshot?.mode,
						interactiveCount: result.snapshot?.interactiveCount,
					},
				})
			}

			return { success: true, data: { snaps } }
		} finally {
			// Restore original viewport
			if (originalViewport) {
				await this.setViewportDimensions(
					action.tab,
					originalViewport.width,
					originalViewport.height,
				)
			}
		}
	}

	private async getHtml(
		tab?: TabRef,
		_ref?: string,
		selector?: string,
	): Promise<ActionResult> {
		const target = selector ?? undefined

		const response = await this.withTab(tab, () => {
			if (target) {
				return this.browserManager.send<{ html: string }>({
					action: 'innerhtml',
					selector: target,
				})
			}
			return this.browserManager.send<{ html: string }>({ action: 'content' })
		})

		if (!(response.success && response.data?.html)) {
			return {
				success: false,
				error: response.error ?? 'HTML extraction failed',
			}
		}

		return { success: true, extractedContent: response.data.html }
	}

	private async getText(
		tab?: TabRef,
		ref?: string,
		selector?: string,
	): Promise<ActionResult> {
		const target = this.resolveSelector(ref, selector)

		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{ text: string }>({
				action: 'gettext',
				selector: target ?? 'body',
			}),
		)

		if (!response.success || response.data?.text === undefined) {
			return {
				success: false,
				error: response.error ?? 'Text extraction failed',
			}
		}

		return { success: true, extractedContent: response.data.text }
	}

	// ============================================================================
	// Marker Actions
	// ============================================================================

	private async createMarker(
		geometry: Geometry | undefined,
		ref: string | undefined,
		tab?: TabRef,
		note?: string,
		tags?: string[],
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		// Get page info
		const urlResult = await this.withTab(tab, async () =>
			this.browserManager.send<{ url: string }>({ action: 'url' }),
		)
		const titleResult = await this.withTab(tab, async () =>
			this.browserManager.send<{ title: string }>({ action: 'title' }),
		)
		const url =
			urlResult.success && urlResult.data?.url ? urlResult.data.url : ''
		const title =
			titleResult.success && titleResult.data?.title
				? titleResult.data.title
				: ''

		// If ref provided, get element info and derive geometry
		let derivedGeometry: Geometry
		let elementMetadata: ElementMetadata | undefined
		let sourceRef: string | undefined

		if (ref) {
			sourceRef = ref
			const elementInfo = await this.getElementInfoForMarker(ref, tab)
			if (!elementInfo.success) {
				return elementInfo.error
			}
			derivedGeometry = elementInfo.geometry
			elementMetadata = elementInfo.metadata
		} else if (geometry) {
			derivedGeometry = geometry
		} else {
			return createError(
				'Either geometry or ref is required',
				ErrorCode.SELECTOR_INVALID,
				false,
				'Provide geometry or element ref from snap',
			)
		}

		// Capture screenshot of the marker area
		const screenshot = await this.captureMarkerScreenshot(derivedGeometry, tab)

		// Capture viewport context
		let viewport: MarkerViewport | undefined
		const viewportResult = await this.withTab(tab, async () =>
			this.browserManager.send<{ result?: MarkerViewport }>({
				action: 'evaluate',
				script: `() => ({
					width: window.innerWidth,
					height: window.innerHeight,
					scrollX: window.scrollX,
					scrollY: window.scrollY,
					devicePixelRatio: window.devicePixelRatio,
				})`,
			}),
		)
		if (viewportResult.success && viewportResult.data?.result) {
			viewport = viewportResult.data.result
		}

		const marker = await this.markerStore.create({
			url,
			title,
			geometry: derivedGeometry,
			note,
			screenshot,
			viewport,
			element: elementMetadata,
			tags,
			sourceRef,
		})

		return { success: true, data: marker }
	}

	/**
	 * Get element information for creating a marker from a ref.
	 *
	 * Uses agent-browser's `styles` action which properly resolves refs via
	 * the internal refMap, then supplements with additional element metadata
	 * using the element's position.
	 */
	private async getElementInfoForMarker(
		ref: string,
		tab?: TabRef,
	): Promise<
		| { success: true; geometry: Geometry; metadata: ElementMetadata }
		| { success: false; error: ActionResult }
	> {
		// Validate element ref
		const validation = this.validateElementRef(ref)
		if (!validation.valid) {
			return { success: false, error: this.createElementRefError(ref) }
		}

		const target = this.resolveSelector(ref, undefined)
		if (!target) {
			return {
				success: false,
				error: createError(
					'Invalid element reference',
					ErrorCode.SELECTOR_INVALID,
					false,
					'Provide a valid element ref from snap (e.g., "e5")',
				),
			}
		}

		// Step 1: Use agent-browser's `styles` action to get bounding box and basic info
		// This properly resolves refs via browser.getLocator() instead of DOM queries
		const stylesResponse = await this.withTab(tab, async () =>
			this.browserManager.send<{
				elements: Array<{
					tag: string
					text: string | null
					box: { x: number; y: number; width: number; height: number }
					styles: {
						fontSize: string
						fontWeight: string
						fontFamily: string
						color: string
						backgroundColor: string
						borderRadius: string
						border: string | null
						boxShadow: string | null
						padding: string
					}
				}>
			}>({
				action: 'styles',
				selector: target,
			}),
		)

		const elements = stylesResponse.data?.elements
		const styleData = elements?.[0]

		if (!stylesResponse.success || !styleData) {
			return {
				success: false,
				error: createError(
					`Element ${ref} not found or not visible`,
					ErrorCode.ELEMENT_NOT_FOUND,
					true,
					'Take a fresh snap to get updated element references',
				),
			}
		}

		const box = styleData.box

		// Step 2: Get additional element metadata using the element's position
		// We use elementFromPoint at the center of the box to get the same element
		const metadataScript = `
			(box) => {
				// Find element at the center of the box returned by styles
				const centerX = box.x + box.width / 2
				const centerY = box.y + box.height / 2
				const el = document.elementFromPoint(centerX, centerY)
				if (!el) return null

				const computedStyle = window.getComputedStyle(el)

				// Build accessibility info
				const accessibility = {
					role: el.getAttribute('role') || undefined,
					ariaLabel: el.getAttribute('aria-label') || undefined,
					ariaDescribedBy: el.getAttribute('aria-describedby') || undefined,
					tabIndex: el.tabIndex !== -1 ? el.tabIndex : undefined,
					ariaHidden: el.getAttribute('aria-hidden') === 'true',
					focusable: el.tabIndex >= 0 || ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName),
				}

				// Build element identity for re-finding
				const testId = el.getAttribute('data-testid') || undefined
				const role = el.getAttribute('role') || el.tagName.toLowerCase()
				const ariaLabel = el.getAttribute('aria-label')
				const textContent = el.textContent?.trim().slice(0, 100) || undefined

				// Build roleAndName string
				let roleAndName = undefined
				if (ariaLabel) {
					roleAndName = role + ':' + ariaLabel
				} else if (textContent && ['button', 'a', 'label'].includes(el.tagName.toLowerCase())) {
					roleAndName = role + ':' + textContent.slice(0, 50)
				}

				// Build selector
				const id = el.id
				let selectorPath = el.tagName.toLowerCase()
				if (id) {
					selectorPath = '#' + id
				} else {
					const className = el.className?.split?.(' ')
						?.filter(c => c && !c.startsWith('_') && !c.match(/^[a-z0-9]{6,}$/i))
						?.slice(0, 2)?.join('.')
					if (className) {
						selectorPath = el.tagName.toLowerCase() + '.' + className
					}
				}

				// Clean CSS classes
				const cssClasses = el.className?.split?.(' ')
					?.filter(c => c && !c.match(/^[a-z0-9]{8,}$/i))
					?.join(' ') || undefined

				return {
					accessibility,
					identity: {
						testId,
						roleAndName,
						selector: selectorPath,
						textContent,
					},
					cssClasses,
					selectorPath,
				}
			}
		`

		const metadataResponse = await this.withTab(tab, async () =>
			this.browserManager.send<{
				result: {
					accessibility: ElementMetadata['accessibility']
					identity: ElementIdentity
					cssClasses?: string
					selectorPath: string
				} | null
			}>({
				action: 'evaluate',
				script: metadataScript,
				args: [box],
			}),
		)

		// Build result even if metadata enhancement fails (we still have box from styles)
		const metaResult = metadataResponse.data?.result

		// Build element name from styleData
		const tagName = styleData.tag
		let elementName = tagName
		if (metaResult?.identity?.textContent) {
			const text = metaResult.identity.textContent
			elementName = `${tagName} '${text.slice(0, 30)}'`
		} else if (styleData.text) {
			elementName = `${tagName} '${styleData.text.slice(0, 30)}'`
		}

		// Build bounding box with all properties
		const boundingBox: BoundingBox = {
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height,
			top: box.y,
			right: box.x + box.width,
			bottom: box.y + box.height,
			left: box.x,
		}

		// Convert styles from agent-browser to our format
		const computedStyles: Record<string, string> = {
			color: styleData.styles.color,
			backgroundColor: styleData.styles.backgroundColor,
			fontSize: styleData.styles.fontSize,
			fontWeight: styleData.styles.fontWeight,
		}

		const result = {
			boundingBox,
			accessibility: metaResult?.accessibility,
			identity: metaResult?.identity ?? {
				selector: metaResult?.selectorPath ?? tagName,
				textContent: styleData.text ?? undefined,
			},
			elementName,
			cssClasses: metaResult?.cssClasses,
			computedStyles,
			selector: metaResult?.selectorPath ?? tagName,
		}
		const geometry: Geometry = {
			type: 'region',
			x: Math.round(result.boundingBox.x),
			y: Math.round(result.boundingBox.y),
			width: Math.round(result.boundingBox.width),
			height: Math.round(result.boundingBox.height),
		}

		const metadata: ElementMetadata = {
			selector: result.selector,
			elementName: result.elementName,
			boundingBox: result.boundingBox,
			cssClasses: result.cssClasses,
			accessibility: result.accessibility,
			computedStyles: result.computedStyles,
			identity: result.identity,
		}

		return { success: true, geometry, metadata }
	}

	/**
	 * Capture screenshot for a marker region.
	 */
	private async captureMarkerScreenshot(
		geometry: Geometry,
		tab?: TabRef,
	): Promise<string | undefined> {
		let clip: { x: number; y: number; width: number; height: number }

		if (geometry.type === 'point') {
			const size = 100
			clip = {
				x: Math.max(0, geometry.x - size / 2),
				y: Math.max(0, geometry.y - size / 2),
				width: size,
				height: size,
			}
		} else {
			clip = {
				x: geometry.x,
				y: geometry.y,
				width: geometry.width,
				height: geometry.height,
			}
		}

		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{ base64?: string }>({
				action: 'screenshot',
				clip,
				format: 'png',
			}),
		)

		if (response.success && response.data?.base64) {
			return `data:image/png;base64,${response.data.base64}`
		}
		return undefined
	}

	private async listMarkers(
		format?: 'json' | 'markdown',
		filters?: { tags?: string[]; url?: string; role?: string },
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const markers = await this.markerStore.list(undefined, filters)

		if (format === 'markdown') {
			return { success: true, extractedContent: markersToMarkdown(markers) }
		}

		return { success: true, data: markers }
	}

	private async getMarker(
		id: string,
		includeScreenshot?: boolean,
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const marker = await this.markerStore.get(id, { includeScreenshot })
		if (!marker) {
			return { success: false, error: `Marker not found: ${id}` }
		}

		return { success: true, data: marker }
	}

	private async readMarkers(
		ids?: string[],
		includeScreenshot?: boolean,
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		let markers = await this.markerStore.list({ includeScreenshot })

		if (ids && ids.length > 0) {
			markers = markers.filter((m) => ids.includes(m.id))
		}

		return { success: true, extractedContent: markersToMarkdown(markers) }
	}

	private async deleteMarker(id: string): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const deleted = await this.markerStore.delete(id)
		if (!deleted) {
			return { success: false, error: `Marker not found: ${id}` }
		}

		return { success: true }
	}

	private async compareMarkers(
		id1: string,
		id2: string,
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const marker1 = await this.markerStore.get(id1)
		const marker2 = await this.markerStore.get(id2)

		if (!marker1 || !marker2) {
			return { success: false, error: 'One or both markers not found' }
		}

		// Basic comparison
		const comparison: Record<string, unknown> = {
			marker1: {
				id: marker1.id,
				geometry: marker1.geometry,
				note: marker1.note,
				url: marker1.url,
				timestamp: marker1.timestamp,
			},
			marker2: {
				id: marker2.id,
				geometry: marker2.geometry,
				note: marker2.note,
				url: marker2.url,
				timestamp: marker2.timestamp,
			},
			sameUrl: marker1.url === marker2.url,
			sameType: marker1.geometry.type === marker2.geometry.type,
		}

		// Calculate position delta for regions
		if (
			marker1.geometry.type === 'region' &&
			marker2.geometry.type === 'region'
		) {
			comparison.positionDelta = {
				x: marker2.geometry.x - marker1.geometry.x,
				y: marker2.geometry.y - marker1.geometry.y,
			}
			comparison.sizeDelta = {
				width: marker2.geometry.width - marker1.geometry.width,
				height: marker2.geometry.height - marker1.geometry.height,
			}
		} else if (
			marker1.geometry.type === 'point' &&
			marker2.geometry.type === 'point'
		) {
			comparison.positionDelta = {
				x: marker2.geometry.x - marker1.geometry.x,
				y: marker2.geometry.y - marker1.geometry.y,
			}
		}

		// Compare element identity if available
		if (marker1.element?.identity && marker2.element?.identity) {
			const id1 = marker1.element.identity
			const id2 = marker2.element.identity
			comparison.sameElement =
				(id1.testId && id1.testId === id2.testId) ||
				(id1.roleAndName && id1.roleAndName === id2.roleAndName)
		}

		// Compare text content if available
		if (marker1.element?.selectedText || marker2.element?.selectedText) {
			comparison.textChanged =
				marker1.element?.selectedText !== marker2.element?.selectedText
		}

		// Compare computed styles if available
		if (marker1.element?.computedStyles && marker2.element?.computedStyles) {
			const styles1 = marker1.element.computedStyles
			const styles2 = marker2.element.computedStyles
			const styleChanges: Record<string, { before: string; after: string }> = {}
			const allKeys = new Set([
				...Object.keys(styles1),
				...Object.keys(styles2),
			])

			for (const key of allKeys) {
				if (styles1[key] !== styles2[key]) {
					styleChanges[key] = {
						before: styles1[key] ?? '',
						after: styles2[key] ?? '',
					}
				}
			}

			if (Object.keys(styleChanges).length > 0) {
				comparison.styleChanges = styleChanges
			}
		}

		return { success: true, data: comparison }
	}

	/**
	 * Resolve a marker to find the same element on the current page.
	 */
	private async resolveMarker(id: string, tab?: TabRef): Promise<ActionResult> {
		if (!this.markerStore) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const marker = await this.markerStore.get(id)
		if (!marker) {
			return { success: false, error: `Marker not found: ${id}` }
		}

		// Check if marker has element identity for re-finding
		if (!marker.element?.identity) {
			return {
				success: false,
				error:
					'Marker does not have element identity. Create markers with ref parameter for re-finding support.',
			}
		}

		const identity = marker.element.identity

		// Build resolution script that tries multiple strategies
		const script = `
			(identity) => {
				const results = []

				// Strategy 1: data-testid (highest confidence)
				if (identity.testId) {
					const el = document.querySelector('[data-testid="' + identity.testId + '"]')
					if (el) {
						const rect = el.getBoundingClientRect()
						results.push({
							method: 'testId',
							confidence: 'high',
							element: el,
							visible: rect.width > 0 && rect.height > 0,
							rect,
						})
					}
				}

				// Strategy 2: Role and accessible name
				if (identity.roleAndName) {
					const [role, ...nameParts] = identity.roleAndName.split(':')
					const name = nameParts.join(':')

					// Try explicit role first
					const candidates = document.querySelectorAll('[role="' + role + '"]')
					for (const el of candidates) {
						const ariaLabel = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 50)
						if (ariaLabel && ariaLabel === name) {
							const rect = el.getBoundingClientRect()
							results.push({
								method: 'roleAndName',
								confidence: 'high',
								element: el,
								visible: rect.width > 0 && rect.height > 0,
								rect,
							})
						}
					}

					// Try implicit role based on tag name
					const implicitRoles = {
						button: ['button', 'input[type="button"]', 'input[type="submit"]'],
						link: ['a'],
						textbox: ['input[type="text"]', 'input', 'textarea'],
					}
					if (implicitRoles[role]) {
						for (const selector of implicitRoles[role]) {
							const elements = document.querySelectorAll(selector)
							for (const el of elements) {
								const ariaLabel = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 50)
								if (ariaLabel && ariaLabel === name) {
									const rect = el.getBoundingClientRect()
									// Only add if not already found
									if (!results.find(r => r.element === el)) {
										results.push({
											method: 'roleAndName',
											confidence: 'medium',
											element: el,
											visible: rect.width > 0 && rect.height > 0,
											rect,
										})
									}
								}
							}
						}
					}
				}

				// Strategy 3: Selector match
				if (identity.selector) {
					try {
						const el = document.querySelector(identity.selector)
						if (el && !results.find(r => r.element === el)) {
							const rect = el.getBoundingClientRect()
							results.push({
								method: 'selector',
								confidence: 'low',
								element: el,
								visible: rect.width > 0 && rect.height > 0,
								rect,
							})
						}
					} catch {
						// Invalid selector, ignore
					}
				}

				// Strategy 4: Text content match (fallback)
				if (identity.textContent && results.length === 0) {
					const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
					while (walker.nextNode()) {
						const el = walker.currentNode
						const text = el.textContent?.trim()
						if (text === identity.textContent) {
							const rect = el.getBoundingClientRect()
							if (rect.width > 0 && rect.height > 0) {
								results.push({
									method: 'textContent',
									confidence: 'low',
									element: el,
									visible: true,
									rect,
								})
								break // Only take first match
							}
						}
					}
				}

				// Find the best result (prefer visible, high confidence)
				if (results.length === 0) {
					return { found: false }
				}

				// Sort by confidence and visibility
				const confidenceOrder = { high: 0, medium: 1, low: 2 }
				results.sort((a, b) => {
					if (a.visible !== b.visible) return b.visible ? 1 : -1
					return confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
				})

				const best = results[0]

				// Find the ref index for the element (if it has data-ref)
				const refAttr = best.element.getAttribute('data-ref')
				const ref = refAttr ? 'e' + refAttr : null

				return {
					found: true,
					ref,
					confidence: best.confidence,
					method: best.method,
					visible: best.visible,
					boundingBox: {
						x: best.rect.x,
						y: best.rect.y,
						width: best.rect.width,
						height: best.rect.height,
					},
					alternativeMatches: results.length - 1,
				}
			}
		`

		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{
				result: {
					found: boolean
					ref?: string | null
					confidence?: 'high' | 'medium' | 'low'
					method?: string
					visible?: boolean
					boundingBox?: { x: number; y: number; width: number; height: number }
					alternativeMatches?: number
				}
			}>({
				action: 'evaluate',
				script,
				args: [identity],
			}),
		)

		if (!response.success) {
			return {
				success: false,
				error: response.error ?? 'Failed to resolve marker element',
			}
		}

		const result = response.data?.result
		if (!result?.found) {
			return {
				success: true,
				data: {
					found: false,
					markerId: id,
					identity,
					message: 'Element not found on current page',
				},
			}
		}

		return {
			success: true,
			data: {
				found: true,
				markerId: id,
				ref: result.ref,
				confidence: result.confidence,
				method: result.method,
				visible: result.visible,
				boundingBox: result.boundingBox,
				alternativeMatches: result.alternativeMatches,
			},
		}
	}

	// ============================================================================
	// Display Actions
	// ============================================================================

	private async setViewport(
		tab?: TabRef,
		preset?: 'mobile' | 'tablet' | 'desktop',
		width?: number,
		height?: number,
	): Promise<ActionResult> {
		const presets = {
			mobile: { width: 375, height: 667 },
			tablet: { width: 768, height: 1024 },
			desktop: { width: 1280, height: 720 },
		} as const

		let viewport: Viewport
		if (preset) {
			viewport = presets[preset]
		} else if (width && height) {
			viewport = { width, height }
		} else {
			viewport = presets.desktop
		}

		const response = await this.withTab(tab, async () =>
			this.browserManager.send({
				action: 'viewport',
				width: viewport.width,
				height: viewport.height,
			}),
		)

		if (!response.success) {
			return {
				success: false,
				error: response.error ?? 'Failed to set viewport',
			}
		}

		return { success: true }
	}

	private async setColorScheme(
		tab: TabRef | undefined,
		scheme: ColorScheme,
	): Promise<ActionResult> {
		const response = await this.withTab(tab, async () =>
			this.browserManager.send({ action: 'emulatemedia', colorScheme: scheme }),
		)

		if (!response.success) {
			return {
				success: false,
				error: response.error ?? 'Failed to set color scheme',
			}
		}

		return { success: true }
	}

	private async setMode(
		target: 'headless' | 'windowed' | 'paired',
	): Promise<ActionResult> {
		await this.browserManager.setMode(target)
		return { success: true }
	}

	// ============================================================================
	// Evaluate Action
	// ============================================================================

	private async evaluate(
		script: string,
		args?: unknown[],
		tab?: TabRef,
	): Promise<ActionResult> {
		const response = await this.withTab(tab, async () =>
			this.browserManager.send<{ result: unknown }>({
				action: 'evaluate',
				script,
				args,
			}),
		)

		if (!response.success) {
			return { success: false, error: response.error ?? 'Evaluate failed' }
		}

		const result = response.data?.result
		let extractedContent: string | undefined
		if (typeof result === 'string') {
			extractedContent = result
		} else if (result !== undefined) {
			extractedContent = JSON.stringify(result, null, 2)
		}

		return { success: true, data: result, extractedContent }
	}

	// ============================================================================
	// Session Actions
	// ============================================================================

	private async getSession(): Promise<ActionResult> {
		const session = this.sessionManager.getCurrentSession()
		if (!session) {
			return createError(
				'No active session',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a session first by executing any action',
			)
		}

		const browserState = await this.browserManager.getSessionState()
		const pairedState = this.pairedManager.getSessionState()

		return {
			success: true,
			data: {
				...session,
				browser: browserState,
				paired: pairedState,
			},
		}
	}

	private async listSessions(limit?: number): Promise<ActionResult> {
		const sessions = await this.sessionManager.listSessions({ limit })
		return { success: true, data: sessions }
	}

	private async getSteps(
		sessionId?: string,
		limit?: number,
	): Promise<ActionResult> {
		const session = sessionId
			? await this.sessionManager.loadSession(sessionId)
			: this.sessionManager.getCurrentSession()

		if (!session) {
			return createError(
				'Session not found',
				ErrorCode.SESSION_NOT_FOUND,
				false,
				'Start a new session or provide a valid session ID',
			)
		}

		const logger = new StepLogger(
			this.sessionManager.getProjectRoot(),
			session.id,
		)
		const steps = await logger.readSteps(limit)

		return { success: true, data: steps }
	}

	// ============================================================================
	// Helpers
	// ============================================================================

	private async withTab<T>(
		tab: TabRef | undefined,
		fn: () => Promise<T>,
	): Promise<T> {
		if (tab !== undefined) {
			const index = await this.resolveTabIndex(tab)
			if (index === null) {
				throw new Error(`Tab ${String(tab)} not found`)
			}
			const response = await this.browserManager.send({
				action: 'tab_switch',
				index,
			})
			if (!response.success) {
				throw new Error(response.error ?? `Failed to switch to tab ${index}`)
			}
		}
		return fn()
	}

	private async sendCommand<T>(
		command: Record<string, unknown>,
		tab?: TabRef,
	): Promise<AgentBrowserResponse<T>> {
		return this.withTab(tab, () => this.browserManager.send<T>(command))
	}

	private parseTabIndexFromString(ref: string): number | null {
		if (NUMERIC_STRING_PATTERN.test(ref)) return Number(ref)
		if (ref.startsWith('b')) {
			const parsed = Number(ref.slice(1))
			return Number.isNaN(parsed) ? null : parsed
		}
		return null
	}

	private async resolveTabIndexFromHash(ref: string): Promise<number | null> {
		if (ref.length !== 4) return null
		const tabs = await this.browserManager.getTabs()
		const match = tabs.find((tab) => tab.urlHash === ref)
		if (!match) return null
		if (typeof match.ref === 'number') return match.ref
		if (typeof match.ref === 'string') {
			return this.parseTabIndexFromString(match.ref)
		}
		return null
	}

	private async resolveTabIndex(ref?: TabRef): Promise<number | null> {
		if (ref === undefined || ref === null) return null
		if (typeof ref === 'number') return ref
		if (typeof ref === 'string') {
			const numericRef = this.parseTabIndexFromString(ref)
			if (numericRef !== null) return numericRef
			const hashRef = await this.resolveTabIndexFromHash(ref)
			if (hashRef !== null) return hashRef
		}
		return null
	}

	private resolveSelector(ref?: string, selector?: string): string | null {
		if (ref) {
			const match = ref.match(/^@?e(\d+)/)
			if (match) return `@e${match[1]}`
		}
		if (selector) return selector
		return null
	}

	/**
	 * Validate an element reference against the last snapshot.
	 *
	 * @param ref - Element reference (e.g., "@e42", "e42")
	 * @returns Object with valid flag and parsed index
	 */
	private validateElementRef(ref: string): { valid: boolean; index: number } {
		const match = ref.match(/^@?e(\d+)/)
		if (!match?.[1]) return { valid: false, index: -1 }
		const index = Number.parseInt(match[1], 10)

		// If no snapshot taken yet, validation fails
		if (!this.hasSnapshot) return { valid: false, index }

		// If snapshot was taken but has 0 interactive elements (e.g., text_only mode),
		// skip validation and let the action proceed to browser level
		if (this.lastInteractiveCount === 0) return { valid: true, index }

		// Element refs are 1-indexed, so valid range is 1 to interactiveCount
		const valid = index >= 1 && index <= this.lastInteractiveCount
		return { valid, index }
	}

	/**
	 * Create an error result for invalid element references.
	 */
	private createElementRefError(ref: string): ActionResult {
		if (!this.hasSnapshot) {
			return createError(
				`Cannot interact with ${ref}: no snapshot taken yet. Run snap first.`,
				ErrorCode.ELEMENT_NOT_FOUND,
				true,
				'Take a snap first to discover interactive elements',
			)
		}
		return createError(
			`Element ${ref} not found. Last snap had ${this.lastInteractiveCount} interactive elements (e1-e${this.lastInteractiveCount}).`,
			ErrorCode.ELEMENT_NOT_FOUND,
			true,
			'Take a fresh snap to get updated element references',
		)
	}

	/**
	 * Extract ref/selector/tab from an action for locator capture.
	 *
	 * Returns the targeting info for actions that interact with elements.
	 * Returns undefined for actions that don't target elements.
	 */
	private extractRefFromAction(
		action: Action,
	): { ref?: string; selector?: string; tab?: TabRef } | undefined {
		// Helper to build result with only defined properties
		const buildResult = (
			ref: string | undefined,
			selector: string | undefined,
			tab: TabRef | undefined,
		): { ref?: string; selector?: string; tab?: TabRef } => {
			const result: { ref?: string; selector?: string; tab?: TabRef } = {}
			if (ref !== undefined) result.ref = ref
			if (selector !== undefined) result.selector = selector
			if (tab !== undefined) result.tab = tab
			return result
		}

		switch (action.action) {
			case 'click':
			case 'type':
			case 'select':
			case 'hover':
			case 'focus':
			case 'fill':
			case 'check':
			case 'uncheck':
			case 'upload':
			case 'download':
			case 'waitFor':
				return buildResult(action.ref, action.selector, action.tab)
			case 'scroll':
				// scroll uses selector but not ref
				return action.selector
					? buildResult(undefined, action.selector, action.tab)
					: undefined
			case 'screenshot':
			case 'text':
			case 'html':
				// These can optionally target elements
				if (action.ref || action.selector) {
					return buildResult(action.ref, action.selector, action.tab)
				}
				return undefined
			default:
				// Non-element-targeting actions
				return undefined
		}
	}

	private rewriteSnapshotRefs(tree: string, version: number): string {
		return tree
			.replace(/\bref=e(\d+)(?!_)/g, `ref=e$1_${version}`)
			.replace(/([@#$%])e(\d+)(?!_)/g, `$1e$2_${version}`)
	}

	// ============================================================================
	// Watch Broadcast Helpers
	// ============================================================================

	/**
	 * Broadcast a watch event to connected clients.
	 */
	private broadcastEvent(event: WatchEvent): void {
		watchBroadcaster.broadcast(event)
	}

	/**
	 * Extract a human-readable target from an action for watch display.
	 */
	private extractActionTarget(action: Action): string | undefined {
		switch (action.action) {
			case 'navigate':
				return action.url
			case 'click':
			case 'type':
			case 'select':
			case 'hover':
			case 'focus':
			case 'scroll':
			case 'waitFor':
			case 'fill':
			case 'check':
			case 'uncheck':
			case 'upload':
			case 'download':
				return action.ref ?? action.selector
			case 'press':
				return action.key
			case 'find':
				return (
					action.text ??
					action.role ??
					action.label ??
					action.testid ??
					action.ref
				)
			case 'dialog':
				return action.handler
			case 'tab':
			case 'closeTab':
				return action.ref !== undefined ? String(action.ref) : undefined
			case 'newTab':
				return action.url
			case 'screenshot':
				return (
					action.ref ??
					action.selector ??
					(action.fullPage ? 'fullPage' : undefined)
				)
			case 'snap':
				return action.mode ?? 'full'
			case 'marker':
				return action.geometry?.type
			case 'markerGet':
			case 'markerDelete':
				return action.id
			case 'markerCompare':
				return `${action.id1} vs ${action.id2}`
			case 'viewport':
				return (
					action.preset ??
					(action.width && action.height
						? `${action.width}x${action.height}`
						: undefined)
				)
			case 'colorScheme':
				return action.scheme
			case 'mode':
				return action.target
			case 'evaluate':
				return action.script?.slice(0, 50)
			case 'wait':
				return `${action.ms}ms`
			default:
				return undefined
		}
	}

	/**
	 * Extract result metadata for watch display.
	 */
	private extractResultMeta(
		action: Action,
		result: ActionResult,
	): Record<string, unknown> | undefined {
		if (!result.success) return undefined

		switch (action.action) {
			case 'snap':
				if (result.snapshot) {
					return {
						elementCount: result.snapshot.interactiveCount,
						url: result.snapshot.url,
					}
				}
				break
			case 'tabs':
				if (result.extractedContent) {
					try {
						const tabs = JSON.parse(result.extractedContent) as unknown[]
						return { tabCount: tabs.length }
					} catch {
						// Ignore parse errors
					}
				}
				break
			case 'markers':
				if (result.data && Array.isArray(result.data)) {
					return { markerCount: result.data.length }
				}
				break
		}

		return undefined
	}

	// ============================================================================
	// Sequence Execution
	// ============================================================================

	/**
	 * Execute a sequence of actions.
	 */
	private async executeSequence(
		steps: Action[],
		params?: Record<string, unknown>,
		options?: {
			stopOnError?: boolean | undefined
			name?: string | undefined
		},
	): Promise<ActionResult> {
		const result = await this.sequenceExecutor.execute(steps, {
			params,
			stopOnError: options?.stopOnError,
			name: options?.name,
			projectRoot: this.currentProjectRoot ?? undefined,
		})

		return {
			success: result.success,
			error: result.error,
			data: result,
		}
	}
}
