/**
 * Marker Markdown Export
 *
 * Converts markers to markdown format for sharing with AI agents.
 *
 * @module markers/markdown
 */

import type { Marker } from '@outfitter/navigator-core'

/**
 * Convert multiple markers to markdown.
 *
 * @param markers - Array of markers
 * @returns Markdown string
 */
export function markersToMarkdown(markers: Marker[]): string {
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

		if (marker.screenshot) {
			lines.push('')
			if (marker.screenshot.startsWith('data:')) {
				lines.push(`![Marker screenshot](${marker.screenshot})`)
			} else {
				lines.push(`_Screenshot saved: ${marker.screenshot}_`)
			}
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
 * @param marker - Marker to convert
 * @returns Markdown string
 */
export function markerToMarkdown(marker: Marker): string {
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
