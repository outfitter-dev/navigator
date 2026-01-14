/**
 * Clipboard utilities for Navigator extension
 */

interface MarkerGeometry {
	type: 'point' | 'region'
	x: number
	y: number
	width?: number
	height?: number
}

interface Marker {
	id: string
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

/**
 * Format markers as markdown for clipboard
 */
export function formatMarkersAsMarkdown(markers: Marker[]): string {
	if (markers.length === 0) {
		return ''
	}

	const lines: string[] = ['# Navigator Markers', '']

	for (const marker of markers) {
		const geoStr = formatGeometry(marker.geometry)

		// Header with note or geometry
		if (marker.note) {
			lines.push(`## ${marker.note}`)
			lines.push(`- Geometry: ${geoStr}`)
		} else {
			lines.push(`## ${geoStr}`)
		}

		// Page info
		lines.push(`- Page: ${marker.title}`)
		lines.push(`- URL: ${marker.url}`)

		// Element info if available
		if (marker.selector) {
			lines.push(`- Selector: \`${marker.selector}\``)
		}

		if (marker.element) {
			const el = marker.element
			let elementDesc = `<${el.tagName}`
			if (el.id) elementDesc += ` id="${el.id}"`
			if (el.className) elementDesc += ` class="${el.className}"`
			elementDesc += '>'
			lines.push(`- Element: \`${elementDesc}\``)

			if (el.text) {
				lines.push(
					`- Text: "${el.text.slice(0, 50)}${el.text.length > 50 ? '...' : ''}"`,
				)
			}
		}

		lines.push('')
	}

	return lines.join('\n')
}

/**
 * Format geometry for display
 */
function formatGeometry(geometry: MarkerGeometry): string {
	if (geometry.type === 'point') {
		return `Point at (${Math.round(geometry.x)}, ${Math.round(geometry.y)})`
	}

	return `Region at (${Math.round(geometry.x)}, ${Math.round(geometry.y)}) - ${Math.round(geometry.width ?? 0)}x${Math.round(geometry.height ?? 0)}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		// Fallback for older browsers or restricted contexts
		const textarea = document.createElement('textarea')
		textarea.value = text
		textarea.style.position = 'fixed'
		textarea.style.opacity = '0'
		document.body.appendChild(textarea)
		textarea.select()

		try {
			document.execCommand('copy')
			return true
		} catch {
			return false
		} finally {
			document.body.removeChild(textarea)
		}
	}
}

/**
 * Copy markers to clipboard as markdown
 */
export async function copyMarkersToClipboard(
	markers: Marker[],
): Promise<boolean> {
	const markdown = formatMarkersAsMarkdown(markers)
	return copyToClipboard(markdown)
}
