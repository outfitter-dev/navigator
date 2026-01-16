/**
 * Marker Store
 *
 * Persists markers to disk within session directories.
 * Screenshots are stored as separate files in a screenshots/ subdirectory.
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
	getMarkerScreenshotPath,
	getMarkerScreenshotsDir,
	getMarkersDir,
} from '@outfitter/navigator-core'
import { CATEGORIES, getLogger } from '@outfitter/navigator-core/logging'

const log = getLogger(CATEGORIES.MARKERS)

/** Options for retrieving markers */
export interface MarkerGetOptions {
	/** If true, load screenshot data as base64 and return in marker.screenshot */
	includeScreenshot?: boolean | undefined
}

/** Marker with optional loaded screenshot data */
export interface MarkerWithScreenshot extends Marker {
	screenshot?: string
}

/**
 * Store for managing markers within a session.
 */
export class MarkerStore {
	private readonly markersDir: string
	private readonly screenshotsDir: string

	constructor(
		private readonly projectRoot: string,
		private readonly sessionId: string,
	) {
		this.markersDir = getMarkersDir(projectRoot, sessionId)
		this.screenshotsDir = getMarkerScreenshotsDir(projectRoot, sessionId)
	}

	/**
	 * Create a new marker.
	 *
	 * If screenshot data (base64) is provided in input, it will be written to a
	 * separate file and the marker will store only the relative path.
	 *
	 * @param input - Marker creation input
	 * @returns Created marker
	 */
	async create(input: MarkerCreateInput): Promise<Marker> {
		const markerId = randomUUID()
		let screenshotPath: string | undefined

		// If screenshot data provided, write to file
		if (input.screenshot) {
			// Ensure screenshots directory exists
			await mkdir(this.screenshotsDir, { recursive: true })

			// Extract base64 data (remove data URL prefix if present)
			const base64Data = input.screenshot.replace(
				/^data:image\/\w+;base64,/,
				'',
			)

			// Write screenshot to file
			const screenshotFilePath = getMarkerScreenshotPath(
				this.projectRoot,
				this.sessionId,
				markerId,
			)
			await writeFile(screenshotFilePath, Buffer.from(base64Data, 'base64'))

			// Store relative path (relative to markers directory)
			screenshotPath = `screenshots/${markerId}.png`

			log.debug`Screenshot saved ${{ markerId, path: screenshotPath }}`
		}

		const marker: Marker = {
			id: markerId,
			sessionId: this.sessionId,
			timestamp: new Date().toISOString(),
			url: input.url,
			title: input.title,
			geometry: input.geometry,
			note: input.note,
			screenshotPath,
			viewport: input.viewport,
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
	 * @param options - Options for retrieval
	 * @returns Marker or null if not found
	 */
	async get(
		markerId: string,
		options?: MarkerGetOptions,
	): Promise<MarkerWithScreenshot | null> {
		const markerPath = getMarkerPath(this.projectRoot, this.sessionId, markerId)
		if (!existsSync(markerPath)) {
			log.debug`Marker not found ${{ id: markerId }}`
			return null
		}
		const raw = await readFile(markerPath, 'utf8')
		const rawJson = JSON.parse(raw) as Record<string, unknown>
		const marker = MarkerSchema.parse(rawJson)

		// Optionally load screenshot data
		if (options?.includeScreenshot) {
			// Check for new separate file storage
			if (marker.screenshotPath) {
				const screenshotData = this.loadScreenshot(markerId)
				if (screenshotData) {
					log.debug`Marker retrieved with screenshot ${{ id: markerId }}`
					return { ...marker, screenshot: screenshotData }
				}
			}
			// Fallback: check for legacy inline screenshot (pre-refactor markers)
			if (typeof rawJson.screenshot === 'string' && rawJson.screenshot.length > 0) {
				log.debug`Marker retrieved with legacy inline screenshot ${{ id: markerId }}`
				return { ...marker, screenshot: rawJson.screenshot }
			}
		}

		log.debug`Marker retrieved ${{ id: markerId }}`
		return marker
	}

	/**
	 * Load screenshot data for a marker.
	 *
	 * @param markerId - Marker UUID
	 * @returns Base64 data URL or null if not found
	 */
	private loadScreenshot(markerId: string): string | null {
		const screenshotPath = getMarkerScreenshotPath(
			this.projectRoot,
			this.sessionId,
			markerId,
		)
		if (!existsSync(screenshotPath)) {
			return null
		}
		try {
			const buffer = readFileSync(screenshotPath)
			return `data:image/png;base64,${buffer.toString('base64')}`
		} catch {
			log.debug`Failed to load screenshot ${{ markerId }}`
			return null
		}
	}

	/**
	 * List all markers in the session.
	 *
	 * @param options - Options for retrieval
	 * @returns Array of markers sorted by timestamp (newest first)
	 */
	async list(options?: MarkerGetOptions): Promise<MarkerWithScreenshot[]> {
		if (!existsSync(this.markersDir)) return []

		const files = readdirSync(this.markersDir).filter((f) =>
			f.endsWith('.json'),
		)
		const markers: MarkerWithScreenshot[] = []

		for (const file of files) {
			try {
				const raw = readFileSync(join(this.markersDir, file), 'utf8')
				const marker = MarkerSchema.parse(JSON.parse(raw))

				// Optionally load screenshot data
				if (options?.includeScreenshot && marker.screenshotPath) {
					const screenshotData = this.loadScreenshot(marker.id)
					if (screenshotData) {
						markers.push({ ...marker, screenshot: screenshotData })
						continue
					}
				}

				markers.push(marker)
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
	 * Delete a marker and its associated screenshot file.
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

		// Delete screenshot file if it exists
		const screenshotPath = getMarkerScreenshotPath(
			this.projectRoot,
			this.sessionId,
			markerId,
		)
		if (existsSync(screenshotPath)) {
			try {
				unlinkSync(screenshotPath)
				log.debug`Screenshot deleted ${{ markerId }}`
			} catch {
				log.debug`Failed to delete screenshot ${{ markerId }}`
			}
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
