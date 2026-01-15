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
	ColorScheme,
	FindAction,
	Geometry,
	NavigatorConfig,
	TabRef,
	Viewport,
} from '@outfitter/navigator-core'
import { parseKeyCombo } from '@outfitter/navigator-core'
import type { BrowserManager } from '../browser/manager'
import { MarkerStore, markersToMarkdown } from '../markers'
import type { PairedManager } from '../paired/manager'
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
// Action Executor
// ============================================================================

/**
 * Executes Navigator actions.
 */
export class ActionExecutor {
	private markerStore: MarkerStore | null = null
	private stepLogger: StepLogger | null = null
	private currentProjectRoot: string | null = null

	constructor(
		private readonly browserManager: BrowserManager,
		private readonly pairedManager: PairedManager,
		private readonly sessionManager: SessionManager,
		_config: NavigatorConfig,
	) {}

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
		}

		const start = Date.now()
		const target = this.extractActionTarget(action)

		// Broadcast action start
		this.broadcastEvent({
			ts: new Date().toISOString(),
			type: 'action',
			source: 'agent',
			action: action.action,
			target,
			status: 'start',
		})

		let result: ActionResult

		try {
			result = await this.run(action)
		} catch (error) {
			result = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}

		const duration = Date.now() - start

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
			return this.pairedManager.execute(action)
		}

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
				return this.screenshot(
					action.tab,
					action.ref,
					action.selector,
					action.fullPage,
					action.quality,
				)
			case 'snap':
				return this.snap(action.tab, action.mode, action)
			case 'html':
				return this.getHtml(action.tab, action.ref, action.selector)
			case 'text':
				return this.getText(action.tab, action.ref, action.selector)

			// Markers
			case 'marker':
				return this.createMarker(action.geometry, action.tab, action.note)
			case 'markers':
				return this.listMarkers(action.format)
			case 'markerGet':
				return this.getMarker(action.id)
			case 'markerRead':
				return this.readMarkers(action.ids)
			case 'markerDelete':
				return this.deleteMarker(action.id)
			case 'markerCompare':
				return this.compareMarkers(action.id1, action.id2)

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
			return { success: false, error: `Tab ${String(ref)} not found` }
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
			return { success: false, error: `Tab ${String(ref)} not found` }
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
			return { success: false, error: 'click requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'click', selector: target, button, clickCount },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Click failed' }
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
			return { success: false, error: 'type requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'type', selector: target, text, clear, delay },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Type failed' }
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
			return { success: false, error: 'select requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'select', selector: target, values: value },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Select failed' }
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
			return { success: false, error: 'hover requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'hover', selector: target },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Hover failed' }
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
			return { success: false, error: 'focus requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'focus', selector: target },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Focus failed' }
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
			return { success: false, error: 'fill requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'fill', selector: target, value },
			tab,
		)
		if (!response.success) {
			return { success: false, error: response.error ?? 'Fill failed' }
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
			return { success: false, error: 'check requires ref or selector' }
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
			return { success: false, error: 'uncheck requires ref or selector' }
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
			return { success: false, error: 'upload requires ref or selector' }
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
			return { success: false, error: 'waitFor requires ref or selector' }
		}

		const response = await this.sendCommand(
			{ action: 'wait', selector: target, state, timeout },
			tab,
		)
		if (!response.success) {
			return {
				success: false,
				error: response.error ?? `Timeout waiting for element to be ${state}`,
			}
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
			return {
				success: false,
				error: response.error ?? 'Timeout waiting for navigation',
			}
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
			return {
				success: false,
				error:
					'snap is not available in paired mode. Use marker/html/text instead.',
			}
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
				interactiveCount: Object.keys(refs).length,
			},
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
		geometry: Geometry,
		_tab?: TabRef,
		note?: string,
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return { success: false, error: 'No active session' }
		}

		// Get page info
		const urlResult = await this.browserManager.send<{ url: string }>({
			action: 'url',
		})
		const titleResult = await this.browserManager.send<{ title: string }>({
			action: 'title',
		})
		const url =
			urlResult.success && urlResult.data?.url ? urlResult.data.url : ''
		const title =
			titleResult.success && titleResult.data?.title
				? titleResult.data.title
				: ''

		// Capture screenshot of the marker area
		let screenshot: string | undefined
		if (geometry.type === 'point') {
			const size = 100
			const response = await this.browserManager.send<{ base64?: string }>({
				action: 'screenshot',
				clip: {
					x: Math.max(0, geometry.x - size / 2),
					y: Math.max(0, geometry.y - size / 2),
					width: size,
					height: size,
				},
				format: 'png',
			})
			if (response.success && response.data?.base64) {
				screenshot = `data:image/png;base64,${response.data.base64}`
			}
		} else {
			const response = await this.browserManager.send<{ base64?: string }>({
				action: 'screenshot',
				clip: {
					x: geometry.x,
					y: geometry.y,
					width: geometry.width,
					height: geometry.height,
				},
				format: 'png',
			})
			if (response.success && response.data?.base64) {
				screenshot = `data:image/png;base64,${response.data.base64}`
			}
		}

		const marker = await this.markerStore.create({
			url,
			title,
			geometry,
			note,
			screenshot,
		})

		return { success: true, data: marker }
	}

	private async listMarkers(
		format?: 'json' | 'markdown',
	): Promise<ActionResult> {
		if (!this.markerStore) {
			return { success: false, error: 'No active session' }
		}

		const markers = await this.markerStore.list()

		if (format === 'markdown') {
			return { success: true, extractedContent: markersToMarkdown(markers) }
		}

		return { success: true, data: markers }
	}

	private async getMarker(id: string): Promise<ActionResult> {
		if (!this.markerStore) {
			return { success: false, error: 'No active session' }
		}

		const marker = await this.markerStore.get(id)
		if (!marker) {
			return { success: false, error: `Marker not found: ${id}` }
		}

		return { success: true, data: marker }
	}

	private async readMarkers(ids?: string[]): Promise<ActionResult> {
		if (!this.markerStore) {
			return { success: false, error: 'No active session' }
		}

		let markers = await this.markerStore.list()

		if (ids && ids.length > 0) {
			markers = markers.filter((m) => ids.includes(m.id))
		}

		return { success: true, extractedContent: markersToMarkdown(markers) }
	}

	private async deleteMarker(id: string): Promise<ActionResult> {
		if (!this.markerStore) {
			return { success: false, error: 'No active session' }
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
			return { success: false, error: 'No active session' }
		}

		const marker1 = await this.markerStore.get(id1)
		const marker2 = await this.markerStore.get(id2)

		if (!marker1 || !marker2) {
			return { success: false, error: 'One or both markers not found' }
		}

		// Simple comparison
		const comparison = {
			marker1: {
				id: marker1.id,
				geometry: marker1.geometry,
				note: marker1.note,
			},
			marker2: {
				id: marker2.id,
				geometry: marker2.geometry,
				note: marker2.note,
			},
			sameUrl: marker1.url === marker2.url,
			sameType: marker1.geometry.type === marker2.geometry.type,
		}

		return { success: true, data: comparison }
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
			return { success: false, error: 'No active session' }
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
			return { success: false, error: 'Session not found' }
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
}
