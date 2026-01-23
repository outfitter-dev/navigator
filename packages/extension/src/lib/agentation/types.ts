/**
 * Navigator-specific types for Agentation integration.
 *
 * Extends Agentation's types with Navigator-specific fields and
 * provides conversion utilities.
 */

import type {
	AccessibilityInfo,
	BoundingBox,
	ElementMetadata,
	Geometry,
	MarkerViewport,
} from '@outfitter/navigator-core'
import type { Annotation } from 'agentation'

/**
 * Navigator marker creation payload from the extension.
 * Includes both geometry and element metadata.
 */
export interface NavigatorMarkerPayload {
	geometry: Geometry
	note?: string
	url: string
	title: string
	viewport?: MarkerViewport
	element?: ElementMetadata
}

/**
 * Agentation annotation with Navigator extensions.
 */
export interface NavigatorAnnotation extends Annotation {
	/** Navigator element ref (e.g., "e42") */
	ref?: string
	/** Ref index for ordering */
	refIndex?: number
}

/**
 * Props for the Navigator-wrapped Agentation component.
 */
export interface NavigatorAgentationProps {
	/** Current session ID for marker association */
	sessionId: string
	/** Callback when a marker is created */
	onMarkerCreate?: (marker: NavigatorMarkerPayload) => void
	/** Callback when a marker is deleted */
	onMarkerDelete?: (markerId: string) => void
	/** Callback when markers are cleared */
	onMarkersClear?: () => void
	/** Callback when annotation markdown is copied */
	onCopy?: (markdown: string) => void
	/** Whether to copy to clipboard (default: true) */
	copyToClipboard?: boolean
	/** Prefix for element refs (default: "e") */
	refPrefix?: string
	/** Starting ref index (default: 1) */
	startRefIndex?: number
	/** Enable demo mode with pre-set annotations */
	enableDemoMode?: boolean
}

/**
 * Parse Agentation's accessibility string back to structured object.
 * Agentation stringifies accessibility info; we parse it back.
 */
export function parseAccessibility(
	accessibilityStr?: string,
): AccessibilityInfo | undefined {
	if (!accessibilityStr) return undefined

	const info: AccessibilityInfo = {}

	// Parse "role: button, aria-label: Submit, focusable: true" format
	const parts = accessibilityStr.split(',').map((s) => s.trim())
	for (const part of parts) {
		const [key, ...valueParts] = part.split(':')
		const value = valueParts.join(':').trim()

		switch (key?.trim().toLowerCase()) {
			case 'role':
				info.role = value
				break
			case 'aria-label':
				info.ariaLabel = value
				break
			case 'aria-describedby':
				info.ariaDescribedBy = value
				break
			case 'tabindex':
				info.tabIndex = Number.parseInt(value, 10) || undefined
				break
			case 'aria-hidden':
				info.ariaHidden = value === 'true'
				break
			case 'focusable':
				info.focusable = value === 'true'
				break
		}
	}

	return Object.keys(info).length > 0 ? info : undefined
}

/**
 * Parse Agentation's computed styles string to record.
 */
export function parseComputedStyles(
	stylesStr?: string,
): Record<string, string> | undefined {
	if (!stylesStr) return undefined

	const styles: Record<string, string> = {}
	const parts = stylesStr.split(',').map((s) => s.trim())

	for (const part of parts) {
		const colonIdx = part.indexOf(':')
		if (colonIdx > 0) {
			const key = part.slice(0, colonIdx).trim()
			const value = part.slice(colonIdx + 1).trim()
			if (key && value) {
				styles[key] = value
			}
		}
	}

	return Object.keys(styles).length > 0 ? styles : undefined
}

/**
 * Convert Agentation bounding box to Navigator format.
 */
export function toBoundingBox(
	box?: Annotation['boundingBox'],
): BoundingBox | undefined {
	if (!box) return undefined

	return {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		top: box.y,
		right: box.x + box.width,
		bottom: box.y + box.height,
		left: box.x,
	}
}
