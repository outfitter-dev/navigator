/**
 * Navigator-Agentation Bridge
 *
 * Thin integration layer that:
 * - Converts Agentation annotations to Navigator markers
 * - Routes storage to Navigator's marker API (not localStorage)
 * - Preserves both element-aware and geometry-based annotations
 */

import type { ElementMetadata, Geometry } from '@outfitter/navigator-core'
import type { Annotation } from 'agentation'
import {
	type NavigatorMarkerPayload,
	parseAccessibility,
	parseComputedStyles,
	toBoundingBox,
} from './types'

/**
 * Convert an Agentation annotation to a Navigator marker payload.
 *
 * Agentation provides rich element metadata; we preserve it all
 * while maintaining Navigator's geometry-based structure.
 */
export function annotationToMarker(
	annotation: Annotation,
	options: {
		url?: string
		title?: string
	} = {},
): NavigatorMarkerPayload {
	const { url = window.location.href, title = document.title } = options

	// Determine geometry type based on annotation properties
	const geometry = deriveGeometry(annotation)

	// Build element metadata from Agentation's rich context
	const element = buildElementMetadata(annotation)

	const payload: NavigatorMarkerPayload = {
		geometry,
		url,
		title,
		viewport: captureViewport(),
		element,
	}

	// Only add note if it has content (exactOptionalPropertyTypes)
	if (annotation.comment) {
		payload.note = annotation.comment
	}

	return payload
}

/**
 * Derive Navigator geometry from Agentation annotation.
 *
 * - If boundingBox exists → region geometry
 * - Otherwise → point geometry at (x, y)
 */
function deriveGeometry(annotation: Annotation): Geometry {
	if (annotation.boundingBox) {
		return {
			type: 'region',
			x: annotation.boundingBox.x,
			y: annotation.boundingBox.y,
			width: annotation.boundingBox.width,
			height: annotation.boundingBox.height,
		}
	}

	return {
		type: 'point',
		x: annotation.x,
		y: annotation.y,
	}
}

/**
 * Build Navigator element metadata from Agentation annotation.
 */
function buildElementMetadata(annotation: Annotation): ElementMetadata {
	return {
		selector: annotation.elementPath,
		elementName: annotation.element,
		fullPath: annotation.fullPath,
		selectedText: annotation.selectedText,
		boundingBox: toBoundingBox(annotation.boundingBox),
		cssClasses: annotation.cssClasses,
		accessibility: parseAccessibility(annotation.accessibility),
		computedStyles: parseComputedStyles(annotation.computedStyles),
	}
}

/**
 * Capture current viewport state for marker context.
 */
function captureViewport() {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
		scrollX: window.scrollX,
		scrollY: window.scrollY,
		devicePixelRatio: window.devicePixelRatio,
	}
}

/**
 * Generate Navigator-style element ref from index.
 */
export function indexToRef(index: number, prefix = 'e'): string {
	return `${prefix}${index}`
}

/**
 * Format annotations as Navigator-compatible markdown output.
 *
 * Enhances Agentation's default markdown with Navigator refs.
 */
export function formatAnnotationsMarkdown(
	annotations: Annotation[],
	options: {
		refPrefix?: string
		startIndex?: number
		includeAccessibility?: boolean
	} = {},
): string {
	const {
		refPrefix = 'e',
		startIndex = 1,
		includeAccessibility = true,
	} = options

	if (annotations.length === 0) {
		return ''
	}

	const lines: string[] = ['## Annotations', '']

	annotations.forEach((annotation, i) => {
		const ref = indexToRef(startIndex + i, refPrefix)
		const elementDesc = annotation.element || 'element'

		lines.push(`### ${ref}: ${elementDesc}`)
		lines.push('')

		// Selector for agent use
		lines.push(`**Selector:** \`${annotation.elementPath}\``)

		// Comment/note
		if (annotation.comment) {
			lines.push(`**Note:** ${annotation.comment}`)
		}

		// Selected text
		if (annotation.selectedText) {
			lines.push(`**Selected text:** "${annotation.selectedText}"`)
		}

		// Position
		if (annotation.boundingBox) {
			const { x, y, width, height } = annotation.boundingBox
			lines.push(`**Bounds:** (${x}, ${y}) ${width}×${height}`)
		} else {
			lines.push(`**Position:** (${annotation.x}, ${annotation.y})`)
		}

		// Accessibility (optional)
		if (includeAccessibility && annotation.accessibility) {
			lines.push(`**Accessibility:** ${annotation.accessibility}`)
		}

		// CSS classes
		if (annotation.cssClasses) {
			lines.push(`**Classes:** \`${annotation.cssClasses}\``)
		}

		lines.push('')
	})

	return lines.join('\n')
}

/**
 * State manager for annotation ↔ ref mapping.
 *
 * Tracks which annotations correspond to which Navigator refs,
 * enabling consistent ref numbering across the session.
 */
export class AnnotationRefManager {
	private annotationToRef = new Map<string, string>()
	private refToAnnotation = new Map<string, string>()
	private nextIndex: number

	constructor(
		private prefix = 'e',
		startIndex = 1,
	) {
		this.nextIndex = startIndex
	}

	/**
	 * Register an annotation and get its ref.
	 */
	register(annotationId: string): string {
		const existing = this.annotationToRef.get(annotationId)
		if (existing) return existing

		const ref = indexToRef(this.nextIndex++, this.prefix)
		this.annotationToRef.set(annotationId, ref)
		this.refToAnnotation.set(ref, annotationId)
		return ref
	}

	/**
	 * Get the ref for an annotation.
	 */
	getRef(annotationId: string): string | undefined {
		return this.annotationToRef.get(annotationId)
	}

	/**
	 * Get the annotation ID for a ref.
	 */
	getAnnotationId(ref: string): string | undefined {
		return this.refToAnnotation.get(ref)
	}

	/**
	 * Remove an annotation from tracking.
	 */
	unregister(annotationId: string): void {
		const ref = this.annotationToRef.get(annotationId)
		if (ref) {
			this.annotationToRef.delete(annotationId)
			this.refToAnnotation.delete(ref)
		}
	}

	/**
	 * Clear all mappings.
	 */
	clear(): void {
		this.annotationToRef.clear()
		this.refToAnnotation.clear()
		this.nextIndex = 1
	}

	/**
	 * Get current ref count.
	 */
	get count(): number {
		return this.annotationToRef.size
	}
}
