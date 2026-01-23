/**
 * Agentation Content Script
 *
 * Mounts the Agentation annotation component into web pages.
 * Bridges Agentation's callbacks to Navigator's marker system.
 */

import type { Annotation } from 'agentation'
import { createRoot } from 'react-dom/client'
import {
	Agentation,
	AnnotationRefManager,
	annotationToMarker,
	formatAnnotationsMarkdown,
} from '../lib/agentation'

// State
let root: ReturnType<typeof createRoot> | null = null
let mountPoint: HTMLDivElement | null = null
let refManager: AnnotationRefManager | null = null
let annotations: Annotation[] = []
let agentationEnabled = false

/**
 * Mount the Agentation component into the page
 */
function mountAgentation(): void {
	if (mountPoint) return

	// Create mount point
	mountPoint = document.createElement('div')
	mountPoint.id = 'navigator-agentation-root'
	mountPoint.setAttribute('data-navigator-overlay', 'agentation')
	document.body.appendChild(mountPoint)

	// Initialize ref manager
	refManager = new AnnotationRefManager('e', 1)

	// Create React root and render
	root = createRoot(mountPoint)
	renderAgentation()

	agentationEnabled = true
	console.log('[Navigator] Agentation mounted')
}

/**
 * Unmount the Agentation component
 */
function unmountAgentation(): void {
	if (!mountPoint || !root) return

	root.unmount()
	mountPoint.remove()

	root = null
	mountPoint = null
	refManager = null
	annotations = []
	agentationEnabled = false

	console.log('[Navigator] Agentation unmounted')
}

/**
 * Render/re-render the Agentation component
 */
function renderAgentation(): void {
	if (!root) return

	root.render(
		<Agentation
			copyToClipboard={true}
			onAnnotationAdd={handleAnnotationAdd}
			onAnnotationDelete={handleAnnotationDelete}
			onAnnotationUpdate={handleAnnotationUpdate}
			onAnnotationsClear={handleAnnotationsClear}
			onCopy={handleCopy}
		/>,
	)
}

/**
 * Handle new annotation from Agentation
 */
function handleAnnotationAdd(annotation: Annotation): void {
	annotations.push(annotation)

	// Register with ref manager
	const ref = refManager?.register(annotation.id)

	// Convert to Navigator marker and send to background
	const marker = annotationToMarker(annotation)

	chrome.runtime
		.sendMessage({
			type: 'createMarker',
			payload: {
				...marker,
				// Include Navigator-specific metadata
				metadata: {
					agentationId: annotation.id,
					ref,
				},
			},
		})
		.catch(() => {
			// Ignore errors when no listeners
		})

	console.log(`[Navigator] Annotation added: ${ref}`, annotation.element)
}

/**
 * Handle annotation deletion
 */
function handleAnnotationDelete(annotation: Annotation): void {
	const index = annotations.findIndex((a) => a.id === annotation.id)
	if (index >= 0) {
		annotations.splice(index, 1)
	}

	const ref = refManager?.getRef(annotation.id)
	refManager?.unregister(annotation.id)

	chrome.runtime
		.sendMessage({
			type: 'deleteMarker',
			agentationId: annotation.id,
			ref,
		})
		.catch(() => {
			// Ignore errors when no listeners
		})

	console.log(`[Navigator] Annotation deleted: ${ref}`)
}

/**
 * Handle annotation update (comment edited)
 */
function handleAnnotationUpdate(annotation: Annotation): void {
	const index = annotations.findIndex((a) => a.id === annotation.id)
	if (index >= 0) {
		annotations[index] = annotation
	}

	const ref = refManager?.getRef(annotation.id)
	const marker = annotationToMarker(annotation)

	chrome.runtime
		.sendMessage({
			type: 'updateMarker',
			agentationId: annotation.id,
			ref,
			payload: marker,
		})
		.catch(() => {
			// Ignore errors when no listeners
		})

	console.log(`[Navigator] Annotation updated: ${ref}`)
}

/**
 * Handle all annotations cleared
 */
function handleAnnotationsClear(clearedAnnotations: Annotation[]): void {
	annotations = []
	refManager?.clear()

	chrome.runtime
		.sendMessage({
			type: 'clearMarkers',
			count: clearedAnnotations.length,
		})
		.catch(() => {
			// Ignore errors when no listeners
		})

	console.log(
		`[Navigator] All annotations cleared (${clearedAnnotations.length})`,
	)
}

/**
 * Handle copy to clipboard
 * Generate Navigator-enhanced markdown
 */
function handleCopy(_originalMarkdown: string): void {
	// Generate Navigator-style markdown with refs
	const navigatorMarkdown = formatAnnotationsMarkdown(annotations, {
		refPrefix: 'e',
		startIndex: 1,
		includeAccessibility: true,
	})

	// Copy Navigator's enhanced version
	navigator.clipboard.writeText(navigatorMarkdown).catch((err) => {
		console.error('[Navigator] Failed to copy markdown:', err)
	})

	console.log('[Navigator] Annotations copied to clipboard')
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener(
	(
		message: {
			type: string
		},
		_sender,
		sendResponse,
	) => {
		switch (message.type) {
			case 'navigator:enableAgentation':
				mountAgentation()
				sendResponse({ success: true })
				break

			case 'navigator:disableAgentation':
				unmountAgentation()
				sendResponse({ success: true })
				break

			case 'navigator:getAgentationStatus':
				sendResponse({
					enabled: agentationEnabled,
					annotationCount: annotations.length,
				})
				break

			case 'navigator:getAnnotations':
				sendResponse({
					annotations: annotations.map((a) => ({
						...a,
						ref: refManager?.getRef(a.id),
					})),
				})
				break
		}

		return true
	},
)

// Log content script initialization
console.log('[Navigator] Agentation content script loaded')
