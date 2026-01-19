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
	mark.command('save')
		.description('Create marker at coordinates')
		.option('-x <number>', 'X coordinate')
		.option('-y <number>', 'Y coordinate')
		.option('-w, --width <number>', 'Width (for region)')
		.option('-h, --height <number>', 'Height (for region)')
		.option('-n, --note <text>', 'Note for marker')
		.action(async (options) => {
			const client = getClient()

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
			})

			// Server returns marker in data field
			console.log('Created marker:', result.data?.id ?? 'unknown')
		})

	// nav mark list
	mark.command('list')
		.description('List all markers')
		.option('--md', 'Output as markdown')
		.action(async (options) => {
			const client = getClient()
			const result = await client.execute<{
				data?: Marker[]
				extractedContent?: string
			}>({
				action: 'markers',
				format: options.md ? 'markdown' : 'json',
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
	mark.command('get <id>')
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
	mark.command('diff <id1> <id2>')
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

	// nav mark remove <id>
	mark.command('remove <id>')
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
