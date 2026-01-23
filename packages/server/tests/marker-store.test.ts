/**
 * Marker Store Tests
 *
 * Tests for the MarkerStore including the new element-aware marker features.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Geometry, MarkerCreateInput } from '@outfitter/navigator-core'
import { MarkerStore } from '../src/markers/store'

describe('MarkerStore', () => {
	let testDir: string
	let sessionId: string
	let store: MarkerStore

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), 'marker-store-test-'))
		sessionId = randomUUID()
		store = new MarkerStore(testDir, sessionId)
	})

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('create', () => {
		test('creates a marker with point geometry', async () => {
			const geometry: Geometry = { type: 'point', x: 100, y: 200 }
			const input: MarkerCreateInput = {
				url: 'https://example.com',
				title: 'Test Page',
				geometry,
				note: 'Test marker',
			}

			const marker = await store.create(input)

			expect(marker.id).toBeDefined()
			expect(marker.url).toBe('https://example.com')
			expect(marker.title).toBe('Test Page')
			expect(marker.geometry).toEqual(geometry)
			expect(marker.note).toBe('Test marker')
		})

		test('creates a marker with region geometry', async () => {
			const geometry: Geometry = {
				type: 'region',
				x: 100,
				y: 200,
				width: 300,
				height: 150,
			}
			const input: MarkerCreateInput = {
				url: 'https://example.com',
				title: 'Test Page',
				geometry,
			}

			const marker = await store.create(input)

			expect(marker.geometry).toEqual(geometry)
		})

		test('creates a marker with tags', async () => {
			const input: MarkerCreateInput = {
				url: 'https://example.com',
				title: 'Test Page',
				geometry: { type: 'point', x: 100, y: 200 },
				tags: ['responsive-test', 'v1.2.0'],
			}

			const marker = await store.create(input)

			expect(marker.tags).toEqual(['responsive-test', 'v1.2.0'])
		})

		test('creates a marker with sourceRef', async () => {
			const input: MarkerCreateInput = {
				url: 'https://example.com',
				title: 'Test Page',
				geometry: { type: 'point', x: 100, y: 200 },
				sourceRef: 'e5',
			}

			const marker = await store.create(input)

			expect(marker.sourceRef).toBe('e5')
		})

		test('creates a marker with element metadata', async () => {
			const input: MarkerCreateInput = {
				url: 'https://example.com',
				title: 'Test Page',
				geometry: { type: 'region', x: 0, y: 0, width: 100, height: 50 },
				element: {
					selector: '#submit-btn',
					elementName: "button 'Submit'",
					accessibility: {
						role: 'button',
						ariaLabel: 'Submit form',
					},
					identity: {
						testId: 'submit-button',
						roleAndName: 'button:Submit form',
						selector: '#submit-btn',
					},
				},
			}

			const marker = await store.create(input)

			expect(marker.element?.selector).toBe('#submit-btn')
			expect(marker.element?.identity?.testId).toBe('submit-button')
			expect(marker.element?.identity?.roleAndName).toBe('button:Submit form')
		})
	})

	describe('list with filters', () => {
		beforeEach(async () => {
			// Create test markers
			await store.create({
				url: 'https://example.com/page1',
				title: 'Page 1',
				geometry: { type: 'point', x: 0, y: 0 },
				tags: ['responsive', 'v1'],
				element: {
					selector: 'button',
					elementName: 'button',
					accessibility: { role: 'button' },
				},
			})
			await store.create({
				url: 'https://example.com/page2',
				title: 'Page 2',
				geometry: { type: 'point', x: 100, y: 100 },
				tags: ['responsive', 'v2'],
				element: {
					selector: 'a',
					elementName: 'link',
					accessibility: { role: 'link' },
				},
			})
			await store.create({
				url: 'https://other.com',
				title: 'Other',
				geometry: { type: 'point', x: 200, y: 200 },
				tags: ['v1'],
			})
		})

		test('lists all markers without filters', async () => {
			const markers = await store.list()
			expect(markers).toHaveLength(3)
		})

		test('filters by single tag', async () => {
			const markers = await store.list(undefined, { tags: ['responsive'] })
			expect(markers).toHaveLength(2)
		})

		test('filters by multiple tags (AND logic)', async () => {
			const markers = await store.list(undefined, { tags: ['responsive', 'v1'] })
			expect(markers).toHaveLength(1)
			expect(markers[0].url).toBe('https://example.com/page1')
		})

		test('filters by URL (partial match)', async () => {
			const markers = await store.list(undefined, { url: 'example.com' })
			expect(markers).toHaveLength(2)
		})

		test('filters by element role', async () => {
			const markers = await store.list(undefined, { role: 'button' })
			expect(markers).toHaveLength(1)
			expect(markers[0].element?.accessibility?.role).toBe('button')
		})

		test('combines multiple filters', async () => {
			const markers = await store.list(undefined, {
				tags: ['responsive'],
				url: 'page1',
			})
			expect(markers).toHaveLength(1)
		})
	})

	describe('get', () => {
		test('returns null for non-existent marker', async () => {
			const marker = await store.get(randomUUID())
			expect(marker).toBeNull()
		})

		test('retrieves created marker', async () => {
			const created = await store.create({
				url: 'https://example.com',
				title: 'Test',
				geometry: { type: 'point', x: 0, y: 0 },
			})

			const retrieved = await store.get(created.id)

			expect(retrieved).not.toBeNull()
			expect(retrieved?.id).toBe(created.id)
		})
	})

	describe('delete', () => {
		test('deletes a marker', async () => {
			const marker = await store.create({
				url: 'https://example.com',
				title: 'Test',
				geometry: { type: 'point', x: 0, y: 0 },
			})

			const deleted = await store.delete(marker.id)
			expect(deleted).toBe(true)

			const retrieved = await store.get(marker.id)
			expect(retrieved).toBeNull()
		})

		test('returns false for non-existent marker', async () => {
			const deleted = await store.delete(randomUUID())
			expect(deleted).toBe(false)
		})
	})

	describe('count', () => {
		test('returns 0 for empty store', async () => {
			const count = await store.count()
			expect(count).toBe(0)
		})

		test('returns correct count after creating markers', async () => {
			await store.create({
				url: 'https://example.com',
				title: 'Test 1',
				geometry: { type: 'point', x: 0, y: 0 },
			})
			await store.create({
				url: 'https://example.com',
				title: 'Test 2',
				geometry: { type: 'point', x: 100, y: 100 },
			})

			const count = await store.count()
			expect(count).toBe(2)
		})
	})
})
