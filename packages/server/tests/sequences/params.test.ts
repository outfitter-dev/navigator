/**
 * Variable Interpolation Tests
 *
 * Tests for {{varName}} parameter substitution in actions.
 */

import { describe, expect, test } from 'bun:test'
import {
	extractVariables,
	hasVariables,
	interpolateParams,
	interpolateString,
	validateParams,
} from '../../src/sequences/params'

describe('hasVariables', () => {
	test('returns true for strings with variables', () => {
		expect(hasVariables('Hello {{name}}')).toBe(true)
		expect(hasVariables('{{a}} and {{b}}')).toBe(true)
	})

	test('returns false for strings without variables', () => {
		expect(hasVariables('Hello world')).toBe(false)
		expect(hasVariables('No variables here')).toBe(false)
		expect(hasVariables('')).toBe(false)
	})

	test('returns false for malformed variable syntax', () => {
		expect(hasVariables('{{}')).toBe(false)
		expect(hasVariables('{name}')).toBe(false)
		expect(hasVariables('{{ name }}')).toBe(false) // No spaces allowed
		expect(hasVariables('{{123}}')).toBe(false) // Must start with letter
	})
})

describe('extractVariables', () => {
	test('extracts single variable', () => {
		expect(extractVariables('Hello {{name}}')).toEqual(['name'])
	})

	test('extracts multiple variables', () => {
		expect(extractVariables('{{first}} {{second}}')).toEqual([
			'first',
			'second',
		])
	})

	test('extracts variables with underscores and numbers', () => {
		expect(extractVariables('{{user_name}} {{item2}}')).toEqual([
			'user_name',
			'item2',
		])
	})

	test('returns empty array for no variables', () => {
		expect(extractVariables('No variables')).toEqual([])
	})

	test('extracts duplicate variables', () => {
		expect(extractVariables('{{a}} {{a}}')).toEqual(['a', 'a'])
	})
})

describe('interpolateString', () => {
	test('replaces single variable', () => {
		expect(interpolateString('Hello {{name}}', { name: 'World' })).toBe(
			'Hello World',
		)
	})

	test('replaces multiple variables', () => {
		expect(
			interpolateString('{{greeting}} {{name}}!', {
				greeting: 'Hello',
				name: 'World',
			}),
		).toBe('Hello World!')
	})

	test('leaves missing variables unchanged', () => {
		expect(interpolateString('Hello {{name}}', {})).toBe('Hello {{name}}')
	})

	test('converts non-string values to strings', () => {
		expect(interpolateString('Count: {{n}}', { n: 42 })).toBe('Count: 42')
		expect(interpolateString('Flag: {{b}}', { b: true })).toBe('Flag: true')
	})

	test('handles consecutive variables', () => {
		expect(interpolateString('{{a}}{{b}}', { a: 'X', b: 'Y' })).toBe('XY')
	})
})

describe('interpolateParams', () => {
	test('interpolates object properties', () => {
		const result = interpolateParams(
			{ name: '{{name}}', value: '{{value}}' },
			{ name: 'test', value: 'data' },
		)
		expect(result).toEqual({ name: 'test', value: 'data' })
	})

	test('interpolates nested objects', () => {
		const result = interpolateParams(
			{ outer: { inner: '{{v}}' } },
			{ v: 'nested' },
		)
		expect(result).toEqual({ outer: { inner: 'nested' } })
	})

	test('interpolates arrays', () => {
		const result = interpolateParams(
			{ items: ['{{a}}', '{{b}}'] },
			{ a: 'first', b: 'second' },
		)
		expect(result).toEqual({ items: ['first', 'second'] })
	})

	test('preserves non-string values', () => {
		const result = interpolateParams(
			{ str: '{{s}}', num: 42, bool: true, nil: null },
			{ s: 'text' },
		)
		expect(result).toEqual({ str: 'text', num: 42, bool: true, nil: null })
	})

	test('returns original data when no params provided', () => {
		const data = { text: '{{var}}' }
		expect(interpolateParams(data, undefined)).toEqual(data)
		expect(interpolateParams(data, {})).toEqual(data)
	})

	test('does not mutate original object', () => {
		const original = { text: '{{name}}' }
		interpolateParams(original, { name: 'test' })
		expect(original.text).toBe('{{name}}')
	})

	test('handles action-like objects', () => {
		const action = {
			action: 'fill',
			selector: '#email',
			value: '{{email}}',
			tab: 0,
		}
		const result = interpolateParams(action, { email: 'user@example.com' })
		expect(result).toEqual({
			action: 'fill',
			selector: '#email',
			value: 'user@example.com',
			tab: 0,
		})
	})

	test('handles circular references without infinite loop', () => {
		// Create a circular reference
		const obj: Record<string, unknown> = { text: '{{name}}' }
		obj.self = obj

		// Should not throw or hang
		const result = interpolateParams(obj, { name: 'test' })

		// Should interpolate the text but preserve circular ref
		expect(result.text).toBe('test')
		expect(result.self).toBe(obj) // Original ref preserved
	})
})

describe('validateParams', () => {
	test('returns empty array when all variables are provided', () => {
		const data = { text: '{{a}}', nested: { value: '{{b}}' } }
		expect(validateParams(data, { a: '1', b: '2' })).toEqual([])
	})

	test('returns missing variable names', () => {
		const data = { text: '{{a}}', value: '{{b}}' }
		expect(validateParams(data, { a: '1' })).toEqual(['b'])
	})

	test('deduplicates missing variables', () => {
		const data = { x: '{{a}}', y: '{{a}}' }
		expect(validateParams(data, {})).toEqual(['a'])
	})

	test('handles arrays', () => {
		const data = ['{{a}}', '{{b}}']
		expect(validateParams(data, { a: '1' })).toEqual(['b'])
	})

	test('handles deeply nested structures', () => {
		const data = {
			level1: {
				level2: {
					value: '{{deep}}',
				},
			},
		}
		expect(validateParams(data, {})).toEqual(['deep'])
	})
})
