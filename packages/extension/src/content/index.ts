/**
 * Content Script
 *
 * Handles marker mode (click/drag to annotate UI elements) and
 * executes agent actions in Paired mode.
 * Reports viewport dimensions and user actions for paired mode.
 */

// State
let markerMode = false
let userActionListenersActive = false
let startPoint: { x: number; y: number } | null = null
let overlay: HTMLDivElement | null = null
let modeIndicator: HTMLDivElement | null = null

// Geometry types
interface PointGeometry {
	type: 'point'
	x: number
	y: number
}

interface RegionGeometry {
	type: 'region'
	x: number
	y: number
	width: number
	height: number
}

type MarkerGeometry = PointGeometry | RegionGeometry

interface MarkerPayload {
	geometry: MarkerGeometry
	note?: string
	url: string
	title: string
	selector?: string
	element?: {
		tagName: string
		id?: string
		className?: string
		text?: string
	}
}

interface ActionPayload {
	action: string
	ref?: string
	selector?: string
	text?: string
	value?: string
	x?: number
	y?: number
	clear?: boolean
}

interface ActionResult {
	success: boolean
	data?: unknown
	error?: string
}

interface Viewport {
	width: number
	height: number
}

interface UserActionEvent {
	type: 'userAction'
	action: 'click' | 'type' | 'navigate' | 'scroll'
	target?: string | undefined
	url?: string | undefined
	timestamp: string
}

// ============================================================================
// Viewport Detection
// ============================================================================

/**
 * Get current viewport dimensions
 */
function getViewport(): Viewport {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
	}
}

/**
 * Report viewport to background script
 */
function reportViewport(): void {
	const viewport = getViewport()
	chrome.runtime
		.sendMessage({
			type: 'viewportUpdate',
			viewport,
			url: window.location.href,
			title: document.title,
		})
		.catch(() => {
			// Ignore errors when no listeners
		})
}

/**
 * Handle viewport resize events with debounce
 */
let resizeTimeout: ReturnType<typeof setTimeout> | null = null
function handleResize(): void {
	if (resizeTimeout) {
		clearTimeout(resizeTimeout)
	}
	resizeTimeout = setTimeout(() => {
		reportViewport()
		resizeTimeout = null
	}, 150)
}

// ============================================================================
// User Action Detection (for paired mode)
// ============================================================================

/**
 * Send user action event to background script
 */
function sendUserActionEvent(event: UserActionEvent): void {
	chrome.runtime.sendMessage(event).catch(() => {
		// Ignore errors when no listeners
	})
}

/**
 * Handle user click events
 */
function handleUserClick(event: MouseEvent): void {
	// Ignore clicks on our overlay elements
	const target = event.target as HTMLElement
	if (target?.hasAttribute?.('data-navigator-overlay')) return
	if (markerMode) return

	const selector = target ? getSelector(target) : undefined
	sendUserActionEvent({
		type: 'userAction',
		action: 'click',
		target: selector,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Handle user input events (typing)
 */
function handleUserInput(event: Event): void {
	const target = event.target as HTMLElement
	if (!target) return

	const selector = getSelector(target)
	sendUserActionEvent({
		type: 'userAction',
		action: 'type',
		target: selector,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Handle user scroll events with debounce
 */
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
function handleUserScroll(): void {
	if (scrollTimeout) return
	scrollTimeout = setTimeout(() => {
		sendUserActionEvent({
			type: 'userAction',
			action: 'scroll',
			timestamp: new Date().toISOString(),
		})
		scrollTimeout = null
	}, 200)
}

/**
 * Enable user action listeners
 */
function enableUserActionListeners(): void {
	if (userActionListenersActive) return
	userActionListenersActive = true

	document.addEventListener('click', handleUserClick, true)
	document.addEventListener('input', handleUserInput, true)
	document.addEventListener('scroll', handleUserScroll, true)
}

/**
 * Disable user action listeners
 */
function disableUserActionListeners(): void {
	if (!userActionListenersActive) return
	userActionListenersActive = false

	document.removeEventListener('click', handleUserClick, true)
	document.removeEventListener('input', handleUserInput, true)
	document.removeEventListener('scroll', handleUserScroll, true)
}

/**
 * Get element at a point, excluding our overlay elements
 */
function getElementAtPoint(x: number, y: number): Element | null {
	// Temporarily hide overlay to get element beneath
	const overlayElements = document.querySelectorAll('[data-navigator-overlay]')
	for (const el of overlayElements) {
		;(el as HTMLElement).style.pointerEvents = 'none'
	}

	const element = document.elementFromPoint(x, y)

	for (const el of overlayElements) {
		;(el as HTMLElement).style.pointerEvents = ''
	}

	return element
}

/**
 * Get a stable CSS selector for an element
 */
function getSelector(element: Element): string {
	if (element.id) {
		return `#${CSS.escape(element.id)}`
	}

	const parts: string[] = []
	let current: Element | null = element

	while (
		current &&
		current.nodeType === Node.ELEMENT_NODE &&
		parts.length < 4
	) {
		let selector = current.tagName.toLowerCase()

		if (current.classList.length > 0) {
			const classes = Array.from(current.classList)
				.slice(0, 2)
				.map((cls) => CSS.escape(cls))
				.join('.')
			selector += `.${classes}`
		}

		const siblings = current.parentElement
			? Array.from(current.parentElement.children).filter(
					(sibling) => sibling.tagName === current?.tagName,
				)
			: []

		if (siblings.length > 1) {
			const index = siblings.indexOf(current) + 1
			selector += `:nth-of-type(${index})`
		}

		parts.unshift(selector)
		current = current.parentElement
	}

	return parts.join(' > ')
}

/**
 * Get element info for marker metadata
 */
function getElementInfo(
	element: Element,
): MarkerPayload['element'] | undefined {
	const tagName = element.tagName.toLowerCase()
	const result: MarkerPayload['element'] = { tagName }

	if (element.id) {
		result.id = element.id
	}
	if (element.className) {
		result.className = element.className
	}
	const text = (element.textContent || '').trim().slice(0, 100)
	if (text) {
		result.text = text
	}

	return result
}

/**
 * Create the selection overlay element
 */
function createOverlay(): void {
	if (overlay) return

	overlay = document.createElement('div')
	overlay.setAttribute('data-navigator-overlay', 'selection')
	overlay.className = 'navigator-marker-overlay'
	document.body.appendChild(overlay)
}

/**
 * Update overlay position and size during drag
 */
function updateOverlay(endX: number, endY: number): void {
	if (!overlay || !startPoint) return

	const left = Math.min(startPoint.x, endX)
	const top = Math.min(startPoint.y, endY)
	const width = Math.abs(endX - startPoint.x)
	const height = Math.abs(endY - startPoint.y)

	overlay.style.left = `${left}px`
	overlay.style.top = `${top}px`
	overlay.style.width = `${width}px`
	overlay.style.height = `${height}px`
	overlay.style.display = 'block'
}

/**
 * Remove the selection overlay
 */
function removeOverlay(): void {
	overlay?.remove()
	overlay = null
}

/**
 * Show marker mode indicator
 */
function showModeIndicator(): void {
	if (modeIndicator) return

	modeIndicator = document.createElement('div')
	modeIndicator.setAttribute('data-navigator-overlay', 'indicator')
	modeIndicator.className = 'navigator-mode-indicator'
	modeIndicator.textContent = 'Marker Mode - Click or drag to select'
	document.body.appendChild(modeIndicator)
}

/**
 * Hide marker mode indicator
 */
function hideModeIndicator(): void {
	modeIndicator?.remove()
	modeIndicator = null
}

/**
 * Handle mouse down - start marker selection
 */
function handleMouseDown(event: MouseEvent): void {
	if (!markerMode) return
	event.preventDefault()
	event.stopPropagation()

	startPoint = { x: event.clientX, y: event.clientY }
	createOverlay()
}

/**
 * Handle mouse move - update selection region
 */
function handleMouseMove(event: MouseEvent): void {
	if (!markerMode || !startPoint) return

	updateOverlay(event.clientX, event.clientY)
}

/**
 * Handle mouse up - complete marker creation
 */
function handleMouseUp(event: MouseEvent): void {
	if (!markerMode || !startPoint) return

	event.preventDefault()
	event.stopPropagation()

	const endPoint = { x: event.clientX, y: event.clientY }

	// Determine if this is a click (point) or drag (region)
	const isClick =
		Math.abs(endPoint.x - startPoint.x) < 5 &&
		Math.abs(endPoint.y - startPoint.y) < 5

	let geometry: MarkerGeometry
	let element: Element | null = null
	let selector: string | undefined

	if (isClick) {
		// Point marker - single click
		geometry = {
			type: 'point',
			x: startPoint.x,
			y: startPoint.y,
		}

		// Get element at click point
		element = getElementAtPoint(startPoint.x, startPoint.y)
		if (element) {
			selector = getSelector(element)
		}
	} else {
		// Region marker - drag selection
		geometry = {
			type: 'region',
			x: Math.min(startPoint.x, endPoint.x),
			y: Math.min(startPoint.y, endPoint.y),
			width: Math.abs(endPoint.x - startPoint.x),
			height: Math.abs(endPoint.y - startPoint.y),
		}
	}

	// Prompt for note
	const note = prompt('Add a note for this marker (optional):')

	// Build marker payload
	const payload: MarkerPayload = {
		geometry,
		url: window.location.href,
		title: document.title,
	}

	if (note) {
		payload.note = note
	}
	if (selector) {
		payload.selector = selector
	}
	if (element) {
		const elementInfo = getElementInfo(element)
		if (elementInfo) {
			payload.element = elementInfo
		}
	}

	// Send marker to background script
	chrome.runtime.sendMessage({
		type: 'createMarker',
		payload,
	})

	// Cleanup
	removeOverlay()
	startPoint = null
}

/**
 * Handle key down - escape exits marker mode
 */
function handleKeyDown(event: KeyboardEvent): void {
	if (!markerMode) return

	if (event.key === 'Escape') {
		disableMarkerMode()
		// Notify popup that marker mode was cancelled
		chrome.runtime.sendMessage({ type: 'markerModeCancelled' })
	}
}

/**
 * Enable marker mode
 */
function enableMarkerMode(): void {
	if (markerMode) return

	markerMode = true
	document.body.style.cursor = 'crosshair'
	showModeIndicator()

	document.addEventListener('mousedown', handleMouseDown, true)
	document.addEventListener('mousemove', handleMouseMove, true)
	document.addEventListener('mouseup', handleMouseUp, true)
	document.addEventListener('keydown', handleKeyDown, true)
}

/**
 * Disable marker mode
 */
function disableMarkerMode(): void {
	if (!markerMode) return

	markerMode = false
	document.body.style.cursor = ''
	hideModeIndicator()
	removeOverlay()
	startPoint = null

	document.removeEventListener('mousedown', handleMouseDown, true)
	document.removeEventListener('mousemove', handleMouseMove, true)
	document.removeEventListener('mouseup', handleMouseUp, true)
	document.removeEventListener('keydown', handleKeyDown, true)
}

/**
 * Resolve element from ref or selector
 */
function resolveElement(action: ActionPayload): {
	element: Element | null
	error?: string
} {
	if (action.ref) {
		const element = document.querySelector(
			`[data-navigator-ref="${action.ref}"]`,
		)
		if (!element) {
			return {
				element: null,
				error: `Element not found for ref: ${action.ref}`,
			}
		}
		return { element }
	}

	if (action.selector) {
		const element = document.querySelector(action.selector)
		if (!element) {
			return {
				element: null,
				error: `Element not found for selector: ${action.selector}`,
			}
		}
		return { element }
	}

	return { element: null, error: 'No ref or selector provided' }
}

/**
 * Execute a click action
 */
function executeClick(action: ActionPayload): ActionResult {
	const { element, error } = resolveElement(action)
	if (!element) {
		return { success: false, error: error ?? 'Element not found' }
	}

	element.dispatchEvent(
		new MouseEvent('click', { bubbles: true, cancelable: true }),
	)
	return { success: true }
}

/**
 * Execute a type action
 */
function executeType(action: ActionPayload): ActionResult {
	const { element, error } = resolveElement(action)
	if (!element) {
		return { success: false, error: error ?? 'Element not found' }
	}

	if (!('value' in element)) {
		return { success: false, error: 'Element is not an input' }
	}

	const input = element as HTMLInputElement | HTMLTextAreaElement

	if (action.clear) {
		input.value = ''
	}

	input.value = action.text ?? ''
	input.dispatchEvent(new Event('input', { bubbles: true }))
	input.dispatchEvent(new Event('change', { bubbles: true }))

	return { success: true }
}

/**
 * Execute a select action
 */
function executeSelect(action: ActionPayload): ActionResult {
	const { element, error } = resolveElement(action)
	if (!element) {
		return { success: false, error: error ?? 'Element not found' }
	}

	if (!(element instanceof HTMLSelectElement)) {
		return { success: false, error: 'Element is not a select' }
	}

	element.value = action.value ?? ''
	element.dispatchEvent(new Event('change', { bubbles: true }))

	return { success: true }
}

/**
 * Execute a hover action
 */
function executeHover(action: ActionPayload): ActionResult {
	const { element, error } = resolveElement(action)
	if (!element) {
		return { success: false, error: error ?? 'Element not found' }
	}

	element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
	element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

	return { success: true }
}

/**
 * Execute a scroll action
 */
function executeScroll(action: ActionPayload): ActionResult {
	if (action.selector || action.ref) {
		const { element, error } = resolveElement(action)
		if (!element) {
			return { success: false, error: error ?? 'Element not found' }
		}
		element.scrollBy(action.x || 0, action.y || 0)
	} else {
		window.scrollBy(action.x || 0, action.y || 0)
	}

	return { success: true }
}

/**
 * Execute a focus action
 */
function executeFocus(action: ActionPayload): ActionResult {
	const { element, error } = resolveElement(action)
	if (!element) {
		return { success: false, error: error ?? 'Element not found' }
	}

	if (element instanceof HTMLElement) {
		element.focus()
	}

	return { success: true }
}

/**
 * Handle action execution from server (Paired mode)
 */
function handleAction(action: ActionPayload): ActionResult {
	try {
		switch (action.action) {
			case 'click':
				return executeClick(action)
			case 'type':
				return executeType(action)
			case 'select':
				return executeSelect(action)
			case 'hover':
				return executeHover(action)
			case 'scroll':
				return executeScroll(action)
			case 'focus':
				return executeFocus(action)
			default:
				return { success: false, error: `Unsupported action: ${action.action}` }
		}
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error',
		}
	}
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener(
	(
		message: {
			type: string
			enabled?: boolean
			action?: ActionPayload
			pairedMode?: boolean
		},
		_sender,
		sendResponse,
	) => {
		switch (message.type) {
			case 'navigator:enableMarkerMode':
				enableMarkerMode()
				sendResponse({ success: true })
				break

			case 'navigator:disableMarkerMode':
				disableMarkerMode()
				sendResponse({ success: true })
				break

			case 'navigator:execute':
				if (message.action) {
					const result = handleAction(message.action)
					sendResponse(result)
				} else {
					sendResponse({ success: false, error: 'No action provided' })
				}
				break

			case 'navigator:getStatus':
				sendResponse({ markerMode, viewport: getViewport() })
				break

			case 'navigator:getViewport':
				sendResponse({ viewport: getViewport() })
				break

			case 'navigator:enablePairedMode':
				enableUserActionListeners()
				sendResponse({ success: true })
				break

			case 'navigator:disablePairedMode':
				disableUserActionListeners()
				sendResponse({ success: true })
				break

			case 'navigator:pairedModeStatus':
				if (message.pairedMode) {
					enableUserActionListeners()
				} else {
					disableUserActionListeners()
				}
				sendResponse({ success: true })
				break
		}

		return true // Keep channel open for async response
	},
)

// ============================================================================
// Initialization
// ============================================================================

// Set up resize listener for viewport reporting
window.addEventListener('resize', handleResize)

// Report initial viewport on load
reportViewport()

// Listen for navigation events (popstate for SPA navigation)
window.addEventListener('popstate', () => {
	sendUserActionEvent({
		type: 'userAction',
		action: 'navigate',
		url: window.location.href,
		timestamp: new Date().toISOString(),
	})
})

// Log content script initialization
console.log('[Navigator] Content script loaded')
