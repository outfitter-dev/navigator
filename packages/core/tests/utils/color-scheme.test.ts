import { describe, expect, test } from 'bun:test'
import { normalizeColorScheme } from '../../src/utils/color-scheme'

describe('normalizeColorScheme', () => {
	describe('pass-through values', () => {
		test('returns light unchanged', () => {
			const result = normalizeColorScheme('light')
			expect(result).toBe('light')
		})

		test('returns dark unchanged', () => {
			const result = normalizeColorScheme('dark')
			expect(result).toBe('dark')
		})

		test('returns no-preference unchanged', () => {
			const result = normalizeColorScheme('no-preference')
			expect(result).toBe('no-preference')
		})
	})

	describe('alias normalization', () => {
		test('normalizes system to no-preference', () => {
			const result = normalizeColorScheme('system')
			expect(result).toBe('no-preference')
		})
	})
})
