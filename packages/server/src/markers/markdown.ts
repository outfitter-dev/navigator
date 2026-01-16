/**
 * Marker Markdown Export
 *
 * Converts markers to markdown format for sharing with AI agents.
 *
 * @module markers/markdown
 */

import type { Marker } from '@outfitter/navigator-core'
import type { MarkerWithScreenshot } from './store'

/**
 * Convert multiple markers to markdown.
 *
 * @param markers - Array of markers (may include loaded screenshot data)
 * @returns Markdown string
 */
export function markersToMarkdown(markers: MarkerWithScreenshot[]): string {
	if (markers.length === 0) {
		return '_No markers_'
	}

	const lines: string[] = ['## Browser Markers', '']

	for (const marker of markers) {
		lines.push(`### ${marker.title}`)
		lines.push('')
		lines.push(`**URL**: ${marker.url}`)
		lines.push(`**Type**: ${marker.geometry.type}`)

		if (marker.geometry.type === 'point') {
			lines.push(`**Position**: (${marker.geometry.x}, ${marker.geometry.y})`)
		} else {
			const { x, y, width, height } = marker.geometry
			lines.push(`**Region**: (${x}, ${y}) - ${width}x${height}`)
		}

		lines.push(`**Time**: ${marker.timestamp}`)

		if (marker.note) {
			lines.push('')
			lines.push(`> ${marker.note}`)
		}

		// Handle loaded screenshot data (base64) or just show path reference
		if (marker.screenshot) {
			// Loaded screenshot data (base64)
			lines.push('')
			lines.push(`![Marker screenshot](${marker.screenshot})`)
		} else if (marker.screenshotPath) {
			// Just the path reference (not loaded)
			lines.push('')
			lines.push(`_Screenshot: ${marker.screenshotPath}_`)
		}

		lines.push('')
		lines.push('---')
		lines.push('')
	}

	return lines.join('\n')
}

/**
 * Convert a single marker to markdown.
 *
 * @param marker - Marker to convert (may include loaded screenshot data)
 * @returns Markdown string
 */
export function markerToMarkdown(marker: MarkerWithScreenshot): string {
	return markersToMarkdown([marker])
}

/**
 * Generate a summary line for a marker.
 *
 * @param marker - Marker to summarize
 * @returns Single-line summary
 */
export function markerSummary(marker: Marker): string {
	const type = marker.geometry.type === 'point' ? 'Point' : 'Region'
	const position =
		marker.geometry.type === 'point'
			? `(${marker.geometry.x}, ${marker.geometry.y})`
			: `(${marker.geometry.x}, ${marker.geometry.y}) ${marker.geometry.width}x${marker.geometry.height}`

	const note = marker.note
		? ` - ${marker.note.slice(0, 50)}${marker.note.length > 50 ? '...' : ''}`
		: ''

	return `[${type}] ${marker.title} @ ${position}${note}`
}
