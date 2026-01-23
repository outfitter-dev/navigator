/**
 * Marker Actions Schema Tests
 *
 * Tests for the marker action schema including the new element-aware features.
 */

import { describe, expect, test } from 'bun:test'
import { ActionSchema } from '../src/schema/action'

describe('marker action schema', () => {
	describe('marker action', () => {
		test('validates geometry-based marker', () => {
			const action = {
				action: 'marker',
				geometry: { type: 'point', x: 100, y: 200 },
				note: 'Test marker',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates ref-based marker', () => {
			const action = {
				action: 'marker',
				ref: 'e5',
				note: 'Test marker',
				tags: ['responsive', 'v1'],
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates marker with @e prefix', () => {
			const action = {
				action: 'marker',
				ref: '@e42',
				tags: ['test'],
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates marker with versioned ref', () => {
			const action = {
				action: 'marker',
				ref: 'e42_1',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('rejects marker without geometry or ref', () => {
			const action = {
				action: 'marker',
				note: 'Missing target',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(false)
		})

		test('allows both geometry and ref (geometry takes precedence)', () => {
			const action = {
				action: 'marker',
				geometry: { type: 'point', x: 100, y: 200 },
				ref: 'e5',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates region geometry', () => {
			const action = {
				action: 'marker',
				geometry: {
					type: 'region',
					x: 100,
					y: 200,
					width: 300,
					height: 150,
				},
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('rejects invalid ref format', () => {
			const action = {
				action: 'marker',
				ref: 'invalid',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(false)
		})
	})

	describe('markers action', () => {
		test('validates basic markers list', () => {
			const action = { action: 'markers' }

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markers with format', () => {
			const action = {
				action: 'markers',
				format: 'markdown',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markers with tags filter', () => {
			const action = {
				action: 'markers',
				tags: ['responsive', 'v1'],
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markers with url filter', () => {
			const action = {
				action: 'markers',
				url: '/checkout',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markers with role filter', () => {
			const action = {
				action: 'markers',
				role: 'button',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markers with all filters', () => {
			const action = {
				action: 'markers',
				format: 'json',
				tags: ['test'],
				url: '/page',
				role: 'link',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})
	})

	describe('markerResolve action', () => {
		test('validates basic markerResolve', () => {
			const action = {
				action: 'markerResolve',
				id: '550e8400-e29b-41d4-a716-446655440000',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('validates markerResolve with tab', () => {
			const action = {
				action: 'markerResolve',
				id: '550e8400-e29b-41d4-a716-446655440000',
				tab: 0,
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})

		test('rejects markerResolve without id', () => {
			const action = {
				action: 'markerResolve',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(false)
		})

		test('rejects markerResolve with invalid uuid', () => {
			const action = {
				action: 'markerResolve',
				id: 'not-a-uuid',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(false)
		})
	})

	describe('markerCompare action', () => {
		test('validates markerCompare', () => {
			const action = {
				action: 'markerCompare',
				id1: '550e8400-e29b-41d4-a716-446655440000',
				id2: '550e8400-e29b-41d4-a716-446655440001',
			}

			const result = ActionSchema.safeParse(action)
			expect(result.success).toBe(true)
		})
	})
})
