/**
 * Marker Store
 *
 * Persists markers to disk within session directories.
 *
 * @module markers/store
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
	type Marker,
	type MarkerCreateInput,
	MarkerSchema,
	getMarkerPath,
	getMarkersDir,
} from '@outfitter/navigator-core'
import { CATEGORIES, getLogger } from '@outfitter/navigator-core/logging'

const log = getLogger(CATEGORIES.MARKERS)

/**
 * Store for managing markers within a session.
 */
export class MarkerStore {
	private readonly markersDir: string

	constructor(
		private readonly projectRoot: string,
		private readonly sessionId: string,
	) {
		this.markersDir = getMarkersDir(projectRoot, sessionId)
	}

	/**
	 * Create a new marker.
	 *
	 * @param input - Marker creation input
	 * @returns Created marker
	 */
	async create(input: MarkerCreateInput): Promise<Marker> {
		const marker: Marker = {
			id: randomUUID(),
			sessionId: this.sessionId,
			timestamp: new Date().toISOString(),
			url: input.url,
			title: input.title,
			geometry: input.geometry,
			note: input.note,
			screenshot: input.screenshot,
		}

		// Validate
		MarkerSchema.parse(marker)

		// Ensure directory exists
		await mkdir(this.markersDir, { recursive: true })

		// Write marker file
		const markerPath = getMarkerPath(
			this.projectRoot,
			this.sessionId,
			marker.id,
		)
		await writeFile(markerPath, JSON.stringify(marker, null, 2), 'utf8')

		log.debug`Marker created ${{ id: marker.id, type: marker.geometry.type }}`
		return marker
	}

	/**
	 * Get a marker by ID.
	 *
	 * @param markerId - Marker UUID
	 * @returns Marker or null if not found
	 */
	async get(markerId: string): Promise<Marker | null> {
		const markerPath = getMarkerPath(this.projectRoot, this.sessionId, markerId)
		if (!existsSync(markerPath)) {
			log.debug`Marker not found ${{ id: markerId }}`
			return null
		}
		const raw = await readFile(markerPath, 'utf8')
		log.debug`Marker retrieved ${{ id: markerId }}`
		return MarkerSchema.parse(JSON.parse(raw))
	}

	/**
	 * List all markers in the session.
	 *
	 * @returns Array of markers sorted by timestamp (newest first)
	 */
	async list(): Promise<Marker[]> {
		if (!existsSync(this.markersDir)) return []

		const files = readdirSync(this.markersDir).filter((f) =>
			f.endsWith('.json'),
		)
		const markers: Marker[] = []

		for (const file of files) {
			try {
				const raw = readFileSync(join(this.markersDir, file), 'utf8')
				markers.push(MarkerSchema.parse(JSON.parse(raw)))
			} catch {
				// Skip invalid markers
			}
		}

		// Sort by timestamp (newest first)
		const sorted = markers.sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		)
		log.debug`Markers listed ${{ count: sorted.length }}`
		return sorted
	}

	/**
	 * Update a marker's note.
	 *
	 * @param markerId - Marker UUID
	 * @param updates - Updates to apply
	 * @returns Updated marker or null if not found
	 */
	async update(
		markerId: string,
		updates: { note?: string },
	): Promise<Marker | null> {
		const marker = await this.get(markerId)
		if (!marker) return null

		const updated: Marker = {
			...marker,
			note: updates.note ?? marker.note,
		}

		MarkerSchema.parse(updated)
		const markerPath = getMarkerPath(this.projectRoot, this.sessionId, markerId)
		await writeFile(markerPath, JSON.stringify(updated, null, 2), 'utf8')

		log.debug`Marker updated ${{ id: markerId }}`
		return updated
	}

	/**
	 * Delete a marker.
	 *
	 * @param markerId - Marker UUID
	 * @returns True if deleted, false if not found
	 */
	async delete(markerId: string): Promise<boolean> {
		const markerPath = getMarkerPath(this.projectRoot, this.sessionId, markerId)
		if (!existsSync(markerPath)) {
			log.debug`Marker not found for deletion ${{ id: markerId }}`
			return false
		}
		unlinkSync(markerPath)
		log.debug`Marker deleted ${{ id: markerId }}`
		return true
	}

	/**
	 * Get the count of markers in the session.
	 */
	async count(): Promise<number> {
		if (!existsSync(this.markersDir)) return 0
		return readdirSync(this.markersDir).filter((f) => f.endsWith('.json'))
			.length
	}
}
