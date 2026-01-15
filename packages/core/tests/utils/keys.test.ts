import { describe, expect, test } from 'bun:test'
import { parseKeyCombo } from '../../src/utils/keys'

describe('parseKeyCombo', () => {
	describe('single keys without modifiers', () => {
		test('parses Enter key', () => {
			const result = parseKeyCombo('Enter')
			expect(result).toEqual({ key: 'Enter', modifiers: [] })
		})

		test('parses Tab key', () => {
			const result = parseKeyCombo('Tab')
			expect(result).toEqual({ key: 'Tab', modifiers: [] })
		})

		test('parses ArrowDown key', () => {
			const result = parseKeyCombo('ArrowDown')
			expect(result).toEqual({ key: 'ArrowDown', modifiers: [] })
		})
	})

	describe('key normalization', () => {
		test('normalizes esc to Escape', () => {
			const result = parseKeyCombo('esc')
			expect(result).toEqual({ key: 'Escape', modifiers: [] })
		})

		test('normalizes Esc to Escape (case insensitive)', () => {
			const result = parseKeyCombo('Esc')
			expect(result).toEqual({ key: 'Escape', modifiers: [] })
		})
	})

	describe('modifier key normalization', () => {
		test('parses ctrl-k with hyphen separator', () => {
			const result = parseKeyCombo('ctrl-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Control'] })
		})

		test('parses ctrl+k with plus separator', () => {
			const result = parseKeyCombo('ctrl+k')
			expect(result).toEqual({ key: 'k', modifiers: ['Control'] })
		})

		test('normalizes cmd to Meta', () => {
			const result = parseKeyCombo('cmd-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Meta'] })
		})

		test('normalizes meta to Meta', () => {
			const result = parseKeyCombo('meta-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Meta'] })
		})

		test('normalizes win to Meta', () => {
			const result = parseKeyCombo('win-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Meta'] })
		})

		test('normalizes control to Control', () => {
			const result = parseKeyCombo('control-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Control'] })
		})

		test('normalizes alt to Alt', () => {
			const result = parseKeyCombo('alt-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Alt'] })
		})

		test('normalizes shift to Shift', () => {
			const result = parseKeyCombo('shift-k')
			expect(result).toEqual({ key: 'k', modifiers: ['Shift'] })
		})
	})

	describe('multiple modifiers', () => {
		test('parses ctrl-shift-p', () => {
			const result = parseKeyCombo('ctrl-shift-p')
			expect(result).toEqual({ key: 'p', modifiers: ['Control', 'Shift'] })
		})

		test('parses cmd-shift-p', () => {
			const result = parseKeyCombo('cmd-shift-p')
			expect(result).toEqual({ key: 'p', modifiers: ['Meta', 'Shift'] })
		})

		test('parses ctrl+alt+del', () => {
			const result = parseKeyCombo('ctrl+alt+del')
			expect(result).toEqual({ key: 'del', modifiers: ['Control', 'Alt'] })
		})

		test('parses cmd-shift-alt-k', () => {
			const result = parseKeyCombo('cmd-shift-alt-k')
			expect(result).toEqual({
				key: 'k',
				modifiers: ['Meta', 'Shift', 'Alt'],
			})
		})
	})

	describe('case handling', () => {
		test('handles uppercase modifiers', () => {
			const result = parseKeyCombo('Ctrl-K')
			expect(result).toEqual({ key: 'K', modifiers: ['Control'] })
		})

		test('handles mixed case modifiers', () => {
			const result = parseKeyCombo('CMD-SHIFT-P')
			expect(result).toEqual({ key: 'P', modifiers: ['Meta', 'Shift'] })
		})
	})
})
