/**
 * MCP Schema Tests for Sequence Action
 *
 * Tests that sequence actions parse correctly through the MCP schema.
 */

import { describe, expect, test } from 'bun:test'
import { navigatorActionSchema } from '../../../mcp/src/schema'

describe('MCP Schema - Sequence Action', () => {
	test('parses simple sequence', () => {
		const input = {
			action: 'sequence',
			steps: [
				{ action: 'navigate', url: 'https://example.com' },
				{ action: 'snap' },
			],
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('sequence')
		}
	})

	test('parses sequence with params', () => {
		const input = {
			action: 'sequence',
			steps: [
				{ action: 'type', selector: '#email', text: '{{email}}' },
				{ action: 'click', selector: 'button[type="submit"]' },
			],
			params: { email: 'test@example.com' },
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('sequence')
			expect(
				(result.data as { params?: Record<string, unknown> }).params,
			).toEqual({
				email: 'test@example.com',
			})
		}
	})

	test('parses sequence with stopOnError', () => {
		const input = {
			action: 'sequence',
			steps: [{ action: 'navigate', url: 'https://example.com' }],
			stopOnError: false,
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect((result.data as { stopOnError: boolean }).stopOnError).toBe(false)
		}
	})

	test('parses sequence with name', () => {
		const input = {
			action: 'sequence',
			steps: [{ action: 'snap' }],
			name: 'test-sequence',
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect((result.data as { name?: string }).name).toBe('test-sequence')
		}
	})

	test('rejects empty steps array', () => {
		const input = {
			action: 'sequence',
			steps: [],
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(false)
	})

	test('rejects missing steps', () => {
		const input = {
			action: 'sequence',
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(false)
	})

	test('defaults stopOnError to true', () => {
		const input = {
			action: 'sequence',
			steps: [{ action: 'snap' }],
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect((result.data as { stopOnError: boolean }).stopOnError).toBe(true)
		}
	})

	test('parses complex multi-step sequence', () => {
		const input = {
			action: 'sequence',
			steps: [
				{ action: 'navigate', url: 'https://example.com/login' },
				{ action: 'fill', selector: '#email', value: '{{email}}' },
				{ action: 'fill', selector: '#password', value: '{{password}}' },
				{ action: 'click', selector: 'button[type="submit"]' },
				{ action: 'waitFor', selector: '.dashboard', state: 'visible' },
				{ action: 'snap' },
			],
			params: {
				email: 'user@example.com',
				password: 'secret',
			},
			name: 'login-flow',
		}

		const result = navigatorActionSchema.safeParse(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('sequence')
			const data = result.data as {
				steps: unknown[]
				params: Record<string, unknown>
				name: string
			}
			expect(data.steps.length).toBe(6)
			expect(data.params.email).toBe('user@example.com')
			expect(data.name).toBe('login-flow')
		}
	})
})
