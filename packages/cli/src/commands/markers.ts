/**
 * Marker Commands
 *
 * nav mark save|list|get|diff|remove
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

interface Marker {
	id: string
	geometry: {
		type: string
		x: number
		y: number
		width?: number
		height?: number
	}
	note?: string
	url?: string
	tags?: string[]
	sourceRef?: string
	element?: {
		selector?: string
		elementName?: string
		identity?: {
			testId?: string
			roleAndName?: string
			selector?: string
			textContent?: string
		}
	}
	createdAt?: string
}

/**
 * Format marker coordinates as a string.
 */
function formatMarkerCoords(geo: Marker['geometry']): string {
	if (geo.type === 'region') {
		return `${geo.x},${geo.y} ${geo.width}x${geo.height}`
	}
	return `${geo.x},${geo.y}`
}

/**
 * Print markers list in table format.
 */
function printMarkersTable(markers: Marker[]): void {
	if (markers.length === 0) {
		console.log('No markers found')
		return
	}

	console.log('Markers:')
	for (const marker of markers) {
		const coords = formatMarkerCoords(marker.geometry)
		console.log(
			`  ${marker.id.slice(0, 8)} [${marker.geometry.type}] ${coords}`,
		)
		if (marker.note) {
			console.log(`    Note: ${marker.note}`)
		}
	}
}

export function registerMarkerCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	const mark = program.command('mark').description('Marker management')

	// nav mark save
	mark
		.command('save')
		.description('Create marker from element ref or coordinates')
		.option('-r, --ref <ref>', 'Element ref from snap (e.g., e5)')
		.option('-x <number>', 'X coordinate')
		.option('-y <number>', 'Y coordinate')
		.option('-w, --width <number>', 'Width (for region)')
		.option('-h, --height <number>', 'Height (for region)')
		.option('-n, --note <text>', 'Note for marker')
		.option('-t, --tags <tags>', 'Comma-separated tags')
		.action(async (options) => {
			const client = getClient()

			// Parse tags if provided
			const tags = options.tags
				? options.tags.split(',').map((t: string) => t.trim())
				: undefined

			// If ref is provided, use ref-based marker creation
			if (options.ref) {
				const result = await client.execute<{ data?: Marker }>({
					action: 'marker',
					ref: options.ref,
					note: options.note,
					tags,
				})

				const marker = result.data
				console.log('Created marker:', marker?.id ?? 'unknown')
				if (marker?.element?.elementName) {
					console.log('  Element:', marker.element.elementName)
				}
				if (marker?.geometry) {
					console.log(
						'  Region:',
						`${marker.geometry.x},${marker.geometry.y} ${marker.geometry.width}x${marker.geometry.height}`,
					)
				}
				return
			}

			// Otherwise use coordinate-based marker creation
			const x = options.x ? Number(options.x) : 0
			const y = options.y ? Number(options.y) : 0

			const hasRegion =
				options.width !== undefined && options.height !== undefined

			const geometry = hasRegion
				? {
						type: 'region' as const,
						x,
						y,
						width: Number(options.width),
						height: Number(options.height),
					}
				: { type: 'point' as const, x, y }

			const result = await client.execute<{ data?: Marker }>({
				action: 'marker',
				geometry,
				note: options.note,
				tags,
			})

			// Server returns marker in data field
			console.log('Created marker:', result.data?.id ?? 'unknown')
		})

	// nav mark list
	mark
		.command('list')
		.description('List all markers')
		.option('--md', 'Output as markdown')
		.option('-t, --tags <tags>', 'Filter by comma-separated tags')
		.option('-u, --url <pattern>', 'Filter by URL pattern')
		.option('-r, --role <role>', 'Filter by element role')
		.action(async (options) => {
			const client = getClient()

			// Build filter options
			const tags = options.tags
				? options.tags.split(',').map((t: string) => t.trim())
				: undefined

			const result = await client.execute<{
				data?: Marker[]
				extractedContent?: string
			}>({
				action: 'markers',
				format: options.md ? 'markdown' : 'json',
				tags,
				url: options.url,
				role: options.role,
			})

			if (options.md) {
				// Server returns markdown in extractedContent
				console.log(result.extractedContent ?? 'No markers')
			} else {
				// Server returns markers in data field
				printMarkersTable(result.data ?? [])
			}
		})

	// nav mark get <id>
	mark
		.command('get <id>')
		.description('Get marker details')
		.action(async (id: string) => {
			const client = getClient()
			const result = await client.execute<{ data?: Marker }>({
				action: 'markerGet',
				id,
			})

			// Server returns marker in data field
			console.log(JSON.stringify(result.data, null, 2))
		})

	// nav mark diff <id1> <id2>
	mark
		.command('diff <id1> <id2>')
		.description('Compare two markers')
		.action(async (id1: string, id2: string) => {
			const client = getClient()
			const result = await client.execute({
				action: 'markerCompare',
				id1,
				id2,
			})

			console.log(JSON.stringify(result, null, 2))
		})

	// nav mark resolve <id>
	mark
		.command('resolve <id>')
		.description('Re-find a marked element on current page')
		.action(async (id: string) => {
			const client = getClient()
			const result = await client.execute<{
				data?: {
					found: boolean
					ref?: string
					confidence?: string
					method?: string
				}
			}>({
				action: 'markerResolve',
				id,
			})

			const data = result.data
			if (data?.found) {
				console.log(`Found element: ${data.ref}`)
				console.log(`  Confidence: ${data.confidence}`)
				console.log(`  Method: ${data.method}`)
			} else {
				console.log('Element not found on current page')
			}
		})

	// nav mark remove <id>
	mark
		.command('remove <id>')
		.description('Delete a marker')
		.action(async (id: string) => {
			const client = getClient()
			await client.execute({
				action: 'markerDelete',
				id,
			})

			console.log('Deleted marker:', id)
		})
}
